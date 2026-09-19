import { pool } from "@workspace/db";
import { seedUsersIfEmpty } from "../lib/seed";

async function main(): Promise<void> {
  try {
    await seedUsersIfEmpty({ resetPasswords: true });
  } finally {
    // Skrip satu-kali harus menutup pool agar launcher dapat melanjutkan ke API.
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error("Gagal menyiapkan akun demo di MariaDB", error);
  process.exit(1);
});
