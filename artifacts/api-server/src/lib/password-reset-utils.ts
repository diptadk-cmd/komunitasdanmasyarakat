import {
  createHash,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from "node:crypto";

export const OTP_TTL_MS = 10 * 60 * 1000;
export const VERIFIED_TOKEN_TTL_MS = 10 * 60 * 1000;
export const MAX_OTP_ATTEMPTS = 5;
export const MIN_ACCOUNT_PASSWORD_LENGTH = 8;

export function normalizeEmail(value: string): string | null {
  const email = value.trim().toLowerCase();
  if (!email || email.length > 254 || /\s/.test(email)) return null;

  const atIndex = email.indexOf("@");
  if (atIndex <= 0 || atIndex !== email.lastIndexOf("@")) return null;

  const localPart = email.slice(0, atIndex);
  const domain = email.slice(atIndex + 1);
  if (
    localPart.length > 64 ||
    localPart.startsWith(".") ||
    localPart.endsWith(".") ||
    localPart.includes("..") ||
    !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$/i.test(localPart)
  ) {
    return null;
  }

  const labels = domain.split(".");
  if (
    labels.length < 2 ||
    labels.some(
      (label) =>
        label.length === 0 ||
        label.length > 63 ||
        !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(label),
    )
  ) {
    return null;
  }

  return email;
}

export function normalizePhone(value: string): string | null {
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("0")) digits = `62${digits.slice(1)}`;
  else if (digits.startsWith("8")) digits = `62${digits}`;
  if (digits.length < 10 || digits.length > 15) return null;
  return digits;
}

export function createOtp(): string {
  return randomInt(100_000, 1_000_000).toString();
}

export function createResetToken(): string {
  return randomBytes(32).toString("hex");
}

export function digestResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function resetTokenMatches(
  token: string,
  expectedDigest: string,
): boolean {
  const actual = Buffer.from(digestResetToken(token), "hex");
  const expected = Buffer.from(expectedDigest, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function passwordMeetsPolicy(password: string): boolean {
  return password.length >= MIN_ACCOUNT_PASSWORD_LENGTH;
}
