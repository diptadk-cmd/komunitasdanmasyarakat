import { Router, type Request, type Response, type NextFunction, type RequestHandler } from "express";
import multer from "multer";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, uploadsTable } from "@workspace/db";
import { requireAuth, paramId } from "../middlewares/auth";
import { getObject, putObject } from "../lib/storage";
import { CommunicationError, CommunicationService, MAX_AUDIO_BYTES, rtcConfiguration, validateAudio } from "../lib/communications";
import { communicationsRepository, pruneExpiredCommunicationState } from "../lib/communications-repository";

const service = new CommunicationService(communicationsRepository);
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_AUDIO_BYTES, files: 1, fields: 2, fieldSize: 128 } });
type Work = (req: Request, res: Response) => Promise<unknown>;
const endpoint = (work: Work): RequestHandler => (req, res, next) => { void work(req, res).catch(next); };

export function createCommunicationsRouter(communication = service, authenticate: RequestHandler = requireAuth) {
  const router = Router();
  router.use("/communications", authenticate, (_req, res, next) => { res.setHeader("Cache-Control", "private, no-store"); next(); });
  const get = (path: string, work: Work) => router.get(`/communications${path}`, endpoint(work));
  const post = (path: string, work: Work) => router.post(`/communications${path}`, endpoint(work));
  get("/contacts", async (req, res) => { res.json(await communication.contacts(req.user!.id)); });
  post("/presence", async (req, res) => { res.json(await communication.presence(req.user!.id)); void pruneExpiredCommunicationState(); });
  get("/threads", async (req, res) => { res.json(await communication.threads(req.user!.id, req.query.kind ?? "chat")); });
  get("/messages", async (req, res) => { res.json(await communication.messages(req.user!.id, req.query)); });
  get("/mail", async (req, res) => { res.json(await communication.mail(req.user!.id, req.query)); });
  post("/messages", async (req, res) => { res.status(201).json(await communication.send(req.user!.id, req.body)); });
  post("/read", async (req, res) => { res.json(await communication.read(req.user!.id, req.body)); });
  get("/rtc-config", async (req, res) => { await communication.actor(req.user!.id); res.json(rtcConfiguration(process.env["COMMUNICATIONS_ICE_SERVERS_JSON"], { turnUrls: process.env["COMMUNICATIONS_TURN_URLS"], turnSecret: process.env["COMMUNICATIONS_TURN_SECRET"], userId: req.user!.id })); });
  get("/calls", async (req, res) => { res.json(await communication.calls(req.user!.id)); });
  post("/calls", async (req, res) => { res.status(201).json(await communication.startCall(req.user!.id, req.body)); });
  router.patch("/communications/calls/:id", endpoint(async (req, res) => { res.json(await communication.updateCall(req.user!.id, paramId(req), req.body)); }));
  get("/calls/:id/signals", async (req, res) => { res.json(await communication.signals(req.user!.id, paramId(req), req.query.after)); });
  post("/calls/:id/signals", async (req, res) => { res.status(201).json(await communication.signal(req.user!.id, paramId(req), req.body)); });
  router.post("/communications/attachments", upload.single("file"), endpoint(async (req, res) => {
    await communication.prepareAttachment(req.user!.id); const file = req.file; if (!file) throw new CommunicationError(400, "Rekaman suara wajib diunggah.");
    const checked = validateAudio(file.mimetype, file.buffer, req.body?.durationMs);
    const id = randomUUID(); const storageKey = `communication-${id}`;
    await putObject(storageKey, file.buffer, checked.contentType);
    await db.insert(uploadsTable).values({ id, storageKey, contentType: checked.contentType, sizeBytes: file.size, originalName: "pesan-suara", uploaderId: req.user!.id });
    const result = await communication.registerAttachment(req.user!.id, { id, url: `/api/communications/attachments/${id}/raw`, contentType: checked.contentType, sizeBytes: file.size, durationMs: checked.durationMs });
    res.status(201).json(result);
  }));
  get("/attachments/:id/raw", async (req, res) => {
    const id = paramId(req); const attachment = await communication.authorizeAttachment(req.user!.id, id);
    const row = (await db.select().from(uploadsTable).where(eq(uploadsTable.id, id)).limit(1))[0]; if (!row) throw new CommunicationError(404, "Rekaman tidak ditemukan.");
    const stored = await getObject(row.storageKey); if (!stored) throw new CommunicationError(404, "Rekaman tidak ditemukan di penyimpanan.");
    res.setHeader("Content-Type", attachment.contentType); res.setHeader("X-Content-Type-Options", "nosniff"); res.setHeader("Content-Disposition", 'inline; filename="pesan-suara"'); res.setHeader("Accept-Ranges", "bytes");
    if (req.headers.range) {
      const match = /^bytes=(\d+)-(\d*)$/.exec(req.headers.range); const start = Number(match?.[1]); const end = Math.min(match?.[2] ? Number(match[2]) : stored.sizeBytes - 1, stored.sizeBytes - 1);
      if (!match || !Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start || start >= stored.sizeBytes) { res.status(416).setHeader("Content-Range", `bytes */${stored.sizeBytes}`); res.end(); return; }
      const chunk = stored.body.subarray(start, end + 1); res.status(206); res.setHeader("Content-Range", `bytes ${start}-${end}/${stored.sizeBytes}`); res.setHeader("Content-Length", String(chunk.length)); res.end(chunk); return;
    }
    res.setHeader("Content-Length", String(stored.sizeBytes)); res.end(stored.body);
  });
  router.use((error: unknown, _req: Request, res: Response, next: NextFunction) => {
    if (error instanceof CommunicationError) { res.status(error.status).json({ error: error.message }); return; }
    if (error instanceof multer.MulterError) { res.status(error.code === "LIMIT_FILE_SIZE" ? 413 : 400).json({ error: "Rekaman maksimal 8 MB; unggah satu berkas audio." }); return; }
    next(error);
  });
  return router;
}
export default createCommunicationsRouter();
