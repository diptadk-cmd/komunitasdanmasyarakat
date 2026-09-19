import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { hashPassword } from "./auth";
import { logger } from "./logger";

type SeedUser = {
  username: string;
  password: string;
  role: string;
  profile?: Record<string, unknown>;
};

// Satu-satunya akun demo yang dipertahankan. Seed hanya dijalankan di
// lingkungan non-production; akun nyata selalu berasal dari database.
const DEMO_USERS: SeedUser[] = [
  {
    username: "Penguasa jak1",
    password: "ayamayaman",
    role: "kurator",
    profile: { nama: "Kurator Utama", title: "Penguasa Jak Sanggar" },
  },
];

export async function seedUsersIfEmpty(
  _options: { resetPasswords?: boolean } = {},
): Promise<void> {
  let inserted = 0;
  for (const user of DEMO_USERS) {
    const existing = await db
      .select({ id: usersTable.id, profile: usersTable.profile })
      .from(usersTable)
      .where(eq(usersTable.username, user.username))
      .limit(1);

    if (existing[0]) {
      const current = existing[0].profile ?? {};
      const missing = Object.fromEntries(
        Object.entries(user.profile ?? {}).filter(
          ([key]) => current[key] === undefined,
        ),
      );
      if (Object.keys(missing).length > 0) {
        await db
          .update(usersTable)
          .set({ profile: { ...current, ...missing } })
          .where(eq(usersTable.id, existing[0].id));
      }
      continue;
    }

    await db.insert(usersTable).values({
      username: user.username,
      passwordHash: await hashPassword(user.password),
      role: user.role,
      status: "aktif",
      profile: user.profile ?? {},
    });
    inserted += 1;
  }

  if (inserted > 0) {
    logger.info(
      { inserted, total: DEMO_USERS.length },
      "Seed demo users selesai",
    );
  }
}
