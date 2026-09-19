import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";

const dbRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const databaseUrl = process.env.MARIADB_URL ?? process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    "MARIADB_URL (atau DATABASE_URL) harus di-set ke koneksi MariaDB/MySQL.",
  );
}

async function tableExists(connection, tableName) {
  const [rows] = await connection.execute(
    "SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? LIMIT 1",
    [tableName],
  );
  return rows.length > 0;
}

function runInitialSchemaPush() {
  const require = createRequire(import.meta.url);
  const drizzleEntry = require.resolve("drizzle-kit");
  const drizzleBin = path.join(path.dirname(drizzleEntry), "bin.cjs");
  const result = spawnSync(
    process.execPath,
    [drizzleBin, "push", "--force", "--config", "./drizzle.config.ts"],
    {
      cwd: dbRoot,
      env: process.env,
      stdio: "inherit",
    },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      `Pembuatan skema awal gagal (exit ${result.status ?? "unknown"}).`,
    );
  }
}

async function getColumns(connection, tableName) {
  const [rows] = await connection.execute(
    "SELECT COLUMN_NAME, IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?",
    [tableName],
  );
  return new Map(rows.map((row) => [row.COLUMN_NAME, row]));
}

const AUDIT_MAX_DEPTH = 4;
const AUDIT_MAX_KEYS = 32;
const AUDIT_MAX_ARRAY_ITEMS = 20;
const AUDIT_MAX_STRING_LENGTH = 512;
const AUDIT_SENSITIVE_KEY =
  /password|passwd|otp|token|secret|authorization|cookie|session|credential|hash/i;

function sanitizeAuditValue(value, depth = 0) {
  if (value === null || typeof value === "boolean" || typeof value === "number")
    return value;
  if (typeof value === "string") return value.slice(0, AUDIT_MAX_STRING_LENGTH);
  if (depth >= AUDIT_MAX_DEPTH) return "[truncated]";
  if (Array.isArray(value)) {
    return value
      .slice(0, AUDIT_MAX_ARRAY_ITEMS)
      .map((item) => sanitizeAuditValue(item, depth + 1));
  }
  if (typeof value !== "object")
    return String(value).slice(0, AUDIT_MAX_STRING_LENGTH);

  const output = {};
  for (const [key, item] of Object.entries(value).slice(0, AUDIT_MAX_KEYS)) {
    if (AUDIT_SENSITIVE_KEY.test(key)) continue;
    output[key] = sanitizeAuditValue(item, depth + 1);
  }
  return output;
}

function parseJsonObject(value) {
  if (Buffer.isBuffer(value)) value = value.toString("utf8");
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return {};
    }
  }
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};
}

function legacyActivityId(recordId) {
  if (recordId.length <= 36) return recordId;
  const hash = createHash("sha256")
    .update(`sync-activity:${recordId}`)
    .digest("hex");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
}

function legacyActivityDate(value, fallback) {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  const date = new Date(value);
  const earliest = Date.UTC(2000, 0, 1);
  const latest = Date.now() + 86_400_000;
  return date.getTime() >= earliest && date.getTime() <= latest
    ? date
    : fallback;
}

async function ensurePasswordResetSchema(connection) {
  const [userIdRows] = await connection.execute(
    "SELECT CHARACTER_SET_NAME, COLLATION_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'id' LIMIT 1",
  );
  const userIdColumn = userIdRows[0];
  const charset = String(userIdColumn?.CHARACTER_SET_NAME ?? "");
  const collation = String(userIdColumn?.COLLATION_NAME ?? "");
  const safeIdentifier = /^[A-Za-z0-9_]+$/;
  if (!safeIdentifier.test(charset) || !safeIdentifier.test(collation)) {
    throw new Error(
      "Charset/collation users.id tidak dapat ditentukan dengan aman.",
    );
  }

  await connection.execute(`
    CREATE TABLE IF NOT EXISTS \`password_reset_challenges\` (
      \`id\` varchar(36) NOT NULL,
      \`user_id\` varchar(36) CHARACTER SET ${charset} COLLATE ${collation} NOT NULL,
      \`otp_hash\` text NOT NULL,
      \`attempts\` int NOT NULL DEFAULT 0,
      \`expires_at\` timestamp NOT NULL,
      \`verified_token_hash\` varchar(64) DEFAULT NULL,
      \`verified_expires_at\` timestamp NULL DEFAULT NULL,
      \`used_at\` timestamp NULL DEFAULT NULL,
      \`created_at\` timestamp NOT NULL DEFAULT current_timestamp(),
      PRIMARY KEY (\`id\`),
      KEY \`idx_password_reset_user\` (\`user_id\`),
      KEY \`idx_password_reset_expiry\` (\`expires_at\`),
      CONSTRAINT \`password_reset_challenges_user_id_users_id_fk\`
        FOREIGN KEY (\`user_id\`) REFERENCES \`users\` (\`id\`) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=${charset} COLLATE=${collation}
  `);

  let columns = await getColumns(connection, "password_reset_challenges");
  const addColumn = async (name, definition) => {
    if (columns.has(name)) return;
    await connection.execute(
      `ALTER TABLE \`password_reset_challenges\` ADD COLUMN \`${name}\` ${definition}`,
    );
    columns = await getColumns(connection, "password_reset_challenges");
  };

  // Migrasi aman dari rancangan reset-password lama. Tantangan lama sengaja
  // dibuat kedaluwarsa; pengguna cukup meminta OTP baru setelah pembaruan.
  await addColumn("otp_hash", "text NULL AFTER `user_id`");
  await addColumn("attempts", "int NOT NULL DEFAULT 0 AFTER `otp_hash`");
  await addColumn("verified_token_hash", "varchar(64) NULL AFTER `expires_at`");
  await addColumn(
    "verified_expires_at",
    "timestamp NULL DEFAULT NULL AFTER `verified_token_hash`",
  );

  await connection.execute(`
    UPDATE \`password_reset_challenges\`
       SET \`otp_hash\` = 'legacy-challenge-invalidated',
           \`expires_at\` = DATE_SUB(NOW(), INTERVAL 1 SECOND),
           \`verified_token_hash\` = NULL,
           \`verified_expires_at\` = NULL
     WHERE \`otp_hash\` IS NULL
  `);
  await connection.execute(
    "ALTER TABLE `password_reset_challenges` MODIFY COLUMN `otp_hash` text NOT NULL",
  );

  // Kolom legacy ini boleh tetap ada agar migrasi tidak merusak histori, tetapi
  // harus nullable supaya insert dengan skema baru tidak tertolak.
  if (columns.get("code_hash")?.IS_NULLABLE === "NO") {
    await connection.execute(
      "ALTER TABLE `password_reset_challenges` MODIFY COLUMN `code_hash` varchar(64) NULL",
    );
  }

  const [indexes] = await connection.execute(
    "SELECT INDEX_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'password_reset_challenges'",
  );
  const indexNames = new Set(indexes.map((row) => row.INDEX_NAME));
  if (!indexNames.has("idx_password_reset_user")) {
    await connection.execute(
      "CREATE INDEX `idx_password_reset_user` ON `password_reset_challenges` (`user_id`)",
    );
  }

  await connection.execute(`
    CREATE TABLE IF NOT EXISTS \`jak_schema_migrations\` (
      \`name\` varchar(128) NOT NULL,
      \`applied_at\` timestamp NOT NULL DEFAULT current_timestamp(),
      PRIMARY KEY (\`name\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await connection.execute(
    "INSERT IGNORE INTO `jak_schema_migrations` (`name`) VALUES ('0001_password_reset_v2')",
  );
}

async function ensureActivityAuditSchema(connection) {
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS \`activity_log\` (
      \`id\` varchar(36) NOT NULL,
      \`actor_id\` varchar(36) DEFAULT NULL,
      \`actor_role\` varchar(32) DEFAULT NULL,
      \`action\` varchar(128) DEFAULT NULL,
      \`target_type\` varchar(64) DEFAULT NULL,
      \`target_id\` varchar(191) DEFAULT NULL,
      \`data\` json NOT NULL,
      \`created_at\` timestamp NOT NULL DEFAULT current_timestamp(),
      \`updated_at\` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
      PRIMARY KEY (\`id\`),
      KEY \`idx_activity_log_actor\` (\`actor_id\`),
      KEY \`idx_activity_log_action\` (\`action\`),
      KEY \`idx_activity_log_target\` (\`target_type\`, \`target_id\`),
      KEY \`idx_activity_log_created_at\` (\`created_at\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  let columns = await getColumns(connection, "activity_log");
  const addColumn = async (name, definition) => {
    if (columns.has(name)) return;
    await connection.execute(
      `ALTER TABLE \`activity_log\` ADD COLUMN \`${name}\` ${definition}`,
    );
    columns = await getColumns(connection, "activity_log");
  };
  await addColumn("target_type", "varchar(64) NULL AFTER `action`");
  await addColumn("target_id", "varchar(191) NULL AFTER `target_type`");

  const [indexes] = await connection.execute(
    "SELECT INDEX_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'activity_log'",
  );
  const indexNames = new Set(indexes.map((row) => row.INDEX_NAME));
  const ensureIndex = async (name, sql) => {
    if (!indexNames.has(name)) await connection.execute(sql);
  };
  await ensureIndex(
    "idx_activity_log_actor",
    "CREATE INDEX `idx_activity_log_actor` ON `activity_log` (`actor_id`)",
  );
  await ensureIndex(
    "idx_activity_log_action",
    "CREATE INDEX `idx_activity_log_action` ON `activity_log` (`action`)",
  );
  await ensureIndex(
    "idx_activity_log_target",
    "CREATE INDEX `idx_activity_log_target` ON `activity_log` (`target_type`, `target_id`)",
  );
  await ensureIndex(
    "idx_activity_log_created_at",
    "CREATE INDEX `idx_activity_log_created_at` ON `activity_log` (`created_at`)",
  );

  // `db.activity` versi local-first terdahulu tersimpan sebagai record sync.
  // Mirror dengan primary key deterministik agar migrasi aman dijalankan ulang.
  if (await tableExists(connection, "sync_records")) {
    const [legacyRows] = await connection.execute(`
      SELECT
        s.record_id,
        s.owner_id,
        s.data,
        s.created_at,
        u.role AS actor_role
      FROM sync_records s
      LEFT JOIN users u ON u.id = s.owner_id
      WHERE s.collection = 'activity'
        AND s.deleted_at IS NULL
    `);

    for (const row of legacyRows) {
      const recordId = String(row.record_id ?? "");
      const ownerId = String(row.owner_id ?? "");
      if (!recordId || !ownerId) continue;

      const data = parseJsonObject(row.data);
      const rawMeta = parseJsonObject(data.meta);
      const meta = sanitizeAuditValue({
        ...rawMeta,
        source: "legacy-sync",
      });
      const action =
        typeof data.action === "string" && data.action.trim()
          ? data.action.trim().slice(0, 128)
          : "client.activity";
      const targetId =
        typeof rawMeta.id === "string" && rawMeta.id.trim()
          ? rawMeta.id.trim().slice(0, 191)
          : recordId.slice(0, 191);
      const createdAt = legacyActivityDate(data.ts, row.created_at);

      await connection.execute(
        `INSERT INTO activity_log
          (id, actor_id, actor_role, action, target_type, target_id, data, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'client-activity', ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE id = VALUES(id)`,
        [
          legacyActivityId(recordId),
          ownerId.slice(0, 36),
          typeof row.actor_role === "string"
            ? row.actor_role.slice(0, 32)
            : null,
          action,
          targetId,
          JSON.stringify(meta),
          createdAt,
          createdAt,
        ],
      );
    }

    console.log(
      `Backfill audit aktivitas: ${legacyRows.length} record legacy diperiksa.`,
    );
  }

  await connection.execute(
    "INSERT IGNORE INTO `jak_schema_migrations` (`name`) VALUES ('0002_activity_audit_v1')",
  );
}

async function ensureKurasiParticipantDispositionSchema(connection) {
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS kurasi_participant_dispositions (
      id VARCHAR(36) NOT NULL PRIMARY KEY,
      submission_id VARCHAR(36) NOT NULL,
      sanggar_id VARCHAR(36) NOT NULL,
      participant_user_id VARCHAR(36) NOT NULL,
      participant_username VARCHAR(100) NOT NULL,
      nik_hash VARCHAR(64) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_kurasi_disposition_participant (participant_user_id),
      UNIQUE KEY uq_kurasi_disposition_nik (nik_hash),
      KEY idx_kurasi_disposition_submission (submission_id),
      KEY idx_kurasi_disposition_sanggar (sanggar_id)
    ) ENGINE=InnoDB
  `);
}

function expectedSchemaTables() {
  const schemaDir = path.join(dbRoot, "src", "schema");
  const names = new Set();
  for (const entry of fs.readdirSync(schemaDir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".ts")) continue;
    const source = fs.readFileSync(path.join(schemaDir, entry.name), "utf8");
    for (const match of source.matchAll(/mysqlTable\(\s*["']([^"']+)["']/g)) {
      names.add(match[1]);
    }
  }
  return names;
}

let connection = await mysql.createConnection(databaseUrl);
try {
  if (!(await tableExists(connection, "users"))) {
    console.log("Database baru terdeteksi; membuat skema awal...");
    await connection.end();
    runInitialSchemaPush();
    connection = await mysql.createConnection(databaseUrl);
  } else {
    console.log(
      "Database yang sudah ada terdeteksi; menerapkan migrasi kompatibel MariaDB...",
    );
  }

  await ensurePasswordResetSchema(connection);
  await ensureActivityAuditSchema(connection);
  await ensureKurasiParticipantDispositionSchema(connection);

  const [actualRows] = await connection.execute(
    "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()",
  );
  const actual = new Set(actualRows.map((row) => row.TABLE_NAME));
  const missing = [...expectedSchemaTables()].filter(
    (name) => !actual.has(name),
  );
  if (missing.length > 0) {
    throw new Error(
      `Skema database belum lengkap. Tabel yang hilang: ${missing.join(", ")}`,
    );
  }

  console.log("Skema MariaDB siap.");
} finally {
  await connection.end().catch(() => {});
}
