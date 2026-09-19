import { isBlockedAccountStatus } from "./account-status";

interface ImpersonationTarget {
  role: string;
  status: string;
}

export type ImpersonationTargetValidation =
  | { ok: true }
  | { ok: false; status: 403 | 404; error: string };

export function validateImpersonationTarget(
  target: ImpersonationTarget | null | undefined,
): ImpersonationTargetValidation {
  if (!target) {
    return { ok: false, status: 404, error: "Akun tujuan tidak ditemukan." };
  }
  if (isBlockedAccountStatus(target.status)) {
    return {
      ok: false,
      status: 403,
      error: "Akun tujuan sedang diblokir.",
    };
  }
  return { ok: true };
}
