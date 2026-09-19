import { compare } from "bcryptjs";
import { db, pool, usersTable } from "@workspace/db";

const DEMO_ACCOUNTS = [
  {
    role: "kurator",
    username: "Penguasa jak1",
    password: "ayamayaman",
  },
] as const;

async function main(): Promise<void> {
  try {
    const users = await db.select().from(usersTable);
    const usersByUsername = new Map(users.map((user) => [user.username, user]));
    const failures: string[] = [];
    let checked = 0;

    for (const account of DEMO_ACCOUNTS) {
      const user = usersByUsername.get(account.username);
      checked += 1;

      if (!user) {
        failures.push(`${account.username}: tidak ditemukan`);
        continue;
      }
      if (user.role !== account.role) {
        failures.push(
          `${account.username}: role ${user.role}, seharusnya ${account.role}`,
        );
      }
      if (user.status !== "aktif") {
        failures.push(`${account.username}: status akun ${user.status}`);
      }
      if (user.profile["status"] && user.profile["status"] !== "aktif") {
        failures.push(
          `${account.username}: status profil ${String(user.profile["status"])}`,
        );
      }
      if (!(await compare(account.password, user.passwordHash))) {
        failures.push(`${account.username}: password demo tidak cocok`);
      }
    }

    console.log(
      JSON.stringify(
        {
          checked,
          activeAndLoginReady: checked - failures.length,
          failures,
        },
        null,
        2,
      ),
    );

    if (failures.length > 0) process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error("Verifikasi akun demo gagal", error);
  process.exitCode = 1;
});
