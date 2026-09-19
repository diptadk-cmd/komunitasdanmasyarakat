import { isBlockedAccountStatus } from "./account-status";

interface PublicSanggarSource {
  id: string;
  profile: Record<string, unknown>;
}

interface PublicSanggarDirectorySource extends PublicSanggarSource {
  role: string;
  status: unknown;
}

function directoryImage(value: unknown): string | undefined {
  const source = cleanText(value);
  if (!source || source.length > 400_000) return undefined;
  if (
    /^data:image\/(png|jpeg|webp|gif|avif);base64,[a-z0-9+/=]+$/i.test(source) ||
    /^\/api\/public\/media\/[0-9a-f-]{36}$/i.test(source)
  ) return source;
  return undefined;
}

/**
 * Registration directory is independent of the map's location requirements.
 * Build a fresh public object: account/profile metadata is never spread here.
 */
export function publicSanggarDirectoryFromAccount(row: PublicSanggarDirectorySource) {
  if (row.role !== "sanggar" || isBlockedAccountStatus(row.status)) return null;
  const profile = row.profile;
  const rawRegion = profile["wilayah"];
  const region = rawRegion && typeof rawRegion === "object" && !Array.isArray(rawRegion)
    ? rawRegion as Record<string, unknown>
    : {};
  const publicRegion: Partial<Record<"kelurahan" | "kecamatan" | "kota" | "provinsi", string>> = {};
  for (const field of ["kelurahan", "kecamatan", "kota", "provinsi"] as const) {
    const label = cleanText(region[field]) || cleanText(profile[field]);
    if (label) publicRegion[field] = label.slice(0, 120);
  }
  const logoDataUrl = directoryImage(profile["logoDataUrl"]);
  const fotoProfileDataUrl = logoDataUrl ? undefined : directoryImage(profile["fotoProfileDataUrl"]);
  return {
    id: row.id,
    namaSanggar: cleanText(profile["namaSanggar"]).slice(0, 160) || "Sanggar belum bernama",
    jenisKesenian: Array.isArray(profile["jenisKesenian"])
      ? [...new Set(profile["jenisKesenian"].filter((item): item is string => typeof item === "string").map((item) => item.trim().slice(0, 80)).filter(Boolean))].slice(0, 20)
      : [],
    ...publicRegion,
    ...(logoDataUrl ? { logoDataUrl } : {}),
    ...(fotoProfileDataUrl ? { fotoProfileDataUrl } : {}),
  };
}

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function coordinate(value: unknown): number | null {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number(value)
        : Number.NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

function accountAddress(profile: Record<string, unknown>): string {
  const direct = cleanText(profile["alamat"]);
  if (direct) return direct;

  const parts = [
    profile["alamatLengkap"],
    profile["kelurahan"],
    profile["kecamatan"],
    profile["kota"],
    profile["provinsi"],
    profile["kodePos"],
  ]
    .map(cleanText)
    .filter(Boolean);
  return [...new Set(parts)].join(", ");
}

function isJakartaCoordinate(lat: number, lng: number): boolean {
  // Termasuk Kepulauan Seribu dan seluruh wilayah daratan DKI Jakarta.
  return lat >= -6.5 && lat <= -5.2 && lng >= 106.35 && lng <= 107.25;
}

function isPlaceholderCoordinate(lat: number, lng: number): boolean {
  // Nilai lama ini pernah dipakai sebagai titik pusat Jakarta saat lokasi
  // akun belum di-geocode. Jangan publikasikan sebagai lokasi Sanggar nyata.
  return Math.abs(lat - -6.2) < 1e-7 && Math.abs(lng - 106.8) < 1e-7;
}

export function publicSanggarFromAccount(row: PublicSanggarSource) {
  const profile = row.profile;
  const alamat = accountAddress(profile);
  const lat = coordinate(profile["lat"]);
  const lng = coordinate(profile["lng"]);

  // Jangan membuat marker pusat Jakarta palsu. Akun tetap tampil di Konsol,
  // tetapi baru masuk peta setelah alamat dan titik lokasinya lengkap.
  if (
    !alamat ||
    lat === null ||
    lng === null ||
    !isJakartaCoordinate(lat, lng) ||
    isPlaceholderCoordinate(lat, lng)
  ) {
    return null;
  }

  return {
    id: row.id,
    namaSanggar: cleanText(profile["namaSanggar"]) || "Sanggar Jakarta",
    jenisKesenian: Array.isArray(profile["jenisKesenian"])
      ? profile["jenisKesenian"].filter(
          (value): value is string => typeof value === "string" && !!value.trim(),
        )
      : [],
    alamat,
    lat,
    lng,
    fotoProfileDataUrl: cleanText(profile["fotoProfileDataUrl"]) || undefined,
    logoDataUrl: cleanText(profile["logoDataUrl"]) || undefined,
    deskripsi: cleanText(profile["deskripsi"]) || undefined,
  };
}
