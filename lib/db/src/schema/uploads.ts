import { mysqlTable, varchar, timestamp, int } from "drizzle-orm/mysql-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { randomUUID } from "node:crypto";
import { usersTable } from "./users";

export const uploadsTable = mysqlTable("uploads", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .$defaultFn(() => randomUUID()),
  storageKey: varchar("storage_key", { length: 512 }).notNull().unique(),
  contentType: varchar("content_type", { length: 191 }).notNull(),
  sizeBytes: int("size_bytes").notNull(),
  originalName: varchar("original_name", { length: 512 }),
  uploaderId: varchar("uploader_id", { length: 36 }).references(
    () => usersTable.id,
    {
      onDelete: "set null",
    },
  ),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertUploadSchema = createInsertSchema(uploadsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertUpload = z.infer<typeof insertUploadSchema>;
export type Upload = typeof uploadsTable.$inferSelect;
