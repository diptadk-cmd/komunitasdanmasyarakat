import { db, usersTable } from "@workspace/db";
import { normalizeEmail } from "./password-reset-utils";

export class UserEmailError extends Error {
  constructor(
    message: string,
    public readonly status: 400 | 409,
  ) {
    super(message);
    this.name = "UserEmailError";
  }
}

/** Normalisasi dan cegah satu alamat terhubung ke lebih dari satu akun. */
export async function normalizeUniqueProfileEmail(
  profileInput: Record<string, unknown> | undefined,
  options: { required?: boolean; excludeUserId?: string } = {},
): Promise<Record<string, unknown>> {
  const profile = { ...(profileInput ?? {}) };
  const raw = profile["email"];
  const email = typeof raw === "string" ? normalizeEmail(raw) : null;

  if (!email) {
    if (options.required) {
      throw new UserEmailError(
        "Email wajib diisi dengan alamat yang valid agar OTP dapat dikirim.",
        400,
      );
    }
    delete profile["email"];
    return profile;
  }

  const users = await db
    .select({ id: usersTable.id, profile: usersTable.profile })
    .from(usersTable);
  const conflict = users.some((candidate) => {
    if (candidate.id === options.excludeUserId) return false;
    const stored = candidate.profile?.["email"];
    return typeof stored === "string" && normalizeEmail(stored) === email;
  });
  if (conflict) {
    throw new UserEmailError("Email sudah terdaftar pada akun lain.", 409);
  }

  profile["email"] = email;
  return profile;
}
