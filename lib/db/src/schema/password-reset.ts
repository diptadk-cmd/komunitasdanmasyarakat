import {
  index,
  int,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";
import { randomUUID } from "node:crypto";
import { usersTable } from "./users";

/**
 * Tantangan pemulihan password sekali pakai. OTP dan token verifikasi tidak
 * pernah disimpan dalam bentuk asli; hanya hash-nya yang masuk database.
 */
export const passwordResetChallengesTable = mysqlTable(
  "password_reset_challenges",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    userId: varchar("user_id", { length: 36 })
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    otpHash: text("otp_hash").notNull(),
    attempts: int("attempts").notNull().default(0),
    expiresAt: timestamp("expires_at").notNull(),
    verifiedTokenHash: varchar("verified_token_hash", { length: 64 }),
    verifiedExpiresAt: timestamp("verified_expires_at"),
    usedAt: timestamp("used_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    byUser: index("idx_password_reset_user").on(table.userId),
    byExpiry: index("idx_password_reset_expiry").on(table.expiresAt),
  }),
);

export type PasswordResetChallenge =
  typeof passwordResetChallengesTable.$inferSelect;
export type InsertPasswordResetChallenge =
  typeof passwordResetChallengesTable.$inferInsert;
