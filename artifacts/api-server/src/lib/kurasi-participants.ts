export const MIN_KURASI_PARTICIPANTS = 5;
export const MAX_KURASI_PARTICIPANTS = 8;

export interface KurasiParticipantPayload {
  userId: string;
  username?: string;
  nama: string;
  jenisKesenian: string;
  nik: string;
  ktpUrl?: string;
  selfieUrl?: string;
  ktpDataUrl?: string;
  selfieDataUrl?: string;
}

function boundedText(value: unknown, max: number): string | null {
  return typeof value === "string" &&
    value.trim().length > 0 &&
    value.trim().length <= max
    ? value.trim()
    : null;
}

export function privateUploadId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  return /^\/api\/uploads\/([0-9a-f-]{36})\/raw$/i.exec(value)?.[1] ?? null;
}

export function normalizeNik(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const nik = value.replace(/\D/g, "");
  return /^\d{16}$/.test(nik) ? nik : null;
}

export function participantKey(
  value: Pick<KurasiParticipantPayload, "userId" | "username">,
): string {
  return (value.username || value.userId).trim().toLowerCase();
}

export function parseKurasiParticipants(
  value: unknown,
): KurasiParticipantPayload[] | null {
  if (
    !Array.isArray(value) ||
    value.length < MIN_KURASI_PARTICIPANTS ||
    value.length > MAX_KURASI_PARTICIPANTS
  ) {
    return null;
  }

  const parsed: KurasiParticipantPayload[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") return null;
    const participant = item as Record<string, unknown>;
    const userId = boundedText(participant["userId"], 100);
    const username = boundedText(participant["username"], 100) ?? undefined;
    const nama = boundedText(participant["nama"], 200);
    const jenisKesenian = boundedText(participant["jenisKesenian"], 100);
    const nik = normalizeNik(participant["nik"]);
    const ktpUrl = privateUploadId(participant["ktpUrl"])
      ? String(participant["ktpUrl"])
      : undefined;
    const selfieUrl = privateUploadId(participant["selfieUrl"])
      ? String(participant["selfieUrl"])
      : undefined;
    const ktpDataUrl =
      boundedText(participant["ktpDataUrl"], 2_000_000) ?? undefined;
    const selfieDataUrl =
      boundedText(participant["selfieDataUrl"], 2_000_000) ?? undefined;
    if (
      !userId ||
      !nama ||
      !jenisKesenian ||
      !nik ||
      !(ktpUrl || ktpDataUrl) ||
      !(selfieUrl || selfieDataUrl)
    ) {
      return null;
    }
    parsed.push({
      userId,
      username,
      nama,
      jenisKesenian,
      nik,
      ktpUrl,
      selfieUrl,
      ktpDataUrl,
      selfieDataUrl,
    });
  }

  const participantKeys = new Set(parsed.map(participantKey));
  const niks = new Set(parsed.map((item) => item.nik));
  return participantKeys.size === parsed.length && niks.size === parsed.length
    ? parsed
    : null;
}
