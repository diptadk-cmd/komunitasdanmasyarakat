import { Router } from "express";
import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import {
  activityLogTable,
  db,
  kurasiParticipantDispositionsTable,
  kurasiSubmissionsTable,
  penugasanJuriTable,
  settingsTable,
  uploadsTable,
  usersTable,
} from "@workspace/db";
import { requireAuth, requireRole } from "../middlewares/auth";
import {
  hasKurasiScoringActivity,
  isKurasiFinalizedForJuri,
  sanitizeKurasiMatrixSnapshot,
  validateAndAggregateKurasiScores,
} from "../lib/kurasi-validation";
import { activityAuditValues } from "../lib/activity-audit";
import {
  MAX_KURASI_PARTICIPANTS,
  MIN_KURASI_PARTICIPANTS,
  normalizeNik,
  parseKurasiParticipants,
  participantKey,
  privateUploadId,
  type KurasiParticipantPayload,
} from "../lib/kurasi-participants";

const router = Router();

type SubmissionBody = {
  tahap1?: unknown;
  tahap1Files?: unknown;
  tahap2VideoName?: unknown;
  tahap2VideoUrl?: unknown;
  pesertaSeni?: unknown;
  deklarasiAntiJoki?: unknown;
};

type AssignmentBody = {
  juriUsername?: unknown;
  sanggarUsername?: unknown;
  periode?: unknown;
};

function text(value: unknown, max: number): string | null {
  return typeof value === "string" &&
    value.trim().length > 0 &&
    value.trim().length <= max
    ? value.trim()
    : null;
}

function collectPrivateUploadIds(
  value: unknown,
  result = new Set<string>(),
): Set<string> {
  const id = privateUploadId(value);
  if (id) result.add(id);
  else if (Array.isArray(value))
    value.forEach((item) => collectPrivateUploadIds(item, result));
  else if (value && typeof value === "object")
    Object.values(value).forEach((item) =>
      collectPrivateUploadIds(item, result),
    );
  return result;
}

async function findUser(username: string, role?: string) {
  const rows = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.username, username))
    .limit(1);
  const row = rows[0];
  return row && (!role || row.role === role) ? row : null;
}

function isDuplicateDispositionError(error: unknown): boolean {
  return Boolean(
    error &&
    typeof error === "object" &&
    "code" in error &&
    (error as { code?: unknown }).code === "ER_DUP_ENTRY",
  );
}

function nikHash(nik: string): string {
  return createHash("sha256").update(`jak-sanggar-kurasi:${nik}`).digest("hex");
}

function rawParticipantKey(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const participant = value as Record<string, unknown>;
  const username = text(participant["username"], 100);
  const userId = text(participant["userId"], 100);
  return (username ?? userId)?.toLowerCase() ?? null;
}

async function currentKurasiMatrixSnapshot() {
  const rows = await db
    .select({ value: settingsTable.value })
    .from(settingsTable)
    .where(eq(settingsTable.key, "kurasiMatrix"))
    .limit(1);
  return sanitizeKurasiMatrixSnapshot(rows[0]?.value);
}

function submissionResponse(
  row: typeof kurasiSubmissionsTable.$inferSelect,
  sanggarUsername: string,
) {
  return {
    id: row.id,
    sanggarUsername,
    ...(row.data as Record<string, unknown>),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** Sanggar melihat submission miliknya; Kurator semua; Juri hanya yang ditugaskan. */
router.get(
  "/kurasi/submissions",
  requireAuth,
  async (req, res, next): Promise<void> => {
    try {
      const me = req.user!;
      let rows: Array<typeof kurasiSubmissionsTable.$inferSelect> = [];

      if (me.role === "sanggar") {
        rows = await db
          .select()
          .from(kurasiSubmissionsTable)
          .where(eq(kurasiSubmissionsTable.sanggarId, me.id));
      } else if (me.role === "kurator" || me.role === "admin") {
        rows = await db.select().from(kurasiSubmissionsTable);
      } else if (me.role === "juri") {
        const assignments = await db
          .select()
          .from(penugasanJuriTable)
          .where(eq(penugasanJuriTable.juriId, me.id));
        const ids = new Set(assignments.map((item) => item.sanggarId));
        const all = await db.select().from(kurasiSubmissionsTable);
        rows = all.filter((item) => ids.has(item.sanggarId));
      } else {
        res.status(403).json({ error: "Akses kurasi ditolak." });
        return;
      }

      const sanggarIds = [...new Set(rows.map((item) => item.sanggarId))];
      const allUsers = sanggarIds.length
        ? await db.select().from(usersTable)
        : [];
      const names = new Map(allUsers.map((item) => [item.id, item.username]));
      res.json(
        rows.map((item) =>
          submissionResponse(item, names.get(item.sanggarId) ?? item.sanggarId),
        ),
      );
    } catch (error) {
      next(error);
    }
  },
);

/** Hanya Sanggar dapat membuat/memperbarui submission miliknya. */
router.put(
  "/kurasi/submission",
  requireAuth,
  requireRole(["sanggar"]),
  async (req, res, next): Promise<void> => {
    try {
      const me = req.user!;
      const body = (req.body ?? {}) as SubmissionBody;
      if (
        !body.tahap1 ||
        typeof body.tahap1 !== "object" ||
        Array.isArray(body.tahap1)
      ) {
        res.status(400).json({ error: "Data Tahap 1 tidak valid." });
        return;
      }
      const requestedParticipants = parseKurasiParticipants(body.pesertaSeni);
      if (!requestedParticipants) {
        res.status(400).json({
          error: `Pilih ${MIN_KURASI_PARTICIPANTS}–${MAX_KURASI_PARTICIPANTS} peserta unik dan lengkapi NIK, KTP, serta selfie memegang KTP.`,
        });
        return;
      }
      if (body.deklarasiAntiJoki !== true) {
        res.status(400).json({
          error: "Pernyataan anti-joki wajib disetujui oleh Sanggar.",
        });
        return;
      }

      const allUsers = await db.select().from(usersTable);
      const canonicalParticipants: Array<{
        payload: KurasiParticipantPayload;
        user: (typeof allUsers)[number];
      }> = [];
      for (const payload of requestedParticipants) {
        const key = participantKey(payload);
        const participant = allUsers.find(
          (candidate) =>
            candidate.role === "seniman" &&
            (candidate.id === payload.userId ||
              candidate.username.toLowerCase() === key),
        );
        const profile = participant?.profile as
          | Record<string, unknown>
          | undefined;
        if (
          !participant ||
          participant.status === "diblokir" ||
          profile?.["status"] !== "aktif" ||
          String(profile?.["sanggarUsername"] ?? "").toLowerCase() !==
            me.username.toLowerCase()
        ) {
          res.status(403).json({
            error: `${payload.nama} bukan Seniman aktif milik Sanggar ini.`,
          });
          return;
        }
        canonicalParticipants.push({ payload, user: participant });
      }

      const allSubmissions = await db.select().from(kurasiSubmissionsTable);
      const selectedKeys = new Set(
        canonicalParticipants.flatMap(({ user }) => [
          user.username.toLowerCase(),
          user.id.toLowerCase(),
        ]),
      );
      const selectedNiks = new Set(
        canonicalParticipants.map(({ payload }) => payload.nik),
      );
      for (const other of allSubmissions) {
        if (other.sanggarId === me.id) continue;
        const data = other.data as Record<string, unknown>;
        const participants = Array.isArray(data["pesertaSeni"])
          ? data["pesertaSeni"]
          : [];
        if (
          participants.some((participant) => {
            const key = rawParticipantKey(participant);
            const nik =
              participant && typeof participant === "object"
                ? normalizeNik((participant as Record<string, unknown>)["nik"])
                : null;
            return Boolean(
              (key && selectedKeys.has(key)) || (nik && selectedNiks.has(nik)),
            );
          })
        ) {
          res.status(409).json({
            error:
              "Salah satu peserta sudah didisposisikan oleh Sanggar lain. Hubungi Kurator bila data keanggotaan perlu diperbaiki.",
          });
          return;
        }
      }
      const videoUrl = privateUploadId(body.tahap2VideoUrl);
      if (!videoUrl || !text(body.tahap2VideoName, 255)) {
        res.status(400).json({ error: "Video unggulan wajib diunggah." });
        return;
      }
      const uploadIds = [...collectPrivateUploadIds(body)];
      const uploads = uploadIds.length
        ? await db.select().from(uploadsTable)
        : [];
      if (
        uploads.length !== uploadIds.length ||
        uploads.some((upload) => upload.uploaderId !== me.id)
      ) {
        res
          .status(403)
          .json({ error: "Berkas kurasi bukan milik akun Sanggar aktif." });
        return;
      }
      const identityUploadIds = new Set(
        requestedParticipants.flatMap((participant) =>
          [participant.ktpUrl, participant.selfieUrl]
            .map(privateUploadId)
            .filter((id): id is string => Boolean(id)),
        ),
      );
      if (
        uploads.some(
          (upload) =>
            identityUploadIds.has(upload.id) &&
            (!upload.contentType.startsWith("image/") ||
              upload.sizeBytes > 1_000_000),
        )
      ) {
        res.status(400).json({
          error:
            "Foto KTP dan selfie memegang KTP harus berupa gambar maksimal 1 MB.",
        });
        return;
      }
      const videoUpload = uploads.find((upload) => upload.id === videoUrl);
      if (
        !videoUpload?.contentType.startsWith("video/") ||
        videoUpload.sizeBytes > 60 * 1024 * 1024
      ) {
        res
          .status(400)
          .json({ error: "Video harus berformat video dan maksimal 60 MB." });
        return;
      }
      const now = new Date();
      const current = await db
        .select()
        .from(kurasiSubmissionsTable)
        .where(eq(kurasiSubmissionsTable.sanggarId, me.id))
        .limit(1);
      const previous = (current[0]?.data ?? {}) as Record<string, unknown>;
      const previousParticipants = Array.isArray(previous["pesertaSeni"])
        ? previous["pesertaSeni"]
        : [];
      const previousSnapshot = sanitizeKurasiMatrixSnapshot(
        previous.matrixSnapshot,
      );
      const latestSnapshot = await currentKurasiMatrixSnapshot();
      const matrixSnapshot = hasKurasiScoringActivity(previous)
        ? (previousSnapshot ?? latestSnapshot)
        : (latestSnapshot ?? previousSnapshot);
      if (!matrixSnapshot) {
        res.status(409).json({
          error: "Matriks kurasi belum tersedia. Hubungi Kurator.",
        });
        return;
      }
      const canonicalParticipantData = canonicalParticipants.map(
        ({ payload, user }) => {
          const profile = user.profile as Record<string, unknown>;
          const previousParticipant = previousParticipants.find(
            (item) => rawParticipantKey(item) === user.username.toLowerCase(),
          ) as Record<string, unknown> | undefined;
          return {
            ...payload,
            userId: user.username,
            username: user.username,
            nama:
              typeof profile["nama"] === "string"
                ? profile["nama"]
                : payload.nama,
            jenisKesenian:
              typeof profile["jenisKesenian"] === "string"
                ? profile["jenisKesenian"]
                : payload.jenisKesenian,
            nik: normalizeNik(payload.nik)!,
            disposisiAt:
              typeof previousParticipant?.["disposisiAt"] === "number"
                ? previousParticipant["disposisiAt"]
                : now.getTime(),
            disposisiOleh: me.username,
          };
        },
      );
      const data = {
        ...previous,
        tahap1: body.tahap1 ?? previous.tahap1 ?? {},
        tahap1Files: body.tahap1Files ?? previous.tahap1Files ?? {},
        tahap2VideoName: body.tahap2VideoName ?? previous.tahap2VideoName,
        tahap2VideoUrl: body.tahap2VideoUrl ?? previous.tahap2VideoUrl,
        pesertaSeni: canonicalParticipantData,
        deklarasiAntiJokiAt:
          typeof previous["deklarasiAntiJokiAt"] === "number"
            ? previous["deklarasiAntiJokiAt"]
            : now.getTime(),
        deklarasiAntiJokiOleh: me.username,
        scores: previous.scores ?? {},
        requirementScores: previous.requirementScores ?? {},
        finalized: previous.finalized ?? {},
        matrixSnapshot,
        sanggarUsername: me.username,
      };

      const id = current[0]?.id ?? crypto.randomUUID();
      try {
        await db.transaction(async (tx) => {
          if (current[0]) {
            await tx
              .update(kurasiSubmissionsTable)
              .set({ data, updatedAt: now })
              .where(eq(kurasiSubmissionsTable.id, id));
          } else {
            await tx.insert(kurasiSubmissionsTable).values({
              id,
              sanggarId: me.id,
              data,
              createdAt: now,
              updatedAt: now,
            });
          }
          await tx
            .delete(kurasiParticipantDispositionsTable)
            .where(eq(kurasiParticipantDispositionsTable.submissionId, id));
          await tx.insert(kurasiParticipantDispositionsTable).values(
            canonicalParticipants.map(({ payload, user }) => ({
              id: crypto.randomUUID(),
              submissionId: id,
              sanggarId: me.id,
              participantUserId: user.id,
              participantUsername: user.username,
              nikHash: nikHash(payload.nik),
              createdAt: now,
              updatedAt: now,
            })),
          );
          await tx.insert(activityLogTable).values(
            activityAuditValues({
              actor: me,
              action: "kurasi.disposisi-peserta",
              targetType: "kurasi-submission",
              targetId: id,
              meta: {
                participantCount: canonicalParticipants.length,
                participantUsernames: canonicalParticipants.map(
                  ({ user }) => user.username,
                ),
                antiJokiDeclared: true,
              },
              at: now,
            }),
          );
        });
      } catch (error) {
        if (isDuplicateDispositionError(error)) {
          res.status(409).json({
            error:
              "Akun atau NIK peserta sudah dikunci pada disposisi Sanggar lain. Hubungi Kurator untuk pemeriksaan anti-joki.",
          });
          return;
        }
        throw error;
      }
      const row = (
        await db
          .select()
          .from(kurasiSubmissionsTable)
          .where(eq(kurasiSubmissionsTable.id, id))
          .limit(1)
      )[0]!;
      res.json(submissionResponse(row, me.username));
    } catch (error) {
      next(error);
    }
  },
);

/** Kurator membuat penugasan yang nantinya dibaca akun Juri dan Sanggar. */
router.get(
  "/kurasi/assignments",
  requireAuth,
  async (req, res, next): Promise<void> => {
    try {
      const me = req.user!;
      let rows: Array<typeof penugasanJuriTable.$inferSelect>;
      if (me.role === "juri") {
        rows = await db
          .select()
          .from(penugasanJuriTable)
          .where(eq(penugasanJuriTable.juriId, me.id));
      } else if (me.role === "sanggar") {
        rows = await db
          .select()
          .from(penugasanJuriTable)
          .where(eq(penugasanJuriTable.sanggarId, me.id));
      } else if (me.role === "kurator" || me.role === "admin") {
        rows = await db.select().from(penugasanJuriTable);
      } else {
        res.status(403).json({ error: "Akses kurasi ditolak." });
        return;
      }

      const users = await db.select().from(usersTable);
      const usernames = new Map(users.map((item) => [item.id, item.username]));
      res.json(
        rows.map((item) => ({
          id: item.id,
          juriUsername: usernames.get(item.juriId) ?? item.juriId,
          sanggarUsername: usernames.get(item.sanggarId) ?? item.sanggarId,
          periode: item.periode ?? "Kurasi",
          createdAt: item.createdAt,
        })),
      );
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  "/kurasi/assignments",
  requireAuth,
  requireRole(["kurator"]),
  async (req, res, next): Promise<void> => {
    try {
      const body = (req.body ?? {}) as AssignmentBody;
      const juriUsername = text(body.juriUsername, 100);
      const sanggarUsername = text(body.sanggarUsername, 100);
      const periode = text(body.periode, 100) ?? "Kurasi";
      if (!juriUsername || !sanggarUsername) {
        res.status(400).json({ error: "Juri dan sanggar wajib dipilih." });
        return;
      }
      const [juri, sanggar] = await Promise.all([
        findUser(juriUsername, "juri"),
        findUser(sanggarUsername, "sanggar"),
      ]);
      if (!juri || !sanggar) {
        res
          .status(400)
          .json({ error: "Akun Juri atau Sanggar tidak ditemukan." });
        return;
      }
      const duplicate = await db
        .select({ id: penugasanJuriTable.id })
        .from(penugasanJuriTable)
        .where(
          and(
            eq(penugasanJuriTable.juriId, juri.id),
            eq(penugasanJuriTable.sanggarId, sanggar.id),
          ),
        )
        .limit(1);
      if (duplicate[0]) {
        res
          .status(409)
          .json({ error: "Juri ini sudah ditugaskan untuk sanggar tersebut." });
        return;
      }
      const now = new Date();
      const id = crypto.randomUUID();
      await db.insert(penugasanJuriTable).values({
        id,
        juriId: juri.id,
        sanggarId: sanggar.id,
        periode,
        data: { juriUsername, sanggarUsername },
        createdAt: now,
        updatedAt: now,
      });
      res
        .status(201)
        .json({ id, juriUsername, sanggarUsername, periode, createdAt: now });
    } catch (error) {
      next(error);
    }
  },
);

/** Juri mengirim draft/final score hanya untuk Sanggar yang ditugaskan. */
router.patch(
  "/kurasi/submission/scores",
  requireAuth,
  requireRole(["juri"]),
  async (req, res, next): Promise<void> => {
    try {
      const me = req.user!;
      const sanggarUsername = text(req.body?.sanggarUsername, 100);
      const scores = req.body?.scores;
      const requirementScores = req.body?.requirementScores ?? {};
      const finalize = req.body?.finalize === true;
      if (
        !sanggarUsername ||
        !scores ||
        typeof scores !== "object" ||
        Array.isArray(scores) ||
        !requirementScores ||
        typeof requirementScores !== "object" ||
        Array.isArray(requirementScores)
      ) {
        res.status(400).json({ error: "Data nilai tidak valid." });
        return;
      }
      const sanggar = await findUser(sanggarUsername, "sanggar");
      if (!sanggar) {
        res.status(404).json({ error: "Sanggar tidak ditemukan." });
        return;
      }
      const assignment = await db
        .select({ id: penugasanJuriTable.id })
        .from(penugasanJuriTable)
        .where(
          and(
            eq(penugasanJuriTable.juriId, me.id),
            eq(penugasanJuriTable.sanggarId, sanggar.id),
          ),
        )
        .limit(1);
      if (!assignment[0]) {
        res
          .status(403)
          .json({ error: "Anda tidak ditugaskan untuk Sanggar ini." });
        return;
      }
      const rows = await db
        .select()
        .from(kurasiSubmissionsTable)
        .where(eq(kurasiSubmissionsTable.sanggarId, sanggar.id))
        .limit(1);
      if (!rows[0]) {
        res
          .status(409)
          .json({ error: "Sanggar belum mengirim berkas kurasi." });
        return;
      }
      const row = rows[0];
      const data = (row.data ?? {}) as Record<string, any>;
      if (isKurasiFinalizedForJuri(data.finalized, me.username)) {
        res.status(409).json({ error: "Nilai final sudah dikunci." });
        return;
      }
      const previousSnapshot = sanitizeKurasiMatrixSnapshot(
        data.matrixSnapshot,
      );
      const latestSnapshot = await currentKurasiMatrixSnapshot();
      const matrixSnapshot = hasKurasiScoringActivity(data)
        ? (previousSnapshot ?? latestSnapshot)
        : (latestSnapshot ?? previousSnapshot);
      if (!matrixSnapshot) {
        res.status(409).json({
          error: "Matriks kurasi belum tersedia. Hubungi Kurator.",
        });
        return;
      }
      const result = validateAndAggregateKurasiScores({
        scores,
        requirementScores,
        matrix: matrixSnapshot,
        finalize,
      });
      if (!result.ok) {
        res.status(400).json({ error: result.error });
        return;
      }
      const finalized =
        data.finalized &&
        typeof data.finalized === "object" &&
        !Array.isArray(data.finalized)
          ? { ...data.finalized }
          : {};
      const existingScores =
        data.scores &&
        typeof data.scores === "object" &&
        !Array.isArray(data.scores)
          ? data.scores
          : {};
      const existingRequirementScores =
        data.requirementScores &&
        typeof data.requirementScores === "object" &&
        !Array.isArray(data.requirementScores)
          ? data.requirementScores
          : {};
      const next = {
        ...data,
        scores: { ...existingScores, [me.username]: result.scores },
        requirementScores: {
          ...existingRequirementScores,
          [me.username]: result.requirementScores,
        },
        finalized: finalize
          ? { ...finalized, [me.username]: Date.now() }
          : finalized,
        matrixSnapshot,
      };
      await db
        .update(kurasiSubmissionsTable)
        .set({ data: next, updatedAt: new Date() })
        .where(eq(kurasiSubmissionsTable.id, row.id));
      res.json(submissionResponse({ ...row, data: next }, sanggar.username));
    } catch (error) {
      next(error);
    }
  },
);

export default router;
