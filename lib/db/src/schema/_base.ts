import { varchar, timestamp } from "drizzle-orm/mysql-core";
import { randomUUID } from "node:crypto";
import { json } from "../json";

// Kolom-kolom standar yang dipakai berulang oleh tabel entitas Jak Sanggar.
// Pola repo: simpan kolom skalar untuk query/filter + satu kolom `data` JSON
// berisi snapshot objek entitas (mengikuti `users.profile`). Kolom skalar
// adalah turunan dari `data` yang sengaja diekstrak agar bisa di-index.

export const idCol = () =>
  varchar("id", { length: 36 })
    .primaryKey()
    .$defaultFn(() => randomUUID());

export const dataCol = () => json<Record<string, unknown>>("data").notNull();

export const createdAtCol = () => timestamp("created_at").notNull().defaultNow();

export const updatedAtCol = () =>
  timestamp("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());
