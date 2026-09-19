import {
  Router,
  type NextFunction,
  type Request,
  type Response,
} from "express";
import { and, eq, inArray, notLike, or } from "drizzle-orm";
import {
  activityLogTable,
  db,
  syncMutationsTable,
  syncRecordsTable,
  uploadsTable,
  usersTable,
  type SyncRecord,
  type User,
} from "@workspace/db";
import { toAuthUser, toDirectoryAuthUser } from "../lib/auth";
import { requireAuth } from "../middlewares/auth";
import {
  normalizeCreativeMediaFields,
  normalizeCreativeMediaModerationWorkflow,
  preserveCreativeMediaAuthorship,
  publicMediaUploadId,
} from "../lib/creative-media";
import {
  activityAuditValues,
  syncRecordAuditEvent,
} from "../lib/activity-audit";
import { sameJsonWithResolvedUserReferences } from "../lib/sync-reference-compare";
import { memberRecordWriteError } from "../lib/member-sync-policy";

const router = Router();

const MAX_MUTATIONS_PER_REQUEST = 100;
const MAX_DATA_DEPTH = 32;

type Scope = "global" | "sanggar" | "personal" | "shared";
type MutationOp = "upsert" | "delete";
type JsonObject = Record<string, unknown>;

interface MutationInput {
  mutationId: string;
  collection: string;
  id: string;
  op: MutationOp;
  baseRevision?: number;
  data?: JsonObject;
}

interface RecordResponse {
  collection: string;
  id: string;
  data: JsonObject;
  revision: number;
  deletedAt?: string;
}

interface MutationResult {
  mutationId: string;
  status: "applied" | "conflict" | "rejected";
  record?: RecordResponse;
  error?: string;
}

interface ScopeInfo {
  scope: Scope;
  ownerId: string;
  participantIds: string[];
}

interface ResolvedReferences {
  /** Semua user id server yang dirujuk data. */
  ids: Set<string>;
  /** Bentuk token/ID persis seperti data -> user id server. */
  byRawValue: Map<string, string>;
}

function syncMutationAuditEvent(input: {
  actor: User;
  mutation: MutationInput;
  operation: "create" | "update" | "delete";
  before?: JsonObject;
  after?: JsonObject;
}) {
  return syncRecordAuditEvent({
    actor: input.actor,
    collection: input.mutation.collection,
    recordId: input.mutation.id,
    operation: input.operation,
    before: input.before,
    after: input.after,
  });
}

class InputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InputError";
  }
}

// Hanya koleksi app yang aman untuk disinkronkan. Akun, password, sesi, dan
// settings sensitif sengaja tidak pernah melewati endpoint generik ini.
const GLOBAL_COLLECTIONS = new Set(["news", "banners", "slider", "infoBudaya"]);

const SANGGAR_COLLECTIONS = new Set([
  "latihan",
  "iuran",
  "pengajuanHonor",
  "distribusi",
  "transaksi",
  "kas",
  "pendaftaranPembinaan",
  "absensiPembinaan",
  "aset",
  "sarpras",
  "kurasiSubmissions",
  "dokumenArsip",
  "paketIsian",
]);

const PERSONAL_COLLECTIONS = new Set([
  "absensiLatihan",
  // Log aktivitas diperlakukan append-only milik aktor. Ia tidak ikut ke
  // collection global karena riwayat pengguna lain tidak boleh terekspos.
  "activity",
]);

const ALLOWED_COLLECTIONS = new Set([
  ...GLOBAL_COLLECTIONS,
  ...SANGGAR_COLLECTIONS,
  ...PERSONAL_COLLECTIONS,
  "penugasanJuri",
  "sertifikat",
  "kerjasama",
  "chatMessages",
  "negosiasi",
  "invoices",
  "payments",
  "contracts",
  "bast",
  "ratings",
  "pemesananSewa",
  "kerjasamaMitraPengrajin",
  "pesananProdukPengrajin",
]);

const PROTECTED_TRANSACTION_COLLECTIONS = new Set([
  "kerjasama",
  "pemesananSewa",
  "kerjasamaMitraPengrajin",
  "pesananProdukPengrajin",
  "chatMessages",
  "negosiasi",
  "invoices",
  "payments",
  "contracts",
  "bast",
  "ratings",
]);

function canDeleteOrderAsCancellation(
  record: SyncRecord,
  actor: User,
): boolean {
  const status = String(record.data["status"] ?? "");
  const isParticipant = participantsOf(record).includes(actor.id);

  if (record.collection === "kerjasama") {
    return (
      actor.role === "sanggar" &&
      isParticipant &&
      record.ownerId !== actor.id &&
      ["menunggu", "negosiasi", "diterima", "berjalan", "batal"].includes(
        status,
      )
    );
  }
  if (record.collection === "pemesananSewa") {
    return (
      (actor.role === "sewa" || actor.role === "mitra_pengrajin") &&
      isParticipant &&
      ["menunggu_sanggar", "menunggu_sdm", "menunggu_ttd", "batal"].includes(
        status,
      )
    );
  }
  if (record.collection === "pesananProdukPengrajin") {
    return (
      actor.role === "mitra_pengrajin" &&
      isParticipant &&
      [
        "menunggu_ongkir",
        "menunggu_persetujuan_ongkir",
        "diajukan",
        "menunggu_ttd",
        "batal",
      ].includes(status)
    );
  }
  return false;
}

// Koleksi turunan mewarisi scope dari parent, sehingga pesan atau bukti bayar
// tidak tiba-tiba hanya bisa dibaca pengirimnya sendiri.
const PARENT_RULES: Record<string, { field: string; parents: string[] }> = {
  chatMessages: { field: "kerjasamaId", parents: ["kerjasama"] },
  negosiasi: { field: "kerjasamaId", parents: ["kerjasama"] },
  invoices: { field: "kerjasamaId", parents: ["kerjasama", "pemesananSewa"] },
  contracts: { field: "kerjasamaId", parents: ["kerjasama", "pemesananSewa"] },
  bast: { field: "kerjasamaId", parents: ["kerjasama", "pemesananSewa"] },
  ratings: { field: "kerjasamaId", parents: ["kerjasama"] },
  payments: { field: "invoiceId", parents: ["invoices"] },
};

// Semua ini adalah foreign key ke akun, bukan ke entitas bisnis lain seperti
// latihanId atau invoiceId. Data lintas perangkat mengirimnya sebagai
// `user:<apiId>` atau `username:<encoded username>`.
const USER_REFERENCE_KEYS = new Set([
  "sanggarId",
  "sanggarPenyediaId",
  "sanggarPeminjamId",
  "sanggarUsername",
  "pelatihId",
  "senimanId",
  "juriId",
  "sewaId",
  "mitraId",
  "pengrajinId",
  "sdmUserId",
  "userId",
  "penerimaId",
  "pesertaId",
  "delegasiId",
  "pemilikId",
  "authorId",
  "actorId",
  "senderId",
  "pengirimSanggarId",
  "pengirimUserId",
  "dariSanggarId",
  "validatedByAdminId",
  "diserahkanOlehId",
  "diajukanOlehId",
  "diperiksaOlehId",
]);

function isObject(value: unknown): value is JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isSafeIdentifier(value: unknown, maxLength: number): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= maxLength &&
    /^[A-Za-z0-9._:@/-]+$/.test(value)
  );
}

function normalizeScope(value: string): Scope {
  if (
    value === "global" ||
    value === "sanggar" ||
    value === "personal" ||
    value === "shared"
  ) {
    return value;
  }
  // Fail closed for rows produced by an older/invalid deployment.
  return "personal";
}

function participantsOf(record: Pick<SyncRecord, "participantIds">): string[] {
  return Array.isArray(record.participantIds)
    ? [
        ...new Set(
          record.participantIds.filter(
            (id): id is string => typeof id === "string",
          ),
        ),
      ]
    : [];
}

function isOverseer(user: User): boolean {
  return user.role === "kurator" || user.role === "admin";
}

function toIso(value: Date | string): string {
  return (value instanceof Date ? value : new Date(value)).toISOString();
}

function toRecordResponse(
  record: Pick<
    SyncRecord,
    "collection" | "recordId" | "data" | "revision" | "deletedAt"
  >,
): RecordResponse {
  const response: RecordResponse = {
    collection: record.collection,
    id: record.recordId,
    data: record.data,
    revision: record.revision,
  };
  if (record.deletedAt) response.deletedAt = toIso(record.deletedAt);
  return response;
}

function rejected(mutationId: string, error: string): MutationResult {
  return { mutationId, status: "rejected", error };
}

function isDuplicateError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "ER_DUP_ENTRY"
  );
}

function parseMutation(value: unknown): MutationInput {
  if (!isObject(value)) throw new InputError("Format mutasi tidak valid.");
  const mutationId = value["mutationId"];
  const collection = value["collection"];
  const id = value["id"];
  const op = value["op"];
  const baseRevision = value["baseRevision"];
  const data = value["data"];

  if (!isSafeIdentifier(mutationId, 128))
    throw new InputError("mutationId tidak valid.");
  if (
    !isSafeIdentifier(collection, 64) ||
    !ALLOWED_COLLECTIONS.has(collection)
  ) {
    throw new InputError("Koleksi tidak diizinkan untuk sinkronisasi.");
  }
  if (!isSafeIdentifier(id, 191))
    throw new InputError("Id record tidak valid.");
  if (op !== "upsert" && op !== "delete")
    throw new InputError("Operasi tidak valid.");
  let parsedBaseRevision: number | undefined;
  if (baseRevision !== undefined) {
    if (
      typeof baseRevision !== "number" ||
      !Number.isInteger(baseRevision) ||
      baseRevision < 0
    ) {
      throw new InputError("baseRevision tidak valid.");
    }
    parsedBaseRevision = baseRevision;
  }
  if (op === "upsert") {
    if (!isObject(data))
      throw new InputError("Data record wajib berupa objek.");
    assertSafeJson(data, 0);
  }

  return {
    mutationId,
    collection,
    id,
    op,
    ...(parsedBaseRevision === undefined
      ? {}
      : { baseRevision: parsedBaseRevision }),
    ...(op === "upsert" ? { data: data as JsonObject } : {}),
  };
}

/** Cegah payload JSON yang tidak dapat diserialisasi dengan aman/terlalu dalam. */
function assertSafeJson(value: unknown, depth: number): void {
  if (depth > MAX_DATA_DEPTH) throw new InputError("Data terlalu dalam.");
  if (value === null || typeof value === "string" || typeof value === "boolean")
    return;
  if (typeof value === "number") {
    if (!Number.isFinite(value))
      throw new InputError("Data angka tidak valid.");
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) assertSafeJson(item, depth + 1);
    return;
  }
  if (isObject(value)) {
    for (const [key, item] of Object.entries(value)) {
      if (key === "__proto__" || key === "prototype" || key === "constructor") {
        throw new InputError("Nama field tidak diizinkan.");
      }
      assertSafeJson(item, depth + 1);
    }
    return;
  }
  throw new InputError("Tipe data tidak didukung.");
}

interface ReferenceCandidates {
  userIds: Set<string>;
  usernames: Set<string>;
  rawTokens: Set<string>;
  directIds: Set<string>;
}

function newReferenceCandidates(): ReferenceCandidates {
  return {
    userIds: new Set<string>(),
    usernames: new Set<string>(),
    rawTokens: new Set<string>(),
    directIds: new Set<string>(),
  };
}

function usernameFromToken(value: string): string | null {
  if (!value.startsWith("username:")) return null;
  try {
    const username = decodeURIComponent(value.slice("username:".length)).trim();
    return username.length > 0 && username.length <= 191 ? username : null;
  } catch {
    return null;
  }
}

function collectToken(value: string, candidates: ReferenceCandidates): void {
  if (value.startsWith("user:")) {
    const id = value.slice("user:".length);
    if (!isSafeIdentifier(id, 64))
      throw new InputError("Referensi user tidak valid.");
    candidates.userIds.add(id);
    candidates.rawTokens.add(value);
    return;
  }
  const username = usernameFromToken(value);
  if (username !== null) {
    candidates.usernames.add(username);
    candidates.rawTokens.add(value);
  }
}

function collectUserReferenceCandidates(
  value: unknown,
  parentKey: string | undefined,
  candidates: ReferenceCandidates,
  depth = 0,
): void {
  if (depth > MAX_DATA_DEPTH) throw new InputError("Data terlalu dalam.");
  if (typeof value === "string") {
    collectToken(value, candidates);
    if (
      parentKey &&
      USER_REFERENCE_KEYS.has(parentKey) &&
      !value.startsWith("user:") &&
      !value.startsWith("username:")
    ) {
      candidates.directIds.add(value);
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value)
      collectUserReferenceCandidates(item, parentKey, candidates, depth + 1);
    return;
  }
  if (!isObject(value)) return;
  for (const [key, item] of Object.entries(value)) {
    // Nilai scores/finalized menggunakan user token sebagai object key.
    collectToken(key, candidates);
    collectUserReferenceCandidates(item, key, candidates, depth + 1);
  }
}

async function resolveUserReferences(
  data: JsonObject,
): Promise<ResolvedReferences> {
  const candidates = newReferenceCandidates();
  collectUserReferenceCandidates(data, undefined, candidates);

  if (
    candidates.userIds.size === 0 &&
    candidates.usernames.size === 0 &&
    candidates.directIds.size === 0
  ) {
    return { ids: new Set<string>(), byRawValue: new Map<string, string>() };
  }

  const idValues = [
    ...new Set([...candidates.userIds, ...candidates.directIds]),
  ];
  const usernameValues = [...candidates.usernames];
  let rows: User[];
  if (idValues.length > 0 && usernameValues.length > 0) {
    rows = await db
      .select()
      .from(usersTable)
      .where(
        or(
          inArray(usersTable.id, idValues),
          inArray(usersTable.username, usernameValues),
        ),
      );
  } else if (idValues.length > 0) {
    rows = await db
      .select()
      .from(usersTable)
      .where(inArray(usersTable.id, idValues));
  } else {
    rows = await db
      .select()
      .from(usersTable)
      .where(inArray(usersTable.username, usernameValues));
  }

  const byId = new Map(rows.map((row) => [row.id, row]));
  const byUsername = new Map(
    rows.map((row) => [row.username.toLowerCase(), row]),
  );
  const byRawValue = new Map<string, string>();
  const ids = new Set<string>();

  for (const token of candidates.rawTokens) {
    if (token.startsWith("user:")) {
      const id = token.slice("user:".length);
      if (!byId.has(id))
        throw new InputError("Referensi user tidak ditemukan.");
      byRawValue.set(token, id);
      ids.add(id);
      continue;
    }
    const username = usernameFromToken(token);
    const user = username ? byUsername.get(username.toLowerCase()) : undefined;
    if (!user) throw new InputError("Referensi username tidak ditemukan.");
    byRawValue.set(token, user.id);
    ids.add(user.id);
  }

  for (const directId of candidates.directIds) {
    const user = byId.get(directId);
    if (!user)
      throw new InputError(
        "Referensi user harus memakai id server yang valid.",
      );
    byRawValue.set(directId, user.id);
    ids.add(user.id);
  }

  return { ids, byRawValue };
}

function userIdForField(
  data: JsonObject,
  field: string,
  refs: ResolvedReferences,
): string | undefined {
  const value = data[field];
  return typeof value === "string" ? refs.byRawValue.get(value) : undefined;
}

function requiredUserId(
  data: JsonObject,
  field: string,
  refs: ResolvedReferences,
): string {
  const id = userIdForField(data, field, refs);
  if (!id)
    throw new InputError(`${field} wajib berupa referensi user yang valid.`);
  return id;
}

function uniqueIds(values: Iterable<string>): string[] {
  return [...new Set([...values].filter((value) => value.length > 0))];
}

async function inheritedScope(
  collection: string,
  data: JsonObject,
): Promise<ScopeInfo | null> {
  const rule = PARENT_RULES[collection];
  if (!rule) return null;
  const relatedId = data[rule.field];
  if (!isSafeIdentifier(relatedId, 191)) {
    throw new InputError(
      `${rule.field} wajib diisi dengan id record yang valid.`,
    );
  }
  for (const parentCollection of rule.parents) {
    const rows = await db
      .select()
      .from(syncRecordsTable)
      .where(
        and(
          eq(syncRecordsTable.collection, parentCollection),
          eq(syncRecordsTable.recordId, relatedId),
        ),
      )
      .limit(1);
    const parent = rows[0];
    if (parent && !parent.deletedAt) {
      return {
        scope: normalizeScope(parent.scope),
        ownerId: parent.ownerId,
        participantIds: participantsOf(parent),
      };
    }
  }
  throw new InputError("Record induk tidak ditemukan atau sudah dihapus.");
}

async function deriveScope(
  collection: string,
  data: JsonObject,
  refs: ResolvedReferences,
  actor: User,
): Promise<ScopeInfo> {
  if (collection === "infoBudaya") {
    const authorId = requiredUserId(data, "authorId", refs);
    return {
      scope: "global",
      ownerId: authorId,
      participantIds: uniqueIds([...refs.ids, authorId]),
    };
  }
  if (GLOBAL_COLLECTIONS.has(collection)) {
    // Tetap simpan referensi author/aktor agar bootstrap dapat mengirim
    // identitas yang dibutuhkan client untuk merender konten global.
    return {
      scope: "global",
      ownerId: actor.id,
      participantIds: uniqueIds(refs.ids),
    };
  }

  const inherited = await inheritedScope(collection, data);
  if (inherited) return inherited;

  if (collection === "penugasanJuri") {
    const juriId = requiredUserId(data, "juriId", refs);
    const sanggarId = requiredUserId(data, "sanggarId", refs);
    return {
      scope: "shared",
      ownerId: actor.id,
      participantIds: uniqueIds([juriId, sanggarId]),
    };
  }

  if (collection === "kerjasama") {
    const sanggarPenyediaId = requiredUserId(data, "sanggarPenyediaId", refs);
    const sanggarPeminjamId = requiredUserId(data, "sanggarPeminjamId", refs);
    return {
      scope: "shared",
      ownerId: sanggarPenyediaId,
      participantIds: uniqueIds([
        sanggarPenyediaId,
        sanggarPeminjamId,
        ...refs.ids,
      ]),
    };
  }

  if (collection === "pemesananSewa") {
    const sewaId = requiredUserId(data, "sewaId", refs);
    const sanggarId = requiredUserId(data, "sanggarId", refs);
    const sdmUserId = userIdForField(data, "sdmUserId", refs);
    return {
      scope: "shared",
      ownerId: sanggarId,
      participantIds: uniqueIds([
        sewaId,
        sanggarId,
        ...(sdmUserId ? [sdmUserId] : []),
      ]),
    };
  }

  if (
    collection === "kerjasamaMitraPengrajin" ||
    collection === "pesananProdukPengrajin"
  ) {
    const mitraId = requiredUserId(data, "mitraId", refs);
    const pengrajinId = requiredUserId(data, "pengrajinId", refs);
    return {
      scope: "shared",
      ownerId: pengrajinId,
      participantIds: uniqueIds([mitraId, pengrajinId]),
    };
  }

  if (collection === "sertifikat") {
    const pemilikId = userIdForField(data, "pemilikId", refs);
    const sanggarId = userIdForField(data, "sanggarId", refs);
    const ownerId = pemilikId ?? sanggarId;
    if (!ownerId)
      throw new InputError("Sertifikat wajib memiliki pemilik atau sanggar.");
    return {
      scope: "personal",
      ownerId,
      participantIds: uniqueIds([...refs.ids, ownerId]),
    };
  }

  if (PERSONAL_COLLECTIONS.has(collection)) {
    const ownerField = collection === "absensiLatihan" ? "userId" : "actorId";
    const ownerId = requiredUserId(data, ownerField, refs);
    return {
      scope: "personal",
      ownerId,
      participantIds: uniqueIds([...refs.ids, ownerId]),
    };
  }

  if (SANGGAR_COLLECTIONS.has(collection)) {
    const sanggarId = requiredUserId(data, "sanggarId", refs);
    return {
      scope: "sanggar",
      ownerId: sanggarId,
      participantIds: uniqueIds([...refs.ids, sanggarId]),
    };
  }

  throw new InputError("Koleksi belum memiliki aturan scope.");
}

async function prepareCreativeMediaData(
  collection: string,
  data: JsonObject,
  actor: User,
): Promise<JsonObject> {
  if (collection !== "infoBudaya") return data;

  const prepared = normalizeCreativeMediaModerationWorkflow(
    data,
    isOverseer(actor),
  );

  const mediaUrl = prepared["mediaUrl"];
  if (
    mediaUrl !== undefined &&
    (typeof mediaUrl !== "string" || mediaUrl.length > 2_048)
  ) {
    throw new InputError("URL media tidak valid.");
  }
  const mediaContentType = prepared["mediaContentType"];
  if (
    mediaContentType !== undefined &&
    (typeof mediaContentType !== "string" || mediaContentType.length > 191)
  ) {
    throw new InputError("Content type media tidak valid.");
  }

  const uploadId = publicMediaUploadId(mediaUrl);
  if (!uploadId) return normalizeCreativeMediaFields(prepared);

  const uploads = await db
    .select({
      id: uploadsTable.id,
      uploaderId: uploadsTable.uploaderId,
      contentType: uploadsTable.contentType,
    })
    .from(uploadsTable)
    .where(eq(uploadsTable.id, uploadId))
    .limit(1);
  const upload = uploads[0];
  if (!upload) throw new InputError("Berkas media tidak ditemukan.");
  if (!isOverseer(actor) && upload.uploaderId !== actor.id) {
    throw new InputError("Berkas media bukan milik akun ini.");
  }
  return normalizeCreativeMediaFields(prepared, upload);
}

function validCoordinate(
  value: unknown,
  min: number,
  max: number,
): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= min &&
    value <= max
  );
}

function operationalDistanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const radians = (value: number) => (value * Math.PI) / 180;
  const dLat = radians(lat2 - lat1);
  const dLng = radians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function assertEvidenceShape(
  evidence: unknown,
): asserts evidence is JsonObject {
  if (!isObject(evidence))
    throw new InputError("Bukti foto dan GPS wajib dilampirkan.");
  const photo = evidence["fotoDataUrl"];
  const timestamp = evidence["timestamp"] ?? evidence["ts"];
  const accuracy = evidence["accuracy"];
  if (
    typeof photo !== "string" ||
    !photo.startsWith("data:image/jpeg;base64,") ||
    photo.length > 1_500_000
  ) {
    throw new InputError(
      "Bukti harus berupa foto JPEG yang valid dan berukuran wajar.",
    );
  }
  if (
    typeof timestamp !== "number" ||
    !Number.isFinite(timestamp) ||
    timestamp <= 0
  ) {
    throw new InputError("Waktu bukti tidak valid.");
  }
  if (
    !validCoordinate(evidence["lat"], -90, 90) ||
    !validCoordinate(evidence["lng"], -180, 180)
  ) {
    throw new InputError("Koordinat GPS tidak valid.");
  }
  if (
    typeof accuracy !== "number" ||
    !Number.isFinite(accuracy) ||
    accuracy <= 0 ||
    accuracy > 150
  ) {
    throw new InputError("Akurasi GPS harus maksimal 150 meter.");
  }
}

function assertOperationalRecord(
  collection: string,
  data: JsonObject,
  actor: User,
  previous?: JsonObject,
): void {
  if (collection === "absensiPembinaan") {
    if (!["pagi", "siang", "pulang"].includes(String(data["slot"] ?? ""))) {
      throw new InputError("Slot absensi pembinaan tidak valid.");
    }
    assertEvidenceShape(data);
    return;
  }
  if (collection !== "latihan") return;
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(String(data["tanggal"] ?? "")) ||
    !/^\d{2}:\d{2}$/.test(String(data["jam"] ?? "")) ||
    typeof data["tempat"] !== "string" ||
    !data["tempat"].trim() ||
    typeof data["kurikulum"] !== "string" ||
    !data["kurikulum"].trim()
  ) {
    throw new InputError("Data jadwal latihan tidak lengkap.");
  }
  if (
    previous?.["laporan"] !== undefined &&
    !sameJson(previous["laporan"], data["laporan"])
  ) {
    throw new InputError(
      "Laporan latihan yang sudah dikirim tidak boleh diubah.",
    );
  }
  if (previous?.["laporan"] !== undefined && !sameJson(previous, data)) {
    throw new InputError("Jadwal terkunci setelah laporan latihan dikirim.");
  }
  if (data["laporan"] === undefined) return;
  assertEvidenceShape(data["laporan"]);
  if (
    previous &&
    previous["laporan"] === undefined &&
    !onlyAllowedFieldsChanged(previous, data, new Set(["laporan"]))
  ) {
    throw new InputError("Jadwal dan laporan tidak boleh diubah bersamaan.");
  }
  const report = data["laporan"] as JsonObject;
  const scheduledAt = Date.parse(
    `${String(data["tanggal"])}T${String(data["jam"])}:00`,
  );
  const reportAt = Number(report["timestamp"]);
  if (
    !Number.isFinite(scheduledAt) ||
    reportAt < scheduledAt - 2 * 60 * 60_000 ||
    reportAt > scheduledAt + 12 * 60 * 60_000
  ) {
    throw new InputError(
      "Laporan berada di luar jendela waktu jadwal latihan.",
    );
  }
  const profile = isObject(actor.profile) ? actor.profile : {};
  if (
    validCoordinate(profile["lat"], -90, 90) &&
    validCoordinate(profile["lng"], -180, 180) &&
    operationalDistanceMeters(
      profile["lat"],
      profile["lng"],
      report["lat"] as number,
      report["lng"] as number,
    ) > 500
  ) {
    throw new InputError(
      "Lokasi laporan lebih dari 500 meter dari titik Sanggar.",
    );
  }
}

function canRead(record: SyncRecord, actor: User): boolean {
  if (isOverseer(actor)) return true;
  if (normalizeScope(record.scope) === "global") return true;
  return (
    record.ownerId === actor.id || participantsOf(record).includes(actor.id)
  );
}

function canMutateExisting(record: SyncRecord, actor: User): boolean {
  if (isOverseer(actor)) return true;
  if (record.collection === "activity") return false;
  if ((actor.role === "seniman" || actor.role === "pelatih") && ["iuran", "distribusi"].includes(record.collection)) return participantsOf(record).includes(actor.id);
  // Karya budaya tetap global supaya bisa ditayangkan ke publik, tetapi
  // sanggar hanya boleh mengubah atau menarik kiriman miliknya sendiri.
  if (record.collection === "infoBudaya") {
    return actor.role === "sanggar" && record.ownerId === actor.id;
  }
  const scope = normalizeScope(record.scope);
  if (scope === "global") return false;
  if (scope === "sanggar")
    return actor.role === "sanggar" && record.ownerId === actor.id;
  if (scope === "personal") return record.ownerId === actor.id;
  // Koleksi transaksi shared tetap mengikuti peran domain. Scope saja tidak
  // cukup: seluruh peserta boleh membaca, tetapi tidak otomatis boleh menulis.
  if (record.collection === "chatMessages")
    return record.createdBy === actor.id;
  if (record.collection === "invoices")
    return actor.role === "sanggar" && record.ownerId === actor.id;
  if (record.collection === "payments")
    return actor.role === "sanggar" && record.ownerId === actor.id;
  if (record.collection === "negosiasi")
    return (
      actor.role === "sanggar" &&
      record.createdBy !== actor.id &&
      participantsOf(record).includes(actor.id)
    );
  if (record.collection === "contracts" || record.collection === "ratings")
    return false;
  if (record.collection === "bast")
    return (
      actor.role === "sanggar" && participantsOf(record).includes(actor.id)
    );
  return participantsOf(record).includes(actor.id);
}

function canCreate(
  collection: string,
  scope: ScopeInfo,
  actor: User,
  data: JsonObject,
  refs: ResolvedReferences,
): boolean {
  if (isOverseer(actor)) return true;
  if (collection === "infoBudaya") {
    const status = data["publicationStatus"];
    return (
      actor.role === "sanggar" &&
      scope.ownerId === actor.id &&
      userIdForField(data, "authorId", refs) === actor.id &&
      data["active"] === false &&
      (status === "draft" || status === "pending")
    );
  }
  if (
    GLOBAL_COLLECTIONS.has(collection) ||
    collection === "penugasanJuri" ||
    collection === "sertifikat"
  ) {
    return false;
  }
  if (SANGGAR_COLLECTIONS.has(collection)) {
    if (collection === "pengajuanHonor" && actor.role === "pelatih") return userIdForField(data, "pelatihId", refs) === actor.id && data["status"] === "pending";
    return actor.role === "sanggar" && actor.id === scope.ownerId;
  }
  if (PERSONAL_COLLECTIONS.has(collection)) return actor.id === scope.ownerId;
  if (collection === "kerjasama") {
    return (
      actor.role === "sanggar" &&
      userIdForField(data, "sanggarPeminjamId", refs) === actor.id
    );
  }
  if (collection === "pemesananSewa") {
    const pemesanRole = String(data["pemesanRole"] ?? "sewa");
    return (
      (actor.role === "sewa" || actor.role === "mitra_pengrajin") &&
      actor.role === pemesanRole &&
      userIdForField(data, "sewaId", refs) === actor.id &&
      data["status"] === "menunggu_sanggar" &&
      Array.isArray(data["ttd"]) &&
      data["ttd"].length === 0 &&
      data["invoiceId"] === undefined &&
      data["bastId"] === undefined &&
      data["penyerahanSewa"] === undefined &&
      data["pengembalianSewa"] === undefined
    );
  }
  if (collection === "pesananProdukPengrajin") {
    return (
      actor.role === "mitra_pengrajin" &&
      userIdForField(data, "mitraId", refs) === actor.id
    );
  }
  if (collection === "kerjasamaMitraPengrajin") {
    return (
      actor.role === "pengrajin" &&
      userIdForField(data, "pengrajinId", refs) === actor.id
    );
  }
  if (collection === "chatMessages") {
    return (
      scope.participantIds.includes(actor.id) &&
      userIdForField(data, "senderId", refs) === actor.id
    );
  }
  if (collection === "negosiasi") {
    return (
      actor.role === "sanggar" &&
      scope.participantIds.includes(actor.id) &&
      userIdForField(data, "pengirimSanggarId", refs) === actor.id
    );
  }
  if (collection === "ratings") {
    return (
      actor.role === "sanggar" &&
      scope.participantIds.includes(actor.id) &&
      userIdForField(data, "dariSanggarId", refs) === actor.id
    );
  }
  if (collection === "invoices") {
    return actor.role === "sanggar" && scope.ownerId === actor.id;
  }
  if (collection === "payments") {
    return (
      (actor.role === "sanggar" || actor.role === "sewa") &&
      scope.ownerId !== actor.id &&
      scope.participantIds.includes(actor.id)
    );
  }
  if (collection === "bast") {
    return actor.role === "sanggar" && scope.participantIds.includes(actor.id);
  }
  return scope.participantIds.includes(actor.id);
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function onlyAllowedFieldsChanged(
  before: JsonObject,
  after: JsonObject,
  allowed: ReadonlySet<string>,
  refs?: ResolvedReferences,
): boolean {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const key of keys) {
    if (
      !allowed.has(key) &&
      !(refs
        ? sameJsonWithResolvedUserReferences({
            left: before[key],
            right: after[key],
            rootKey: key,
            byRawValue: refs.byRawValue,
            referenceKeys: USER_REFERENCE_KEYS,
          })
        : sameJson(before[key], after[key]))
    )
      return false;
  }
  return true;
}

function resolvedUserId(
  value: unknown,
  refs: ResolvedReferences,
): string | null {
  return typeof value === "string"
    ? (refs.byRawValue.get(value) ?? null)
    : null;
}

function assertKerjasamaUpdateAllowed(
  existing: SyncRecord,
  next: JsonObject,
  refs: ResolvedReferences,
  actor: User,
): void {
  if (
    !onlyAllowedFieldsChanged(
      existing.data,
      next,
      new Set(["status", "nilaiTotal", "updatedAt"]),
      refs,
    )
  ) {
    throw new InputError(
      "Rincian dasar kerja sama tidak boleh diubah setelah permintaan dibuat.",
    );
  }
  const beforeStatus = String(existing.data["status"] ?? "");
  const nextStatus = String(next["status"] ?? "");
  const providerId = userIdForField(next, "sanggarPenyediaId", refs);
  const borrowerId = userIdForField(next, "sanggarPeminjamId", refs);
  const isProvider = actor.role === "sanggar" && actor.id === providerId;
  const isBorrower = actor.role === "sanggar" && actor.id === borrowerId;
  if (!isProvider && !isBorrower)
    throw new InputError("Bukan pihak dalam kerja sama.");

  if (beforeStatus === nextStatus) {
    if (!sameJson(existing.data["nilaiTotal"], next["nilaiTotal"])) {
      throw new InputError(
        "Nilai kerja sama hanya dapat berubah saat tawaran diterima.",
      );
    }
    return;
  }

  const transitions: Record<string, string[]> = {
    menunggu: ["negosiasi", "diterima", "ditolak", "batal"],
    negosiasi: ["diterima", "ditolak", "batal"],
    diterima: ["berjalan", "batal"],
    berjalan: ["selesai", "batal"],
    selesai: [],
    ditolak: [],
    batal: [],
  };
  if (!transitions[beforeStatus]?.includes(nextStatus)) {
    throw new InputError("Transisi status kerja sama tidak valid.");
  }
  if (nextStatus === "ditolak" && !isProvider) {
    throw new InputError("Hanya penyedia yang dapat menolak kerja sama.");
  }
  if (nextStatus === "batal" && !isBorrower) {
    throw new InputError("Hanya peminjam yang dapat membatalkan kerja sama.");
  }
  if (nextStatus === "berjalan" && !isProvider) {
    throw new InputError("Hanya penyedia yang dapat memulai penagihan.");
  }
  if (nextStatus === "diterima") {
    const total = next["nilaiTotal"];
    if (typeof total !== "number" || !Number.isFinite(total) || total < 0) {
      throw new InputError("Nilai kerja sama tidak valid.");
    }
  } else if (!sameJson(existing.data["nilaiTotal"], next["nilaiTotal"])) {
    throw new InputError(
      "Nilai kerja sama tidak boleh berubah pada transisi ini.",
    );
  }
}

function assertRentalSignaturesAllowed(
  beforeValue: unknown,
  nextValue: unknown,
  refs: ResolvedReferences,
  actor: User,
  expectedParty: "sewa" | "sanggar" | "sdm",
): void {
  const before = Array.isArray(beforeValue) ? beforeValue : [];
  const next = Array.isArray(nextValue) ? nextValue : [];
  if (next.length === before.length && sameJson(before, next)) return;
  if (
    next.length !== before.length + 1 ||
    !sameJson(before, next.slice(0, before.length))
  ) {
    throw new InputError(
      "Daftar tanda tangan hanya boleh ditambahkan satu per satu.",
    );
  }
  const signature = next[next.length - 1];
  if (!isObject(signature))
    throw new InputError("Data tanda tangan tidak valid.");
  if (
    signature["pihak"] !== expectedParty ||
    resolvedUserId(signature["userId"], refs) !== actor.id ||
    typeof signature["nama"] !== "string" ||
    typeof signature["ts"] !== "number"
  ) {
    throw new InputError("Tanda tangan tidak cocok dengan akun aktif.");
  }
}

function assertPemesananSewaUpdateAllowed(
  existing: SyncRecord,
  next: JsonObject,
  refs: ResolvedReferences,
  actor: User,
): void {
  const mutableFields = new Set([
    "status",
    "alasanTolak",
    "ttd",
    "sdmUserId",
    "invoiceId",
    "bastId",
    "penyerahanSewa",
    "pengembalianSewa",
    "updatedAt",
  ]);
  if (!onlyAllowedFieldsChanged(existing.data, next, mutableFields, refs)) {
    throw new InputError(
      "Rincian dan nilai pesanan sewa tidak boleh diubah setelah dibuat.",
    );
  }

  const sewaId = userIdForField(next, "sewaId", refs);
  const sanggarId = userIdForField(next, "sanggarId", refs);
  const sdmId = userIdForField(next, "sdmUserId", refs);
  const pemesanRole = String(next["pemesanRole"] ?? "sewa");
  const penyediaRole = String(next["penyediaRole"] ?? "sanggar");
  const isSewa =
    (actor.role === "sewa" || actor.role === "mitra_pengrajin") &&
    actor.role === pemesanRole &&
    actor.id === sewaId;
  const isSanggar = actor.role === penyediaRole && actor.id === sanggarId;
  const isSdm =
    (actor.role === "pelatih" || actor.role === "seniman") &&
    actor.id === sdmId;
  if (!isSewa && !isSanggar && !isSdm)
    throw new InputError("Bukan pihak dalam pesanan sewa.");
  const actorParty = isSewa ? "sewa" : isSanggar ? "sanggar" : "sdm";
  assertRentalSignaturesAllowed(
    existing.data["ttd"],
    next["ttd"],
    refs,
    actor,
    actorParty,
  );

  if (!sameJson(existing.data["sdmUserId"], next["sdmUserId"]) && !isSanggar) {
    throw new InputError("Hanya sanggar yang dapat menugaskan SDM.");
  }
  if (!sameJson(existing.data["invoiceId"], next["invoiceId"]) && !isSanggar) {
    throw new InputError("Hanya sanggar yang dapat menautkan invoice.");
  }
  if (!sameJson(existing.data["bastId"], next["bastId"]) && !isSanggar) {
    throw new InputError("Hanya sanggar yang dapat menautkan BAST.");
  }

  const beforeStatus = String(existing.data["status"] ?? "");
  const nextStatus = String(next["status"] ?? "");
  const requiresReturn =
    ["aset", "sarpras"].includes(String(next["sumberType"] ?? "")) ||
    ["alat_musik", "kostum", "tempat_latihan"].includes(
      String(next["kategori"] ?? ""),
    );
  const penyerahanChanged = !sameJsonWithResolvedUserReferences({
    left: existing.data["penyerahanSewa"],
    right: next["penyerahanSewa"],
    rootKey: "penyerahanSewa",
    byRawValue: refs.byRawValue,
    referenceKeys: USER_REFERENCE_KEYS,
  });
  if (penyerahanChanged) {
    const penyerahan = next["penyerahanSewa"];
    if (
      !isSanggar ||
      beforeStatus !== "lunas" ||
      nextStatus !== "sedang_disewa" ||
      !isObject(penyerahan) ||
      resolvedUserId(penyerahan["diserahkanOlehId"], refs) !== actor.id ||
      typeof penyerahan["diserahkanAt"] !== "number" ||
      typeof penyerahan["catatan"] !== "string" ||
      !penyerahan["catatan"].trim()
    ) {
      throw new InputError("Data penyerahan objek sewa tidak valid.");
    }
  }

  const pengembalianChanged = !sameJsonWithResolvedUserReferences({
    left: existing.data["pengembalianSewa"],
    right: next["pengembalianSewa"],
    rootKey: "pengembalianSewa",
    byRawValue: refs.byRawValue,
    referenceKeys: USER_REFERENCE_KEYS,
  });
  if (pengembalianChanged) {
    const beforeReturn = existing.data["pengembalianSewa"];
    const nextReturn = next["pengembalianSewa"];
    if (!isObject(nextReturn)) {
      throw new InputError("Data pengembalian objek sewa tidak valid.");
    }
    if (
      beforeStatus === "sedang_disewa" &&
      nextStatus === "menunggu_konfirmasi_pengembalian"
    ) {
      if (
        !isSewa ||
        nextReturn["status"] !== "diajukan" ||
        resolvedUserId(nextReturn["diajukanOlehId"], refs) !== actor.id ||
        typeof nextReturn["diajukanAt"] !== "number" ||
        typeof nextReturn["catatanPenyewa"] !== "string" ||
        !nextReturn["catatanPenyewa"].trim() ||
        nextReturn["diperiksaAt"] !== undefined ||
        nextReturn["diperiksaOlehId"] !== undefined
      ) {
        throw new InputError("Pengajuan pengembalian tidak valid.");
      }
    } else if (
      beforeStatus === "menunggu_konfirmasi_pengembalian" &&
      (nextStatus === "dikembalikan" || nextStatus === "sedang_disewa")
    ) {
      if (
        !isSanggar ||
        !isObject(beforeReturn) ||
        !sameJson(beforeReturn["diajukanAt"], nextReturn["diajukanAt"]) ||
        !sameJsonWithResolvedUserReferences({
          left: beforeReturn["diajukanOlehId"],
          right: nextReturn["diajukanOlehId"],
          rootKey: "diajukanOlehId",
          byRawValue: refs.byRawValue,
          referenceKeys: USER_REFERENCE_KEYS,
        }) ||
        !sameJson(
          beforeReturn["catatanPenyewa"],
          nextReturn["catatanPenyewa"],
        ) ||
        !sameJson(beforeReturn["buktiDataUrl"], nextReturn["buktiDataUrl"]) ||
        resolvedUserId(nextReturn["diperiksaOlehId"], refs) !== actor.id ||
        typeof nextReturn["diperiksaAt"] !== "number" ||
        (nextStatus === "dikembalikan" &&
          (nextReturn["status"] !== "diterima" ||
            !["baik", "rusak_ringan", "rusak_berat"].includes(
              String(nextReturn["kondisi"] ?? ""),
            ))) ||
        (nextStatus === "sedang_disewa" &&
          (nextReturn["status"] !== "perlu_tindak_lanjut" ||
            typeof nextReturn["catatanPenyedia"] !== "string" ||
            !nextReturn["catatanPenyedia"].trim()))
      ) {
        throw new InputError("Pemeriksaan pengembalian tidak valid.");
      }
    } else {
      throw new InputError("Perubahan data pengembalian tidak diizinkan.");
    }
  }

  if (beforeStatus === nextStatus) return;
  const transitions: Record<string, string[]> = {
    menunggu_sanggar: ["menunggu_sdm", "menunggu_ttd", "ditolak", "batal"],
    menunggu_sdm: ["menunggu_ttd", "ditolak", "batal"],
    menunggu_ttd: ["kontrak_aktif", "batal"],
    kontrak_aktif: ["menunggu_bayar"],
    menunggu_bayar: ["lunas"],
    lunas: ["sedang_disewa", "selesai"],
    sedang_disewa: ["menunggu_konfirmasi_pengembalian"],
    menunggu_konfirmasi_pengembalian: ["dikembalikan", "sedang_disewa"],
    dikembalikan: ["selesai"],
    selesai: [],
    ditolak: [],
    batal: [],
  };
  if (!transitions[beforeStatus]?.includes(nextStatus)) {
    throw new InputError("Transisi status pesanan sewa tidak valid.");
  }
  if (requiresReturn && beforeStatus === "lunas" && nextStatus === "selesai") {
    throw new InputError(
      "Objek sewa wajib melalui penyerahan dan pengembalian sebelum BAST.",
    );
  }
  if (
    !requiresReturn &&
    [
      "sedang_disewa",
      "menunggu_konfirmasi_pengembalian",
      "dikembalikan",
    ].includes(nextStatus)
  ) {
    throw new InputError("Pesanan jasa tidak memerlukan alur pengembalian.");
  }
  if (nextStatus === "batal" && !isSewa) {
    throw new InputError("Hanya penyewa yang dapat membatalkan pesanan.");
  }
  if (
    beforeStatus === "menunggu_sanggar" &&
    nextStatus !== "batal" &&
    !isSanggar
  ) {
    throw new InputError("Pesanan masih menunggu tindakan sanggar.");
  }
  if (
    beforeStatus === "menunggu_sdm" &&
    nextStatus !== "batal" &&
    !isSdm &&
    !(isSanggar && nextStatus === "ditolak")
  ) {
    throw new InputError("Pesanan masih menunggu tindakan SDM tertugas.");
  }
  if (nextStatus === "menunggu_konfirmasi_pengembalian" && !isSewa) {
    throw new InputError("Hanya penyewa yang dapat mengajukan pengembalian.");
  }
  if (
    [
      "menunggu_bayar",
      "lunas",
      "sedang_disewa",
      "dikembalikan",
      "selesai",
    ].includes(nextStatus) &&
    !isSanggar
  ) {
    throw new InputError(
      "Tahap pembayaran, penyerahan, pemeriksaan pengembalian, dan BAST hanya dapat diproses penyedia.",
    );
  }
}

function assertKerjasamaMitraPengrajinUpdateAllowed(
  existing: SyncRecord,
  next: JsonObject,
  refs: ResolvedReferences,
  actor: User,
): void {
  const mutableFields = new Set([
    "status",
    "alasanTolak",
    "jadwal",
    "catatanPeninjauan",
    "pesananId",
    "updatedAt",
  ]);
  if (!onlyAllowedFieldsChanged(existing.data, next, mutableFields, refs)) {
    throw new InputError(
      "Isi pengajuan kerja sama tidak boleh diubah setelah dikirim.",
    );
  }
  const mitraId = userIdForField(next, "mitraId", refs);
  const pengrajinId = userIdForField(next, "pengrajinId", refs);
  const isMitra = actor.role === "mitra_pengrajin" && actor.id === mitraId;
  const isPengrajin = actor.role === "pengrajin" && actor.id === pengrajinId;
  if (!isMitra && !isPengrajin) {
    throw new InputError("Bukan peserta kerja sama Mitra.");
  }
  const beforeStatus = String(existing.data["status"] ?? "");
  const nextStatus = String(next["status"] ?? "");
  if (beforeStatus === nextStatus) return;
  const transitions: Record<string, string[]> = {
    diajukan: ["disetujui", "ditolak"],
    disetujui: ["jadwal_diajukan", "peninjauan_selesai"],
    jadwal_diajukan: ["jadwal_disepakati"],
    jadwal_disepakati: ["peninjauan_selesai"],
    peninjauan_selesai: ["bersepakat"],
    bersepakat: ["pembelian_dibuat"],
    pembelian_dibuat: [],
    ditolak: [],
  };
  if (!transitions[beforeStatus]?.includes(nextStatus)) {
    throw new InputError("Transisi kerja sama Mitra tidak valid.");
  }
  if (nextStatus === "jadwal_disepakati" && !isPengrajin) {
    throw new InputError("Jadwal harus disetujui oleh Pengrajin.");
  }
  if (nextStatus !== "jadwal_disepakati" && !isMitra) {
    throw new InputError("Tahap ini hanya dapat diproses oleh Mitra.");
  }
}

function assertPesananProdukPengrajinUpdateAllowed(
  existing: SyncRecord,
  next: JsonObject,
  refs: ResolvedReferences,
  actor: User,
): void {
  const mutableFields = new Set([
    "status",
    "alasanTolak",
    "ttd",
    "kontrak",
    "invoice",
    "kwitansi",
    "bast",
    "pembayaranAt",
    "pengiriman",
    "pembayaran",
    "ringkasanPajak",
    "subtotalProduk",
    "nilaiTotal",
    "rekeningTujuan",
    "riwayatPembayaran",
    "fakturPajak",
    "buktiPotongPph",
    "updatedAt",
  ]);
  if (!onlyAllowedFieldsChanged(existing.data, next, mutableFields, refs)) {
    throw new InputError(
      "Rincian dan nilai pesanan produk tidak boleh diubah setelah diajukan.",
    );
  }

  const mitraId = userIdForField(next, "mitraId", refs);
  const pengrajinId = userIdForField(next, "pengrajinId", refs);
  const isMitra = actor.role === "mitra_pengrajin" && actor.id === mitraId;
  const isPengrajin = actor.role === "pengrajin" && actor.id === pengrajinId;
  if (!isMitra && !isPengrajin) {
    throw new InputError("Bukan pihak dalam pesanan produk Pengrajin.");
  }

  if (
    (!sameJson(existing.data["subtotalProduk"], next["subtotalProduk"]) ||
      !sameJson(existing.data["nilaiTotal"], next["nilaiTotal"]) ||
      !sameJson(existing.data["rekeningTujuan"], next["rekeningTujuan"]) ||
      !sameJson(existing.data["pembayaran"], next["pembayaran"])) &&
    !isPengrajin
  ) {
    throw new InputError(
      "Nilai, rekening tujuan, dan konfirmasi syarat penjual hanya dapat diperbarui Pengrajin.",
    );
  }
  if (
    !sameJson(existing.data["pengiriman"], next["pengiriman"]) &&
    !isPengrajin
  ) {
    throw new InputError(
      "Ongkir, resi, dan live location hanya dapat diisi Pengrajin.",
    );
  }
  if (
    !sameJson(existing.data["ringkasanPajak"], next["ringkasanPajak"]) &&
    !isPengrajin
  ) {
    throw new InputError(
      "Ringkasan pajak setelah ongkir hanya dapat diperbarui Pengrajin.",
    );
  }
  if (
    !sameJson(existing.data["fakturPajak"], next["fakturPajak"]) &&
    !isPengrajin
  ) {
    throw new InputError(
      "Faktur Pajak hanya dapat diunggah Pengrajin penjual.",
    );
  }
  if (
    !sameJson(existing.data["buktiPotongPph"], next["buktiPotongPph"]) &&
    !isMitra
  ) {
    throw new InputError("Bukti potong hanya dapat diunggah Mitra pembeli.");
  }
  if (
    !sameJson(existing.data["riwayatPembayaran"], next["riwayatPembayaran"])
  ) {
    const beforeRows = Array.isArray(existing.data["riwayatPembayaran"])
      ? existing.data["riwayatPembayaran"]
      : [];
    const nextRows = Array.isArray(next["riwayatPembayaran"])
      ? next["riwayatPembayaran"]
      : [];
    if (nextRows.length > beforeRows.length && !isMitra && !isPengrajin) {
      throw new InputError(
        "Pembayaran hanya dapat dicatat oleh peserta transaksi.",
      );
    }
    if (nextRows.length === beforeRows.length && !isPengrajin) {
      throw new InputError(
        "Penerimaan dana hanya dapat diverifikasi Pengrajin.",
      );
    }
  }

  const signatures = Array.isArray(next["ttd"]) ? next["ttd"] : [];
  for (const signature of signatures) {
    if (!isObject(signature)) continue;
    const party = signature["pihak"];
    const rawUserId = signature["userId"];
    const resolved =
      typeof rawUserId === "string" ? refs.byRawValue.get(rawUserId) : null;
    if (party === "mitra" && resolved !== mitraId) {
      throw new InputError("Tanda tangan Mitra tidak valid.");
    }
    if (party === "pengrajin" && resolved !== pengrajinId) {
      throw new InputError("Tanda tangan Pengrajin tidak valid.");
    }
  }

  const beforeStatus = String(existing.data["status"] ?? "");
  const nextStatus = String(next["status"] ?? "");
  if (beforeStatus === nextStatus) return;
  const transitions: Record<string, string[]> = {
    menunggu_ongkir: ["menunggu_persetujuan_ongkir", "batal"],
    menunggu_persetujuan_ongkir: ["menunggu_ttd", "batal"],
    diajukan: ["menunggu_ttd", "ditolak", "batal"],
    menunggu_ttd: ["menunggu_bayar", "kontrak_aktif", "ditolak", "batal"],
    menunggu_bayar: ["menunggu_verifikasi_bayar", "selesai"],
    menunggu_verifikasi_bayar: ["kontrak_aktif", "selesai"],
    kontrak_aktif: ["diproses"],
    diproses: ["dikirim"],
    dikirim: ["selesai", "menunggu_bayar"],
    selesai: [],
    ditolak: [],
    batal: [],
  };
  if (!transitions[beforeStatus]?.includes(nextStatus)) {
    throw new InputError("Transisi status pesanan produk tidak valid.");
  }
  if (nextStatus === "batal" && !isMitra) {
    throw new InputError("Hanya Mitra yang dapat membatalkan pesanan.");
  }
  if (
    beforeStatus === "menunggu_ongkir" &&
    nextStatus === "menunggu_persetujuan_ongkir" &&
    !isPengrajin
  ) {
    throw new InputError("Ongkos kirim harus ditetapkan Pengrajin.");
  }
  if (
    beforeStatus === "menunggu_persetujuan_ongkir" &&
    nextStatus === "menunggu_ttd" &&
    !isMitra
  ) {
    throw new InputError("Ongkos kirim harus disetujui Mitra pembeli.");
  }
  if (beforeStatus === "diajukan" && nextStatus !== "batal" && !isPengrajin) {
    throw new InputError("Pesanan masih menunggu tindakan Pengrajin.");
  }
  if (["diproses", "dikirim"].includes(nextStatus) && !isPengrajin) {
    throw new InputError("Produksi dan pengiriman hanya diproses Pengrajin.");
  }
  if (
    beforeStatus === "menunggu_bayar" &&
    nextStatus === "menunggu_verifikasi_bayar" &&
    !isMitra
  ) {
    throw new InputError("Bukti pembayaran hanya dapat diajukan Mitra.");
  }
  if (
    beforeStatus === "menunggu_verifikasi_bayar" &&
    ["kontrak_aktif", "selesai"].includes(nextStatus) &&
    !isPengrajin
  ) {
    throw new InputError(
      "Dana masuk hanya dapat diverifikasi Pengrajin penjual.",
    );
  }
  if (
    beforeStatus === "dikirim" &&
    ["selesai", "menunggu_bayar"].includes(nextStatus) &&
    !isMitra
  ) {
    throw new InputError("BAST hanya dapat disahkan oleh Mitra penerima.");
  }
}

function assertTransactionUpdateAllowed(
  existing: SyncRecord,
  next: JsonObject,
  refs: ResolvedReferences,
  actor: User,
): void {
  if (isOverseer(actor)) return;
  if (existing.collection === "kerjasama") {
    assertKerjasamaUpdateAllowed(existing, next, refs, actor);
  } else if (existing.collection === "pemesananSewa") {
    assertPemesananSewaUpdateAllowed(existing, next, refs, actor);
  } else if (existing.collection === "kerjasamaMitraPengrajin") {
    assertKerjasamaMitraPengrajinUpdateAllowed(existing, next, refs, actor);
  } else if (existing.collection === "pesananProdukPengrajin") {
    assertPesananProdukPengrajinUpdateAllowed(existing, next, refs, actor);
  }
}

function sameSet(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const values = new Set(a);
  return b.every((value) => values.has(value));
}

function scopeChangeAllowed(
  existing: SyncRecord,
  next: ScopeInfo,
  actor: User,
): boolean {
  if (isOverseer(actor)) return true;
  const existingScope = normalizeScope(existing.scope);
  if (existingScope !== next.scope || existing.ownerId !== next.ownerId)
    return false;
  const before = participantsOf(existing);
  if (existingScope === "personal") return sameSet(before, next.participantIds);
  if (existingScope === "shared") {
    // Hanya pemilik (mis. sanggar penyedia) boleh menambah pihak baru seperti
    // SDM yang ditugaskan; pihak lain tidak dapat menghapus/menambah akses.
    if (actor.id === existing.ownerId)
      return before.every((id) => next.participantIds.includes(id));
    return sameSet(before, next.participantIds);
  }
  return true;
}

function memberSanggarUsername(user: User): string | null {
  if (user.role !== "pelatih" && user.role !== "seniman") return null;
  const value = (user.profile as Record<string, unknown>)["sanggarUsername"];
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

async function assertMemberFinanceRecord(collection: string, data: JsonObject, actor: User, before?: JsonObject) {
  if (!["pelatih", "seniman"].includes(actor.role) || !["iuran", "pengajuanHonor", "distribusi"].includes(collection)) return;
  const refs = await resolveUserReferences({ before, next: data });
  const sanggarId = userIdForField(data, "sanggarId", refs);
  const owners = sanggarId ? await db.select({ username: usersTable.username }).from(usersTable).where(eq(usersTable.id, sanggarId)).limit(1) : [];
  const normalize = (value: JsonObject) => Object.fromEntries(Object.entries(value).map(([key, item]) => [key, USER_REFERENCE_KEYS.has(key) && typeof item === "string" ? refs.byRawValue.get(item) ?? item : item]));
  const eligible = new Set<string>();
  const claimed = new Set<string>();
  if (collection === "pengajuanHonor" && sanggarId) {
    const records = await db.select().from(syncRecordsTable).where(and(inArray(syncRecordsTable.collection, ["latihan", "absensiLatihan", "pengajuanHonor"]), or(eq(syncRecordsTable.ownerId, sanggarId), eq(syncRecordsTable.ownerId, actor.id))));
    const active = records.filter((record) => !record.deletedAt);
    const recordRefs = await resolveUserReferences({ records: active.map((record) => record.data) });
    const owned = (record: SyncRecord, key: string) => userIdForField(record.data, key, recordRefs) === actor.id;
    const attended = new Set(active.filter((record) => record.collection === "absensiLatihan" && owned(record, "userId")).map((record) => record.data["latihanId"]));
    const requests = active.filter((record) => record.collection === "pengajuanHonor" && owned(record, "pelatihId") && record.data["status"] !== "ditolak");
    const legacyCutoff = Math.max(0, ...requests.filter((record) => !Array.isArray(record.data["latihanIds"])).map((record) => Number(record.data["createdAt"]) || 0));
    for (const record of requests) if (Array.isArray(record.data["latihanIds"])) for (const id of record.data["latihanIds"]) if (typeof id === "string") claimed.add(id);
    for (const record of active) {
      const report = record.data["laporan"];
      if (record.collection === "latihan" && record.ownerId === sanggarId && owned(record, "pelatihId") && attended.has(record.recordId) && isObject(report) && Number(report["timestamp"]) > legacyCutoff) eligible.add(record.recordId);
    }
  }
  const error = memberRecordWriteError({ collection, actor, ownerUsername: owners[0]?.username ?? "", next: normalize(data), before: before ? normalize(before) : undefined, eligibleSessionIds: eligible, claimedSessionIds: claimed });
  if (error) throw new InputError(error);
}

function canReadAsSanggarMember(
  record: SyncRecord,
  actor: User,
  ownerById: Map<string, { username: string; role: string }>,
): boolean {
  if (normalizeScope(record.scope) !== "sanggar") return false;
  const sanggarUsername = memberSanggarUsername(actor);
  const owner = ownerById.get(record.ownerId);
  return (
    !!sanggarUsername &&
    owner?.role === "sanggar" &&
    owner.username.toLowerCase() === sanggarUsername.toLowerCase()
  );
}

async function processMutation(
  actor: User,
  raw: unknown,
): Promise<MutationResult> {
  let mutation: MutationInput;
  try {
    mutation = parseMutation(raw);
  } catch (error) {
    return rejected(
      isObject(raw) && typeof raw["mutationId"] === "string"
        ? raw["mutationId"]
        : "",
      error instanceof Error ? error.message : "Mutasi tidak valid.",
    );
  }

  return db.transaction(async (tx) => {
    if (mutation.collection === "pengajuanHonor" && actor.role === "pelatih") {
      // Serialisasi pengajuan satu pelatih agar dua request bersamaan tidak
      // sama-sama melihat sesi yang belum diklaim lalu membuat honor ganda.
      await tx.select({ id: usersTable.id }).from(usersTable)
        .where(eq(usersTable.id, actor.id)).for("update");
    }
    const priorRows = await tx
      .select()
      .from(syncMutationsTable)
      .where(eq(syncMutationsTable.mutationId, mutation.mutationId))
      .limit(1);
    const prior = priorRows[0];
    if (prior) {
      if (prior.actorId !== actor.id)
        return rejected(mutation.mutationId, "mutationId sudah digunakan.");
      const priorResult = prior.result as Partial<MutationResult>;
      if (
        priorResult.status === "applied" ||
        priorResult.status === "conflict" ||
        priorResult.status === "rejected"
      ) {
        return {
          mutationId: mutation.mutationId,
          status: priorResult.status,
          ...(priorResult.record
            ? { record: priorResult.record as RecordResponse }
            : {}),
          ...(typeof priorResult.error === "string"
            ? { error: priorResult.error }
            : {}),
        };
      }
      return rejected(mutation.mutationId, "Mutasi sebelumnya masih diproses.");
    }

    // Reserve idempotency key lebih dulu. Bila dua retry tiba bersamaan,
    // primary key database memastikan hanya satu yang melakukan perubahan.
    try {
      await tx.insert(syncMutationsTable).values({
        mutationId: mutation.mutationId,
        actorId: actor.id,
        result: { status: "processing" },
      });
    } catch (error) {
      if (!isDuplicateError(error)) throw error;
      const racedRows = await tx
        .select()
        .from(syncMutationsTable)
        .where(eq(syncMutationsTable.mutationId, mutation.mutationId))
        .limit(1);
      const raced = racedRows[0];
      if (!raced || raced.actorId !== actor.id) {
        return rejected(mutation.mutationId, "mutationId sudah digunakan.");
      }
      const result = raced.result as Partial<MutationResult>;
      if (
        result.status === "applied" ||
        result.status === "conflict" ||
        result.status === "rejected"
      ) {
        return {
          mutationId: mutation.mutationId,
          status: result.status,
          ...(result.record ? { record: result.record as RecordResponse } : {}),
          ...(typeof result.error === "string" ? { error: result.error } : {}),
        };
      }
      return rejected(mutation.mutationId, "Mutasi sebelumnya masih diproses.");
    }

    const existingRows = await tx
      .select()
      .from(syncRecordsTable)
      .where(
        and(
          eq(syncRecordsTable.collection, mutation.collection),
          eq(syncRecordsTable.recordId, mutation.id),
        ),
      )
      .limit(1);
    const existing = existingRows[0];

    const finish = async (result: MutationResult): Promise<MutationResult> => {
      await tx
        .update(syncMutationsTable)
        .set({ result: result as unknown as Record<string, unknown> })
        .where(eq(syncMutationsTable.mutationId, mutation.mutationId));
      return result;
    };

    if (existing) {
      if (!canRead(existing, actor))
        return finish(
          rejected(mutation.mutationId, "Tidak punya akses ke record ini."),
        );
      if (mutation.baseRevision === undefined) {
        return finish(
          rejected(
            mutation.mutationId,
            "baseRevision wajib untuk record yang sudah ada.",
          ),
        );
      }
      if (mutation.baseRevision !== existing.revision) {
        return finish({
          mutationId: mutation.mutationId,
          status: "conflict",
          record: toRecordResponse(existing),
        });
      }
      if (!canMutateExisting(existing, actor)) {
        return finish(
          rejected(mutation.mutationId, "Tidak punya hak mengubah record ini."),
        );
      }
      if (existing.deletedAt) {
        return finish({
          mutationId: mutation.mutationId,
          status: "conflict",
          record: toRecordResponse(existing),
        });
      }

      if (mutation.op === "delete") {
        if ((actor.role === "seniman" || actor.role === "pelatih") && ["iuran", "distribusi"].includes(existing.collection)) return finish(rejected(mutation.mutationId, "Anggota tidak dapat menghapus catatan keuangan."));
        if (
          !isOverseer(actor) &&
          PROTECTED_TRANSACTION_COLLECTIONS.has(existing.collection) &&
          !canDeleteOrderAsCancellation(existing, actor)
        ) {
          return finish(
            rejected(
              mutation.mutationId,
              "Record transaksi tidak dapat dihapus; gunakan status pembatalan yang sesuai.",
            ),
          );
        }
        const deletedAt = new Date();
        const revision = existing.revision + 1;
        await tx
          .update(syncRecordsTable)
          .set({ revision, deletedAt, updatedBy: actor.id })
          .where(eq(syncRecordsTable.id, existing.id));
        const auditEvent = syncMutationAuditEvent({
          actor,
          mutation,
          operation: "delete",
          before: existing.data,
        });
        if (auditEvent) {
          await tx
            .insert(activityLogTable)
            .values(activityAuditValues(auditEvent));
        }
        return finish({
          mutationId: mutation.mutationId,
          status: "applied",
          record: toRecordResponse({ ...existing, revision, deletedAt }),
        });
      }

      try {
        let data = await prepareCreativeMediaData(
          mutation.collection,
          mutation.data!,
          actor,
        );
        assertOperationalRecord(
          mutation.collection,
          data,
          actor,
          existing.data,
        );
        await assertMemberFinanceRecord(mutation.collection, data, actor, existing.data);
        let refs = await resolveUserReferences(data);
        let scope: ScopeInfo;
        if (existing.collection === "infoBudaya") {
          const existingAuthorData = {
            authorId: existing.data["authorId"],
          };
          const existingAuthorRefs =
            existing.data["authorId"] === undefined
              ? undefined
              : await resolveUserReferences(existingAuthorData);
          const authorship = preserveCreativeMediaAuthorship({
            existingData: existing.data,
            incomingData: data,
            existingOwnerId: existing.ownerId,
            existingAuthorId: existingAuthorRefs
              ? userIdForField(
                  existingAuthorData,
                  "authorId",
                  existingAuthorRefs,
                )
              : undefined,
            incomingAuthorId: userIdForField(data, "authorId", refs),
          });
          if (!authorship.ok) {
            throw new InputError("Author karya tidak boleh diubah.");
          }
          data = authorship.data;
          refs = await resolveUserReferences(data);
          scope = {
            scope: "global",
            ownerId: authorship.ownerId,
            participantIds: uniqueIds([...refs.ids, authorship.ownerId]),
          };
        } else {
          // Snapshot lama dapat menyimpan `username:<nama>`, sedangkan klien
          // yang sudah menerima direktori identitas mengirim akun yang sama
          // sebagai `user:<uuid>`. Resolve kedua snapshot sekaligus supaya
          // validasi immutable membandingkan identitas semantik, bukan token.
          refs = await resolveUserReferences({
            existing: existing.data,
            incoming: data,
          });
          assertTransactionUpdateAllowed(existing, data, refs, actor);
          scope = await deriveScope(mutation.collection, data, refs, actor);
        }
        if (
          existing.collection === "infoBudaya" &&
          actor.role === "sanggar" &&
          (userIdForField(data, "authorId", refs) !== actor.id ||
            data["active"] !== false ||
            !["draft", "pending", "rejected"].includes(
              String(data["publicationStatus"] ?? ""),
            ))
        ) {
          return finish(
            rejected(
              mutation.mutationId,
              "Sanggar hanya dapat mengubah kiriman sendiri dan wajib mengirimkannya untuk ditinjau.",
            ),
          );
        }
        if (!scopeChangeAllowed(existing, scope, actor)) {
          return finish(
            rejected(
              mutation.mutationId,
              "Kepemilikan atau pihak yang terlibat tidak boleh diubah.",
            ),
          );
        }
        const revision = existing.revision + 1;
        await tx
          .update(syncRecordsTable)
          .set({
            data,
            scope: scope.scope,
            ownerId: scope.ownerId,
            participantIds: scope.participantIds,
            revision,
            updatedBy: actor.id,
          })
          .where(eq(syncRecordsTable.id, existing.id));
        const auditEvent = syncMutationAuditEvent({
          actor,
          mutation,
          operation: "update",
          before: existing.data,
          after: data,
        });
        if (auditEvent) {
          await tx
            .insert(activityLogTable)
            .values(activityAuditValues(auditEvent));
        }
        return finish({
          mutationId: mutation.mutationId,
          status: "applied",
          record: toRecordResponse({ ...existing, data, revision }),
        });
      } catch (error) {
        if (error instanceof InputError)
          return finish(rejected(mutation.mutationId, error.message));
        throw error;
      }
    }

    if (mutation.op === "delete") {
      return finish(
        rejected(
          mutation.mutationId,
          "Record yang akan dihapus tidak ditemukan.",
        ),
      );
    }
    if (mutation.baseRevision !== undefined && mutation.baseRevision !== 0) {
      return finish(
        rejected(
          mutation.mutationId,
          "baseRevision record baru harus 0 atau kosong.",
        ),
      );
    }

    try {
      const data = await prepareCreativeMediaData(
        mutation.collection,
        mutation.data!,
        actor,
      );
      assertOperationalRecord(mutation.collection, data, actor);
      await assertMemberFinanceRecord(mutation.collection, data, actor);
      const refs = await resolveUserReferences(data);
      const scope = await deriveScope(mutation.collection, data, refs, actor);
      if (!canCreate(mutation.collection, scope, actor, data, refs)) {
        return finish(
          rejected(mutation.mutationId, "Tidak punya hak membuat record ini."),
        );
      }
      const now = new Date();
      await tx.insert(syncRecordsTable).values({
        collection: mutation.collection,
        recordId: mutation.id,
        scope: scope.scope,
        ownerId: scope.ownerId,
        participantIds: scope.participantIds,
        data,
        revision: 1,
        createdBy: actor.id,
        updatedBy: actor.id,
        createdAt: now,
        updatedAt: now,
      });
      const auditEvent = syncMutationAuditEvent({
        actor,
        mutation,
        operation: "create",
        after: data,
      });
      if (auditEvent) {
        await tx
          .insert(activityLogTable)
          .values(activityAuditValues(auditEvent));
      }
      return finish({
        mutationId: mutation.mutationId,
        status: "applied",
        record: {
          collection: mutation.collection,
          id: mutation.id,
          data,
          revision: 1,
        },
      });
    } catch (error) {
      if (error instanceof InputError)
        return finish(rejected(mutation.mutationId, error.message));
      throw error;
    }
  });
}

router.use("/sync", requireAuth);

/**
 * Bootstrap selalu mengirim snapshot yang terfilter per identitas. Untuk data
 * JAK SANGGAR saat ini volume lebih kecil dan lebih aman daripada cursor yang
 * rawan melewatkan tombstone; client memakai revision tiap record untuk merge.
 */
router.get(
  "/sync/bootstrap",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Snapshot ini memuat direktori akun yang bergantung pada sesi/peran dan
      // dapat berubah kapan saja. Jangan biarkan browser memakai body 304 lama
      // yang belum memiliki `directoryComplete`.
      res.set("Cache-Control", "private, no-store, max-age=0");
      res.set("Pragma", "no-cache");
      res.set("Expires", "0");
      const actor = req.user!;
      // Private communications use their own participant-only API. Generic
      // admin/curator sync permissions must never reveal messages or signaling.
      const all = (await db.select().from(syncRecordsTable).where(notLike(syncRecordsTable.collection, "comm.%"))).filter(
        (record) => !record.collection.startsWith("comm."),
      );
      const ownerIds = [...new Set(all.map((record) => record.ownerId))];
      const owners =
        ownerIds.length > 0
          ? await db
              .select({
                id: usersTable.id,
                username: usersTable.username,
                role: usersTable.role,
              })
              .from(usersTable)
              .where(inArray(usersTable.id, ownerIds))
          : [];
      const ownerById = new Map(owners.map((owner) => [owner.id, owner]));
      const visible = all.filter(
        (record) =>
          canRead(record, actor) ||
          canReadAsSanggarMember(record, actor, ownerById),
      );
      // Kurator dan admin mengelola direktori akun. Mereka harus menerima
      // seluruh pengguna database, termasuk Sanggar baru yang belum memiliki
      // record sinkronisasi. Peran lain tetap hanya menerima identitas yang
      // terkait dengan record yang dapat mereka baca.
      const directoryComplete =
        actor.role === "kurator" || actor.role === "admin";
      const identityIds = new Set<string>([actor.id]);
      for (const record of visible) {
        identityIds.add(record.ownerId);
        for (const participantId of participantsOf(record))
          identityIds.add(participantId);
      }
      const ids = [...identityIds];
      const identities = directoryComplete
        ? await db.select().from(usersTable)
        : ids.length > 0
          ? await db
              .select()
              .from(usersTable)
              .where(inArray(usersTable.id, ids))
          : [];
      res.json({
        directoryComplete,
        identities: identities.map(
          directoryComplete ? toDirectoryAuthUser : toAuthUser,
        ),
        records: visible.map(toRecordResponse),
      });
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  "/sync/mutations",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actor = req.user!;
      if (
        actor.role === "mitra_pengrajin" &&
        (actor.profile as Record<string, unknown>)[
          "statusVerifikasiTokoOffline"
        ] !== "terverifikasi"
      ) {
        res.status(403).json({
          error:
            "Akun Mitra belum aktif. Lengkapi profil dan tunggu verifikasi Kurator.",
        });
        return;
      }
      const mutations = isObject(req.body) ? req.body["mutations"] : undefined;
      if (!Array.isArray(mutations)) {
        res.status(400).json({ error: "mutations wajib berupa array." });
        return;
      }
      if (mutations.length > MAX_MUTATIONS_PER_REQUEST) {
        res.status(400).json({
          error: `Maksimal ${MAX_MUTATIONS_PER_REQUEST} mutasi per permintaan.`,
        });
        return;
      }
      const results: MutationResult[] = [];
      for (const mutation of mutations) {
        results.push(await processMutation(actor, mutation));
      }
      res.json({ results });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
