import { defineConfig } from "drizzle-kit";
import path from "path";

const url = process.env.MARIADB_URL ?? process.env.DATABASE_URL;

if (!url) {
  throw new Error(
    "MARIADB_URL (atau DATABASE_URL) harus di-set ke koneksi MariaDB/MySQL (mysql://...).",
  );
}

export default defineConfig({
  schema: "./src/schema/index.ts",
  dialect: "mysql",
  dbCredentials: {
    url,
  },
});
