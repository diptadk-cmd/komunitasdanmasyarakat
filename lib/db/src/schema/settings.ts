import { mysqlTable, varchar, timestamp } from "drizzle-orm/mysql-core";
import { json } from "../json";

// Tabel key/value untuk singleton global yang sebelumnya disimpan langsung di
// objek DB localStorage: `kurasiMatrix`, `jamPembinaan`, `appearance`,
// `exportPassword`, `honorPerSesiDefault`. Disimpan satu baris per key dengan
// value JSON (bisa objek maupun primitif).
export const settingsTable = mysqlTable("settings", {
  key: varchar("key", { length: 128 }).primaryKey(),
  value: json<unknown>("value").notNull(),
  updatedAt: timestamp("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});
export type Setting = typeof settingsTable.$inferSelect;
export type InsertSetting = typeof settingsTable.$inferInsert;
