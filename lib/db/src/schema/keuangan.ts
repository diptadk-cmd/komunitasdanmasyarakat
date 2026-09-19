import { mysqlTable, varchar, index } from "drizzle-orm/mysql-core";
import { idCol, dataCol, createdAtCol, updatedAtCol } from "./_base";

// Iuran seniman
export const iuranTable = mysqlTable(
  "iuran",
  {
    id: idCol(),
    sanggarId: varchar("sanggar_id", { length: 36 }).notNull(),
    senimanId: varchar("seniman_id", { length: 36 }),
    status: varchar("status", { length: 32 }),
    data: dataCol(),
    createdAt: createdAtCol(),
    updatedAt: updatedAtCol(),
  },
  (t) => ({
    bySanggar: index("idx_iuran_sanggar").on(t.sanggarId),
  }),
);
export type Iuran = typeof iuranTable.$inferSelect;
export type InsertIuran = typeof iuranTable.$inferInsert;

// Pengajuan honor pelatih
export const pengajuanHonorTable = mysqlTable(
  "pengajuan_honor",
  {
    id: idCol(),
    sanggarId: varchar("sanggar_id", { length: 36 }).notNull(),
    pelatihId: varchar("pelatih_id", { length: 36 }),
    status: varchar("status", { length: 32 }),
    data: dataCol(),
    createdAt: createdAtCol(),
    updatedAt: updatedAtCol(),
  },
  (t) => ({
    bySanggar: index("idx_pengajuan_honor_sanggar").on(t.sanggarId),
  }),
);
export type PengajuanHonor = typeof pengajuanHonorTable.$inferSelect;
export type InsertPengajuanHonor = typeof pengajuanHonorTable.$inferInsert;

// Distribusi honor (bagi hasil job)
export const distribusiHonorTable = mysqlTable(
  "distribusi_honor",
  {
    id: idCol(),
    sanggarId: varchar("sanggar_id", { length: 36 }).notNull(),
    penerimaId: varchar("penerima_id", { length: 36 }),
    penerimaRole: varchar("penerima_role", { length: 32 }),
    data: dataCol(),
    createdAt: createdAtCol(),
    updatedAt: updatedAtCol(),
  },
  (t) => ({
    bySanggar: index("idx_distribusi_honor_sanggar").on(t.sanggarId),
  }),
);
export type DistribusiHonor = typeof distribusiHonorTable.$inferSelect;
export type InsertDistribusiHonor = typeof distribusiHonorTable.$inferInsert;

// Transaksi manual buku kas
export const transaksiManualTable = mysqlTable(
  "transaksi_manual",
  {
    id: idCol(),
    sanggarId: varchar("sanggar_id", { length: 36 }).notNull(),
    jenis: varchar("jenis", { length: 16 }),
    tanggal: varchar("tanggal", { length: 16 }),
    data: dataCol(),
    createdAt: createdAtCol(),
    updatedAt: updatedAtCol(),
  },
  (t) => ({
    bySanggar: index("idx_transaksi_manual_sanggar").on(t.sanggarId),
  }),
);
export type TransaksiManual = typeof transaksiManualTable.$inferSelect;
export type InsertTransaksiManual = typeof transaksiManualTable.$inferInsert;

// Entri buku kas (ledger terhitung)
export const kasEntriesTable = mysqlTable(
  "kas_entries",
  {
    id: idCol(),
    sanggarId: varchar("sanggar_id", { length: 36 }).notNull(),
    refType: varchar("ref_type", { length: 64 }),
    refId: varchar("ref_id", { length: 64 }),
    data: dataCol(),
    createdAt: createdAtCol(),
    updatedAt: updatedAtCol(),
  },
  (t) => ({
    bySanggar: index("idx_kas_entries_sanggar").on(t.sanggarId),
  }),
);
export type KasEntry = typeof kasEntriesTable.$inferSelect;
export type InsertKasEntry = typeof kasEntriesTable.$inferInsert;
