import { mysqlTable, varchar, index } from "drizzle-orm/mysql-core";
import { idCol, dataCol, createdAtCol, updatedAtCol } from "./_base";

// Jadwal & laporan latihan sanggar
export const latihanTable = mysqlTable(
  "latihan",
  {
    id: idCol(),
    sanggarId: varchar("sanggar_id", { length: 36 }).notNull(),
    pelatihId: varchar("pelatih_id", { length: 36 }),
    tanggal: varchar("tanggal", { length: 16 }),
    data: dataCol(),
    createdAt: createdAtCol(),
    updatedAt: updatedAtCol(),
  },
  (t) => ({
    bySanggar: index("idx_latihan_sanggar").on(t.sanggarId),
  }),
);
export type Latihan = typeof latihanTable.$inferSelect;
export type InsertLatihan = typeof latihanTable.$inferInsert;
