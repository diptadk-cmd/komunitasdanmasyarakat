import { mysqlTable, varchar, index } from "drizzle-orm/mysql-core";
import { idCol, dataCol, createdAtCol, updatedAtCol } from "./_base";

// Kerjasama antar-sanggar
export const kerjasamaTable = mysqlTable(
  "kerjasama",
  {
    id: idCol(),
    nomor: varchar("nomor", { length: 64 }).notNull().unique(),
    sumberType: varchar("sumber_type", { length: 32 }),
    sumberId: varchar("sumber_id", { length: 36 }),
    sanggarPenyediaId: varchar("sanggar_penyedia_id", { length: 36 }).notNull(),
    sanggarPeminjamId: varchar("sanggar_peminjam_id", { length: 36 }).notNull(),
    kategori: varchar("kategori", { length: 32 }),
    status: varchar("status", { length: 32 }),
    data: dataCol(),
    createdAt: createdAtCol(),
    updatedAt: updatedAtCol(),
  },
  (t) => ({
    byPenyedia: index("idx_kerjasama_penyedia").on(t.sanggarPenyediaId),
    byPeminjam: index("idx_kerjasama_peminjam").on(t.sanggarPeminjamId),
  }),
);
export type Kerjasama = typeof kerjasamaTable.$inferSelect;
export type InsertKerjasama = typeof kerjasamaTable.$inferInsert;

// Chat dalam kerjasama
export const chatMessagesTable = mysqlTable(
  "chat_messages",
  {
    id: idCol(),
    kerjasamaId: varchar("kerjasama_id", { length: 36 }).notNull(),
    senderId: varchar("sender_id", { length: 36 }),
    data: dataCol(),
    createdAt: createdAtCol(),
    updatedAt: updatedAtCol(),
  },
  (t) => ({
    byKerjasama: index("idx_chat_messages_kerjasama").on(t.kerjasamaId),
  }),
);
export type ChatMessage = typeof chatMessagesTable.$inferSelect;
export type InsertChatMessage = typeof chatMessagesTable.$inferInsert;

// Negosiasi harga
export const negosiasiTable = mysqlTable(
  "negosiasi",
  {
    id: idCol(),
    kerjasamaId: varchar("kerjasama_id", { length: 36 }).notNull(),
    status: varchar("status", { length: 32 }),
    data: dataCol(),
    createdAt: createdAtCol(),
    updatedAt: updatedAtCol(),
  },
  (t) => ({
    byKerjasama: index("idx_negosiasi_kerjasama").on(t.kerjasamaId),
  }),
);
export type Negosiasi = typeof negosiasiTable.$inferSelect;
export type InsertNegosiasi = typeof negosiasiTable.$inferInsert;

// Invoice
export const invoicesTable = mysqlTable(
  "invoices",
  {
    id: idCol(),
    kerjasamaId: varchar("kerjasama_id", { length: 36 }).notNull(),
    nomor: varchar("nomor", { length: 64 }).notNull().unique(),
    status: varchar("status", { length: 32 }),
    data: dataCol(),
    createdAt: createdAtCol(),
    updatedAt: updatedAtCol(),
  },
  (t) => ({
    byKerjasama: index("idx_invoices_kerjasama").on(t.kerjasamaId),
  }),
);
export type Invoice = typeof invoicesTable.$inferSelect;
export type InsertInvoice = typeof invoicesTable.$inferInsert;

// Pembayaran terhadap invoice
export const paymentsTable = mysqlTable(
  "payments",
  {
    id: idCol(),
    invoiceId: varchar("invoice_id", { length: 36 }).notNull(),
    status: varchar("status", { length: 32 }),
    data: dataCol(),
    createdAt: createdAtCol(),
    updatedAt: updatedAtCol(),
  },
  (t) => ({
    byInvoice: index("idx_payments_invoice").on(t.invoiceId),
  }),
);
export type Payment = typeof paymentsTable.$inferSelect;
export type InsertPayment = typeof paymentsTable.$inferInsert;

// Kontrak
export const contractsTable = mysqlTable(
  "contracts",
  {
    id: idCol(),
    kerjasamaId: varchar("kerjasama_id", { length: 36 }).notNull(),
    nomor: varchar("nomor", { length: 64 }),
    data: dataCol(),
    createdAt: createdAtCol(),
    updatedAt: updatedAtCol(),
  },
  (t) => ({
    byKerjasama: index("idx_contracts_kerjasama").on(t.kerjasamaId),
  }),
);
export type Contract = typeof contractsTable.$inferSelect;
export type InsertContract = typeof contractsTable.$inferInsert;

// Berita Acara Serah Terima (BAST)
export const bastTable = mysqlTable(
  "bast",
  {
    id: idCol(),
    kerjasamaId: varchar("kerjasama_id", { length: 36 }).notNull(),
    nomor: varchar("nomor", { length: 64 }),
    status: varchar("status", { length: 32 }),
    data: dataCol(),
    createdAt: createdAtCol(),
    updatedAt: updatedAtCol(),
  },
  (t) => ({
    byKerjasama: index("idx_bast_kerjasama").on(t.kerjasamaId),
  }),
);
export type Bast = typeof bastTable.$inferSelect;
export type InsertBast = typeof bastTable.$inferInsert;

// Rating / ulasan kerjasama
export const ratingsTable = mysqlTable(
  "ratings",
  {
    id: idCol(),
    kerjasamaId: varchar("kerjasama_id", { length: 36 }).notNull(),
    dariSanggarId: varchar("dari_sanggar_id", { length: 36 }),
    data: dataCol(),
    createdAt: createdAtCol(),
    updatedAt: updatedAtCol(),
  },
  (t) => ({
    byKerjasama: index("idx_ratings_kerjasama").on(t.kerjasamaId),
  }),
);
export type Rating = typeof ratingsTable.$inferSelect;
export type InsertRating = typeof ratingsTable.$inferInsert;
