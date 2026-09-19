import { randomUUID } from "node:crypto";
import mysql from "mysql2/promise";

const databaseUrl = process.env.MARIADB_URL ?? process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error(
    "MARIADB_URL (atau DATABASE_URL) harus di-set ke koneksi MariaDB/MySQL.",
  );
}

const apply = process.argv.includes("--apply");

const demoNews = new Map([
  [
    "Pembukaan Pendaftaran Pembinaan 2026\u0000Sanggar di seluruh Jakarta diundang mendaftar program pembinaan manajemen tahun ini.",
    "seed-news-pembinaan-2026",
  ],
  [
    "Festival Budaya Betawi Bulan Depan\u0000Pendaftaran peserta festival telah dibuka di portal Jak Sanggar.",
    "seed-news-festival-betawi-2026",
  ],
]);
const demoBanner =
  "Periode kurasi sanggar 2026 akan dimulai 1 Mei 2026.";
const demoSlider = new Set([
  "Sanggar berkarya, budaya bertahan\u0000https://images.unsplash.com/photo-1583294131-9c11d4d4b4e3?w=1200",
  "Regenerasi pelaku seni untuk Jakarta\u0000https://images.unsplash.com/photo-1604881991720-f91add269bed?w=1200",
]);

function fingerprint(row) {
  const data = typeof row.data === "string" ? JSON.parse(row.data) : row.data;
  if (row.collection === "news") {
    const key = `${String(data?.judul ?? "")}\u0000${String(data?.isi ?? "")}`;
    return demoNews.has(key) ? key : null;
  }
  if (row.collection === "banners") {
    return data?.teks === demoBanner ? demoBanner : null;
  }
  if (row.collection === "slider") {
    const key = `${String(data?.caption ?? "")}\u0000${String(data?.imageUrl ?? "")}`;
    return demoSlider.has(key) ? key : null;
  }
  return null;
}

function createdTime(row) {
  return row.createdAt instanceof Date
    ? row.createdAt.getTime()
    : Date.parse(String(row.createdAt));
}

function chooseKeeper(rows, key) {
  if (rows[0]?.collection === "news") {
    const stableId = demoNews.get(key);
    const stable = rows.find((row) => row.recordId === stableId);
    if (stable) return stable;
  }
  return [...rows].sort(
    (a, b) => createdTime(a) - createdTime(b) || a.recordId.localeCompare(b.recordId),
  )[0];
}

const connection = await mysql.createConnection(databaseUrl);
try {
  const [rows] = await connection.execute(
    "SELECT id, collection, record_id AS recordId, data, revision, created_at AS createdAt FROM sync_records WHERE collection IN ('news','banners','slider') AND deleted_at IS NULL ORDER BY collection, created_at, record_id",
  );
  const groups = new Map();
  for (const row of rows) {
    const key = fingerprint(row);
    if (!key) continue;
    const groupKey = `${row.collection}\u0000${key}`;
    const group = groups.get(groupKey) ?? [];
    group.push(row);
    groups.set(groupKey, group);
  }

  const targets = [];
  for (const [key, group] of groups) {
    if (group.length < 2) continue;
    const semanticKey = key.slice(key.indexOf("\u0000") + 1);
    const keeper = chooseKeeper(group, semanticKey);
    for (const row of group) {
      if (row.id === keeper.id) continue;
      targets.push({ ...row, keeperId: keeper.recordId });
    }
  }

  console.log(
    JSON.stringify(
      {
        mode: apply ? "apply" : "dry-run",
        duplicateCount: targets.length,
        targets: targets.map((row) => ({
          collection: row.collection,
          recordId: row.recordId,
          keeperId: row.keeperId,
        })),
      },
      null,
      2,
    ),
  );

  if (!apply || targets.length === 0) process.exitCode = 0;
  else {
    await connection.beginTransaction();
    try {
      for (const row of targets) {
        const [result] = await connection.execute(
          "UPDATE sync_records SET revision = revision + 1, deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND revision = ? AND deleted_at IS NULL",
          [row.id, row.revision],
        );
        if (result.affectedRows !== 1) {
          throw new Error(`Record berubah selama cleanup: ${row.collection}/${row.recordId}`);
        }
        await connection.execute(
          "INSERT INTO activity_log (id, actor_role, action, target_type, target_id, data, created_at, updated_at) VALUES (?, 'system', 'system.dedupe-demo', ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
          [
            randomUUID(),
            row.collection,
            row.recordId,
            JSON.stringify({
              reason: "duplicate_local_demo_seed",
              keeperId: row.keeperId,
            }),
          ],
        );
      }
      await connection.commit();
      console.log(`Rekonsiliasi selesai: ${targets.length} duplikat ditombstone.`);
    } catch (error) {
      await connection.rollback();
      throw error;
    }
  }
} finally {
  await connection.end();
}
