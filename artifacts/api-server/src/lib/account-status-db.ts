import { db, usersTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import {
  BLOCKED_ACCOUNT_STATUS,
  normalizeAccountStatus,
} from "./account-status";
import {
  normalizeLegacyAccountRole,
  type AccountRole,
} from "./account-role";

/**
 * Memindahkan status alur keanggotaan legacy keluar dari users.status.
 * Data profil tidak disentuh, sehingga pending/ditolak/keluar tetap utuh pada
 * profile.status. Fungsi idempoten dan aman dijalankan pada setiap startup.
 */
export async function normalizeLegacyAccountStatuses(): Promise<number> {
  const rows = await db
    .select({ id: usersTable.id, status: usersTable.status })
    .from(usersTable);
  const changed = rows.filter(
    (row) => row.status !== normalizeAccountStatus(row.status),
  );
  if (changed.length === 0) return 0;

  const blockedIds = changed
    .filter(
      (row) => normalizeAccountStatus(row.status) === BLOCKED_ACCOUNT_STATUS,
    )
    .map((row) => row.id);
  const activeIds = changed
    .filter(
      (row) => normalizeAccountStatus(row.status) !== BLOCKED_ACCOUNT_STATUS,
    )
    .map((row) => row.id);

  await db.transaction(async (tx) => {
    if (activeIds.length === 1) {
      await tx
        .update(usersTable)
        .set({ status: "aktif" })
        .where(eq(usersTable.id, activeIds[0]!));
    } else if (activeIds.length > 1) {
      await tx
        .update(usersTable)
        .set({ status: "aktif" })
        .where(inArray(usersTable.id, activeIds));
    }
    if (blockedIds.length === 1) {
      await tx
        .update(usersTable)
        .set({ status: "diblokir" })
        .where(eq(usersTable.id, blockedIds[0]!));
    } else if (blockedIds.length > 1) {
      await tx
        .update(usersTable)
        .set({ status: "diblokir" })
        .where(inArray(usersTable.id, blockedIds));
    }
  });

  return changed.length;
}

/** Menyelaraskan alias role lama yang diketahui dengan route aplikasi resmi. */
export async function normalizeLegacyAccountRoles(): Promise<number> {
  const rows = await db
    .select({ id: usersTable.id, role: usersTable.role })
    .from(usersTable);
  const changed = rows
    .map((row) => ({ ...row, normalized: normalizeLegacyAccountRole(row.role) }))
    .filter(
      (row): row is { id: string; role: string; normalized: AccountRole } =>
        row.normalized !== null && row.normalized !== row.role,
    );
  if (changed.length === 0) return 0;

  await db.transaction(async (tx) => {
    for (const row of changed) {
      await tx
        .update(usersTable)
        .set({ role: row.normalized })
        .where(eq(usersTable.id, row.id));
    }
  });
  return changed.length;
}
