import type { DBShape } from "@workspace/jaksanggar-core/store";
import type { PelatihUser } from "@workspace/jaksanggar-core/types";

/** Kehadiran adalah record tersendiri; tidak pernah mengubah penugasan jadwal. */
export function catatKehadiran(
  db: DBShape,
  input: {
    userId: string;
    latihanId: string;
    id: string;
    now: number;
    lat?: number;
    lng?: number;
  },
) {
  const anggota = db.users.find((item) => item.id === input.userId);
  if (
    !anggota ||
    (anggota.role !== "pelatih" && anggota.role !== "seniman") ||
    anggota.status !== "aktif"
  ) {
    throw new Error("Kehadiran hanya dapat dicatat oleh anggota aktif.");
  }
  const jadwal = db.latihan.find((item) => item.id === input.latihanId);
  if (!jadwal || !anggota.sanggarId || jadwal.sanggarId !== anggota.sanggarId) {
    throw new Error("Jadwal bukan milik sanggar Anda.");
  }
  const existing = db.absensiLatihan.find(
    (item) => item.latihanId === jadwal.id && item.userId === anggota.id,
  );
  if (existing) return existing;
  const gps =
    Number.isFinite(input.lat) &&
    Number.isFinite(input.lng) &&
    Math.abs(input.lat!) <= 90 &&
    Math.abs(input.lng!) <= 180;
  const hadir = {
    id: input.id,
    latihanId: jadwal.id,
    sanggarId: jadwal.sanggarId,
    userId: anggota.id,
    role: anggota.role,
    hadirAt: input.now,
    metode: gps ? ("gps" as const) : ("manual" as const),
    ...(gps ? { lat: input.lat, lng: input.lng } : {}),
  };
  db.absensiLatihan.push(hadir);
  db.activity.push({
    id: `${input.id}_activity`,
    ts: input.now,
    actorId: anggota.id,
    actorRole: anggota.role,
    action: "absen-latihan",
    meta: { latihanId: jadwal.id, metode: hadir.metode },
  });
  return hadir;
}

export function sesiHonorTersedia(db: DBShape, pelatih: PelatihUser) {
  const klaim = db.pengajuanHonor.filter(
    (item) =>
      item.pelatihId === pelatih.id &&
      item.sanggarId === pelatih.sanggarId &&
      item.status !== "ditolak",
  );
  const claimed = new Set(klaim.flatMap((item) => item.latihanIds ?? []));
  // Pengajuan lama tidak menyimpan ID sesi. Lindungi seluruh laporan yang
  // sudah ada saat pengajuan itu dibuat agar tidak dibayar lagi tanpa sengaja.
  const batasLama = Math.max(
    0,
    ...klaim.filter((item) => !item.latihanIds).map((item) => item.createdAt),
  );
  const hadir = new Set(
    db.absensiLatihan
      .filter((item) => item.userId === pelatih.id)
      .map((item) => item.latihanId),
  );
  return db.latihan.filter(
    (item) =>
      item.sanggarId === pelatih.sanggarId &&
      item.pelatihId === pelatih.id &&
      item.laporan &&
      hadir.has(item.id) &&
      !claimed.has(item.id) &&
      item.laporan.timestamp > batasLama,
  );
}

export function ajukanHonorLatihan(
  db: DBShape,
  input: { userId: string; id: string; now: number },
) {
  const pelatih = db.users.find((item) => item.id === input.userId);
  if (
    !pelatih ||
    pelatih.role !== "pelatih" ||
    pelatih.status !== "aktif" ||
    !pelatih.sanggarId
  )
    throw new Error("Pengajuan memerlukan pelatih aktif dengan sanggar.");
  if (!Number.isFinite(pelatih.honorPerSesi) || pelatih.honorPerSesi <= 0)
    throw new Error("Honor per sesi belum ditetapkan dengan benar.");
  const sesi = sesiHonorTersedia(db, pelatih);
  if (!sesi.length)
    throw new Error("Belum ada sesi hadir dan terlapor yang belum diajukan.");
  const total = sesi.length * pelatih.honorPerSesi;
  if (!Number.isFinite(total)) throw new Error("Total honor tidak valid.");
  const pengajuan = {
    id: input.id,
    sanggarId: pelatih.sanggarId,
    pelatihId: pelatih.id,
    latihanIds: sesi.map((item) => item.id),
    jumlahSesi: sesi.length,
    honorPerSesi: pelatih.honorPerSesi,
    total,
    status: "pending" as const,
    createdAt: input.now,
  };
  db.pengajuanHonor.push(pengajuan);
  return pengajuan;
}
