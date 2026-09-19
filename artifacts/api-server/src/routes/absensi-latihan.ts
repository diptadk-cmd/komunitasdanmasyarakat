import { Router } from "express";
import { and, desc, eq } from "drizzle-orm";
import { absensiLatihanTable, db } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";

const router = Router();

type AttendancePayload = {
  latihanId?: unknown;
  sanggarId?: unknown;
  metode?: unknown;
  lat?: unknown;
  lng?: unknown;
  catatan?: unknown;
};

function asText(value: unknown, max: number): string | null {
  return typeof value === "string" && value.trim().length > 0 && value.trim().length <= max
    ? value.trim()
    : null;
}

router.get("/absensi-latihan", requireAuth, async (req, res, next): Promise<void> => {
  try {
    const user = req.user!;
    const rows = await db
      .select()
      .from(absensiLatihanTable)
      .where(eq(absensiLatihanTable.userId, user.id))
      .orderBy(desc(absensiLatihanTable.createdAt));
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

router.post("/absensi-latihan", requireAuth, async (req, res, next): Promise<void> => {
  try {
    const user = req.user!;
    if (user.role !== "seniman" && user.role !== "pelatih") {
      res.status(403).json({ message: "Hanya seniman atau pelatih yang dapat mengisi absen latihan." });
      return;
    }

    const body = (req.body ?? {}) as AttendancePayload;
    const latihanId = asText(body.latihanId, 96);
    const sanggarId = asText(body.sanggarId, 96);
    if (!latihanId || !sanggarId) {
      res.status(400).json({ message: "latihanId dan sanggarId wajib diisi." });
      return;
    }

    const existing = await db
      .select({ id: absensiLatihanTable.id })
      .from(absensiLatihanTable)
      .where(and(
        eq(absensiLatihanTable.userId, user.id),
        eq(absensiLatihanTable.latihanId, latihanId),
      ))
      .limit(1);
    if (existing[0]) {
      res.status(409).json({ message: "Kehadiran untuk latihan ini sudah tercatat." });
      return;
    }

    const metode = body.metode === "gps" ? "gps" : "manual";
    const lat = typeof body.lat === "number" && Number.isFinite(body.lat) ? body.lat : undefined;
    const lng = typeof body.lng === "number" && Number.isFinite(body.lng) ? body.lng : undefined;
    const catatan = asText(body.catatan, 500) ?? undefined;
    const now = new Date();
    const id = crypto.randomUUID();
    const data = { role: user.role, metode, lat, lng, catatan, hadirAt: now.toISOString() };

    await db.insert(absensiLatihanTable).values({
      id,
      userId: user.id,
      sanggarId,
      latihanId,
      data,
      createdAt: now,
      updatedAt: now,
    });
    res.status(201).json({ id, userId: user.id, sanggarId, latihanId, data, createdAt: now });
  } catch (error) {
    next(error);
  }
});

export default router;
