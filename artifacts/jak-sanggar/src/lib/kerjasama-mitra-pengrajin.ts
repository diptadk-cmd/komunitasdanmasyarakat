import { load, logActivity, save, uid } from "./store";
import { buatPesananDariKesepakatan } from "./perdagangan-pengrajin";
import type {
  KerjasamaMitraPengrajin,
  MetodePeninjauanMitra,
  MitraPengrajinUser,
  PengrajinUser,
  ProdukKerajinan,
} from "./types";

export const STATUS_KERJASAMA_MITRA: Record<
  KerjasamaMitraPengrajin["status"],
  string
> = {
  diajukan: "Menunggu Mitra",
  disetujui: "Disetujui - Siap Ditinjau",
  ditolak: "Ditolak",
  jadwal_diajukan: "Menunggu Persetujuan Jadwal",
  jadwal_disepakati: "Jadwal Disepakati",
  peninjauan_selesai: "Peninjauan Selesai",
  bersepakat: "Bersepakat - Pilih Barang",
  pembelian_dibuat: "Pembelian Dibuat",
};

function nextNumber() {
  const db = load();
  const year = new Date().getFullYear();
  const count = db.kerjasamaMitraPengrajin.filter((item) =>
    item.nomor.includes(`/${year}/`),
  ).length;
  return `KSM/KRIYA/${year}/${String(count + 1).padStart(4, "0")}`;
}

function mutate(id: string, updater: (item: KerjasamaMitraPengrajin) => void) {
  let result: KerjasamaMitraPengrajin | undefined;
  save((db) => {
    const item = db.kerjasamaMitraPengrajin.find((value) => value.id === id);
    if (!item) return;
    updater(item);
    item.updatedAt = Date.now();
    result = item;
  });
  if (!result) throw new Error("Pengajuan kerja sama tidak ditemukan.");
  return result;
}

export function ajukanKerjasamaMitra(input: {
  pengrajin: PengrajinUser;
  mitra: MitraPengrajinUser;
  judul: string;
  pesan: string;
  produkIds: string[];
  videoUrl?: string;
}) {
  if (!input.judul.trim() || !input.pesan.trim())
    throw new Error("Judul dan tujuan kerja sama wajib diisi.");
  if (input.produkIds.length === 0)
    throw new Error("Pilih minimal satu produk untuk ditawarkan.");
  const products = (input.pengrajin.produk ?? []).filter((produk) =>
    input.produkIds.includes(produk.id),
  );
  const media: KerjasamaMitraPengrajin["media"] = products
    .filter((produk) => Boolean(produk.fotoUrl || produk.fotoDataUrl))
    .map((produk) => ({
      id: uid(),
      jenis: "foto",
      judul: produk.nama,
      url: produk.fotoUrl || produk.fotoDataUrl || "",
    }));
  if (input.videoUrl?.trim()) {
    media.push({
      id: uid(),
      jenis: "video",
      judul: `Video ${input.pengrajin.namaUsaha}`,
      url: input.videoUrl.trim(),
    });
  }
  const now = Date.now();
  const item: KerjasamaMitraPengrajin = {
    id: uid(),
    nomor: nextNumber(),
    pengrajinId: input.pengrajin.id,
    mitraId: input.mitra.id,
    judul: input.judul.trim(),
    pesan: input.pesan.trim(),
    produkIds: input.produkIds,
    media,
    status: "diajukan",
    createdAt: now,
    updatedAt: now,
  };
  save((db) => db.kerjasamaMitraPengrajin.push(item));
  logActivity(
    input.pengrajin.id,
    input.pengrajin.role,
    "ajukan-kerjasama-mitra",
    {
      kerjasamaId: item.id,
      mitraId: input.mitra.id,
    },
  );
  return item;
}

export function putuskanKerjasamaMitra(
  id: string,
  mitra: MitraPengrajinUser,
  keputusan: "setujui" | "tolak",
  alasan = "",
) {
  return mutate(id, (item) => {
    if (item.mitraId !== mitra.id || item.status !== "diajukan")
      throw new Error("Pengajuan tidak dapat diproses.");
    item.status = keputusan === "setujui" ? "disetujui" : "ditolak";
    item.alasanTolak =
      keputusan === "tolak"
        ? alasan.trim() || "Belum sesuai kebutuhan Mitra."
        : undefined;
  });
}

export function ajukanJadwalPeninjauan(input: {
  id: string;
  mitra: MitraPengrajinUser;
  metode: MetodePeninjauanMitra;
  tanggalWaktu: string;
  tempat?: string;
  tautanRapat?: string;
  catatan?: string;
}) {
  return mutate(input.id, (item) => {
    if (item.mitraId !== input.mitra.id || item.status !== "disetujui")
      throw new Error("Jadwal belum dapat diajukan.");
    if (!input.tanggalWaktu) throw new Error("Waktu peninjauan wajib diisi.");
    if (input.metode === "langsung" && !input.tempat?.trim())
      throw new Error("Tempat peninjauan wajib diisi.");
    if (input.metode === "rapat_daring" && !input.tautanRapat?.trim())
      throw new Error("Tautan rapat daring wajib diisi.");
    const now = Date.now();
    item.jadwal = {
      metode: input.metode,
      tanggalWaktu: input.tanggalWaktu,
      tempat: input.tempat?.trim() || undefined,
      tautanRapat: input.tautanRapat?.trim() || undefined,
      catatan: input.catatan?.trim() || undefined,
      diajukanAt: now,
      disepakatiMitraAt: now,
    };
    item.status = "jadwal_diajukan";
  });
}

export function sepakatiJadwalPeninjauan(id: string, pengrajin: PengrajinUser) {
  return mutate(id, (item) => {
    if (
      item.pengrajinId !== pengrajin.id ||
      item.status !== "jadwal_diajukan" ||
      !item.jadwal
    )
      throw new Error("Jadwal tidak dapat disetujui.");
    item.jadwal.disepakatiPengrajinAt = Date.now();
    item.status = "jadwal_disepakati";
  });
}

export function selesaikanPeninjauan(
  id: string,
  mitra: MitraPengrajinUser,
  catatan = "",
) {
  return mutate(id, (item) => {
    if (
      item.mitraId !== mitra.id ||
      !["disetujui", "jadwal_disepakati"].includes(item.status)
    )
      throw new Error("Peninjauan belum dapat diselesaikan.");
    item.catatanPeninjauan =
      catatan.trim() || "Produk dan kapasitas telah ditinjau.";
    item.status = "peninjauan_selesai";
  });
}

export function sepakatiKerjasama(id: string, mitra: MitraPengrajinUser) {
  return mutate(id, (item) => {
    if (item.mitraId !== mitra.id || item.status !== "peninjauan_selesai")
      throw new Error("Peninjauan belum selesai.");
    item.status = "bersepakat";
  });
}

export function buatPembelianKerjasama(input: {
  id: string;
  mitra: MitraPengrajinUser;
  pengrajin: PengrajinUser;
  items: Array<{ produk: ProdukKerajinan; jumlah: number }>;
  alamatPengiriman: string;
  targetSelesai: string;
  catatan?: string;
  metodePengiriman?: import("./types").MetodePengirimanProduk;
  mekanismePembayaran?: import("./types").MekanismePembayaranProduk;
  dpPersen?: number;
  jatuhTempoHari?: number;
}) {
  const kerja = load().kerjasamaMitraPengrajin.find(
    (item) => item.id === input.id,
  );
  if (!kerja || kerja.status !== "bersepakat")
    throw new Error("Kerja sama belum siap menjadi pembelian.");
  if (
    kerja.mitraId !== input.mitra.id ||
    kerja.pengrajinId !== input.pengrajin.id
  )
    throw new Error("Identitas peserta kerja sama tidak sesuai.");
  const pesanan = buatPesananDariKesepakatan({
    mitra: input.mitra,
    pengrajin: input.pengrajin,
    kerjasamaId: input.id,
    items: input.items,
    alamatPengiriman: input.alamatPengiriman,
    targetSelesai: input.targetSelesai,
    catatan: input.catatan,
    metodePengiriman: input.metodePengiriman,
    mekanismePembayaran: input.mekanismePembayaran,
    dpPersen: input.dpPersen,
    jatuhTempoHari: input.jatuhTempoHari,
  });
  mutate(input.id, (item) => {
    item.pesananId = pesanan.id;
    item.status = "pembelian_dibuat";
  });
  return pesanan;
}
