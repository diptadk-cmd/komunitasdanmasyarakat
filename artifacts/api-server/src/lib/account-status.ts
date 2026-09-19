export const ACTIVE_ACCOUNT_STATUS = "aktif" as const;
export const BLOCKED_ACCOUNT_STATUS = "diblokir" as const;

export type AccountStatus =
  | typeof ACTIVE_ACCOUNT_STATUS
  | typeof BLOCKED_ACCOUNT_STATUS;

export function isBlockedAccountStatus(status: unknown): boolean {
  return (
    typeof status === "string" &&
    status.trim().toLowerCase() === BLOCKED_ACCOUNT_STATUS
  );
}

/**
 * Status akun hanya mengenal aktif dan diblokir. Status alur bisnis seperti
 * pending/ditolak/keluar tetap disimpan pada profil keanggotaan, bukan akun.
 */
export function normalizeAccountStatus(status: unknown): AccountStatus {
  return isBlockedAccountStatus(status)
    ? BLOCKED_ACCOUNT_STATUS
    : ACTIVE_ACCOUNT_STATUS;
}
