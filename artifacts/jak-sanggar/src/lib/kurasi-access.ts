import type { DBShape } from "@workspace/jaksanggar-core/store";

export function juriScoringAccessError(
  db: Pick<DBShape, "users" | "penugasanJuri" | "kurasiSubmissions">,
  userId: string,
  sanggarId: string,
  write = false,
) {
  const juri = db.users.find((item) => item.id === userId);
  if (
    !juri ||
    juri.role !== "juri" ||
    !db.penugasanJuri.some(
      (item) => item.juriId === userId && item.sanggarId === sanggarId,
    )
  )
    return "Anda belum ditugaskan untuk menilai sanggar ini.";
  const submission = db.kurasiSubmissions.find(
    (item) => item.sanggarId === sanggarId,
  );
  if (!submission) return "Sanggar belum mengirim pengajuan kurasi.";
  if (write && submission.finalized[juri.username])
    return "Nilai akhir sudah terkunci dan tidak dapat diubah.";
  return undefined;
}
