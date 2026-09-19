import { createHash } from "node:crypto";

const MAX_DEPTH = 4;
const MAX_KEYS = 32;
const MAX_ARRAY_ITEMS = 20;
const MAX_STRING_LENGTH = 512;
const SENSITIVE_KEY =
  /password|passwd|otp|token|secret|authorization|cookie|session|credential|hash/i;

export interface ActivityAuditActor {
  id: string;
  role: string;
}

export interface ActivityAuditEvent {
  /** Dipakai saat memirror log legacy agar prosesnya idempoten. */
  id?: string;
  actor: ActivityAuditActor;
  action: string;
  targetType?: string;
  targetId?: string;
  meta?: Record<string, unknown>;
  at?: Date;
}

function sanitizeValue(value: unknown, depth: number): unknown {
  if (value === null || typeof value === "boolean" || typeof value === "number")
    return value;
  if (typeof value === "string") return value.slice(0, MAX_STRING_LENGTH);
  if (depth >= MAX_DEPTH) return "[truncated]";
  if (Array.isArray(value)) {
    return value
      .slice(0, MAX_ARRAY_ITEMS)
      .map((item) => sanitizeValue(item, depth + 1));
  }
  if (typeof value !== "object")
    return String(value).slice(0, MAX_STRING_LENGTH);

  const output: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value).slice(0, MAX_KEYS)) {
    if (SENSITIVE_KEY.test(key)) continue;
    output[key] = sanitizeValue(item, depth + 1);
  }
  return output;
}

/**
 * Pertahanan berlapis agar password, OTP, token sesi/reset, cookie, dan hash
 * tidak pernah ikut tersimpan walau pemanggil tanpa sengaja memasukkannya.
 */
export function sanitizeAuditMeta(
  meta: Record<string, unknown> | undefined,
): Record<string, unknown> {
  return (sanitizeValue(meta ?? {}, 0) ?? {}) as Record<string, unknown>;
}

function boundedAuditId(value: string): string {
  if (value.length <= 36) return value;
  const hash = createHash("sha256")
    .update(`sync-activity:${value}`)
    .digest("hex");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
}

export function activityAuditValues(event: ActivityAuditEvent) {
  const at = event.at ?? new Date();
  return {
    ...(event.id ? { id: boundedAuditId(event.id) } : {}),
    actorId: event.actor.id,
    actorRole: event.actor.role,
    action: event.action.slice(0, 128),
    targetType: event.targetType?.slice(0, 64),
    targetId: event.targetId?.slice(0, 191),
    data: sanitizeAuditMeta(event.meta),
    createdAt: at,
    updatedAt: at,
  };
}

function safeEventDate(value: unknown): Date | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  const date = new Date(value);
  const earliest = Date.UTC(2000, 0, 1);
  const latest = Date.now() + 86_400_000;
  return date.getTime() >= earliest && date.getTime() <= latest
    ? date
    : undefined;
}

/** Mirror append-only `db.activity` lama ke tabel audit permanen. */
export function clientActivityAuditEvent(input: {
  actor: ActivityAuditActor;
  recordId: string;
  data: Record<string, unknown>;
}): ActivityAuditEvent {
  const rawMeta =
    input.data["meta"] && typeof input.data["meta"] === "object"
      ? (input.data["meta"] as Record<string, unknown>)
      : {};
  const action =
    typeof input.data["action"] === "string" && input.data["action"].trim()
      ? input.data["action"].trim()
      : "client.activity";
  return {
    id: input.recordId,
    actor: input.actor,
    action,
    targetType: "client-activity",
    targetId:
      typeof rawMeta["id"] === "string" ? rawMeta["id"] : input.recordId,
    meta: { ...rawMeta, source: "client-sync" },
    at: safeEventDate(input.data["ts"]),
  };
}

const AUDITED_CONTENT_COLLECTIONS = new Set([
  "news",
  "banners",
  "slider",
  "infoBudaya",
]);

function publicationState(data: Record<string, unknown> | undefined) {
  if (!data) return {};
  return {
    active: data["active"] === true,
    status:
      typeof data["publicationStatus"] === "string"
        ? data["publicationStatus"]
        : undefined,
  };
}

export function contentAuditEvent(input: {
  actor: ActivityAuditActor;
  collection: string;
  recordId: string;
  operation: "create" | "update" | "delete";
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
}): ActivityAuditEvent | null {
  if (!AUDITED_CONTENT_COLLECTIONS.has(input.collection)) return null;

  const before = publicationState(input.before);
  const after = publicationState(input.after);
  let verb:
    | "create"
    | "update"
    | "delete"
    | "approve"
    | "reject"
    | "unpublish" = input.operation;
  if (input.operation === "update" && input.collection === "infoBudaya") {
    if (after.status === "rejected" && before.status !== "rejected") {
      verb = "reject";
    } else if (
      (after.active && !before.active) ||
      (after.status === "published" && before.status !== "published")
    ) {
      verb = "approve";
    } else if (!after.active && before.active) {
      verb = "unpublish";
    }
  }

  return {
    actor: input.actor,
    action: `content.${verb}`,
    targetType: input.collection,
    targetId: input.recordId,
    meta: {
      operation: input.operation,
      previousActive: before.active,
      nextActive: after.active,
      previousStatus: before.status,
      nextStatus: after.status,
    },
  };
}

/**
 * Satu event detail untuk setiap mutasi sync yang benar-benar diterapkan.
 * Koleksi konten dan activity memakai action khusus; koleksi lain tetap
 * memiliki jejak collection/recordId tanpa menyalin snapshot/body.
 */
export function syncRecordAuditEvent(input: {
  actor: ActivityAuditActor;
  collection: string;
  recordId: string;
  operation: "create" | "update" | "delete";
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
}): ActivityAuditEvent {
  const contentEvent = contentAuditEvent(input);
  if (contentEvent) return contentEvent;

  if (
    input.operation === "create" &&
    input.collection === "activity" &&
    input.after
  ) {
    return clientActivityAuditEvent({
      actor: input.actor,
      recordId: input.recordId,
      data: input.after,
    });
  }

  return {
    actor: input.actor,
    action: `sync.${input.operation}`,
    targetType: input.collection,
    targetId: input.recordId,
    meta: { operation: input.operation },
  };
}
