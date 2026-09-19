import {
  load,
  isLegacyGlobalSeedRecord,
  normalizeInfoBudayaForStore,
  rememberInfoBudayaTombstones,
  save,
  setStoreChangeListener,
  type DBShape,
} from "./store";
import {
  syncApi,
  type ApiAuthUser,
  type ApiSyncBootstrap,
  type ApiSyncCollection,
  type ApiSyncIdentity,
  type ApiSyncMutation,
  type ApiSyncMutationResult,
  type ApiSyncRecord,
} from "./api";
import type {
  AnyUser,
  Role,
  SanggarUser,
  PelatihUser,
  SenimanUser,
  JuriUser,
  AdminUser,
  InfoBudaya,
  SewaUser,
  PengrajinUser,
  MitraPengrajinUser,
} from "./types";

/**
 * Koleksi yang sebelumnya hanya hidup di `localStorage`. Koleksi yang sudah
 * memiliki API domain khusus (profil, anggota, pengaturan, arsip dokumen, dan
 * kurasi) sengaja tidak dikirim ulang lewat jalur generik ini.
 */
const COLLECTIONS: ApiSyncCollection[] = [
  "news",
  "banners",
  "slider",
  "latihan",
  // Kehadiran harus sampai sebelum pengajuan honor yang merujuk sesi itu.
  "absensiLatihan",
  "iuran",
  "pengajuanHonor",
  "distribusi",
  "transaksi",
  "kas",
  "sertifikat",
  "activity",
  "absensiPembinaan",
  "pendaftaranPembinaan",
  "aset",
  "sarpras",
  "kerjasama",
  // Parent transaksi harus diproses sebelum invoice/kontrak/BAST turunannya,
  // terutama ketika satu alur diselesaikan saat perangkat sedang offline.
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
  "infoBudaya",
  "paketIsian",
];

const GLOBAL_COLLECTIONS = new Set<ApiSyncCollection>([
  "news",
  "banners",
  "slider",
  "infoBudaya",
]);

const SANGGAR_COLLECTIONS = new Set<ApiSyncCollection>([
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
]);

const USER_REF_KEYS = new Set([
  "authorId",
  "sanggarId",
  "pelatihId",
  "senimanId",
  "penerimaId",
  "juriId",
  "pemilikId",
  "pesertaId",
  "delegasiId",
  "userId",
  "sewaId",
  "mitraId",
  "pengrajinId",
  "sdmUserId",
  "sanggarPenyediaId",
  "sanggarPeminjamId",
  "senderId",
  "pengirimSanggarId",
  "pengirimUserId",
  "dariSanggarId",
  "actorId",
  "validatedByAdminId",
]);

const USER_REF_MAP_KEYS = new Set(["scores", "finalized"]);
const OUTBOX_PREFIX = "jaksanggar_sync_outbox_v1";

type WireData = Record<string, unknown>;
type LocalRecord = {
  collection: ApiSyncCollection;
  id: string;
  data: WireData;
};

interface QueuedMutation extends ApiSyncMutation {
  key: string;
}

export interface DataSyncRejection {
  collection: ApiSyncCollection;
  id: string;
  error: string;
}

type DataSyncRejectionListener = (issue: DataSyncRejection) => void;
const rejectionListeners = new Set<DataSyncRejectionListener>();
let dataSyncRejectionCount = 0;

/** Berlangganan penolakan final dari API agar UI tidak menampilkan sukses semu. */
export function subscribeDataSyncRejections(
  listener: DataSyncRejectionListener,
) {
  rejectionListeners.add(listener);
  return () => {
    rejectionListeners.delete(listener);
  };
}

function notifyDataSyncRejection(issue: DataSyncRejection) {
  dataSyncRejectionCount++;
  for (const listener of rejectionListeners) listener(issue);
}

interface SyncActor {
  id: string;
  username: string;
  role: ApiAuthUser["role"];
}

let actor: SyncActor | null = null;
let ready = false;
let flushing = false;
let refreshing = false;
let refreshAfterFlush = false;
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let revisions = new Map<string, number>();
let outbox = new Map<string, QueuedMutation>();

function recordKey(collection: ApiSyncCollection, id: string) {
  return `${collection}::${id}`;
}

function newMutationId() {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  return `sync-${Date.now().toString(36)}-${random}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function localUserForId(db: DBShape, id: string): AnyUser | undefined {
  return db.users.find((user) => user.id === id);
}

function userToken(db: DBShape, id: string): string {
  const user = localUserForId(db, id);
  if (!user) return id;
  if (user.apiId) return `user:${user.apiId}`;
  return `username:${encodeURIComponent(user.username)}`;
}

function localIdFromToken(db: DBShape, value: string): string {
  if (value.startsWith("user:")) {
    const apiId = value.slice("user:".length);
    return db.users.find((user) => user.apiId === apiId)?.id ?? value;
  }
  if (value.startsWith("username:")) {
    const username = decodeURIComponent(value.slice("username:".length));
    return (
      db.users.find(
        (user) => user.username.toLowerCase() === username.toLowerCase(),
      )?.id ?? value
    );
  }
  return value;
}

function encodeReferences(value: unknown, db: DBShape, key?: string): unknown {
  if (typeof value === "string") {
    return key && USER_REF_KEYS.has(key) ? userToken(db, value) : value;
  }
  if (Array.isArray(value))
    return value.map((item) => encodeReferences(item, db));
  if (!isRecord(value)) return value;

  const out: Record<string, unknown> = {};
  for (const [childKey, childValue] of Object.entries(value)) {
    if (USER_REF_MAP_KEYS.has(childKey) && isRecord(childValue)) {
      out[childKey] = Object.fromEntries(
        Object.entries(childValue).map(([id, entry]) => [
          userToken(db, id),
          encodeReferences(entry, db),
        ]),
      );
    } else {
      out[childKey] = encodeReferences(childValue, db, childKey);
    }
  }
  return out;
}

function decodeReferences(value: unknown, db: DBShape, key?: string): unknown {
  if (typeof value === "string") {
    return key && USER_REF_KEYS.has(key) ? localIdFromToken(db, value) : value;
  }
  if (Array.isArray(value))
    return value.map((item) => decodeReferences(item, db));
  if (!isRecord(value)) return value;

  const out: Record<string, unknown> = {};
  for (const [childKey, childValue] of Object.entries(value)) {
    if (USER_REF_MAP_KEYS.has(childKey) && isRecord(childValue)) {
      out[childKey] = Object.fromEntries(
        Object.entries(childValue).map(([id, entry]) => [
          localIdFromToken(db, id),
          decodeReferences(entry, db),
        ]),
      );
    } else {
      out[childKey] = decodeReferences(childValue, db, childKey);
    }
  }
  return out;
}

function getRecords(db: DBShape): Map<string, LocalRecord> {
  const all = new Map<string, LocalRecord>();
  const shape = db as unknown as Record<string, unknown>;
  for (const collection of COLLECTIONS) {
    if (collection === "paketIsian") {
      for (const [localKey, values] of Object.entries(db.paketIsian)) {
        const separator = localKey.indexOf(":");
        if (separator < 1) continue;
        const localSanggarId = localKey.slice(0, separator);
        const paketId = localKey.slice(separator + 1);
        const sanggarId = userToken(db, localSanggarId);
        // Hanya gunakan karakter id yang diterima API; isi record tetap
        // menyimpan paketId terpisah sehingga pemisah ini tidak perlu diurai.
        const id = `${sanggarId}:${paketId}`;
        const data = { sanggarId, paketId, values: clone(values) } as WireData;
        all.set(recordKey(collection, id), { collection, id, data });
      }
      continue;
    }
    const entries = shape[collection];
    if (!Array.isArray(entries)) continue;
    for (const item of entries) {
      if (!isRecord(item) || typeof item.id !== "string") continue;
      const data = encodeReferences(item, db) as WireData;
      all.set(recordKey(collection, item.id), {
        collection,
        id: item.id,
        data,
      });
    }
  }
  return all;
}

function actorLocalUser(db: DBShape): AnyUser | undefined {
  if (!actor) return undefined;
  return (
    db.users.find((user) => user.apiId === actor!.id) ??
    db.users.find(
      (user) => user.username.toLowerCase() === actor!.username.toLowerCase(),
    )
  );
}

function isSystemRole(user: AnyUser | undefined) {
  return user?.role === "kurator" || user?.role === "admin";
}

function relatedKerjasama(db: DBShape, id: unknown) {
  return typeof id === "string"
    ? db.kerjasama.find((item) => item.id === id)
    : undefined;
}

function relatedPemesananSewa(db: DBShape, id: unknown) {
  return typeof id === "string"
    ? db.pemesananSewa.find((item) => item.id === id)
    : undefined;
}

function isSharedTransactionParticipant(
  db: DBShape,
  parentId: unknown,
  userId: string,
): boolean {
  const kerjasama = relatedKerjasama(db, parentId);
  if (kerjasama) {
    return (
      kerjasama.sanggarPenyediaId === userId ||
      kerjasama.sanggarPeminjamId === userId
    );
  }
  const pemesanan = relatedPemesananSewa(db, parentId);
  return Boolean(
    pemesanan &&
    (pemesanan.sewaId === userId ||
      pemesanan.sanggarId === userId ||
      pemesanan.sdmUserId === userId),
  );
}

function canQueueRecord(db: DBShape, record: LocalRecord): boolean {
  const current = actorLocalUser(db);
  if (!current) return false;
  if (isSystemRole(current)) return true;
  const data = record.data;
  const localData = decodeReferences(data, db) as WireData;
  if (record.collection === "infoBudaya") {
    return current.role === "sanggar" && localData.authorId === current.id;
  }
  if (GLOBAL_COLLECTIONS.has(record.collection)) return false;

  const isCurrent = (value: unknown) => value === current.id;

  // Anggota boleh mengirim aksi pribadinya; server membatasi perubahan field
  // (bukti iuran, pengajuan honor baru, konfirmasi penerimaan honor).
  if ((current.role === "pelatih" || current.role === "seniman") && current.status === "aktif" && localData.sanggarId === current.sanggarId) {
    if (record.collection === "pengajuanHonor") return current.role === "pelatih" && isCurrent(localData.pelatihId);
    if (record.collection === "iuran") return current.role === "seniman" && isCurrent(localData.senimanId);
    if (record.collection === "distribusi") return isCurrent(localData.penerimaId);
  }

  if (SANGGAR_COLLECTIONS.has(record.collection))
    return isCurrent(localData.sanggarId);
  if (record.collection === "paketIsian") return isCurrent(localData.sanggarId);
  if (record.collection === "activity") return isCurrent(localData.actorId);
  if (record.collection === "absensiLatihan")
    return isCurrent(localData.userId);
  if (record.collection === "sertifikat") {
    return isCurrent(localData.pemilikId) || isCurrent(localData.sanggarId);
  }
  if (record.collection === "kerjasama") {
    return (
      isCurrent(localData.sanggarPenyediaId) ||
      isCurrent(localData.sanggarPeminjamId)
    );
  }
  if (record.collection === "pemesananSewa") {
    return (
      isCurrent(localData.sewaId) ||
      isCurrent(localData.sanggarId) ||
      isCurrent(localData.sdmUserId)
    );
  }
  if (
    record.collection === "kerjasamaMitraPengrajin" ||
    record.collection === "pesananProdukPengrajin"
  ) {
    return isCurrent(localData.mitraId) || isCurrent(localData.pengrajinId);
  }
  if (
    record.collection === "chatMessages" ||
    record.collection === "negosiasi" ||
    record.collection === "invoices" ||
    record.collection === "contracts" ||
    record.collection === "bast" ||
    record.collection === "ratings"
  ) {
    return isSharedTransactionParticipant(
      db,
      localData.kerjasamaId,
      current.id,
    );
  }
  if (record.collection === "payments") {
    const invoice = db.invoices.find((item) => item.id === localData.invoiceId);
    return isSharedTransactionParticipant(db, invoice?.kerjasamaId, current.id);
  }
  return false;
}

function outboxStorageKey() {
  return actor ? `${OUTBOX_PREFIX}:${actor.id}` : null;
}

function persistOutbox() {
  const key = outboxStorageKey();
  if (!key || typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify([...outbox.values()]));
  } catch {
    // Jika browser kehabisan ruang, data utama tetap tersimpan; sync akan
    // mengirim perubahan berikutnya selama tab ini masih terbuka.
  }
}

function restoreOutbox() {
  outbox = new Map();
  const key = outboxStorageKey();
  if (!key || typeof localStorage === "undefined") return;
  try {
    const raw = localStorage.getItem(key);
    const saved = raw ? (JSON.parse(raw) as QueuedMutation[]) : [];
    for (const mutation of saved) {
      if (mutation && typeof mutation.key === "string")
        outbox.set(mutation.key, mutation);
    }
  } catch {
    // Abaikan antrean yang korup; perubahan baru tetap dapat tersinkron.
  }
}

function clearOutbox() {
  const key = outboxStorageKey();
  outbox.clear();
  if (key && typeof localStorage !== "undefined") localStorage.removeItem(key);
}

function queue(
  record: LocalRecord | undefined,
  previous: LocalRecord | undefined,
) {
  const source = record ?? previous;
  if (!source) return;
  const key = recordKey(source.collection, source.id);
  const existing = outbox.get(key);
  const mutation: QueuedMutation = {
    key,
    mutationId: newMutationId(),
    collection: source.collection,
    id: source.id,
    op: record ? "upsert" : "delete",
    baseRevision: existing?.baseRevision ?? revisions.get(key),
    ...(record ? { data: clone(record.data) } : {}),
  };
  outbox.set(key, mutation);
  persistOutbox();
}

function scheduleFlush() {
  if (!ready || !actor || flushing || outbox.size === 0) return;
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flush();
  }, 600);
}

function applyRecord(db: DBShape, record: ApiSyncRecord) {
  const data = decodeReferences(record.data, db) as WireData;
  if (record.collection === "paketIsian") {
    const sanggarId =
      typeof data.sanggarId === "string" ? data.sanggarId : null;
    const paketId = typeof data.paketId === "string" ? data.paketId : null;
    if (!sanggarId || !paketId) return;
    const key = `${sanggarId}:${paketId}`;
    if (record.deletedAt) delete db.paketIsian[key];
    else if (isRecord(data.values))
      db.paketIsian[key] = data.values as Record<string, string>;
    return;
  }

  const target = (db as unknown as Record<string, unknown[]>)[
    record.collection
  ];
  if (!Array.isArray(target)) return;
  const index = target.findIndex(
    (item) => isRecord(item) && item.id === record.id,
  );
  if (record.deletedAt) {
    if (index >= 0) target.splice(index, 1);
    return;
  }
  const next = { ...data, id: record.id };
  if (record.collection === "infoBudaya") {
    normalizeInfoBudayaForStore(next as unknown as InfoBudaya);
  }
  if (index >= 0) target[index] = next;
  else target.push(next);
}

function makeUser(identity: ApiSyncIdentity): AnyUser {
  const profile = identity.profile ?? {};
  const createdAt = Date.parse(identity.createdAt) || Date.now();
  const base = {
    id: `u_api_${identity.id}`,
    apiId: identity.id,
    username: identity.username,
    password: "***api***",
    createdAt,
    statusModerasiAkun:
      identity.status === "diblokir" ||
      profile.statusModerasiAkun === "diblokir"
        ? "diblokir"
        : "aktif",
    kategoriBlokirAkun: profile.kategoriBlokirAkun,
    alasanBlokirAkun: profile.alasanBlokirAkun,
    diblokirAt: profile.diblokirAt,
    diblokirOleh: profile.diblokirOleh,
  };
  switch (identity.role as Role) {
    case "sanggar":
      return {
        ...base,
        role: "sanggar",
        namaSanggar: String(profile.namaSanggar ?? identity.username),
        namaKetua: String(profile.namaKetua ?? "-"),
        legalitas: "Non-Badan Hukum",
        jenisKesenian: [],
        alamat: String(profile.alamat ?? "-"),
        rekening: { bank: "BCA", nomor: "-", atasNama: "-" },
        saldo: 0,
        editCount: 0,
        editPeriodStart: createdAt,
        ...profile,
      } as SanggarUser;
    case "pelatih":
      return {
        ...base,
        role: "pelatih",
        nama: String(profile.nama ?? identity.username),
        usia: 0,
        pendidikan: "-",
        jenisKesenian: "Tari",
        status: "aktif",
        rekening: { bank: "BCA", nomor: "-", atasNama: "-" },
        honorPerSesi: 0,
        ...profile,
      } as PelatihUser;
    case "seniman":
      return {
        ...base,
        role: "seniman",
        nama: String(profile.nama ?? identity.username),
        usia: 0,
        pendidikan: "-",
        jenisKesenian: "Tari",
        status: "aktif",
        rekening: { bank: "BCA", nomor: "-", atasNama: "-" },
        ...profile,
      } as SenimanUser;
    case "juri":
      return {
        ...base,
        role: "juri",
        nama: String(profile.nama ?? identity.username),
        keahlian: String(profile.keahlian ?? "Umum"),
        ...profile,
      } as JuriUser;
    case "admin":
      return {
        ...base,
        role: "admin",
        nama: String(profile.nama ?? identity.username),
        permissions: {
          kelolaBerita: true,
          kelolaBanner: true,
          kelolaSlider: true,
          kelolaJamPembinaan: false,
          kelolaInfoBudaya: true,
        },
        ...profile,
      } as AdminUser;
    case "sewa":
      return {
        ...base,
        role: "sewa",
        nama: String(profile.nama ?? identity.username),
        ...profile,
      } as SewaUser;
    case "pengrajin":
      return {
        ...base,
        role: "pengrajin",
        namaUsaha: String(profile.namaUsaha ?? identity.username),
        namaPemilik: String(profile.namaPemilik ?? "-"),
        bentukUsaha: "Perorangan",
        jenisKerajinan: String(profile.jenisKerajinan ?? "Kerajinan Lainnya"),
        produkUnggulan: String(profile.produkUnggulan ?? "-"),
        produk: [],
        alamat: String(profile.alamat ?? "-"),
        wilayah: profile.wilayah ?? {},
        lat: Number(profile.lat ?? 0),
        lng: Number(profile.lng ?? 0),
        npwp: "",
        nib: "",
        rekening: {
          bank: "BCA",
          nomor: "",
          atasNama: String(profile.namaPemilik ?? "-"),
        },
        dokumen: [],
        tokoDipublikasikan: true,
        menerimaSewaJasa: false,
        menerimaKerjasama: false,
        ...profile,
      } as PengrajinUser;
    case "mitra_pengrajin":
      return {
        ...base,
        role: "mitra_pengrajin",
        namaUsaha: String(profile.namaUsaha ?? identity.username),
        namaPenanggungJawab: String(profile.namaPenanggungJawab ?? "-"),
        bentukUsaha: "Perorangan",
        alamat: String(profile.alamat ?? "-"),
        memilikiTokoOffline: profile.memilikiTokoOffline !== false,
        namaTokoOffline: String(
          profile.namaTokoOffline ?? profile.namaUsaha ?? identity.username,
        ),
        alamatTokoOffline: String(
          profile.alamatTokoOffline ?? profile.alamat ?? "-",
        ),
        npwp: "",
        nib: "",
        rekening: { bank: "BCA", nomor: "", atasNama: "-" },
        dokumen: [],
        marketplace: [],
        paketProduk: [],
        jabatanPenandatangan: "Penanggung Jawab",
        ...profile,
      } as MitraPengrajinUser;
    default:
      return { ...base, role: "kurator" } as AnyUser;
  }
}

/** Terapkan direktori identitas tanpa pernah membawa sandi ke browser. */
function applyIdentities(
  identities: ApiSyncIdentity[],
  directoryComplete = false,
) {
  save(
    (db) => {
      for (const identity of identities) {
        const existing =
          db.users.find((user) => user.apiId === identity.id) ??
          db.users.find(
            (user) =>
              user.username.toLowerCase() === identity.username.toLowerCase(),
          );
        if (existing) {
          existing.apiId = identity.id;
          existing.username = identity.username;
          existing.statusModerasiAkun =
            identity.status === "diblokir" ||
            identity.profile?.statusModerasiAkun === "diblokir"
              ? "diblokir"
              : "aktif";
          // Profil dari server boleh memperbarui field publik, tetapi tidak
          // menimpa id lokal maupun nilai sandi demo.
          Object.assign(
            existing as unknown as Record<string, unknown>,
            identity.profile ?? {},
          );
        } else {
          db.users.push(makeUser(identity));
        }
      }
      if (directoryComplete) {
        const apiIds = new Set(identities.map((identity) => identity.id));
        const usernames = new Set(
          identities.map((identity) => identity.username.toLowerCase()),
        );
        db.users = db.users.filter(
          (user) =>
            (typeof user.apiId === "string" && apiIds.has(user.apiId)) ||
            usernames.has(user.username.toLowerCase()),
        );
      }
      // Hubungkan anggota ke id Sanggar lokal setelah seluruh direktori ada.
      for (const user of db.users) {
        if (user.role !== "pelatih" && user.role !== "seniman") continue;
        const identity = identities.find((item) => item.id === user.apiId);
        const sanggarUsername = identity?.profile?.sanggarUsername;
        if (typeof sanggarUsername !== "string") continue;
        user.sanggarId = db.users.find(
          (candidate) =>
            candidate.role === "sanggar" &&
            candidate.username.toLowerCase() === sanggarUsername.toLowerCase(),
        )?.id;
      }
    },
    { origin: "remote" },
  );
}

function applyBootstrap(payload: ApiSyncBootstrap) {
  applyIdentities(payload.identities, payload.directoryComplete === true);
  const serverInfoRecords = payload.records.filter(
    (record) => record.collection === "infoBudaya",
  );
  rememberInfoBudayaTombstones(
    serverInfoRecords
      .filter((record) => Boolean(record.deletedAt))
      .map((record) => record.id),
  );
  const serverGlobalIds = new Map<ApiSyncCollection, Set<string>>();
  for (const collection of GLOBAL_COLLECTIONS) {
    serverGlobalIds.set(collection, new Set());
  }
  for (const record of payload.records) {
    serverGlobalIds.get(record.collection)?.add(record.id);
  }
  let outboxChanged = false;
  for (const [key, mutation] of outbox) {
    if (
      mutation.op === "upsert" &&
      GLOBAL_COLLECTIONS.has(mutation.collection) &&
      serverGlobalIds.get(mutation.collection)?.has(mutation.id) !== true &&
      isLegacyGlobalSeedRecord(
        mutation.collection,
        mutation.id,
        mutation.data ?? {},
      )
    ) {
      outbox.delete(key);
      outboxChanged = true;
    }
  }
  save(
    (db) => {
      // Snapshot server selalu menjadi sumber utama untuk koleksi global.
      // Pertahankan hanya edit lokal yang benar-benar tercatat di outbox;
      // seed/cache lama yang tidak dikenal server tidak boleh dipromosikan.
      const keepGlobal = <T extends { id: string }>(
        collection: ApiSyncCollection,
        items: T[],
      ) =>
        items.filter((item) => {
          const pending = outbox.get(recordKey(collection, item.id));
          return (
            serverGlobalIds.get(collection)?.has(item.id) === true ||
            pending?.op === "upsert"
          );
        });
      db.news = keepGlobal("news", db.news);
      db.banners = keepGlobal("banners", db.banners);
      db.slider = keepGlobal("slider", db.slider);
      db.infoBudaya = keepGlobal("infoBudaya", db.infoBudaya);
      for (const record of payload.records) {
        const key = recordKey(record.collection, record.id);
        const pending = outbox.get(key);
        if (record.deletedAt) {
          if (pending) {
            // Tombstone server bersifat final. Mutasi lokal yang masih mengacu
            // record ini tidak boleh menghidupkannya kembali atau retry terus.
            outbox.delete(key);
            outboxChanged = true;
          }
        } else if (pending) {
          // Jangan timpa edit offline yang belum terkirim dengan snapshot,
          // berlaku untuk semua koleksi dan bukan hanya Media Kreatif.
          continue;
        }
        applyRecord(db, record);
      }

      // Migrasi browser lama dapat memetakan beberapa seed acak ke ID canonical
      // yang sama. Pertahankan hanya versi lokal terbaru berdasarkan stable ID.
      const uniqueMedia = new Map<string, InfoBudaya>();
      for (const item of db.infoBudaya) {
        const current = uniqueMedia.get(item.id);
        if (!current || item.updatedAt >= current.updatedAt) {
          uniqueMedia.set(item.id, item);
        }
      }
      db.infoBudaya = [...uniqueMedia.values()];
    },
    { origin: "remote" },
  );
  revisions = new Map(
    payload.records.map((record) => [
      recordKey(record.collection, record.id),
      record.revision,
    ]),
  );
  // Edit dapat terjadi selagi bootstrap masih berjalan. Rebase antrean itu ke
  // snapshot yang baru diterima agar perubahan tidak hilang atau konflik semu.
  for (const [key, mutation] of outbox) {
    const baseRevision = revisions.get(key);
    if (mutation.baseRevision !== baseRevision) {
      mutation.baseRevision = baseRevision;
      outboxChanged = true;
    }
  }
  if (outboxChanged) persistOutbox();
}

function recordMutation(before: DBShape, after: DBShape) {
  // Antrekan juga perubahan yang terjadi saat request bootstrap masih berjalan.
  // scheduleFlush sendiri menunggu `ready`, jadi data aman tanpa dikirim dini.
  if (!actor) return;
  const previous = getRecords(before);
  const current = getRecords(after);
  const keys = new Set([...previous.keys(), ...current.keys()]);
  for (const key of keys) {
    const left = previous.get(key);
    const right = current.get(key);
    if (JSON.stringify(left?.data) === JSON.stringify(right?.data)) continue;
    const candidate = right ?? left;
    if (candidate && canQueueRecord(after, candidate)) queue(right, left);
  }
  scheduleFlush();
}

async function flush() {
  if (!actor || !ready || flushing || outbox.size === 0) return;
  flushing = true;
  const sent = [...outbox.values()].slice(0, 60);
  for (const mutation of sent) outbox.delete(mutation.key);
  persistOutbox();
  try {
    const response = await syncApi.mutate(
      sent.map(({ key, ...mutation }) => mutation),
    );
    const byId = new Map(
      sent.map((mutation) => [mutation.mutationId, mutation]),
    );
    const remoteRecords: ApiSyncRecord[] = [];
    let refreshRejectedSnapshot = false;
    const rejected: DataSyncRejection[] = [];
    for (const result of response.results) {
      const original = byId.get(result.mutationId);
      if (!original) continue;
      const latest = outbox.get(original.key);
      if (result.status === "applied" && result.record) {
        revisions.set(original.key, result.record.revision);
        if (latest) {
          latest.baseRevision = result.record.revision;
          outbox.set(original.key, latest);
        } else {
          remoteRecords.push(result.record);
        }
      } else if (result.status === "conflict" && result.record) {
        if (original.collection === "infoBudaya" && result.record.deletedAt) {
          // Tombstone tidak dapat dihidupkan kembali oleh endpoint sync;
          // menerima snapshot mencegah retry konflik tanpa akhir.
          revisions.set(original.key, result.record.revision);
          remoteRecords.push(result.record);
          outbox.delete(original.key);
          continue;
        }
        // Pertahankan perubahan lokal dan kirim ulang terhadap revisi terbaru.
        // Ini adalah last-writer-wins yang eksplisit untuk draft; endpoint
        // domain khusus tetap memegang aturan final seperti kurasi.
        const retry = latest ?? original;
        retry.baseRevision = result.record.revision;
        retry.mutationId = newMutationId();
        outbox.set(original.key, retry);
        revisions.set(original.key, result.record.revision);
      } else if (result.status === "rejected") {
        // Semua penolakan final harus dipulihkan dari snapshot server. Tanpa
        // ini transaksi lokal tampak berhasil meskipun pihak lain tidak pernah
        // menerima perubahan tersebut.
        refreshRejectedSnapshot = true;
        rejected.push({
          collection: original.collection,
          id: original.id,
          error: result.error ?? "Perubahan ditolak server.",
        });
      }
      // Mutasi rejected tetap dibuang agar tidak menjadi retry tanpa akhir;
      // snapshot di bawah menjadi sumber kebenaran dan UI menerima notifikasi.
    }
    if (remoteRecords.length > 0) {
      rememberInfoBudayaTombstones(
        remoteRecords
          .filter(
            (record) =>
              record.collection === "infoBudaya" && Boolean(record.deletedAt),
          )
          .map((record) => record.id),
      );
      save(
        (db) => {
          for (const record of remoteRecords) applyRecord(db, record);
        },
        { origin: "remote" },
      );
    }
    if (refreshRejectedSnapshot && actor) {
      try {
        applyBootstrap(await syncApi.bootstrap());
      } catch {
        // Mutasi sudah memiliki hasil final; kegagalan refresh tidak boleh
        // mengantrekan ulang batch yang sudah diterima server.
      }
    }
    for (const issue of rejected) notifyDataSyncRejection(issue);
  } catch {
    // Jaringan boleh putus setelah server menerima sebagian batch. Mutation ID
    // membuat retry berikutnya idempoten sehingga aman mengembalikan antrean.
    for (const mutation of sent) {
      if (!outbox.has(mutation.key)) outbox.set(mutation.key, mutation);
    }
  } finally {
    flushing = false;
    persistOutbox();
    if (refreshAfterFlush) {
      refreshAfterFlush = false;
      void refreshDataSync();
    } else if (outbox.size > 0) {
      scheduleFlush();
    }
  }
}

/** Tunggu konfirmasi server sebelum menyatakan draf tersimpan. */
export async function waitForServer(): Promise<boolean> {
  const started = Date.now();
  const errors = dataSyncRejectionCount;
  while (Date.now() - started < 15000) {
    if (!navigator.onLine) {
      throw new Error(
        "Koneksi terputus. Draf tetap ada di perangkat; sambungkan internet lalu simpan lagi.",
      );
    }
    if (actor && ready) {
      if (!flushing && outbox.size) await flush();
      if (dataSyncRejectionCount !== errors) {
        throw new Error(
          "Server menolak perubahan. Periksa data lalu simpan kembali.",
        );
      }
      if (!flushing && outbox.size === 0) return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(
    "Data belum dikonfirmasi server. Draf masih menunggu sinkronisasi; coba simpan lagi.",
  );
}

/**
 * Tarik snapshot terbaru tanpa mengganti sesi atau membuang outbox lokal.
 * Dipanggil ketika tab kembali aktif agar perubahan pihak transaksi pada
 * perangkat/tab lain langsung terlihat.
 */
export async function refreshDataSync(): Promise<void> {
  if (!actor || !ready) return;
  if (flushing) {
    refreshAfterFlush = true;
    return;
  }
  if (refreshing) return;

  const expectedActorId = actor.id;
  refreshing = true;
  try {
    const payload = await syncApi.bootstrap();
    if (!actor || actor.id !== expectedActorId) return;
    applyBootstrap(payload);
  } catch {
    // Jaringan sementara putus: cache lokal tetap dapat digunakan dan event
    // fokus berikutnya akan mencoba menarik snapshot lagi.
  } finally {
    refreshing = false;
    if (outbox.size > 0) scheduleFlush();
  }
}

/**
 * Mulai sinkronisasi setelah autentikasi server berhasil. Bootstrap lebih dulu
 * agar seed lokal pada perangkat baru tidak menimpa data yang sudah ada.
 */
export async function startDataSync(
  identity: Pick<ApiAuthUser, "id" | "username" | "role">,
): Promise<void> {
  actor = { id: identity.id, username: identity.username, role: identity.role };
  ready = false;
  restoreOutbox();
  setStoreChangeListener(recordMutation);
  try {
    const payload = await syncApi.bootstrap();
    if (!actor || actor.id !== identity.id) return;
    applyBootstrap(payload);
    ready = true;
    // Snapshot lokal lama/seed bukan bukti adanya perubahan pengguna. Mutasi
    // nyata selama sesi sudah ditangkap listener (termasuk saat bootstrap masih
    // berjalan), sehingga memindai seluruh cache di sini hanya akan mengunggah
    // kembali data demo atau record yang sudah ditombstone server.
    scheduleFlush();
  } catch {
    // Server/offline: pengamat tetap aktif. Begitu koneksi kembali, handler
    // `online` akan mencoba bootstrap lagi melalui pemanggilan berikutnya.
    ready = true;
  }
}

/** Hentikan sesi sinkronisasi ketika logout atau akun berganti. */
export function stopDataSync(options: { clearPending?: boolean } = {}) {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = null;
  if (options.clearPending) clearOutbox();
  ready = false;
  flushing = false;
  refreshing = false;
  refreshAfterFlush = false;
  revisions.clear();
  actor = null;
  setStoreChangeListener(null);
}

if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    if (actor) void startDataSync(actor);
  });
  window.addEventListener("focus", () => {
    void refreshDataSync();
  });
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") void refreshDataSync();
    });
  }
}
