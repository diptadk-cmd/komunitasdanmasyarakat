import { Router, type IRouter, type Request, type Response } from "express";
import { randomUUID } from "node:crypto";
import { db, usersTable, type User } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import { CreateMemberBody, UpdateMemberBody } from "@workspace/api-zod";
import { hashPassword, toAuthUser } from "../lib/auth";
import { paramId, requireAuth, requireRole } from "../middlewares/auth";
import { normalizeUniqueProfileEmail, UserEmailError } from "../lib/user-email";
import { memberProfileEditAccess, selfMemberProfilePatch } from "../lib/member-profile-policy";

const router: IRouter = Router();

// Peran anggota yang dikelola lewat endpoint ini.
const MEMBER_ROLES = ["pelatih", "seniman"];
// Peran yang boleh melihat SEMUA anggota (kurator perlu untuk Manajemen Data).
const OVERSEERS = ["kurator", "admin"];

router.use("/members", requireAuth);

function sanggarUsernameOf(u: User): string | null {
  const v = (u.profile as Record<string, unknown>)["sanggarUsername"];
  return typeof v === "string" && v.length > 0 ? v : null;
}

async function findSanggarByUsername(username: string): Promise<User | null> {
  const rows = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.username, username))
    .limit(1);
  const u = rows[0];
  return u && u.role === "sanggar" ? u : null;
}

// GET /members — sanggar: anggota miliknya; kurator/admin: semua anggota.
router.get(
  "/members",
  requireRole(["sanggar", ...OVERSEERS]),
  async (req: Request, res: Response) => {
    const me = req.user!;
    const rows = await db
      .select()
      .from(usersTable)
      .where(inArray(usersTable.role, MEMBER_ROLES));
    const list = OVERSEERS.includes(me.role)
      ? rows
      : rows.filter((r) => sanggarUsernameOf(r) === me.username);
    res.json(list.map(toAuthUser));
  },
);

// POST /members — sanggar membuat akun anggota untuk sanggarnya sendiri
// (Tambah Langsung). Kurator juga boleh (profile.sanggarUsername bebas).
router.post(
  "/members",
  requireRole(["sanggar", "kurator"]),
  async (req: Request, res: Response) => {
    const me = req.user!;
    const parsed = CreateMemberBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Permintaan tidak valid" });
      return;
    }
    const { username, password, role, profile } = parsed.data;
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
    if (me.role === "sanggar") {
      // Sanggar hanya boleh menambahkan anggota ke dirinya sendiri.
      memberProfile["sanggarUsername"] = me.username;
    } else {
      const target = memberProfile["sanggarUsername"];
      if (typeof target === "string" && target.length > 0) {
        const sanggar = await findSanggarByUsername(target);
        if (!sanggar) {
          res.status(400).json({ error: "Sanggar tujuan tidak ditemukan" });
          return;
        }
      }
    }
    const passwordHash = await hashPassword(password);
    const id = randomUUID();
    await db.insert(usersTable).values({
      id,
      username,
      passwordHash,
      role,
      status: "aktif",
      profile: memberProfile,
    });
    const inserted = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, id))
      .limit(1);
    res.status(201).json(toAuthUser(inserted[0]!));
  },
);

// PATCH /members/:id — ubah status keanggotaan pada profil
// (terima/tolak/berhentikan),
// mutasi (profile.sanggarUsername), promosi (role seniman<->pelatih).
// Pengelolaan: sanggar pemilik anggota atau kurator. Anggota boleh menyunting
// profil biasa miliknya; status/afiliasi/tarif/rapor tetap milik pengelola.
router.patch("/members/:id", async (req: Request, res: Response) => {
  const id = paramId(req);
  const me = req.user!;
  const parsed = UpdateMemberBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Permintaan tidak valid" });
    return;
  }
  const rows = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, id))
    .limit(1);
  const member = rows[0];
  if (!member || !MEMBER_ROLES.includes(member.role)) {
    res.status(404).json({ error: "Tidak ditemukan" });
    return;
  }
  // Anggota tanpa sanggar (mis. seed lama / pendaftar yang memilih sanggar ini
  // secara lokal) boleh "diklaim" sanggar HANYA jika patch menetapkan
  // sanggarUsername = sanggar pemanggil (mis. saat menerima permohonan).
  const requestedProfile = (parsed.data.profile ?? {}) as Record<string, unknown>;
  const access = memberProfileEditAccess(me, member, requestedProfile);
  if (!access) {
    res.status(403).json({ error: "Tidak punya akses" });
    return;
  }
  if (access === "self" && parsed.data.role && parsed.data.role !== member.role) {
    res.status(403).json({ error: "Perubahan peran anggota hanya dapat dilakukan pengelola." });
    return;
  }
  const patchProfile = access === "self" ? selfMemberProfilePatch(member.role, requestedProfile) : requestedProfile;
  const currentSanggar = sanggarUsernameOf(member);
  if (
    me.role === "sanggar" &&
    currentSanggar !== null &&
    patchProfile["sanggarUsername"] !== undefined &&
    patchProfile["sanggarUsername"] !== currentSanggar
  ) {
    res.status(403).json({
      error: "Mutasi harus diajukan dan disetujui Kurator; anggota belum dipindahkan.",
    });
    return;
  }
  // Validasi mutasi: sanggar tujuan harus ada.
  const targetSanggar = patchProfile["sanggarUsername"];
  if (targetSanggar !== undefined) {
    if (typeof targetSanggar !== "string" || targetSanggar.length === 0) {
      res.status(400).json({ error: "Sanggar tujuan tidak valid" });
      return;
    }
    const sanggar = await findSanggarByUsername(targetSanggar);
    if (!sanggar) {
      res.status(400).json({ error: "Sanggar tujuan tidak ditemukan" });
      return;
    }
  }
  const requestedSanggar = patchProfile["mutasiTujuanUsername"];
  if (requestedSanggar !== undefined) {
    if (typeof requestedSanggar !== "string" || requestedSanggar.length === 0) {
      res.status(400).json({ error: "Sanggar tujuan mutasi tidak valid" });
      return;
    }
    const sanggar = await findSanggarByUsername(requestedSanggar);
    if (!sanggar) {
      res.status(400).json({ error: "Sanggar tujuan mutasi tidak ditemukan" });
      return;
    }
  }
  const update: Partial<typeof usersTable.$inferInsert> = {};
  if (parsed.data.role && parsed.data.role !== member.role) {
    update.role = parsed.data.role;
  }
  if (Object.keys(patchProfile).length > 0) {
    // Merge patch di atas profil tersimpan (bukan replace) supaya field yang
    // tidak dikirim tidak hilang.
    try {
      update.profile = await normalizeUniqueProfileEmail(
        {
          ...(member.profile as Record<string, unknown>),
          ...patchProfile,
        },
        { excludeUserId: id },
      );
    } catch (error) {
      if (error instanceof UserEmailError) {
        res.status(error.status).json({ error: error.message });
        return;
      }
      throw error;
    }
  }
  const membershipStatus = patchProfile["status"];
  if (membershipStatus !== undefined) {
    if (
      typeof membershipStatus !== "string" ||
      !["pending", "aktif", "ditolak", "keluar"].includes(membershipStatus)
    ) {
      res.status(400).json({ error: "Status keanggotaan tidak valid" });
      return;
    }
    // Status ini sengaja tetap berada di profile.status. Akun hanya dapat
    // dinonaktifkan melalui blokir Kurator atau dihapus.
  }
  if (Object.keys(update).length > 0) {
    await db.update(usersTable).set(update).where(eq(usersTable.id, id));
  }
  const updated = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, id))
    .limit(1);
  res.json(toAuthUser(updated[0]!));
});

export default router;
