import { mysqlTable, varchar, boolean, index } from "drizzle-orm/mysql-core";
import { idCol, dataCol, createdAtCol, updatedAtCol } from "./_base";

// Aset (alat musik / kostum)
export const asetTable = mysqlTable(
  "aset",
  {
    id: idCol(),
    sanggarId: varchar("sanggar_id", { length: 36 }).notNull(),
    kategori: varchar("kategori", { length: 32 }),
    statusPublish: boolean("status_publish").notNull().default(false),
    data: dataCol(),
    createdAt: createdAtCol(),
    updatedAt: updatedAtCol(),
  },
  (t) => ({
    bySanggar: index("idx_aset_sanggar").on(t.sanggarId),
  }),
);
export type Aset = typeof asetTable.$inferSelect;
export type InsertAset = typeof asetTable.$inferInsert;

// Sarpras (tempat / aula / studio)
export const sarprasTable = mysqlTable(
  "sarpras",
  {
    id: idCol(),
    sanggarId: varchar("sanggar_id", { length: 36 }).notNull(),
    jenisTempat: varchar("jenis_tempat", { length: 32 }),
    statusPublish: boolean("status_publish").notNull().default(false),
    data: dataCol(),
    createdAt: createdAtCol(),
    updatedAt: updatedAtCol(),
  },
  (t) => ({
    bySanggar: index("idx_sarpras_sanggar").on(t.sanggarId),
  }),
);
export type Sarpras = typeof sarprasTable.$inferSelect;
export type InsertSarpras = typeof sarprasTable.$inferInsert;
