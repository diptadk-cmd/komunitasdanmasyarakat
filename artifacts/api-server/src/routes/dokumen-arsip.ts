import { Router, type IRouter, type Request, type Response } from "express";
import { db, dokumenArsipTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { PutDokumenArsipBody } from "@workspace/api-zod";
import { paramId, requireAuth, requireRole } from "../middlewares/auth";

const router: IRouter = Router();

// Peran yang boleh melihat/mengelola SEMUA arsip (kurator perlu untuk
// impersonation Login As dan Manajemen Data).
const OVERSEERS = ["kurator", "admin"];

router.use("/dokumen-arsip", requireAuth, requireRole(["sanggar", ...OVERSEERS]));

// Bentuk respons API: snapshot entri dari kolom `data` + kunci kepemilikan.
function toApi(row: {
  id: string;
  sanggarUsername: string;
  data: Record<string, unknown>;
}): Record<string, unknown> {
  return { id: row.id, sanggarUsername: row.sanggarUsername, ...row.data };
}

// GET /dokumen-arsip — sanggar: arsip miliknya; kurator/admin: semua.
router.get("/dokumen-arsip", async (req: Request, res: Response) => {
  const me = req.user!;
  const rows = OVERSEERS.includes(me.role)
    ? await db.select().from(dokumenArsipTable)
    : await db
        .select()
        .from(dokumenArsipTable)
        .where(eq(dokumenArsipTable.sanggarUsername, me.username));
  res.json(rows.map(toApi));
});

async function sanggarExists(username: string): Promise<boolean> {
  const rows = await db
    .select({ id: usersTable.id, role: usersTable.role })
    .from(usersTable)
    .where(eq(usersTable.username, username))
    .limit(1);
  return !!rows[0] && rows[0].role === "sanggar";
}

// PUT /dokumen-arsip/:id — upsert entri (id dibuat klien). Sesi sanggar
// dipaksa memiliki entri atas namanya sendiri; kurator/admin boleh menulis
// untuk sanggar manapun (impersonation) via body.sanggarUsername.
router.put("/dokumen-arsip/:id", async (req: Request, res: Response) => {
  const id = paramId(req);
  const me = req.user!;
  if (!id || id.length > 36) {
    res.status(400).json({ error: "Id tidak valid" });
    return;
  }
  const parsed = PutDokumenArsipBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Permintaan tidak valid" });
    return;
  }
  const { sanggarUsername: bodyOwner, ...entry } = parsed.data;
  let owner: string;
  if (me.role === "sanggar") {
    owner = me.username;
  } else {
    if (typeof bodyOwner !== "string" || bodyOwner.length === 0) {
      res.status(400).json({ error: "sanggarUsername wajib diisi" });
      return;
    }
    if (!(await sanggarExists(bodyOwner))) {
      res.status(400).json({ error: "Sanggar tujuan tidak ditemukan" });
      return;
    }
    owner = bodyOwner;
  }
  const existingRows = await db
    .select()
    .from(dokumenArsipTable)
    .where(eq(dokumenArsipTable.id, id))
    .limit(1);
  const existing = existingRows[0];
  if (existing && existing.sanggarUsername !== owner && me.role === "sanggar") {
    res.status(403).json({ error: "Tidak punya akses" });
    return;
  }
  const data = entry as Record<string, unknown>;
  if (existing) {
    await db
      .update(dokumenArsipTable)
      .set({ data, sanggarUsername: owner })
      .where(eq(dokumenArsipTable.id, id));
  } else {
    await db.insert(dokumenArsipTable).values({ id, sanggarUsername: owner, data });
  }
  res.json(toApi({ id, sanggarUsername: owner, data }));
});

// DELETE /dokumen-arsip/:id — sanggar pemilik, atau kurator/admin.
router.delete("/dokumen-arsip/:id", async (req: Request, res: Response) => {
  const id = paramId(req);
  const me = req.user!;
  const rows = await db
    .select()
    .from(dokumenArsipTable)
    .where(eq(dokumenArsipTable.id, id))
    .limit(1);
  const row = rows[0];
  if (!row) {
    res.status(404).json({ error: "Tidak ditemukan" });
    return;
  }
  if (!OVERSEERS.includes(me.role) && row.sanggarUsername !== me.username) {
    res.status(403).json({ error: "Tidak punya akses" });
    return;
  }
  await db.delete(dokumenArsipTable).where(eq(dokumenArsipTable.id, id));
  res.status(204).end();
});

export default router;
