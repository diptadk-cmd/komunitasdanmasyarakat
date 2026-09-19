const OFFLINE_STORE_REQUIRED =
  "Mitra wajib mempunyai toko offline, memilih wilayah lengkap DKI Jakarta, dan menandai titik tokonya di peta.";
const NIB_DATE_REQUIRED =
  "Tanggal terbit NIB wajib diisi dan tidak boleh lebih lama dari 6 bulan pada tanggal permohonan.";

function jakartaDate(now: Date): string {
  return new Date(now.getTime() + 7 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

function subtractCalendarMonths(date: Date, months: number): Date {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() - months;
  const day = date.getUTCDate();
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(day, lastDay)));
}

export function validasiDanNormalisasiTokoOfflineMitra(
  role: string,
  profile: Record<string, unknown>,
  now = new Date(),
): { ok: true } | { ok: false; error: string } {
  if (role !== "mitra_pengrajin") return { ok: true };

  const namaTokoOffline =
    typeof profile["namaTokoOffline"] === "string"
      ? profile["namaTokoOffline"].trim()
      : "";
  const alamatTokoOffline =
    typeof profile["alamatTokoOffline"] === "string"
      ? profile["alamatTokoOffline"].trim()
      : "";
  const wilayah =
    profile["wilayahTokoOffline"] &&
    typeof profile["wilayahTokoOffline"] === "object"
      ? (profile["wilayahTokoOffline"] as Record<string, unknown>)
      : {};
  const lat = Number(profile["latTokoOffline"]);
  const lng = Number(profile["lngTokoOffline"]);

  if (
    profile["memilikiTokoOffline"] !== true ||
    !namaTokoOffline ||
    !alamatTokoOffline ||
    !wilayah["provinsiId"] ||
    !wilayah["kotaId"] ||
    !wilayah["kecamatanId"] ||
    !wilayah["kelurahanId"] ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < -6.5 ||
    lat > -5.3 ||
    lng < 106.5 ||
    lng > 107.2
  ) {
    return { ok: false, error: OFFLINE_STORE_REQUIRED };
  }

  const tanggalPermohonan = jakartaDate(now);
  const tanggalTerbitNib =
    typeof profile["tanggalTerbitNib"] === "string"
      ? profile["tanggalTerbitNib"].trim()
      : "";
  const terbit = /^\d{4}-\d{2}-\d{2}$/.test(tanggalTerbitNib)
    ? new Date(`${tanggalTerbitNib}T00:00:00.000Z`)
    : new Date(Number.NaN);
  const permohonan = new Date(`${tanggalPermohonan}T00:00:00.000Z`);
  const batasEnamBulan = subtractCalendarMonths(permohonan, 6);
  if (
    Number.isNaN(terbit.getTime()) ||
    terbit > permohonan ||
    terbit < batasEnamBulan
  ) {
    return { ok: false, error: NIB_DATE_REQUIRED };
  }

  profile["namaTokoOffline"] = namaTokoOffline;
  profile["alamatTokoOffline"] = alamatTokoOffline;
  profile["latTokoOffline"] = lat;
  profile["lngTokoOffline"] = lng;
  profile["tanggalTerbitNib"] = tanggalTerbitNib;
  profile["tanggalPermohonanMitra"] = tanggalPermohonan;
  // Dokumen diunggah setelah registrasi karena endpoint unggahan memerlukan sesi.
  // Pemohon tidak pernah boleh memverifikasi tokonya sendiri.
  profile["statusVerifikasiTokoOffline"] = "belum_lengkap";
  delete profile["catatanVerifikasiTokoOffline"];
  delete profile["diverifikasiTokoOfflineAt"];
  delete profile["diverifikasiTokoOfflineOleh"];
  return { ok: true };
}
