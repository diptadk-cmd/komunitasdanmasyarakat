import type { DBShape } from "./store";
import type { AnyUser } from "./types";

export interface RekapanEntry {
  id: string;
  jenis: string;
  judul: string;
  keterangan: string;
  status: string;
  nominal?: number;
  tanggal: number;
}

export interface RingkasanRekapan {
  totalCatatan: number;
  totalTransaksi: number;
  totalPencatatan: number;
  akumulasiNominal: number;
}

const parseTanggal = (value: string | number | undefined, fallback = 0) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
};

const label = (value: string) =>
  value
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const namaPengguna = (user: AnyUser | undefined) => {
  if (!user) return "Pengguna";
  if (user.role === "sanggar") return user.namaSanggar;
  if (user.role === "pengrajin") return user.namaUsaha;
  if (user.role === "mitra_pengrajin") return user.namaUsaha;
  if (user.role === "sewa") return user.nama;
  if (user.role === "kurator") return "Kurator";
  return user.nama;
};

function ringkasMeta(meta?: Record<string, unknown>) {
  if (!meta) return "Jejak aktivitas sistem";
  const pasangan = Object.entries(meta)
    .filter(
      ([key, value]) =>
        value !== undefined &&
        value !== null &&
        !key.toLowerCase().endsWith("id") &&
        !["id", "pihakterkait"].includes(key.toLowerCase()),
    )
    .slice(0, 4)
    .map(([key, value]) => {
      const rendered = Array.isArray(value) ? value.join(", ") : String(value);
      return `${label(key)}: ${rendered}`;
    });
  return pasangan.join(" · ") || "Jejak aktivitas sistem";
}

export function buildRekapan(db: DBShape, user: AnyUser): RekapanEntry[] {
  const semua = user.role === "kurator";
  const pengguna = new Map(db.users.map((item) => [item.id, item]));
  const nama = (id: string) => namaPengguna(pengguna.get(id));
  const rows: RekapanEntry[] = [];
  const push = (entry: RekapanEntry) => rows.push(entry);

  const kerjasamaTerkait = (id: string) => {
    const item = db.kerjasama.find((row) => row.id === id);
    return (
      !!item &&
      (semua ||
        item.sanggarPenyediaId === user.id ||
        item.sanggarPeminjamId === user.id)
    );
  };
  const pemesananTerkait = (id: string) => {
    const item = db.pemesananSewa.find((row) => row.id === id);
    return (
      !!item &&
      (semua ||
        item.sewaId === user.id ||
        item.sanggarId === user.id ||
        item.sdmUserId === user.id)
    );
  };
  const invoiceTerkait = (id: string) => {
    const invoice = db.invoices.find((row) => row.id === id);
    if (!invoice) return false;
    return (
      kerjasamaTerkait(invoice.kerjasamaId) ||
      db.pemesananSewa.some(
        (row) => row.invoiceId === id && pemesananTerkait(row.id),
      )
    );
  };
  for (const item of db.kas) {
    if (!semua && item.sanggarId !== user.id) continue;
    const nominal = item.debit > 0 ? item.debit : -item.kredit;
    push({
      id: `kas:${item.id}`,
      jenis: "Kas",
      judul: item.keterangan,
      keterangan: `${nama(item.sanggarId)} · ${label(item.refType)}`,
      status: item.debit > 0 ? "Pemasukan" : "Pengeluaran",
      nominal,
      tanggal: item.tanggal,
    });
  }

  for (const item of db.transaksi) {
    if (!semua && item.sanggarId !== user.id) continue;
    push({
      id: `transaksi:${item.id}`,
      jenis: "Transaksi",
      judul: item.kategori,
      keterangan: `${item.sumberAtauTujuan} · ${item.keterangan}`,
      status: label(item.jenis),
      nominal: item.jenis === "pemasukan" ? item.nominal : -item.nominal,
      tanggal: parseTanggal(item.tanggal, item.createdAt),
    });
  }

  for (const item of db.iuran) {
    if (!semua && item.sanggarId !== user.id && item.senimanId !== user.id)
      continue;
    push({
      id: `iuran:${item.id}`,
      jenis: "Iuran",
      judul: item.judul,
      keterangan: `${nama(item.senimanId)} → ${nama(item.sanggarId)}`,
      status: label(item.status),
      nominal: item.nominal,
      tanggal: item.validatedAt ?? item.createdAt,
    });
  }

  for (const item of db.pengajuanHonor) {
    if (!semua && item.sanggarId !== user.id && item.pelatihId !== user.id)
      continue;
    push({
      id: `honor:${item.id}`,
      jenis: "Honor",
      judul: `Honor ${item.jumlahSesi} sesi`,
      keterangan: `${nama(item.sanggarId)} → ${nama(item.pelatihId)}`,
      status: label(item.status),
      nominal: item.total,
      tanggal: item.paidAt ?? item.createdAt,
    });
  }

  for (const item of db.distribusi) {
    if (!semua && item.sanggarId !== user.id && item.penerimaId !== user.id)
      continue;
    push({
      id: `distribusi:${item.id}`,
      jenis: "Distribusi Honor",
      judul: item.judulJob,
      keterangan: `${nama(item.sanggarId)} → ${nama(item.penerimaId)}`,
      status: item.konfirmasi ? "Dikonfirmasi" : "Menunggu Konfirmasi",
      nominal: item.nominal,
      tanggal: item.createdAt,
    });
  }

  for (const item of db.kerjasama) {
    if (
      !semua &&
      item.sanggarPenyediaId !== user.id &&
      item.sanggarPeminjamId !== user.id
    )
      continue;
    push({
      id: `kerjasama:${item.id}`,
      jenis: "Kerja Sama Sanggar",
      judul: item.judul,
      keterangan: `${item.nomor} · ${nama(item.sanggarPeminjamId)} ↔ ${nama(item.sanggarPenyediaId)}`,
      status: label(item.status),
      nominal: item.nilaiTotal,
      tanggal: item.updatedAt || item.createdAt,
    });
  }

  for (const item of db.pemesananSewa) {
    if (
      !semua &&
      item.sewaId !== user.id &&
      item.sanggarId !== user.id &&
      item.sdmUserId !== user.id
    )
      continue;
    push({
      id: `sewa:${item.id}`,
      jenis: "Pesanan Layanan",
      judul: item.judul,
      keterangan: `${item.nomor} · ${nama(item.sewaId)} → ${nama(item.sanggarId)}`,
      status: label(item.status),
      nominal: item.nilaiTotal,
      tanggal: item.updatedAt || item.createdAt,
    });
  }

  for (const item of db.kerjasamaMitraPengrajin) {
    if (!semua && item.mitraId !== user.id && item.pengrajinId !== user.id)
      continue;
    push({
      id: `kerjasama-pengrajin:${item.id}`,
      jenis: "Kerja Sama Pengrajin",
      judul: item.judul,
      keterangan: `${item.nomor} · ${nama(item.pengrajinId)} ↔ ${nama(item.mitraId)}`,
      status: label(item.status),
      tanggal: item.updatedAt || item.createdAt,
    });
  }

  for (const item of db.pesananProdukPengrajin) {
    if (!semua && item.mitraId !== user.id && item.pengrajinId !== user.id)
      continue;
    push({
      id: `pesanan-produk:${item.id}`,
      jenis: "Pesanan Produk",
      judul: item.items.map((produk) => produk.nama).join(", ") || item.nomor,
      keterangan: `${item.nomor} · ${nama(item.mitraId)} → ${nama(item.pengrajinId)}`,
      status: label(item.status),
      nominal: item.nilaiTotal,
      tanggal: item.updatedAt || item.createdAt,
    });
  }

  for (const item of db.invoices) {
    if (!semua && !invoiceTerkait(item.id)) continue;
    push({
      id: `invoice:${item.id}`,
      jenis: "Invoice",
      judul: item.nomor,
      keterangan: `Tagihan transaksi · batas bayar ${new Date(item.batasPembayaran).toLocaleDateString("id-ID")}`,
      status: label(item.status),
      nominal: item.total,
      tanggal: item.createdAt,
    });
  }

  for (const item of db.payments) {
    if (!semua && !invoiceTerkait(item.invoiceId)) continue;
    push({
      id: `payment:${item.id}`,
      jenis: "Pembayaran",
      judul: `Pembayaran ${item.status}`,
      keterangan: item.catatanVerifikator || "Bukti pembayaran transaksi",
      status: label(item.status),
      nominal: item.nominal,
      tanggal: item.tanggalBayar || item.createdAt,
    });
  }

  for (const item of db.contracts) {
    if (!semua && !kerjasamaTerkait(item.kerjasamaId)) continue;
    push({
      id: `contract:${item.id}`,
      jenis: "Kontrak",
      judul: item.nomor,
      keterangan: "Dokumen kontrak kerja sama",
      status: "Tercatat",
      tanggal: item.createdAt,
    });
  }

  for (const item of db.bast) {
    const terkait =
      kerjasamaTerkait(item.kerjasamaId) ||
      db.pemesananSewa.some(
        (row) => row.bastId === item.id && pemesananTerkait(row.id),
      );
    if (!semua && !terkait) continue;
    push({
      id: `bast:${item.id}`,
      jenis: "BAST",
      judul: item.nomor,
      keterangan: "Berita acara serah terima",
      status: label(item.status),
      tanggal: item.finalAt ?? item.createdAt,
    });
  }

  for (const item of db.ratings) {
    if (!semua && !kerjasamaTerkait(item.kerjasamaId)) continue;
    push({
      id: `rating:${item.id}`,
      jenis: "Penilaian Transaksi",
      judul: `${item.rating}/5 bintang`,
      keterangan: item.ulasan || `Diberikan oleh ${nama(item.dariSanggarId)}`,
      status: "Tercatat",
      tanggal: item.createdAt,
    });
  }

  for (const item of db.latihan) {
    if (!semua && item.sanggarId !== user.id && item.pelatihId !== user.id)
      continue;
    push({
      id: `latihan:${item.id}`,
      jenis: "Latihan",
      judul: item.kurikulum,
      keterangan: `${item.tempat} · ${item.jam}`,
      status: item.laporan ? "Laporan Tersedia" : "Terjadwal",
      tanggal: parseTanggal(item.tanggal, item.editedAt),
    });
  }

  for (const item of db.absensiLatihan) {
    if (!semua && item.sanggarId !== user.id && item.userId !== user.id)
      continue;
    push({
      id: `absensi:${item.id}`,
      jenis: "Absensi",
      judul: `Kehadiran ${nama(item.userId)}`,
      keterangan: item.catatan || `Metode ${label(item.metode ?? "manual")}`,
      status: "Hadir",
      tanggal: item.hadirAt,
    });
  }

  for (const item of db.pendaftaranPembinaan) {
    if (!semua && item.sanggarId !== user.id && item.delegasiId !== user.id)
      continue;
    push({
      id: `pembinaan:${item.id}`,
      jenis: "Pembinaan",
      judul: `Pendaftaran ${nama(item.delegasiId)}`,
      keterangan: `Sanggar ${nama(item.sanggarId)}`,
      status: item.setuju ? "Disetujui" : "Menunggu",
      tanggal: item.createdAt,
    });
  }

  for (const item of db.penugasanJuri) {
    if (!semua && item.juriId !== user.id && item.sanggarId !== user.id)
      continue;
    push({
      id: `penugasan:${item.id}`,
      jenis: "Penugasan Juri",
      judul: item.periode,
      keterangan: `${nama(item.juriId)} menilai ${nama(item.sanggarId)}`,
      status: "Ditugaskan",
      tanggal: item.createdAt,
    });
  }

  for (const item of db.kurasiSubmissions) {
    const juriTerkait =
      user.role === "juri" &&
      (Object.hasOwn(item.scores, user.username) ||
        Object.hasOwn(item.finalized, user.username));
    if (!semua && item.sanggarId !== user.id && !juriTerkait) continue;
    const finalAt = Math.max(0, ...Object.values(item.finalized));
    push({
      id: `kurasi:${item.id}`,
      jenis: "Kurasi",
      judul: `Kurasi ${nama(item.sanggarId)}`,
      keterangan: `${Object.keys(item.scores).length} juri memberi nilai`,
      status: finalAt > 0 ? "Difinalisasi" : "Dalam Proses",
      tanggal: finalAt || item.createdAt,
    });
  }

  for (const item of db.sertifikat) {
    if (
      !semua &&
      item.pemilikId !== user.id &&
      item.sanggarId !== user.id &&
      item.penerbitId !== user.id
    )
      continue;
    push({
      id: `sertifikat:${item.id}`,
      jenis: "Sertifikat",
      judul: item.jenis,
      keterangan: `${item.nomor ?? "Tanpa nomor"} · ${item.pemilikNama}`,
      status: item.predikat ?? "Diterbitkan",
      tanggal: item.issuedAt,
    });
  }

  for (const item of db.dokumenArsip) {
    if (!semua && item.sanggarId !== user.id) continue;
    push({
      id: `dokumen:${item.id}`,
      jenis: "Dokumen",
      judul: item.judul,
      keterangan: `Template ${label(item.templateId)}`,
      status: "Tersimpan",
      tanggal: item.updatedAt || item.createdAt,
    });
  }

  for (const item of db.activity) {
    if (!semua && item.actorId !== user.id) continue;
    push({
      id: `activity:${item.id}`,
      jenis: "Aktivitas",
      judul: label(item.action),
      keterangan: ringkasMeta(item.meta),
      status: "Tercatat",
      tanggal: item.ts,
    });
  }

  return rows.sort((a, b) => b.tanggal - a.tanggal || a.id.localeCompare(b.id));
}

export function ringkasanRekapan(entries: RekapanEntry[]): RingkasanRekapan {
  const transaksi = entries.filter((entry) => entry.nominal !== undefined);
  return {
    totalCatatan: entries.length,
    totalTransaksi: transaksi.length,
    totalPencatatan: entries.length - transaksi.length,
    akumulasiNominal: transaksi.reduce(
      (total, entry) => total + Math.abs(entry.nominal ?? 0),
      0,
    ),
  };
}
