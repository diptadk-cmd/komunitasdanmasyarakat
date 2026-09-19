export type CreativeMediaKind =
  | "youtube"
  | "spotify"
  | "soundcloud"
  | "audio"
  | "video"
  | "image"
  | "link";

export type UploadMediaKind =
  | "audio"
  | "video"
  | "image"
  | "document"
  | "other";

const CREATIVE_MEDIA_KINDS = new Set<CreativeMediaKind>([
  "youtube",
  "spotify",
  "soundcloud",
  "audio",
  "video",
  "image",
  "link",
]);

const PUBLIC_MEDIA_PATH = /^\/api\/public\/media\/([0-9a-f-]{36})$/i;

function asUrl(value: unknown): URL | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value.trim(), "http://localhost");
    return url.protocol === "http:" || url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

export function uploadMediaKind(contentType: string): UploadMediaKind {
  const normalized = contentType.trim().toLowerCase();
  if (normalized.startsWith("audio/")) return "audio";
  if (normalized.startsWith("video/")) return "video";
  if (normalized.startsWith("image/")) return "image";
  if (normalized === "application/pdf") return "document";
  return "other";
}

export function creativeMediaKindFromContentType(
  contentType: unknown,
): CreativeMediaKind | undefined {
  if (typeof contentType !== "string") return undefined;
  const kind = uploadMediaKind(contentType);
  if (kind === "audio" || kind === "video" || kind === "image") return kind;
  return undefined;
}

export function inferCreativeMediaKind(
  mediaUrl: unknown,
  contentType?: unknown,
  declaredKind?: unknown,
): CreativeMediaKind | undefined {
  const url = asUrl(mediaUrl);
  if (url) {
    const host = url.hostname
      .toLowerCase()
      .replace(/^www\./, "")
      .replace(/^m\./, "");
    if (
      host === "youtu.be" ||
      host === "youtube.com" ||
      host.endsWith(".youtube.com") ||
      host === "youtube-nocookie.com" ||
      host.endsWith(".youtube-nocookie.com")
    ) {
      return "youtube";
    }
    if (host === "open.spotify.com") return "spotify";
    if (host === "soundcloud.com" || host.endsWith(".soundcloud.com")) {
      return "soundcloud";
    }
  }

  const fromContentType = creativeMediaKindFromContentType(contentType);
  if (fromContentType) return fromContentType;
  if (
    typeof declaredKind === "string" &&
    CREATIVE_MEDIA_KINDS.has(declaredKind as CreativeMediaKind)
  ) {
    return declaredKind as CreativeMediaKind;
  }

  const extension = url?.pathname.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1];
  if (
    ["mp3", "wav", "ogg", "oga", "m4a", "aac", "flac"].includes(extension ?? "")
  ) {
    return "audio";
  }
  if (["mp4", "webm", "ogv", "mov", "m4v"].includes(extension ?? "")) {
    return "video";
  }
  if (
    ["jpg", "jpeg", "png", "webp", "gif", "avif", "svg"].includes(
      extension ?? "",
    )
  ) {
    return "image";
  }
  return url ? "link" : undefined;
}

export function publicMediaUploadId(value: unknown): string | null {
  const url = asUrl(value);
  return url?.pathname.match(PUBLIC_MEDIA_PATH)?.[1] ?? null;
}

export function normalizeCreativeMediaFields(
  item: Record<string, unknown>,
  upload?: { contentType: string } | null,
): Record<string, unknown> {
  const next = { ...item };
  const contentType =
    upload?.contentType ??
    (typeof next["mediaContentType"] === "string"
      ? next["mediaContentType"].trim()
      : undefined);
  const kind = inferCreativeMediaKind(
    next["mediaUrl"],
    contentType,
    next["mediaKind"],
  );

  if (contentType) next["mediaContentType"] = contentType;
  else delete next["mediaContentType"];
  if (kind) next["mediaKind"] = kind;
  else delete next["mediaKind"];
  return next;
}

/**
 * Klien moderasi lama hanya mengubah `active`, sehingga server pernah
 * menyimpan kombinasi mustahil `active: true` + `publicationStatus: pending`.
 * Jadikan keputusan moderator konsisten tanpa mengubah workflow milik Sanggar.
 */
export function normalizeCreativeMediaModerationWorkflow(
  item: Record<string, unknown>,
  isOverseer: boolean,
): Record<string, unknown> {
  if (!isOverseer) return item;

  const next = { ...item };
  if (next["active"] === true) {
    next["publicationStatus"] = "published";
  } else if (
    next["active"] === false &&
    next["publicationStatus"] === "published"
  ) {
    next["publicationStatus"] = "pending";
  }
  return next;
}

export type CreativeMediaAuthorshipResult =
  | {
      ok: true;
      data: Record<string, unknown>;
      ownerId: string;
    }
  | { ok: false };

/**
 * Author sebuah karya tidak boleh diganti melalui payload moderasi. ID hasil
 * resolve dipisahkan dari token mentah agar `username:x` dan `user:uuid` yang
 * menunjuk orang sama tetap kompatibel, sementara nilai tersimpan dipertahankan.
 */
export function preserveCreativeMediaAuthorship(input: {
  existingData: Record<string, unknown>;
  incomingData: Record<string, unknown>;
  existingOwnerId: string;
  existingAuthorId?: string;
  incomingAuthorId?: string;
}): CreativeMediaAuthorshipResult {
  const existingRaw = input.existingData["authorId"];
  const incomingHasAuthor = input.incomingData["authorId"] !== undefined;

  if (existingRaw !== undefined) {
    if (!input.existingAuthorId) return { ok: false };
    if (
      incomingHasAuthor &&
      input.incomingAuthorId !== input.existingAuthorId
    ) {
      return { ok: false };
    }
    return {
      ok: true,
      data: { ...input.incomingData, authorId: existingRaw },
      ownerId: input.existingAuthorId,
    };
  }

  // Record sangat lama dapat belum memiliki authorId. Payload tidak boleh
  // mengambil alih; owner lama menjadi fallback otoritatif.
  if (incomingHasAuthor && input.incomingAuthorId !== input.existingOwnerId) {
    return { ok: false };
  }
  const data = { ...input.incomingData };
  delete data["authorId"];
  return { ok: true, data, ownerId: input.existingOwnerId };
}

/**
 * Aturan tayang Media Kreatif. Record legacy memakai `active`, sedangkan
 * record yang sudah memiliki workflow wajib berstatus `published`.
 */
export function isPublishedCreativeMedia(
  item: Record<string, unknown>,
): boolean {
  if (item["active"] !== true) return false;
  const status = item["publicationStatus"];
  return status === undefined || status === "published";
}

/**
 * Demo adalah initial data, bukan rekonsiliasi startup. Begitu server pernah
 * memiliki Media Kreatif—termasuk tombstone—pengguna menjadi sumber kebenaran
 * dan seed tidak boleh membuat record yang hilang muncul kembali.
 */
export function shouldInitializeCanonicalCreativeMedia(
  history: readonly unknown[],
): boolean {
  return history.length === 0;
}

export const CANONICAL_RESURRECTION_MIN_AGE_MS = 86_400_000;

export interface CreativeMediaHistoryRecord {
  recordId: string;
  data: Record<string, unknown>;
  revision: number;
  createdAt: Date | string | number;
  deletedAt?: Date | string | number | null;
}

function exactCreativeMediaContent(
  left: Record<string, unknown>,
  right: Record<string, unknown>,
): boolean {
  return (
    typeof left["judul"] === "string" &&
    typeof left["isi"] === "string" &&
    left["judul"] === right["judul"] &&
    left["isi"] === right["isi"]
  );
}

function timestamp(value: Date | string | number | null | undefined): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value;
  return typeof value === "string" ? Date.parse(value) : Number.NaN;
}

/**
 * Temukan bukti bahwa canonical revision pertama adalah kebangkitan seed lama.
 * Jeda sehari membedakan hapus historis dari selisih zona waktu/cleanup pada
 * startup yang sama. Canonical yang pernah diedit tidak disentuh otomatis.
 */
export function historicalDeletionForCanonicalMedia(
  canonical: CreativeMediaHistoryRecord,
  definition: { id: string; data: Record<string, unknown> },
  history: readonly CreativeMediaHistoryRecord[],
  minimumAgeMs = CANONICAL_RESURRECTION_MIN_AGE_MS,
): CreativeMediaHistoryRecord | undefined {
  if (
    canonical.recordId !== definition.id ||
    canonical.deletedAt != null ||
    canonical.revision !== 1 ||
    !exactCreativeMediaContent(canonical.data, definition.data)
  ) {
    return undefined;
  }
  const canonicalCreatedAt = timestamp(canonical.createdAt);
  if (!Number.isFinite(canonicalCreatedAt)) return undefined;

  return history
    .filter((row) => {
      if (row.recordId === canonical.recordId || row.deletedAt == null) {
        return false;
      }
      const deletedAt = timestamp(row.deletedAt);
      return (
        Number.isFinite(deletedAt) &&
        canonicalCreatedAt - deletedAt >= minimumAgeMs &&
        exactCreativeMediaContent(row.data, definition.data)
      );
    })
    .sort((a, b) => timestamp(b.deletedAt) - timestamp(a.deletedAt))[0];
}

function normalizedText(value: unknown): string {
  return typeof value === "string" ? value.trim().toLocaleLowerCase("id") : "";
}

function contentKey(item: Record<string, unknown>): string {
  // ID server adalah identitas karya. Dua karya modern yang kebetulan memiliki
  // judul dan isi sama tetap sah sebagai dua publikasi berbeda.
  if (item["publicationStatus"] !== undefined) {
    return `id:${String(item["id"] ?? "")}`;
  }

  // Hanya data legacy tanpa workflow yang pernah dibuat berulang oleh seed
  // browser acak; semantic key dipakai khusus untuk kompatibilitas data itu.
  const title = normalizedText(item["judul"]);
  const body = normalizedText(item["isi"]);
  if (title && body) return `legacy-content:${title}\u0000${body}`;
  return `id:${String(item["id"] ?? "")}`;
}

function numberValue(item: Record<string, unknown>, key: string): number {
  const value = Number(item[key] ?? 0);
  return Number.isFinite(value) ? value : 0;
}

/** Hilangkan salinan seed legacy tanpa membatasi/menggabungkan karya modern. */
export function dedupeCreativeMediaItems(
  items: Array<Record<string, unknown>>,
): Array<Record<string, unknown>> {
  const newestFirst = [...items].sort(
    (a, b) =>
      numberValue(b, "updatedAt") - numberValue(a, "updatedAt") ||
      numberValue(b, "createdAt") - numberValue(a, "createdAt"),
  );
  const unique = new Map<string, Record<string, unknown>>();
  for (const item of newestFirst) {
    const key = contentKey(item);
    if (!unique.has(key)) unique.set(key, item);
  }
  return [...unique.values()].sort(
    (a, b) =>
      numberValue(a, "order") - numberValue(b, "order") ||
      numberValue(b, "createdAt") - numberValue(a, "createdAt"),
  );
}
