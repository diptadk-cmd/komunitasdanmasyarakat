import { Router, type IRouter, type Request, type Response } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  AuthLoginBody,
  AuthRegisterBody,
  ConfirmPasswordResetBody,
  RequestPasswordResetBody,
  VerifyPasswordResetBody,
} from "@workspace/api-zod";
import {
  CURATOR_SESSION_COOKIE,
  SESSION_COOKIE,
  SESSION_TTL_MS,
  createSession,
  destroySession,
  getSessionUser,
  hashPassword,
  toAuthUser,
  verifyPassword,
} from "../lib/auth";
import {
  requireAuth,
  requireRole,
  sessionTokenFromRequest,
} from "../middlewares/auth";
import { createRateLimit } from "../lib/rate-limit";
import { validasiDanNormalisasiTokoOfflineMitra } from "../lib/mitra-registration";
import {
  confirmPasswordReset,
  PasswordResetError,
  requestPasswordReset,
  verifyPasswordReset,
} from "../lib/password-reset";
import { recordActivityAudit } from "../lib/activity-audit";
import { logger } from "../lib/logger";
import { normalizeUniqueProfileEmail, UserEmailError } from "../lib/user-email";
import { validateImpersonationTarget } from "../lib/impersonation-policy";
import { isBlockedAccountStatus } from "../lib/account-status";
import { documentRendererUrl } from "../lib/document-renderer";

const router: IRouter = Router();

const loginRateLimit = createRateLimit({
  name: "auth-login",
  windowMs: 15 * 60 * 1000,
  max: 20,
});
const registerRateLimit = createRateLimit({
  name: "auth-register",
  windowMs: 60 * 60 * 1000,
  max: 10,
});
const passwordResetRateLimit = createRateLimit({
  name: "auth-password-reset",
  windowMs: 15 * 60 * 1000,
  max: 10,
});

const SESSION_COOKIE_OPTS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env["NODE_ENV"] === "production",
  path: "/",
};

function cookieFromRequest(req: Request, name: string): string | undefined {
  return (req as Request & { cookies?: Record<string, string> }).cookies?.[
    name
  ];
}

async function getCuratorSessionUser(req: Request) {
  const token = cookieFromRequest(req, CURATOR_SESSION_COOKIE);
  if (!token) return null;
  const user = await getSessionUser(token);
  return user?.role === "kurator" ? { token, user } : null;
}

router.use("/auth", (_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});

function sendPasswordResetError(res: Response, error: unknown): void {
  if (error instanceof PasswordResetError) {
    res.status(error.status).json({ error: error.message });
    return;
  }
  res.status(500).json({ error: "Pemulihan password gagal diproses." });
}

router.post(
  "/auth/login",
  loginRateLimit,
  async (req: Request, res: Response) => {
    const parsed = AuthLoginBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Permintaan tidak valid" });
      return;
    }
    const { password, expectedRole, tabSession } = parsed.data;
    const username = parsed.data.username.trim();
    const rows = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.username, username))
      .limit(1);
    const user = rows[0];
    if (!user) {
      res.status(401).json({ error: "Username atau password salah" });
      return;
    }
    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) {
      res.status(401).json({ error: "Username atau password salah" });
      return;
    }
    if (isBlockedAccountStatus(user.status)) {
      res.status(403).json({
        error:
          "Akun diblokir oleh Kurator karena pengaduan, aktivitas atau potensi mencurigakan, manipulasi data, upaya maupun tindakan penipuan, atau dugaan tindak kriminal lainnya sesuai ketentuan peraturan perundang-undangan yang berlaku. Hubungi pengelola Jak Sanggar.",
      });
      return;
    }
    // Validasi peran SEBELUM membuat sesi/cookie: bila klien meminta peran
    // tertentu (mis. Konsol Kurator) dan akun tidak cocok, tolak tanpa
    // menyentuh cookie sesi lama pengguna.
    if (expectedRole && user.role !== expectedRole) {
      res.status(403).json({
        error:
          expectedRole === "kurator"
            ? "Konsol ini khusus Kurator. Silakan masuk lewat aplikasi utama."
            : "Peran akun tidak sesuai untuk aplikasi ini.",
      });
      return;
    }
    const { token, expiresAt } = await createSession(user.id);
    await recordActivityAudit({
      actor: user,
      action: "auth.login",
      targetType: "user",
      targetId: user.id,
      meta: { role: user.role },
    }).catch((error: unknown) => {
      logger.error(
        { err: error, actorId: user.id },
        "Audit login gagal disimpan",
      );
    });
    const useTabSession =
      tabSession === true && process.env["NODE_ENV"] !== "production";
    if (!useTabSession) {
      res.cookie(SESSION_COOKIE, token, {
        ...SESSION_COOKIE_OPTS,
        expires: expiresAt,
      });
      res.clearCookie(CURATOR_SESSION_COOKIE, SESSION_COOKIE_OPTS);
    }
    res.json({
      ...toAuthUser(user),
      ...(useTabSession ? { sessionToken: token } : {}),
    });
  },
);

// Registrasi mandiri publik untuk pelatih/seniman/sanggar/juri/pengrajin.
// Role dibatasi ketat oleh schema agar endpoint publik tidak dapat membuat
// akun kurator/admin.
router.post(
  "/auth/register",
  registerRateLimit,
  async (req: Request, res: Response) => {
    const parsed = AuthRegisterBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Permintaan tidak valid" });
      return;
    }
    const { username, password, role, profile } = parsed.data;
    const validasiTokoOffline = validasiDanNormalisasiTokoOfflineMitra(
      role,
      profile,
    );
    if (!validasiTokoOffline.ok) {
      res.status(400).json({ error: validasiTokoOffline.error });
      return;
    }
    const existing = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.username, username))
      .limit(1);
    if (existing[0]) {
      res.status(409).json({ error: "Username sudah dipakai" });
      return;
    }
    let memberProfile: Record<string, unknown>;
    try {
      memberProfile = await normalizeUniqueProfileEmail(profile, {
        required: true,
      });
    } catch (error) {
      if (error instanceof UserEmailError) {
        res.status(error.status).json({ error: error.message });
        return;
      }
      throw error;
    }
    if (role === "pelatih" || role === "seniman") {
      const selectedSanggarId = memberProfile["sanggarId"];
      const selectedSanggarUsername = memberProfile["sanggarUsername"];
      const hasSelectedSanggar =
        typeof selectedSanggarId === "string" ||
        typeof selectedSanggarUsername === "string";

      if (role === "seniman" && !hasSelectedSanggar) {
        res.status(400).json({ error: "Sanggar tujuan wajib dipilih." });
        return;
      }

      if (hasSelectedSanggar) {
        const selectedSanggarRows = await db
          .select({
            username: usersTable.username,
            role: usersTable.role,
            status: usersTable.status,
          })
          .from(usersTable)
          .where(
            typeof selectedSanggarId === "string"
              ? eq(usersTable.id, selectedSanggarId)
              : eq(usersTable.username, String(selectedSanggarUsername)),
          )
          .limit(1);
        const selectedSanggar = selectedSanggarRows[0];
        if (
          !selectedSanggar ||
          selectedSanggar.role !== "sanggar" ||
          isBlockedAccountStatus(selectedSanggar.status)
        ) {
          res.status(400).json({
            error: "Sanggar tujuan tidak ditemukan atau sedang diblokir.",
          });
          return;
        }
        memberProfile["sanggarUsername"] = selectedSanggar.username;
        delete memberProfile["sanggarId"];
      }
    }
    // Hanya calon anggota sanggar yang menunggu validasi. Sanggar, juri, dan
    // penyewa dapat langsung memakai akun setelah pendaftaran berhasil.
    memberProfile["status"] =
      role === "pelatih" || role === "seniman" ? "pending" : "aktif";
    const passwordHash = await hashPassword(password);
    const requiresApproval = role === "pelatih" || role === "seniman";
    await db.insert(usersTable).values({
      username,
      passwordHash,
      role,
      status: "aktif",
      profile: memberProfile,
    });
    const rows = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.username, username))
      .limit(1);
    const user = rows[0]!;
    if (!requiresApproval) {
      const { token, expiresAt } = await createSession(user.id);
      res.cookie(SESSION_COOKIE, token, {
        ...SESSION_COOKIE_OPTS,
        expires: expiresAt,
      });
      res.clearCookie(CURATOR_SESSION_COOKIE, SESSION_COOKIE_OPTS);
    }
    res.status(201).json(toAuthUser(user));
  },
);

router.post(
  "/auth/password-reset/request",
  passwordResetRateLimit,
  async (req: Request, res: Response) => {
    const parsed = RequestPasswordResetBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Alamat email tidak valid." });
      return;
    }
    try {
      const result = await requestPasswordReset(parsed.data.email);
      res.status(202).json(result);
    } catch (error) {
      sendPasswordResetError(res, error);
    }
  },
);

router.post(
  "/auth/password-reset/verify",
  passwordResetRateLimit,
  async (req: Request, res: Response) => {
    const parsed = VerifyPasswordResetBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Kode OTP tidak valid." });
      return;
    }
    try {
      const result = await verifyPasswordReset(
        parsed.data.requestId,
        parsed.data.otp,
      );
      res.json(result);
    } catch (error) {
      sendPasswordResetError(res, error);
    }
  },
);

router.post(
  "/auth/password-reset/confirm",
  passwordResetRateLimit,
  async (req: Request, res: Response) => {
    const parsed = ConfirmPasswordResetBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Data password baru tidak valid." });
      return;
    }
    try {
      await confirmPasswordReset(
        parsed.data.requestId,
        parsed.data.resetToken,
        parsed.data.newPassword,
      );
      res.clearCookie(SESSION_COOKIE, SESSION_COOKIE_OPTS);
      res.clearCookie(CURATOR_SESSION_COOKIE, SESSION_COOKIE_OPTS);
      res.status(204).end();
    } catch (error) {
      sendPasswordResetError(res, error);
    }
  },
);

router.post(
  "/auth/impersonate",
  requireAuth,
  requireRole(["kurator"]),
  async (req: Request, res: Response) => {
    if (await getCuratorSessionUser(req)) {
      res.status(409).json({
        error: "Selesaikan sesi Login As saat ini sebelum memilih akun lain.",
      });
      return;
    }
    const targetUserId =
      typeof req.body?.targetUserId === "string"
        ? req.body.targetUserId.trim()
        : "";
    if (!targetUserId) {
      res.status(400).json({ error: "ID akun tujuan wajib diisi." });
      return;
    }
    const rows = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, targetUserId))
      .limit(1);
    const target = rows[0];
    const validation = validateImpersonationTarget(target);
    if (!validation.ok) {
      res.status(validation.status).json({ error: validation.error });
      return;
    }

    const originalToken = req.sessionToken!;
    const { token: targetToken, expiresAt } = await createSession(target.id);
    res.cookie(CURATOR_SESSION_COOKIE, originalToken, {
      ...SESSION_COOKIE_OPTS,
      expires: new Date(Date.now() + SESSION_TTL_MS),
    });
    res.cookie(SESSION_COOKIE, targetToken, {
      ...SESSION_COOKIE_OPTS,
      expires: expiresAt,
    });
    await recordActivityAudit({
      actor: req.user!,
      action: "auth.impersonate.start",
      targetType: "user",
      targetId: target.id,
      meta: { targetRole: target.role, targetUsername: target.username },
    }).catch((error: unknown) => {
      logger.error(
        { err: error, actorId: req.user!.id, targetId: target.id },
        "Audit Login As gagal disimpan",
      );
    });
    res.json({
      ...toAuthUser(target),
      impersonatedFrom: {
        id: req.user!.id,
        username: req.user!.username,
        role: req.user!.role,
      },
    });
  },
);

router.post("/auth/impersonate/stop", async (req: Request, res: Response) => {
  const curatorSession = await getCuratorSessionUser(req);
  if (!curatorSession) {
    res.clearCookie(CURATOR_SESSION_COOKIE, SESSION_COOKIE_OPTS);
    res.status(401).json({ error: "Sesi Kurator asal tidak tersedia." });
    return;
  }
  const currentToken = sessionTokenFromRequest(req);
  const currentUser = currentToken ? await getSessionUser(currentToken) : null;
  if (currentToken && currentToken !== curatorSession.token) {
    await destroySession(currentToken);
  }
  res.cookie(SESSION_COOKIE, curatorSession.token, {
    ...SESSION_COOKIE_OPTS,
    expires: new Date(Date.now() + SESSION_TTL_MS),
  });
  res.clearCookie(CURATOR_SESSION_COOKIE, SESSION_COOKIE_OPTS);
  await recordActivityAudit({
    actor: curatorSession.user,
    action: "auth.impersonate.stop",
    targetType: "user",
    targetId: currentUser?.id,
    meta: {
      targetRole: currentUser?.role ?? null,
      targetUsername: currentUser?.username ?? null,
    },
  }).catch((error: unknown) => {
    logger.error(
      { err: error, actorId: curatorSession.user.id },
      "Audit selesai Login As gagal disimpan",
    );
  });
  res.json(toAuthUser(curatorSession.user));
});

router.post("/auth/logout", async (req: Request, res: Response) => {
  const token = sessionTokenFromRequest(req);
  if (token) {
    const actor = await getSessionUser(token);
    await destroySession(token);
    if (actor) {
      await recordActivityAudit({
        actor,
        action: "auth.logout",
        targetType: "user",
        targetId: actor.id,
        meta: { role: actor.role },
      }).catch((error: unknown) => {
        logger.error(
          { err: error, actorId: actor.id },
          "Audit logout gagal disimpan",
        );
      });
    }
  }
  const curatorToken = cookieFromRequest(req, CURATOR_SESSION_COOKIE);
  if (curatorToken && curatorToken !== token) {
    await destroySession(curatorToken);
  }
  res.clearCookie(SESSION_COOKIE, SESSION_COOKIE_OPTS);
  res.clearCookie(CURATOR_SESSION_COOKIE, SESSION_COOKIE_OPTS);
  res.status(204).end();
});

router.get("/auth/me", requireAuth, async (req: Request, res: Response) => {
  const curatorSession = await getCuratorSessionUser(req);
  res.json({
    ...toAuthUser(req.user!),
    ...(curatorSession
      ? {
          impersonatedFrom: {
            id: curatorSession.user.id,
            username: curatorSession.user.username,
            role: curatorSession.user.role,
          },
        }
      : {}),
  });
});

// Keep the authenticated renderer proxy already present in the production release.
const documentRenderLimit = createRateLimit({ name: "document-render", windowMs: 60_000, max: 20 });
router.post("/documents/render", requireAuth, documentRenderLimit, async (req, res) => {
  const { format, html } = req.body ?? {};
  if (!["word", "pdf"].includes(format) || typeof html !== "string" || Buffer.byteLength(html) > 8 * 1024 * 1024) {
    res.status(400).json({ error: "Format atau ukuran dokumen tidak valid." });
    return;
  }
  try {
    const result = await fetch(documentRendererUrl(), {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body), signal: AbortSignal.timeout(60_000),
    });
    res.status(result.status).set("Cache-Control", "no-store")
      .set("Content-Type", result.headers.get("content-type") || "application/octet-stream")
      .send(Buffer.from(await result.arrayBuffer()));
  } catch {
    res.status(503).json({ error: process.env["NODE_ENV"] === "production"
      ? "Generator dokumen belum tersedia. Coba lagi sebentar."
      : "Generator dokumen lokal belum aktif. Jalankan MULAI-GENERATOR-DOKUMEN.bat lalu coba kembali." });
  }
});

export default router;
