type Data = Record<string, unknown>;
type MemberActor = { id: string; role: string; profile: Data };
const onlyChanged = (before: Data, after: Data, allowed: string[]) =>
  [...new Set([...Object.keys(before), ...Object.keys(after)])].every(
    (key) =>
      allowed.includes(key) ||
      JSON.stringify(before[key]) === JSON.stringify(after[key]),
  );

function validReceipt(value: unknown) {
  if (typeof value !== "string") return false;
  const match =
    /^data:(?:image\/(?:png|jpeg|webp)|application\/pdf);base64,([A-Za-z0-9+/]+={0,2})$/.exec(
      value,
    );
  return !!match && match[1].length <= Math.ceil((2 * 1024 * 1024) / 3) * 4;
}

/** Referensi akun pada before/next sudah dinormalisasi menjadi ID server. */
export function memberRecordWriteError(input: {
  collection: string;
  actor: MemberActor;
  ownerUsername: string;
  next: Data;
  before?: Data;
  eligibleSessionIds?: ReadonlySet<string>;
  claimedSessionIds?: ReadonlySet<string>;
}): string | undefined {
  const { collection, actor, ownerUsername, next, before } = input;
  if (
    !["pelatih", "seniman"].includes(actor.role) ||
    actor.profile.status !== "aktif" ||
    typeof actor.profile.sanggarUsername !== "string" ||
    actor.profile.sanggarUsername.toLowerCase() !== ownerUsername.toLowerCase()
  )
    return "Akun harus anggota aktif sanggar pemilik data.";
  if (collection === "iuran") {
    if (
      actor.role !== "seniman" ||
      !before ||
      before.senimanId !== actor.id ||
      next.senimanId !== actor.id ||
      !["pending", "ditolak"].includes(String(before.status)) ||
      next.status !== "pending" ||
      !onlyChanged(before, next, ["buktiDataUrl", "status"]) ||
      !validReceipt(next.buktiDataUrl)
    )
      return "Seniman hanya dapat mengirim bukti pembayaran tagihannya yang belum lunas.";
    return;
  }
  if (collection === "distribusi") {
    if (
      !before ||
      before.penerimaId !== actor.id ||
      next.penerimaId !== actor.id ||
      next.penerimaRole !== actor.role ||
      before.konfirmasi !== false ||
      next.konfirmasi !== true ||
      !onlyChanged(before, next, ["konfirmasi"])
    )
      return "Penerima hanya dapat mengonfirmasi honor miliknya tanpa mengubah nominal.";
    return;
  }
  if (collection === "pengajuanHonor") {
    if (
      before ||
      actor.role !== "pelatih" ||
      next.pelatihId !== actor.id ||
      next.status !== "pending" ||
      next.paidAt !== undefined ||
      next.buktiTransferDataUrl !== undefined
    )
      return "Pelatih hanya dapat membuat pengajuan honor miliknya yang menunggu validasi.";
    const sessions = next.latihanIds;
    if (
      !Array.isArray(sessions) ||
      !sessions.length ||
      sessions.some((id) => typeof id !== "string") ||
      new Set(sessions).size !== sessions.length ||
      next.jumlahSesi !== sessions.length
    )
      return "Daftar sesi pengajuan honor tidak valid.";
    if (
      sessions.some(
        (id) =>
          !input.eligibleSessionIds?.has(id) ||
          input.claimedSessionIds?.has(id),
      )
    )
      return "Sesi belum dihadiri/dilaporkan atau sudah masuk pengajuan honor.";
    const tarif = actor.profile.honorPerSesi;
    if (
      typeof tarif !== "number" ||
      !Number.isFinite(tarif) ||
      tarif <= 0 ||
      next.honorPerSesi !== tarif ||
      next.total !== tarif * sessions.length ||
      !Number.isFinite(next.total)
    )
      return "Perhitungan honor harus sesuai tarif pelatih dan jumlah sesi.";
    return;
  }
  return "Aksi anggota pada koleksi ini tidak tersedia.";
}
