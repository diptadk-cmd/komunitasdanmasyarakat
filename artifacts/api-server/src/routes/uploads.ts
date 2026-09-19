import {
  Router,
  type IRouter,
  type Request,
  type Response,
  type NextFunction,
  type ErrorRequestHandler,
} from "express";
import multer from "multer";
import { randomBytes, randomUUID } from "node:crypto";
import { extname, basename } from "node:path";
import { activityLogTable, db, kurasiSubmissionsTable, penugasanJuriTable, uploadsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { paramId, requireAuth } from "../middlewares/auth";
import { putObject, getObject, buildDownloadUrl } from "../lib/storage";
import { uploadMediaKind } from "../lib/creative-media";
import { activityAuditValues } from "../lib/activity-audit";

const router: IRouter = Router();

const MAX_BYTES = 60 * 1024 * 1024;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES },
});

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/avif",
  "audio/mpeg",
  "audio/mp4",
  "audio/wav",
  "audio/x-wav",
  "audio/ogg",
  "audio/aac",
  "audio/flac",
  "video/mp4",
  "video/webm",
  "video/ogg",
  "video/quicktime",
  "application/pdf",
]);

const uploadErrorHandler: ErrorRequestHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      res.status(413).json({ error: "Berkas terlalu besar (maks 60 MB)" });
      return;
    }
    res.status(400).json({ error: `Upload gagal: ${err.message}` });
    return;
  }
  next(err);
};

function referencesUpload(value: unknown, uploadId: string): boolean {
  if (typeof value === "string") return value.includes(`/uploads/${uploadId}/raw`);
  if (Array.isArray(value)) return value.some((item) => referencesUpload(item, uploadId));
  if (value && typeof value === "object") return Object.values(value).some((item) => referencesUpload(item, uploadId));
  return false;
}

async function canAccessUpload(
  requestUserId: string,
  requestUserRole: string,
  uploaderId: string,
  uploadId: string,
): Promise<boolean> {
  if (requestUserRole === "kurator" || requestUserRole === "admin") return true;
  if (requestUserId === uploaderId) return true;
  if (requestUserRole !== "juri") return false;
  const assignments = await db.select().from(penugasanJuriTable).where(eq(penugasanJuriTable.juriId, requestUserId));
  if (assignments.length === 0) return false;
  const submissions = await db.select().from(kurasiSubmissionsTable);
  const assignedSanggarIds = new Set(assignments.map((item) => item.sanggarId));
  return submissions.some((item) => assignedSanggarIds.has(item.sanggarId) && referencesUpload(item.data, uploadId));
}

router.post(
  "/uploads",
  requireAuth,
  (req: Request, res: Response, next: NextFunction) => {
    upload.single("file")(req, res, (err: unknown) => {
      if (err) {
        uploadErrorHandler(err, req, res, next);
        return;
      }
      next();
    });
  },
  async (req: Request, res: Response) => {
    const file = (req as Request & { file?: Express.Multer.File }).file;
    if (!file) {
      res.status(400).json({ error: "Berkas tidak ditemukan" });
      return;
    }
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      res.status(415).json({
        error:
          "Tipe berkas tidak didukung. Gunakan gambar, MP3/WAV/OGG, MP4/WebM/MOV, atau PDF.",
      });
      return;
    }
    const ext = extname(file.originalname || "").toLowerCase();
    const key = `${Date.now()}-${randomBytes(6).toString("hex")}${ext}`;
    await putObject(key, file.buffer, file.mimetype);
    const id = randomUUID();
    await db.transaction(async (tx) => {
      await tx.insert(uploadsTable).values({
        id,
        storageKey: key,
        contentType: file.mimetype,
        sizeBytes: file.size,
        originalName: file.originalname || null,
        uploaderId: req.user!.id,
      });
      await tx.insert(activityLogTable).values(
        activityAuditValues({
          actor: req.user!,
          action: "upload.create",
          targetType: "upload",
          targetId: id,
          // Nama asli dan isi berkas sengaja tidak dicatat.
          meta: { contentType: file.mimetype, sizeBytes: file.size },
        }),
      );
    });
    const inserted = await db
      .select()
      .from(uploadsTable)
      .where(eq(uploadsTable.id, id))
      .limit(1);
    const row = inserted[0]!;
    res.status(201).json({
      id: row.id,
      url: buildDownloadUrl(row.id),
      publicUrl: `/api/public/media/${row.id}`,
      contentType: row.contentType,
      mediaKind: uploadMediaKind(row.contentType),
      sizeBytes: row.sizeBytes,
      originalName: row.originalName,
      createdAt: row.createdAt.toISOString(),
    });
  },
);

router.get("/uploads/:id", requireAuth, async (req: Request, res: Response) => {
  const id = paramId(req);
  const rows = await db
    .select()
    .from(uploadsTable)
    .where(eq(uploadsTable.id, id))
    .limit(1);
  const row = rows[0];
  if (!row) {
    res.status(404).json({ error: "Tidak ditemukan" });
    return;
  }
  if (row.storageKey.startsWith("communication-") || !(await canAccessUpload(req.user!.id, req.user!.role, row.uploaderId ?? "", row.id))) {
    res.status(403).json({ error: "Tidak punya akses" });
    return;
  }
  res.json({
    id: row.id,
    url: buildDownloadUrl(row.id),
    publicUrl: `/api/public/media/${row.id}`,
    contentType: row.contentType,
    mediaKind: uploadMediaKind(row.contentType),
    sizeBytes: row.sizeBytes,
    originalName: row.originalName,
    createdAt: row.createdAt.toISOString(),
  });
});

router.get(
  "/uploads/:id/raw",
  requireAuth,
  async (req: Request, res: Response) => {
    const id = paramId(req);
    const rows = await db
      .select()
      .from(uploadsTable)
      .where(eq(uploadsTable.id, id))
      .limit(1);
    const row = rows[0];
    if (!row) {
      res.status(404).json({ error: "Tidak ditemukan" });
      return;
    }
    if (row.storageKey.startsWith("communication-") || !(await canAccessUpload(req.user!.id, req.user!.role, row.uploaderId ?? "", row.id))) {
      res.status(403).json({ error: "Tidak punya akses" });
      return;
    }
    const obj = await getObject(row.storageKey);
    if (!obj) {
      res.status(404).json({ error: "Berkas tidak ditemukan di storage" });
      return;
    }
    const safeContentType = ALLOWED_MIME_TYPES.has(row.contentType ?? "")
      ? row.contentType!
      : "application/octet-stream";
    const safeName = basename(row.originalName || row.id).replace(
      /[^\w.\-]/g,
      "_",
    );
    res.setHeader("Content-Type", safeContentType);
    res.setHeader("Content-Disposition", `inline; filename="${safeName}"`);
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    const range = req.headers.range;
    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      const start = match?.[1] ? Number(match[1]) : 0;
      const requestedEnd = match?.[2] ? Number(match[2]) : obj.sizeBytes - 1;
      const end = Math.min(requestedEnd, obj.sizeBytes - 1);
      if (!match || !Number.isInteger(start) || start < 0 || start > end) {
        res.status(416).setHeader("Content-Range", `bytes */${obj.sizeBytes}`);
        res.end();
        return;
      }
      const body = obj.body.subarray(start, end + 1);
      res.status(206);
      res.setHeader("Content-Range", `bytes ${start}-${end}/${obj.sizeBytes}`);
      res.setHeader("Content-Length", String(body.length));
      res.end(body);
      return;
    }
    res.setHeader("Content-Length", String(obj.sizeBytes));
    res.end(obj.body);
  },
);

export default router;
