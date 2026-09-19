import { Router, type IRouter, type Request, type Response } from "express";
import { db, settingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { PutSettingBody } from "@workspace/api-zod";
import { paramId, requireAuth, requireRole } from "../middlewares/auth";
import { sanitizeKurasiMatrixSetting } from "../lib/kurasi-validation";

const router: IRouter = Router();

// Key sensitif yang tidak boleh diekspos lewat GET /settings publik.
const SENSITIVE_KEYS = new Set<string>(["exportPassword"]);

function toIso(value: Date | string): string {
  return (value instanceof Date ? value : new Date(value)).toISOString();
}

// GET /settings — publik (dibutuhkan halaman login untuk branding/tema, dan
// semua peran untuk membaca singleton seperti kurasiMatrix). Key sensitif
// disaring agar tidak bocor.
router.get("/settings", async (_req: Request, res: Response) => {
  const rows = await db.select().from(settingsTable);
  res.json(
    rows
      .filter((r) => !SENSITIVE_KEYS.has(r.key))
      .map((r) => ({
        key: r.key,
        value: r.value,
        updatedAt: toIso(r.updatedAt),
      })),
  );
});

// PUT /settings/:key — hanya kurator yang boleh mengubah pengaturan global.
router.put(
  "/settings/:key",
  requireAuth,
  requireRole(["kurator"]),
  async (req: Request, res: Response) => {
    const key = paramId(req, "key");
    if (!key) {
      res.status(400).json({ error: "Key wajib diisi" });
      return;
    }
    const parsed = PutSettingBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Permintaan tidak valid" });
      return;
    }
    let value = parsed.data.value;
    if (key === "kurasiMatrix") {
      const sanitized = sanitizeKurasiMatrixSetting(value);
      if (!sanitized) {
        res.status(400).json({ error: "Matriks kurasi tidak valid" });
        return;
      }
      value = sanitized;
    }
    await db
      .insert(settingsTable)
      .values({ key, value })
      .onDuplicateKeyUpdate({ set: { value } });
    const rows = await db
      .select()
      .from(settingsTable)
      .where(eq(settingsTable.key, key))
      .limit(1);
    const row = rows[0]!;
    res.json({
      key: row.key,
      value: row.value,
      updatedAt: toIso(row.updatedAt),
    });
  },
);

export default router;
