import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { db, sessionsTable, usersTable, type User } from "@workspace/db";
import { and, eq, gt, lt, ne } from "drizzle-orm";
import { summarizeProfileForDirectory } from "./directory-profile";

export const SESSION_COOKIE = "jak_session";
export const CURATOR_SESSION_COOKIE = "jak_curator_session";
export const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 hari

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(
  plain: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export async function createSession(userId: string): Promise<{
  token: string;
  expiresAt: Date;
}> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.insert(sessionsTable).values({ token, userId, expiresAt });
  // Best-effort cleanup sesi expired untuk user yang sama (tidak menunggu).
  void db
    .delete(sessionsTable)
    .where(
      and(eq(sessionsTable.userId, userId), lt(sessionsTable.expiresAt, new Date())),
    )
    .catch(() => {});
  return { token, expiresAt };
}

export async function getSessionUser(token: string): Promise<User | null> {
  const rows = await db
    .select({ user: usersTable })
    .from(sessionsTable)
    .innerJoin(usersTable, eq(sessionsTable.userId, usersTable.id))
    .where(
      and(
        eq(sessionsTable.token, token),
        gt(sessionsTable.expiresAt, new Date()),
        ne(usersTable.status, "diblokir"),
      ),
    )
    .limit(1);

  return rows[0]?.user ?? null;
}

export async function destroyAllUserSessions(userId: string): Promise<void> {
  await db.delete(sessionsTable).where(eq(sessionsTable.userId, userId));
}

export async function destroySession(token: string): Promise<void> {
  await db.delete(sessionsTable).where(eq(sessionsTable.token, token));
}

export function toAuthUser(user: User) {
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    status: user.status,
    profile: user.profile,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

/** Identitas ringkas untuk tabel akun; detail lengkap tetap tersedia per user. */
export function toDirectoryAuthUser(user: User) {
  return {
    ...toAuthUser(user),
    profile: summarizeProfileForDirectory(user.profile),
  };
}
