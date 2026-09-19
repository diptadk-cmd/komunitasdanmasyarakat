import { Router, type IRouter, type Request, type Response } from "express";
import { randomUUID } from "node:crypto";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { CreateUserBody, UpdateUserBody } from "@workspace/api-zod";
import {
  destroyAllUserSessions,
  hashPassword,
  toAuthUser,
  toDirectoryAuthUser,
} from "../lib/auth";
import { paramId, requireAuth, requireRole } from "../middlewares/auth";
import { normalizeUniqueProfileEmail, UserEmailError } from "../lib/user-email";
import { normalizeAccountStatus } from "../lib/account-status";

const router: IRouter = Router();
// `ADMINS` boleh melihat daftar user (admin perlu untuk moderasi konten).
const ADMINS = ["kurator", "admin"];
// Hanya kurator yang boleh mengelola user lain (create / delete / update profil orang lain).
const KURATORS = ["kurator"];

router.use("/users", requireAuth);

router.get(
  "/users",
  requireRole(ADMINS),
  async (_req: Request, res: Response) => {
    res.set("Cache-Control", "private, no-store, max-age=0");
    res.set("Pragma", "no-cache");
    res.set("Expires", "0");
    const rows = await db.select().from(usersTable);
    res.json(rows.map(toDirectoryAuthUser));
  },
);

router.post(
  "/users",
  requireRole(KURATORS),
  async (req: Request, res: Response) => {
    const parsed = CreateUserBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Permintaan tidak valid" });
      return;
    }
    const { username, password, role, status, profile } = parsed.data;
    const existing = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.username, username))
      .limit(1);
    if (existing[0]) {
      res.status(409).json({ error: "Username sudah dipakai" });
      return;
    }
    let normalizedProfile: Record<string, unknown>;
    try {
      normalizedProfile = await normalizeUniqueProfileEmail(profile);
    } catch (error) {
      if (error instanceof UserEmailError) {
        res.status(error.status).json({ error: error.message });
        return;
      }
      throw error;
    }
    const passwordHash = await hashPassword(password);
    const id = randomUUID();
    await db.insert(usersTable).values({
      id,
      username,
      passwordHash,
      role,
      status: normalizeAccountStatus(status),
      profile: normalizedProfile,
    });
    const inserted = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, id))
      .limit(1);
    res.status(201).json(toAuthUser(inserted[0]!));
  },
);

router.get("/users/:id", async (req: Request, res: Response) => {
  const id = paramId(req);
  const me = req.user!;
  // Self atau admin/kurator dapat melihat detail.
  if (!ADMINS.includes(me.role) && me.id !== id) {
    res.status(403).json({ error: "Tidak punya akses" });
    return;
  }
  const rows = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, id))
    .limit(1);
  const user = rows[0];
  if (!user) {
    res.status(404).json({ error: "Tidak ditemukan" });
    return;
  }
  res.json(toAuthUser(user));
});

router.patch("/users/:id", async (req: Request, res: Response) => {
  const id = paramId(req);
  const me = req.user!;
  // Self boleh edit profil sendiri (ganti sandi/profile). Mengubah user lain hanya kurator.
  const isSelf = me.id === id;
  const isKurator = me.role === "kurator";
  if (!isSelf && !isKurator) {
    res.status(403).json({ error: "Tidak punya akses" });
    return;
  }
  const parsed = UpdateUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Permintaan tidak valid" });
    return;
  }
  const { password, status, profile } = parsed.data;
  const update: Partial<typeof usersTable.$inferInsert> = {};
  if (typeof password === "string") {
    update.passwordHash = await hashPassword(password);
  }
  // Status hanya boleh diubah kurator (mencegah self-aktivasi atau aksi admin).
  if (typeof status === "string" && isKurator) {
    update.status = normalizeAccountStatus(status);
  }
  if (profile && typeof profile === "object") {
    try {
      const currentRows = await db
        .select({ profile: usersTable.profile, role: usersTable.role })
        .from(usersTable)
        .where(eq(usersTable.id, id))
        .limit(1);
      if (!currentRows[0]) {
        res.status(404).json({ error: "Tidak ditemukan" });
        return;
      }
      const safeProfile = { ...profile } as Record<string, unknown>;
      if (isSelf) {
        for (const key of [
          "statusModerasiAkun",
          "kategoriBlokirAkun",
          "alasanBlokirAkun",
          "diblokirAt",
          "diblokirOleh",
        ]) {
          delete safeProfile[key];
        }
      }
      if (isSelf && currentRows[0].role === "mitra_pengrajin") {
        const requestedStatus = safeProfile["statusVerifikasiTokoOffline"];
        if (
          requestedStatus !== undefined &&
          requestedStatus !== "belum_lengkap" &&
          requestedStatus !== "menunggu_verifikasi"
        ) {
          delete safeProfile["statusVerifikasiTokoOffline"];
        }
        // Pengajuan ulang boleh membersihkan hasil lama, tetapi tidak boleh
        // mengisi identitas/tanggal pemeriksa sendiri.
        if (
          requestedStatus === "belum_lengkap" ||
          requestedStatus === "menunggu_verifikasi"
        ) {
          safeProfile["catatanVerifikasiTokoOffline"] = "";
          safeProfile["diverifikasiTokoOfflineAt"] = 0;
          safeProfile["diverifikasiTokoOfflineOleh"] = "";
        } else {
          delete safeProfile["catatanVerifikasiTokoOffline"];
          delete safeProfile["diverifikasiTokoOfflineAt"];
          delete safeProfile["diverifikasiTokoOfflineOleh"];
        }
        if (currentRows[0].profile["tanggalPermohonanMitra"] === undefined) {
          safeProfile["tanggalPermohonanMitra"] = new Date()
            .toISOString()
            .slice(0, 10);
        } else {
          delete safeProfile["tanggalPermohonanMitra"];
        }
      }
      // PATCH profil bersifat merge. Modul seperti logo/stempel, paket Mitra,
      // dan dokumen legal dapat disimpan terpisah tanpa menghapus field lain.
      update.profile = await normalizeUniqueProfileEmail(
        { ...currentRows[0].profile, ...safeProfile },
        {
          excludeUserId: id,
        },
      );
    } catch (error) {
      if (error instanceof UserEmailError) {
        res.status(error.status).json({ error: error.message });
        return;
      }
      throw error;
    }
  }
  if (Object.keys(update).length === 0) {
    const rows = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, id))
      .limit(1);
    const user = rows[0];
    if (!user) {
      res.status(404).json({ error: "Tidak ditemukan" });
      return;
    }
    res.json(toAuthUser(user));
    return;
  }
  await db.update(usersTable).set(update).where(eq(usersTable.id, id));
  // Cabut semua sesi aktif bila sandi atau status berubah. Dengan status akun
  // dua-keadaan, perubahan status berarti blokir atau buka blokir.
  if (update.passwordHash !== undefined || update.status !== undefined) {
    await destroyAllUserSessions(id);
  }
  const updated = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, id))
    .limit(1);
  if (!updated[0]) {
    res.status(404).json({ error: "Tidak ditemukan" });
    return;
  }
  res.json(toAuthUser(updated[0]));
});

router.delete(
  "/users/:id",
  requireRole(KURATORS),
  async (req: Request, res: Response) => {
    const id = paramId(req);
    if (id === req.user!.id) {
      res.status(400).json({ error: "Tidak bisa menghapus akun sendiri" });
      return;
    }
    const existing = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.id, id))
      .limit(1);
    if (!existing[0]) {
      res.status(404).json({ error: "Tidak ditemukan" });
      return;
    }
    await db.delete(usersTable).where(eq(usersTable.id, id));
    res.status(204).end();
  },
);

export default router;
