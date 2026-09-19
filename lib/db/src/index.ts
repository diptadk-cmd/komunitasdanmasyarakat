import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "./schema";

// Jak Sanggar memakai MariaDB (produksi di VPS Bizznet). Untuk dev di Replit,
// pakai MARIADB_URL (mis. mysql://root@127.0.0.1:3306/jaksanggar). Di VPS,
// set MARIADB_URL atau DATABASE_URL ke koneksi mysql:// produksi.
const url = process.env.MARIADB_URL ?? process.env.DATABASE_URL;

if (!url) {
  throw new Error(
    "MARIADB_URL (atau DATABASE_URL) harus di-set ke koneksi MariaDB/MySQL (mysql://...).",
  );
}

export const pool = mysql.createPool(url);
export const db = drizzle(pool, { schema, mode: "default" });

export * from "./schema";
