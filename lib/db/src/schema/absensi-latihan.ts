import { mysqlTable, varchar, index } from "drizzle-orm/mysql-core";
import { idCol, dataCol, createdAtCol, updatedAtCol } from "./_base";

/** Kehadiran anggota pada sesi latihan. Detail fleksibel disimpan di JSON. */
export const absensiLatihanTable = mysqlTable(
  "absensi_latihan",
  {
    id: idCol(),
    userId: varchar("user_id", { length: 36 }).notNull(),
    sanggarId: varchar("sanggar_id", { length: 96 }).notNull(),
    latihanId: varchar("latihan_id", { length: 96 }).notNull(),
    data: dataCol(),
    createdAt: createdAtCol(),
    updatedAt: updatedAtCol(),
  },
  (table) => ({
    byUser: index("idx_absensi_latihan_user").on(table.userId),
    bySanggar: index("idx_absensi_latihan_sanggar").on(table.sanggarId),
    byLatihan: index("idx_absensi_latihan_latihan").on(table.latihanId),
  }),
);

export type AbsensiLatihan = typeof absensiLatihanTable.$inferSelect;
export type InsertAbsensiLatihan = typeof absensiLatihanTable.$inferInsert;
