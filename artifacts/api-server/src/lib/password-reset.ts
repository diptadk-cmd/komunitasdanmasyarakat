import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { createTransport } from "nodemailer";
import {
  db,
  passwordResetChallengesTable,
  sessionsTable,
  usersTable,
} from "@workspace/db";
import { and, eq, isNull, lt, ne } from "drizzle-orm";
import { hashPassword } from "./auth";
import {
  createOtp,
  createResetToken,
  digestResetToken,
  MAX_OTP_ATTEMPTS,
  normalizeEmail,
  OTP_TTL_MS,
  passwordMeetsPolicy,
  resetTokenMatches,
  VERIFIED_TOKEN_TTL_MS,
} from "./password-reset-utils";
import { logger } from "./logger";

export class PasswordResetError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "PasswordResetError";
  }
}

function devOtpExposureEnabled(): boolean {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.PASSWORD_RESET_DEV_EXPOSE_OTP === "true"
  );
}

interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
  fromName?: string;
}

function getSmtpConfig(): SmtpConfig | null {
  const host = process.env.SMTP_HOST?.trim();
  const portText = process.env.SMTP_PORT?.trim();
  const secureText = process.env.SMTP_SECURE?.trim().toLowerCase();
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS;
  const fromInput = process.env.EMAIL_FROM ?? "";
  const from = normalizeEmail(fromInput);
  const fromName = process.env.EMAIL_FROM_NAME?.trim();
  const port = Number(portText);

  if (
    !host ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65_535 ||
    (secureText !== "true" && secureText !== "false") ||
    !user ||
    !pass ||
    !from ||
    (fromName !== undefined && /[\r\n]/.test(fromName))
  ) {
    return null;
  }

  return {
    host,
    port,
    secure: secureText === "true",
    user,
    pass,
    from,
    ...(fromName ? { fromName } : {}),
  };
}

export function passwordResetDeliveryConfigured(): boolean {
  return getSmtpConfig() !== null || devOtpExposureEnabled();
}

function smtpTransport(config: SmtpConfig) {
  return createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass,
    },
    requireTLS: !config.secure,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
}

function maskedEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "alamat-tidak-valid";
  return `${local.slice(0, 2)}***@${domain}`;
}

export async function verifyPasswordResetDelivery(): Promise<boolean> {
  if (devOtpExposureEnabled()) return true;
  const config = getSmtpConfig();
  if (!config) return false;
  const transporter = smtpTransport(config);
  try {
    return await transporter.verify();
  } finally {
    transporter.close();
  }
}

async function deliverOtp(
  email: string,
  otp: string,
): Promise<{ devOtp?: string }> {
  if (devOtpExposureEnabled()) return { devOtp: otp };

  const config = getSmtpConfig();
  if (!config) {
    throw new PasswordResetError(
      "Layanan pemulihan password belum dikonfigurasi.",
      503,
    );
  }

  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const transporter = smtpTransport(config);
    try {
      const result = await transporter.sendMail({
        from: config.fromName
          ? { name: config.fromName, address: config.from }
          : config.from,
        to: email,
        subject: "Kode OTP pemulihan password JAK SANGGAR",
        text: [
          "Kode OTP pemulihan password JAK SANGGAR Anda:",
          "",
          otp,
          "",
          `Kode ini berlaku selama ${OTP_TTL_MS / 60_000} menit.`,
          "Jangan berikan kode ini kepada siapa pun.",
          "Abaikan email ini jika Anda tidak meminta pemulihan password.",
        ].join("\n"),
        disableFileAccess: true,
        disableUrlAccess: true,
      });
      if (!result.accepted.length || result.rejected.length) {
        throw new Error("Server SMTP tidak menerima alamat tujuan.");
      }
      return {};
    } catch (error) {
      lastError = error;
      if (attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 500));
      }
    } finally {
      transporter.close();
    }
  }
  logger.error(
    { err: lastError, recipient: maskedEmail(email), attempts: 3 },
    "Pengiriman OTP gagal setelah percobaan ulang",
  );
  throw new PasswordResetError(
    "Layanan pengiriman OTP sedang tidak tersedia.",
    503,
  );
}

export async function requestPasswordReset(emailInput: string): Promise<{
  requestId: string;
  devOtp?: string;
}> {
  const email = normalizeEmail(emailInput);
  if (!email) throw new PasswordResetError("Alamat email tidak valid.", 400);
  if (!passwordResetDeliveryConfigured()) {
    throw new PasswordResetError(
      "Layanan pemulihan password belum dikonfigurasi.",
      503,
    );
  }

  // Pembersihan best-effort agar tabel tidak tumbuh tanpa batas.
  void db
    .delete(passwordResetChallengesTable)
    .where(
      lt(
        passwordResetChallengesTable.expiresAt,
        new Date(Date.now() - 86_400_000),
      ),
    )
    .catch(() => {});

  const users = await db
    .select({
      id: usersTable.id,
      status: usersTable.status,
      profile: usersTable.profile,
    })
    .from(usersTable)
    .where(ne(usersTable.status, "diblokir"));
  const matches = users.filter((candidate) => {
    const stored = candidate.profile?.["email"];
    return typeof stored === "string" && normalizeEmail(stored) === email;
  });
  const user = matches.length === 1 ? matches[0] : undefined;

  // Respons untuk email tak dikenal (atau email duplikat yang ambigu) tetap
  // berbentuk sama agar akun tidak bisa dienumerasi dari endpoint publik.
  if (!user) return { requestId: randomUUID() };

  await db
    .delete(passwordResetChallengesTable)
    .where(
      and(
        eq(passwordResetChallengesTable.userId, user.id),
        isNull(passwordResetChallengesTable.usedAt),
      ),
    );

  const requestId = randomUUID();
  const otp = createOtp();
  const otpHash = await bcrypt.hash(otp, 10);
  await db.insert(passwordResetChallengesTable).values({
    id: requestId,
    userId: user.id,
    otpHash,
    expiresAt: new Date(Date.now() + OTP_TTL_MS),
  });

  try {
    const delivery = await deliverOtp(email, otp);
    return { requestId, ...delivery };
  } catch (error) {
    await db
      .delete(passwordResetChallengesTable)
      .where(eq(passwordResetChallengesTable.id, requestId))
      .catch(() => {});

    logger.error(
      { err: error, recipient: maskedEmail(email), requestId },
      "OTP untuk akun terdaftar tidak berhasil dikirim",
    );

    // Jangan bedakan respons antara alamat tidak dikenal dan kegagalan
    // pengiriman per-penerima; perbedaan status dapat dipakai untuk enumerasi.
    return { requestId };
  }
}

export async function verifyPasswordReset(
  requestId: string,
  otp: string,
): Promise<{ resetToken: string }> {
  const rows = await db
    .select()
    .from(passwordResetChallengesTable)
    .where(eq(passwordResetChallengesTable.id, requestId))
    .limit(1);
  const challenge = rows[0];
  const now = new Date();
  if (
    !challenge ||
    challenge.usedAt ||
    challenge.expiresAt <= now ||
    challenge.attempts >= MAX_OTP_ATTEMPTS
  ) {
    throw new PasswordResetError(
      "Kode OTP tidak valid atau sudah kedaluwarsa.",
      400,
    );
  }

  const attempts = challenge.attempts + 1;
  const valid = await bcrypt.compare(otp, challenge.otpHash);
  if (!valid) {
    await db
      .update(passwordResetChallengesTable)
      .set({ attempts })
      .where(eq(passwordResetChallengesTable.id, requestId));
    const status = attempts >= MAX_OTP_ATTEMPTS ? 429 : 400;
    throw new PasswordResetError(
      attempts >= MAX_OTP_ATTEMPTS
        ? "Batas percobaan OTP tercapai. Minta kode baru."
        : "Kode OTP tidak valid atau sudah kedaluwarsa.",
      status,
    );
  }

  const resetToken = createResetToken();
  await db
    .update(passwordResetChallengesTable)
    .set({
      attempts,
      verifiedTokenHash: digestResetToken(resetToken),
      verifiedExpiresAt: new Date(Date.now() + VERIFIED_TOKEN_TTL_MS),
    })
    .where(eq(passwordResetChallengesTable.id, requestId));
  return { resetToken };
}

export async function confirmPasswordReset(
  requestId: string,
  resetToken: string,
  newPassword: string,
): Promise<void> {
  if (!passwordMeetsPolicy(newPassword)) {
    throw new PasswordResetError("Password minimal 8 karakter.", 400);
  }

  const rows = await db
    .select()
    .from(passwordResetChallengesTable)
    .where(eq(passwordResetChallengesTable.id, requestId))
    .limit(1);
  const challenge = rows[0];
  if (
    !challenge ||
    challenge.usedAt ||
    !challenge.verifiedTokenHash ||
    !challenge.verifiedExpiresAt ||
    challenge.verifiedExpiresAt <= new Date() ||
    !resetTokenMatches(resetToken, challenge.verifiedTokenHash)
  ) {
    throw new PasswordResetError(
      "Sesi pemulihan tidak valid atau sudah kedaluwarsa.",
      400,
    );
  }

  const passwordHash = await hashPassword(newPassword);
  await db.transaction(async (tx) => {
    await tx
      .update(usersTable)
      .set({ passwordHash })
      .where(eq(usersTable.id, challenge.userId));
    await tx
      .update(passwordResetChallengesTable)
      .set({
        usedAt: new Date(),
        verifiedTokenHash: null,
        verifiedExpiresAt: null,
      })
      .where(eq(passwordResetChallengesTable.id, requestId));
    await tx
      .delete(sessionsTable)
      .where(eq(sessionsTable.userId, challenge.userId));
  });
}
