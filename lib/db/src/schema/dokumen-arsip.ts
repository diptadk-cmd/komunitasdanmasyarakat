import { mysqlTable, varchar, index } from "drizzle-orm/mysql-core";
import { idCol, dataCol, createdAtCol, updatedAtCol } from "./_base";

// Arsip dokumen administrasi yang dicetak lewat Tools Dokumen Administrasi.
// Dimiliki per-sanggar; kunci kepemilikan pakai `sanggar_username` (username
// unik lintas perangkat — id lokal berbeda per browser). Kolom `data` berisi
// snapshot entri (templateId, judul, bentukId, nilai, createdAt, updatedAt ms).
export const dokumenArsipTable = mysqlTable(
  "dokumen_arsip",
  {
    id: idCol(),
    sanggarUsername: varchar("sanggar_username", { length: 191 }).notNull(),
    data: dataCol(),
    createdAt: createdAtCol(),
    updatedAt: updatedAtCol(),
  },
  (t) => ({
    bySanggar: index("idx_dokumen_arsip_sanggar").on(t.sanggarUsername),
  }),
);
export type DokumenArsipRow = typeof dokumenArsipTable.$inferSelect;
export type InsertDokumenArsip = typeof dokumenArsipTable.$inferInsert;
