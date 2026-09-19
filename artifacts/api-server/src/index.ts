import app from "./app";
import { logger } from "./lib/logger";
import { seedUsersIfEmpty } from "./lib/seed";
import { seedCreativeMediaIfMissing } from "./lib/creative-media-seed";
import { verifyPasswordResetDelivery } from "./lib/password-reset";
import {
  normalizeLegacyAccountRoles,
  normalizeLegacyAccountStatuses,
} from "./lib/account-status-db";

const rawPort = process.env["PORT"] ?? "3000";

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function start(): Promise<void> {
  const normalizedAccountCount = await normalizeLegacyAccountStatuses();
  if (normalizedAccountCount > 0) {
    logger.info(
      { normalizedAccountCount },
      "Status akun legacy dinormalisasi menjadi aktif/diblokir",
    );
  }
  const normalizedRoleCount = await normalizeLegacyAccountRoles();
  if (normalizedRoleCount > 0) {
    logger.info(
      { normalizedRoleCount },
      "Role akun legacy dinormalisasi ke role aplikasi resmi",
    );
  }
  if (
    process.env["NODE_ENV"] !== "production" &&
    process.env["SEED_DEMO_USERS"] === "true"
  ) {
    await seedUsersIfEmpty();
  } else if (process.env["NODE_ENV"] === "production") {
    logger.info("Production mode: seed demo users dilewati");
  }
  if (
    process.env["NODE_ENV"] !== "production" &&
    process.env["SEED_DEMO_CONTENT"] === "true"
  ) {
    await seedCreativeMediaIfMissing();
  }

  try {
    const smtpReady = await verifyPasswordResetDelivery();
    if (smtpReady) logger.info("SMTP OTP terverifikasi dan siap digunakan");
    else logger.error("SMTP OTP belum dikonfigurasi dengan lengkap");
  } catch (err) {
    logger.error({ err }, "Verifikasi SMTP OTP saat startup gagal");
  }

  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }

    logger.info({ port }, "Server listening");
  });
}

start().catch((err: unknown) => {
  logger.error({ err }, "Server gagal dimulai");
  process.exit(1);
});
