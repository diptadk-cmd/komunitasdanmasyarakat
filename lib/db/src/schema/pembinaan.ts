import { mysqlTable, varchar, index } from "drizzle-orm/mysql-core";
import { idCol, dataCol, createdAtCol, updatedAtCol } from "./_base";

// Absensi pembinaan (3 slot)
export const absensiPembinaanTable = mysqlTable(
  "absensi_pembinaan",
  {
    id: idCol(),
    pesertaId: varchar("peserta_id", { length: 36 }).notNull(),
    slot: varchar("slot", { length: 16 }),
    data: dataCol(),
    createdAt: createdAtCol(),
    updatedAt: updatedAtCol(),
  },
  (t) => ({
    byPeserta: index("idx_absensi_pembinaan_peserta").on(t.pesertaId),
  }),
);
export type AbsensiPembinaan = typeof absensiPembinaanTable.$inferSelect;
export type InsertAbsensiPembinaan = typeof absensiPembinaanTable.$inferInsert;

// Pendaftaran pembinaan (kartu registrasi)
export const pendaftaranPembinaanTable = mysqlTable(
  "pendaftaran_pembinaan",
  {
    id: idCol(),
    sanggarId: varchar("sanggar_id", { length: 36 }).notNull(),
    delegasiId: varchar("delegasi_id", { length: 36 }),
    data: dataCol(),
    createdAt: createdAtCol(),
    updatedAt: updatedAtCol(),
  },
  (t) => ({
    bySanggar: index("idx_pendaftaran_pembinaan_sanggar").on(t.sanggarId),
  }),
);
export type PendaftaranPembinaan = typeof pendaftaranPembinaanTable.$inferSelect;
export type InsertPendaftaranPembinaan =
  typeof pendaftaranPembinaanTable.$inferInsert;
