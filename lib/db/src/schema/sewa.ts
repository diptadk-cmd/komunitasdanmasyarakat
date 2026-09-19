import { mysqlTable, varchar, index } from "drizzle-orm/mysql-core";
import { idCol, dataCol, createdAtCol, updatedAtCol } from "./_base";

// Pemesanan Sewa Jasa (penyewa eksternal -> sanggar -> SDM)
export const pemesananSewaTable = mysqlTable(
  "pemesanan_sewa",
  {
    id: idCol(),
    nomor: varchar("nomor", { length: 64 }).notNull().unique(),
    sewaId: varchar("sewa_id", { length: 36 }).notNull(),
    sanggarId: varchar("sanggar_id", { length: 36 }).notNull(),
    sdmUserId: varchar("sdm_user_id", { length: 36 }),
    sumberType: varchar("sumber_type", { length: 32 }),
    sumberId: varchar("sumber_id", { length: 36 }),
    status: varchar("status", { length: 32 }),
    invoiceId: varchar("invoice_id", { length: 36 }),
    bastId: varchar("bast_id", { length: 36 }),
    data: dataCol(),
    createdAt: createdAtCol(),
    updatedAt: updatedAtCol(),
  },
  (t) => ({
    bySanggar: index("idx_pemesanan_sewa_sanggar").on(t.sanggarId),
    bySewa: index("idx_pemesanan_sewa_sewa").on(t.sewaId),
  }),
);
export type PemesananSewa = typeof pemesananSewaTable.$inferSelect;
export type InsertPemesananSewa = typeof pemesananSewaTable.$inferInsert;
