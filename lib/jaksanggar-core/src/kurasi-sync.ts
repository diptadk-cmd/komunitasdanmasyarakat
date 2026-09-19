import { isStoreDemoMode, load, save, uid } from "./store";
import {
  kurasiApi,
  type ApiKurasiAssignment,
  type ApiKurasiSubmission,
} from "./api";
import { migrateMatrix } from "./kurasi";
import type { KurasiSubmission, PenugasanJuri } from "./types";

function localUserId(username: string): string | null {
  return (
    load().users.find(
      (user) => user.username.toLowerCase() === username.toLowerCase(),
    )?.id ?? null
  );
}

function toLocalSubmission(api: ApiKurasiSubmission): KurasiSubmission | null {
  const sanggarId = localUserId(api.sanggarUsername);
  if (!sanggarId) return null;
  return {
    id: `kurasi_api_${api.id}`,
    apiId: api.id,
    sanggarId,
    tahap1: api.tahap1 ?? {},
    tahap1Files: api.tahap1Files as KurasiSubmission["tahap1Files"],
    tahap2VideoName: api.tahap2VideoName,
    tahap2VideoUrl: api.tahap2VideoUrl,
    pesertaSeni: api.pesertaSeni as KurasiSubmission["pesertaSeni"],
    deklarasiAntiJokiAt: api.deklarasiAntiJokiAt,
    deklarasiAntiJokiOleh: api.deklarasiAntiJokiOleh,
    ...(api.matrixSnapshot
      ? {
          matrixSnapshot: migrateMatrix(api.matrixSnapshot, {
            preserveExistingContent: true,
          }),
        }
      : {}),
    scores: api.scores ?? {},
    requirementScores: api.requirementScores ?? {},
    finalized: api.finalized ?? {},
    createdAt: Date.parse(api.createdAt) || Date.now(),
  };
}

function toLocalAssignment(api: ApiKurasiAssignment): PenugasanJuri | null {
  const juriId = localUserId(api.juriUsername);
  const sanggarId = localUserId(api.sanggarUsername);
  if (!juriId || !sanggarId) return null;
  return {
    id: `penugasan_api_${api.id}`,
    apiId: api.id,
    juriId,
    sanggarId,
    periode: api.periode,
    createdAt: Date.parse(api.createdAt) || Date.now(),
  };
}

/** Tarik penugasan/submission dari MariaDB lalu overlay ke store lokal. */
export async function hydrateKurasi(): Promise<void> {
  try {
    const [assignments, submissions] = await Promise.all([
      kurasiApi.listAssignments(),
      kurasiApi.listSubmissions(),
    ]);
    const localAssignments = assignments
      .map(toLocalAssignment)
      .filter(Boolean) as PenugasanJuri[];
    const localSubmissions = submissions
      .map(toLocalSubmission)
      .filter(Boolean) as KurasiSubmission[];
    save((db) => {
      for (const assignment of localAssignments) {
        const index = db.penugasanJuri.findIndex(
          (item) => item.apiId === assignment.apiId,
        );
        if (index >= 0) db.penugasanJuri[index] = assignment;
        else db.penugasanJuri.push(assignment);
      }
      for (const submission of localSubmissions) {
        const index = db.kurasiSubmissions.findIndex(
          (item) =>
            item.apiId === submission.apiId ||
            item.sanggarId === submission.sanggarId,
        );
        if (index >= 0)
          db.kurasiSubmissions[index] = {
            ...db.kurasiSubmissions[index],
            ...submission,
          };
        else db.kurasiSubmissions.push(submission);
      }
    });
  } catch {
    // Offline: modul tetap memakai snapshot lokal.
  }
}

export async function persistKurasiSubmission(
  submission: KurasiSubmission,
  sanggarUsername: string,
): Promise<void> {
  if (isStoreDemoMode()) return;
  const response = await kurasiApi.putSubmission({
    tahap1: submission.tahap1,
    tahap1Files: submission.tahap1Files,
    tahap2VideoName: submission.tahap2VideoName,
    tahap2VideoUrl: submission.tahap2VideoUrl,
    pesertaSeni: submission.pesertaSeni,
    deklarasiAntiJoki: Boolean(submission.deklarasiAntiJokiAt),
  });
  const local = toLocalSubmission(response);
  if (!local) return;
  save((db) => {
    const index = db.kurasiSubmissions.findIndex(
      (item) => item.sanggarId === submission.sanggarId,
    );
    if (index >= 0)
      db.kurasiSubmissions[index] = {
        ...db.kurasiSubmissions[index],
        ...local,
      };
  });
  void sanggarUsername;
}

export async function persistKurasiScore(
  sanggarUsername: string,
  scores: Record<string, number>,
  finalize: boolean,
  requirementScores?: Record<string, Record<string, number>>,
): Promise<void> {
  if (isStoreDemoMode()) return;
  const response = await kurasiApi.saveScores({
    sanggarUsername,
    scores,
    requirementScores,
    finalize,
  });
  const local = toLocalSubmission(response);
  if (!local) return;
  save((db) => {
    const index = db.kurasiSubmissions.findIndex(
      (item) => item.sanggarId === local.sanggarId,
    );
    if (index >= 0)
      db.kurasiSubmissions[index] = {
        ...db.kurasiSubmissions[index],
        ...local,
      };
    else db.kurasiSubmissions.push(local);
  });
}

export async function createKurasiAssignment(
  juriUsername: string,
  sanggarUsername: string,
  periode: string,
): Promise<void> {
  if (isStoreDemoMode()) {
    const juriId = localUserId(juriUsername);
    const sanggarId = localUserId(sanggarUsername);
    if (!juriId || !sanggarId) {
      throw new Error("Juri atau sanggar demo tidak ditemukan.");
    }
    save((db) => {
      db.penugasanJuri.push({
        id: `penugasan_demo_${uid()}`,
        juriId,
        sanggarId,
        periode,
        createdAt: Date.now(),
      });
    });
    return;
  }
  const response = await kurasiApi.createAssignment({
    juriUsername,
    sanggarUsername,
    periode,
  });
  const local = toLocalAssignment(response);
  if (!local) return;
  save((db) => {
    if (!db.penugasanJuri.some((item) => item.apiId === local.apiId))
      db.penugasanJuri.push(local);
  });
}
