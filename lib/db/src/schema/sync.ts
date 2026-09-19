import {
  index,
  int,
  mysqlTable,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";
import { randomUUID } from "node:crypto";
import { json } from "../json";

/**
 * Catatan sinkronisasi generik untuk koleksi aplikasi yang masih bersifat
 * local-first. Data bisnis sengaja disimpan sebagai JSON snapshot; metadata
 * di luar snapshot dipakai server untuk otorisasi, optimistic concurrency,
 * dan propagasi penghapusan lintas perangkat.
 */
export const syncRecordsTable = mysqlTable(
  "sync_records",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    collection: varchar("collection", { length: 64 }).notNull(),
    recordId: varchar("record_id", { length: 191 }).notNull(),
    // global | sanggar | personal | shared. Tidak dipercaya dari browser;
    // selalu dihitung ulang oleh routes/sync.ts.
    scope: varchar("scope", { length: 32 }).notNull(),
    ownerId: varchar("owner_id", { length: 36 }).notNull(),
    // ID user server yang berhak membaca record selain kurator/admin.
    participantIds: json<string[]>("participant_ids").notNull(),
    data: json<Record<string, unknown>>("data").notNull(),
    revision: int("revision").notNull().default(1),
    deletedAt: timestamp("deleted_at"),
    createdBy: varchar("created_by", { length: 36 }).notNull(),
    updatedBy: varchar("updated_by", { length: 36 }).notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    byCollectionRecord: uniqueIndex("uq_sync_records_collection_record").on(
      table.collection,
      table.recordId,
    ),
    byOwner: index("idx_sync_records_owner").on(table.ownerId),
    byScope: index("idx_sync_records_scope").on(table.scope),
    byUpdatedAt: index("idx_sync_records_updated_at").on(table.updatedAt),
  }),
);

export type SyncRecord = typeof syncRecordsTable.$inferSelect;
export type InsertSyncRecord = typeof syncRecordsTable.$inferInsert;

/**
 * Menyimpan hasil satu mutasi agar retry dari outbox/offline client aman.
 * `mutationId` adalah idempotency key yang dikirim browser dan unik global.
 */
export const syncMutationsTable = mysqlTable(
  "sync_mutations",
  {
    mutationId: varchar("mutation_id", { length: 128 }).primaryKey(),
    actorId: varchar("actor_id", { length: 36 }).notNull(),
    result: json<Record<string, unknown>>("result").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    byActor: index("idx_sync_mutations_actor").on(table.actorId),
  }),
);

export type SyncMutation = typeof syncMutationsTable.$inferSelect;
export type InsertSyncMutation = typeof syncMutationsTable.$inferInsert;
