import { and, asc, desc, eq, inArray, lt, or, sql, type SQL } from "drizzle-orm";
import { db, syncRecordsTable, usersTable } from "@workspace/db";
import type { CommunicationQuery, CommunicationRecord, CommunicationRepository } from "./communications";
import { COMM, CommunicationError } from "./communications";

const selectUser = { id: usersTable.id, role: usersTable.role, status: usersTable.status, profile: usersTable.profile };
function asRecord(row: typeof syncRecordsTable.$inferSelect): CommunicationRecord { return { id: row.recordId, collection: row.collection, ownerId: row.ownerId, participantIds: row.participantIds, data: row.data }; }
function values(record: CommunicationRecord) { return { collection: record.collection, recordId: record.id, scope: "shared", ownerId: record.ownerId, participantIds: record.participantIds, data: record.data, createdBy: record.ownerId, updatedBy: record.ownerId }; }

/** Communications never use the generic sync mutator/reader or its overseer ACL. */
export const communicationsRepository: CommunicationRepository = {
  async user(id) { return (await db.select(selectUser).from(usersTable).where(eq(usersTable.id, id)).limit(1))[0]; },
  async users() { return db.select(selectUser).from(usersTable).where(eq(usersTable.status, "aktif")); },
  async get(collection, id) { const row = (await db.select().from(syncRecordsTable).where(and(eq(syncRecordsTable.collection, collection), eq(syncRecordsTable.recordId, id))).limit(1))[0]; return row ? asRecord(row) : undefined; },
  async find(collection, query: CommunicationQuery = {}) {
    const predicates: SQL[] = [eq(syncRecordsTable.collection, collection)];
    if (query.participantId) predicates.push(sql`JSON_CONTAINS(${syncRecordsTable.participantIds}, ${JSON.stringify(query.participantId)})`);
    if (query.ownerId) predicates.push(eq(syncRecordsTable.ownerId, query.ownerId));
    for (const field of ["conversationId", "callId", "kind", "senderId", "recipientId"] as const) if (query[field]) predicates.push(sql`JSON_UNQUOTE(JSON_EXTRACT(${syncRecordsTable.data}, ${`$.${field}`})) = ${query[field]}`);
    if (query.attachmentId) predicates.push(sql`JSON_UNQUOTE(JSON_EXTRACT(${syncRecordsTable.data}, '$.attachment.id')) = ${query.attachmentId}`);
    if (query.before !== undefined) predicates.push(sql`CAST(JSON_EXTRACT(${syncRecordsTable.data}, '$.createdAt') AS UNSIGNED) < ${query.before}`);
    const statement = db.select().from(syncRecordsTable).where(and(...predicates)).orderBy(sql`CAST(JSON_EXTRACT(${syncRecordsTable.data}, '$.createdAt') AS UNSIGNED) DESC`, desc(syncRecordsTable.recordId));
    const rows = query.limit ? await statement.limit(query.limit) : await statement;
    return rows.map(asRecord);
  },
  async create(record) {
    await db.insert(syncRecordsTable).values(values(record)).onDuplicateKeyUpdate({ set: { recordId: sql`${syncRecordsTable.recordId}` } });
    const saved = await this.get(record.collection, record.id); if (!saved) throw new Error("Communication record was not saved"); return saved;
  },
  async createCall(record) {
    return db.transaction(async (tx) => {
      // Consistent account lock order prevents simultaneous calls from ringing
      // an already busy account, even across multiple API processes.
      await tx.select({ id: usersTable.id }).from(usersTable).where(inArray(usersTable.id, record.participantIds)).orderBy(asc(usersTable.id)).for("update");
      const same = (await tx.select().from(syncRecordsTable).where(and(eq(syncRecordsTable.collection, COMM.call), eq(syncRecordsTable.recordId, record.id))).limit(1))[0];
      if (same) return asRecord(same);
      const busy = await tx.select({ id: syncRecordsTable.id }).from(syncRecordsTable).where(and(
        eq(syncRecordsTable.collection, COMM.call),
        sql`JSON_UNQUOTE(JSON_EXTRACT(${syncRecordsTable.data}, '$.status')) IN ('ringing','accepted')`,
        sql`CAST(JSON_EXTRACT(${syncRecordsTable.data}, '$.expiresAt') AS UNSIGNED) > ${Number(record.data.createdAt)}`,
        or(...record.participantIds.map((id) => sql`JSON_CONTAINS(${syncRecordsTable.participantIds}, ${JSON.stringify(id)})`)),
      )).limit(1);
      if (busy.length) throw new CommunicationError(409, "Salah satu akun sedang menerima atau menjalani panggilan.");
      await tx.insert(syncRecordsTable).values(values(record)); return record;
    });
  },
  async createSignal(record) {
    return db.transaction(async (tx) => {
      const callId = String(record.data.callId);
      const call = (await tx.select().from(syncRecordsTable).where(and(eq(syncRecordsTable.collection, COMM.call), eq(syncRecordsTable.recordId, callId))).for("update"))[0];
      if (!call || !call.participantIds.includes(record.ownerId)) throw new CommunicationError(403, "Tidak memiliki akses panggilan.");
      if (!["ringing", "accepted"].includes(String(call.data.status)) || Number(call.data.expiresAt) <= Date.now()) throw new CommunicationError(409, "Panggilan sudah berakhir.");
      const same = (await tx.select().from(syncRecordsTable).where(and(eq(syncRecordsTable.collection, COMM.signal), eq(syncRecordsTable.recordId, record.id))).limit(1))[0];
      if (same) return asRecord(same);
      const signals = await tx.select({ data: syncRecordsTable.data }).from(syncRecordsTable).where(and(eq(syncRecordsTable.collection, COMM.signal), sql`JSON_UNQUOTE(JSON_EXTRACT(${syncRecordsTable.data}, '$.callId')) = ${callId}`)).limit(513);
      if (signals.length >= 512) throw new CommunicationError(429, "Batas sinyal panggilan tercapai.");
      // DB-serialized timestamps are strictly increasing per call. A polling
      // cursor cannot skip concurrent ICE events sharing a millisecond.
      const createdAt = Math.max(Number(record.data.createdAt), ...signals.map((row) => Number(row.data.createdAt) + 1));
      const saved = { ...record, data: { ...record.data, createdAt } };
      await tx.insert(syncRecordsTable).values(values(saved)); return saved;
    });
  },
  async replace(record, expectedStatus) {
    const predicates = [eq(syncRecordsTable.collection, record.collection), eq(syncRecordsTable.recordId, record.id)];
    if (expectedStatus !== undefined) predicates.push(sql`JSON_UNQUOTE(JSON_EXTRACT(${syncRecordsTable.data}, '$.status')) = ${expectedStatus}`);
    const result = await db.update(syncRecordsTable).set({ data: record.data, participantIds: record.participantIds, updatedAt: new Date() }).where(and(...predicates));
    return result[0].affectedRows > 0;
  },
  async readThrough(record) {
    await db.insert(syncRecordsTable).values(values(record)).onDuplicateKeyUpdate({ set: {
      data: sql`IF(CAST(JSON_EXTRACT(${syncRecordsTable.data}, '$.through') AS UNSIGNED) < ${Number(record.data.through)}, ${JSON.stringify(record.data)}, ${syncRecordsTable.data})`, updatedAt: new Date(),
    } });
  },
};

let lastPrunedAt = 0;
/** Short-lived signaling/presence records do not accumulate with business data. */
export async function pruneExpiredCommunicationState(): Promise<void> {
  const now = Date.now(); if (now - lastPrunedAt < 60 * 60_000) return; lastPrunedAt = now;
  try { await db.delete(syncRecordsTable).where(and(or(eq(syncRecordsTable.collection, "comm.signal.v1"), eq(syncRecordsTable.collection, "comm.call.v1"), eq(syncRecordsTable.collection, "comm.presence.v1")), lt(syncRecordsTable.updatedAt, new Date(now - 24 * 60 * 60_000)))); }
  catch { lastPrunedAt = 0; }
}
