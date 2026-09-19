// =============================================================
// sewa-flow.ts
//
// Semua aksi alur pemesanan layanan (Konsumen/Mitra -> Sanggar
// -> seniman/pelatih) berada di sini, terpisah dari kerjasama antar
// sanggar (lib/kerjasama.ts).
//
// Lifecycle status & otoritas:
//   menunggu_sanggar  -> sanggar (penyedia) dapat: terima/tolak/assign
//   menunggu_sdm      -> seniman/pelatih yang ditugaskan: terima/tolak
//   menunggu_ttd      -> ke-3 (atau ke-2 untuk barang/tempat) pihak
//                        klik "Setuju" -> begitu lengkap auto-pindah
//                        ke kontrak_aktif
//   kontrak_aktif     -> sanggar (penyedia) menerbitkan invoice
//   menunggu_bayar    -> penyewa upload bukti bayar
//   lunas             -> sanggar verifikasi bukti -> pelaksanaan/penyerahan
//   sedang_disewa     -> barang/tempat telah diserahkan atau dapat digunakan
//   menunggu_konfirmasi_pengembalian
//                     -> penyewa mengajukan pengembalian/selesai pemakaian
//   dikembalikan      -> penyedia menerima dan memeriksa objek sewa
//   selesai           -> BAST difinalkan (penyedia)
//   ditolak / batal   -> alur dihentikan; tidak ada transisi keluar.
// =============================================================

import type {
  AnyUser,
  PelatihUser,
  SenimanUser,
  SanggarUser,
  SewaUser,
  MitraPengrajinUser,
  PemesananSewa,
  PemesananSewaStatus,
  PihakSewa,
  TandaTanganSewa,
  Invoice,
  Payment,
  Bast,
  Role,
  AkomodasiMode,
  KerjasamaSumber,
  KondisiPengembalianSewa,
} from "./types";
import { load, save, uid, logActivity, pushKas } from "./store";
import type { KatalogItem } from "./kerjasama";
import {
  getKatalogItem,
  validateBuktiPembayaran,
  validatePeriode,
} from "./kerjasama";
import {
  memerlukanPengembalianSewa,
  stokSetelahPengembalian,
} from "./sewa-return";

export { memerlukanPengembalianSewa } from "./sewa-return";

type Actor = { id: string; role: Role };

// Counter penomoran (in-memory; identik gaya dengan kerjasama.ts).
let counter = 1;
function genNomor(prefix: string) {
  const y = new Date().getFullYear();
  const seq = String(counter++).padStart(3, "0");
  return `${prefix}/${y}/${Date.now().toString().slice(-4)}${seq}`;
}

function isPositiveFinite(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function todayIsoLocal(): string {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

// ============= LABEL & UTIL =============

export const STATUS_PEMESANAN_LABEL: Record<PemesananSewaStatus, string> = {
  menunggu_sanggar: "Menunggu Sanggar",
  menunggu_sdm: "Menunggu Seniman/Pelatih",
  menunggu_ttd: "Menunggu Tanda Tangan",
  kontrak_aktif: "Kontrak Aktif",
  menunggu_bayar: "Menunggu Pembayaran",
  lunas: "Lunas — Menunggu Pelaksanaan/Penyerahan",
  sedang_disewa: "Sedang Disewa — Menunggu Pengembalian",
  menunggu_konfirmasi_pengembalian: "Pengembalian Menunggu Pemeriksaan",
  dikembalikan: "Pengembalian Diterima — Menunggu BAST",
  selesai: "Selesai",
  ditolak: "Ditolak",
  batal: "Dibatalkan",
};

export const STATUS_PEMESANAN_COLOR: Record<PemesananSewaStatus, string> = {
  menunggu_sanggar: "bg-amber-100 text-amber-800 border-amber-300",
  menunggu_sdm: "bg-orange-100 text-orange-800 border-orange-300",
  menunggu_ttd: "bg-lime-100 text-lime-800 border-lime-300",
  kontrak_aktif: "bg-green-100 text-green-800 border-green-300",
  menunggu_bayar: "bg-pink-100 text-pink-800 border-pink-300",
  lunas: "bg-emerald-100 text-emerald-800 border-emerald-300",
  sedang_disewa: "bg-sky-100 text-sky-800 border-sky-300",
  menunggu_konfirmasi_pengembalian:
    "bg-violet-100 text-violet-800 border-violet-300",
  dikembalikan: "bg-teal-100 text-teal-800 border-teal-300",
  selesai: "bg-emerald-200 text-emerald-900 border-emerald-400",
  ditolak: "bg-rose-100 text-rose-800 border-rose-300",
  batal: "bg-zinc-200 text-zinc-700 border-zinc-300",
};

export const AKOMODASI_LABEL: Record<AkomodasiMode, string> = {
  termasuk: "Termasuk akomodasi PP",
  diluar: "Di luar akomodasi PP",
};

export const KONDISI_PENGEMBALIAN_LABEL: Record<
  KondisiPengembalianSewa,
  string
> = {
  baik: "Baik dan lengkap",
  rusak_ringan: "Rusak ringan",
  rusak_berat: "Rusak berat",
};

export const MAX_BUKTI_SERAH_TERIMA_BYTES = 2 * 1024 * 1024;

function validateBuktiSerahTerima(
  dataUrl: string | undefined,
): string | undefined {
  if (!dataUrl) return undefined;
  return validateBuktiPembayaran(dataUrl)?.replace(
    /pembayaran/gi,
    "serah terima",
  );
}

// Pihak yang wajib ttd untuk satu pemesanan, sesuai kategori sumber.
export function pihakWajib(p: PemesananSewa): PihakSewa[] {
  const isSdm =
    p.sumberType === "sdm-pelatih" || p.sumberType === "sdm-seniman";
  const privatPelatih = p.penyediaRole === "pelatih";
  return isSdm && !privatPelatih
    ? ["sewa", "sanggar", "sdm"]
    : ["sewa", "sanggar"];
}

export function sudahTtd(p: PemesananSewa, pihak: PihakSewa): boolean {
  return p.ttd.some((t) => t.pihak === pihak);
}

export function semuaSudahTtd(p: PemesananSewa): boolean {
  return pihakWajib(p).every((pihak) => sudahTtd(p, pihak));
}

export function progressTtd(p: PemesananSewa): {
  selesai: number;
  total: number;
} {
  const wajib = pihakWajib(p);
  return {
    selesai: wajib.filter((pihak) => sudahTtd(p, pihak)).length,
    total: wajib.length,
  };
}

// Default akomodasi & biaya akomodasi dari item katalog.
export function defaultAkomodasi(item: KatalogItem): {
  mode: AkomodasiMode;
  biaya: number;
} {
  const db = load();
  let mode: AkomodasiMode = "diluar";
  let biaya = 0;
  if (item.sumberType === "sdm-pelatih") {
    const u = db.users.find((x) => x.id === item.sumberId) as
      | PelatihUser
      | undefined;
    if (u) {
      mode = u.akomodasiPP ?? "diluar";
      biaya = u.biayaAkomodasi ?? 0;
    }
  } else if (item.sumberType === "sdm-seniman") {
    const u = db.users.find((x) => x.id === item.sumberId) as
      | SenimanUser
      | undefined;
    if (u) {
      mode = u.akomodasiPP ?? "diluar";
      biaya = u.biayaAkomodasi ?? 0;
    }
  } else if (item.sumberType === "aset") {
    const a = db.aset.find((x) => x.id === item.sumberId);
    if (a) {
      mode = a.akomodasiPP ?? "diluar";
      biaya = a.biayaAkomodasi ?? 0;
    }
  } else if (item.sumberType === "sarpras") {
    // Tempat fisik biasanya tidak butuh akomodasi PP, tapi sanggar
    // tetap boleh menyetel default.
    const s = db.sarpras.find((x) => x.id === item.sumberId);
    if (s) {
      mode = s.akomodasiPP ?? "termasuk";
      biaya = s.biayaAkomodasi ?? 0;
    }
  }
  return { mode, biaya };
}

export function hitungTotal(input: {
  hargaDasar: number;
  jumlah: number;
  akomodasiPP: AkomodasiMode;
  biayaAkomodasi: number;
}): number {
  if (!Number.isFinite(input.hargaDasar) || !isPositiveFinite(input.jumlah))
    return 0;
  const subtotal = Math.max(0, input.hargaDasar) * input.jumlah;
  const tambahan =
    input.akomodasiPP === "termasuk" || !Number.isFinite(input.biayaAkomodasi)
      ? 0
      : Math.max(0, input.biayaAkomodasi);
  return subtotal + tambahan;
}

// ============= AUTHORIZATION =============

function isPenyedia(p: PemesananSewa, actor: Actor) {
  const role = p.penyediaRole ?? "sanggar";
  return actor.role === role && p.sanggarId === actor.id;
}
function isPenyewa(p: PemesananSewa, actor: Actor) {
  const pemesanRole = p.pemesanRole ?? "sewa";
  return actor.role === pemesanRole && p.sewaId === actor.id;
}
function isSdmTertugas(p: PemesananSewa, actor: Actor) {
  return (
    (actor.role === "pelatih" || actor.role === "seniman") &&
    p.sdmUserId === actor.id
  );
}
function isInvolved(p: PemesananSewa, actor: Actor) {
  if (actor.role === "kurator") return true;
  return isPenyedia(p, actor) || isPenyewa(p, actor) || isSdmTertugas(p, actor);
}

// ============= QUERY HELPERS =============

export function listPemesananForActor(actor: Actor): PemesananSewa[] {
  const db = load();
  return db.pemesananSewa.filter((p) => {
    if (actor.role === "kurator") return true;
    if (actor.role === "sewa" || actor.role === "mitra_pengrajin")
      return isPenyewa(p, actor);
    if (actor.role === "sanggar") return isPenyedia(p, actor);
    if (actor.role === "pelatih" && p.penyediaRole === "pelatih")
      return isPenyedia(p, actor);
    if (actor.role === "pelatih" || actor.role === "seniman")
      return p.sdmUserId === actor.id;
    return false;
  });
}

// ============= ACTIONS =============

export interface CreatePemesananInput {
  katalog: KatalogItem;
  sewaId: string;
  tanggalMulai: string;
  tanggalSelesai: string;
  lokasi: string;
  jumlah: number;
  catatan: string;
  akomodasiPP: AkomodasiMode;
  biayaAkomodasi: number;
  actor: Actor;
}

export function createPemesanan(input: CreatePemesananInput): {
  ok: boolean;
  reason?: string;
  pemesanan?: PemesananSewa;
} {
  if (
    (input.actor.role !== "sewa" && input.actor.role !== "mitra_pengrajin") ||
    input.actor.id !== input.sewaId
  ) {
    return {
      ok: false,
      reason: "Hanya Konsumen atau Mitra yang dapat membuat pesanan.",
    };
  }
  const db = load();
  const actorUser = db.users.find((u) => u.id === input.actor.id);
  if (
    !actorUser ||
    (actorUser.role !== "sewa" && actorUser.role !== "mitra_pengrajin")
  ) {
    return { ok: false, reason: "Akun Konsumen/Mitra tidak ditemukan." };
  }
  if (!isPositiveFinite(input.jumlah))
    return { ok: false, reason: "Jumlah tidak valid." };
  const periodeError = validatePeriode(
    input.tanggalMulai,
    input.tanggalSelesai,
  );
  if (periodeError) return { ok: false, reason: periodeError };
  if (input.tanggalMulai < todayIsoLocal()) {
    return {
      ok: false,
      reason: "Tanggal mulai tidak boleh berada di masa lalu.",
    };
  }
  if (!input.lokasi.trim())
    return { ok: false, reason: "Lokasi acara wajib diisi." };

  // Re-resolve katalog dari DB agar tidak terpengaruh snapshot lama / payload tampered.
  const fresh = getKatalogItem(input.katalog.id);
  if (!fresh) {
    return { ok: false, reason: "Item sudah tidak tersedia di katalog." };
  }
  // Pastikan identitas inti tidak berubah.
  if (
    fresh.sanggarId !== input.katalog.sanggarId ||
    fresh.sumberId !== input.katalog.sumberId ||
    fresh.sumberType !== input.katalog.sumberType ||
    fresh.kategori !== input.katalog.kategori
  ) {
    return {
      ok: false,
      reason: "Item katalog telah berubah, silakan muat ulang.",
    };
  }
  if (!Number.isFinite(fresh.hargaSewa) || fresh.hargaSewa < 0) {
    return { ok: false, reason: "Harga katalog tidak valid." };
  }
  if (memerlukanPengembalianSewa(fresh) && !Number.isInteger(input.jumlah)) {
    return {
      ok: false,
      reason: "Jumlah objek sewa harus berupa bilangan bulat.",
    };
  }
  if (fresh.sumberType === "aset") {
    const aset = db.aset.find((item) => item.id === fresh.sumberId);
    if (!aset || input.jumlah > aset.jumlahTersedia) {
      return {
        ok: false,
        reason: "Jumlah objek sewa melebihi stok yang tersedia.",
      };
    }
  }
  if (input.akomodasiPP !== "termasuk" && input.akomodasiPP !== "diluar") {
    return { ok: false, reason: "Pilihan akomodasi tidak valid." };
  }
  // Penyewa tidak boleh mengirim biaya akomodasi negatif/tidak terbatas.
  if (!Number.isFinite(input.biayaAkomodasi) || input.biayaAkomodasi < 0) {
    return { ok: false, reason: "Biaya akomodasi tidak valid." };
  }
  const biayaAkomodasi =
    input.akomodasiPP === "termasuk" ? 0 : input.biayaAkomodasi;

  const total = hitungTotal({
    hargaDasar: fresh.hargaSewa,
    jumlah: input.jumlah,
    akomodasiPP: input.akomodasiPP,
    biayaAkomodasi,
  });

  // Untuk sumber SDM, kalau item katalog spesifik ke seseorang
  // (sumberType "sdm-pelatih"/"sdm-seniman"), assign langsung.
  let sdmUserId: string | undefined;
  if (
    fresh.penyediaRole !== "pelatih" &&
    (fresh.sumberType === "sdm-pelatih" || fresh.sumberType === "sdm-seniman")
  ) {
    sdmUserId = fresh.sumberId;
  }

  const p: PemesananSewa = {
    id: uid(),
    nomor: genNomor("SEWA"),
    katalogItemId: fresh.id,
    sumberType: fresh.sumberType as KerjasamaSumber,
    sumberId: fresh.sumberId,
    sewaId: input.sewaId,
    pemesanRole: input.actor.role,
    tujuanTransaksi:
      input.actor.role === "mitra_pengrajin"
        ? "dijual_kembali"
        : "penggunaan_sendiri",
    sanggarId: fresh.sanggarId,
    penyediaRole: fresh.penyediaRole ?? "sanggar",
    sdmUserId,
    judul: fresh.judul,
    kategori: fresh.kategori,
    tanggalMulai: input.tanggalMulai,
    tanggalSelesai: input.tanggalSelesai,
    lokasi: input.lokasi.trim(),
    jumlah: input.jumlah,
    satuanHarga: fresh.satuanHarga,
    catatan: input.catatan.trim(),
    hargaDasar: fresh.hargaSewa,
    akomodasiPP: input.akomodasiPP,
    biayaAkomodasi,
    nilaiTotal: total,
    status: "menunggu_sanggar",
    ttd: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  save((db) => {
    db.pemesananSewa.unshift(p);
  });
  logActivity(input.actor.id, input.actor.role, "pemesanan-create", {
    nomor: p.nomor,
  });
  return { ok: true, pemesanan: p };
}

// Sanggar: tolak pesanan.
export function tolakPemesanan(
  id: string,
  alasan: string,
  actor: Actor,
): { ok: boolean; reason?: string } {
  const alasanBersih = alasan.trim();
  if (!alasanBersih)
    return { ok: false, reason: "Alasan penolakan wajib diisi." };
  let result: { ok: boolean; reason?: string } = { ok: false };
  save((db) => {
    const p = db.pemesananSewa.find((x) => x.id === id);
    if (!p) {
      result = { ok: false, reason: "Pesanan tidak ditemukan." };
      return;
    }
    if (!isPenyedia(p, actor)) {
      result = {
        ok: false,
        reason: "Hanya sanggar penyedia yang dapat menolak.",
      };
      return;
    }
    if (!["menunggu_sanggar", "menunggu_sdm"].includes(p.status)) {
      result = { ok: false, reason: "Status saat ini tidak bisa ditolak." };
      return;
    }
    p.status = "ditolak";
    p.alasanTolak = alasanBersih;
    p.updatedAt = Date.now();
    result = { ok: true };
  });
  if (result.ok) logActivity(actor.id, actor.role, "pemesanan-tolak", { id });
  return result;
}

// Penyewa: batalkan pesanan (selama belum jalan).
export function batalkanPemesanan(
  id: string,
  actor: Actor,
): { ok: boolean; reason?: string } {
  let result: { ok: boolean; reason?: string } = { ok: false };
  let catatanPembatalan: Record<string, unknown> | undefined;
  save((db) => {
    const index = db.pemesananSewa.findIndex((x) => x.id === id);
    const p = index >= 0 ? db.pemesananSewa[index] : undefined;
    if (!p) {
      result = { ok: false, reason: "Pesanan tidak ditemukan." };
      return;
    }
    if (!isPenyewa(p, actor)) {
      result = { ok: false, reason: "Hanya penyewa yang dapat membatalkan." };
      return;
    }
    // Hanya boleh batal sebelum kontrak aktif / invoice terbit.
    const bolehBatal: PemesananSewa["status"][] = [
      "menunggu_sanggar",
      "menunggu_sdm",
      "menunggu_ttd",
    ];
    if (!bolehBatal.includes(p.status)) {
      result = {
        ok: false,
        reason:
          "Pesanan tidak bisa dibatalkan setelah kontrak aktif. Silakan koordinasi dengan sanggar.",
      };
      return;
    }
    catatanPembatalan = {
      id: p.id,
      nomor: p.nomor,
      judul: p.judul,
      nilaiTotal: p.nilaiTotal,
      pihakTerkait: [p.sewaId, p.sanggarId, p.sdmUserId].filter(Boolean),
    };
    db.pemesananSewa.splice(index, 1);
    result = { ok: true };
  });
  if (result.ok) {
    logActivity(
      actor.id,
      actor.role,
      "pemesanan-batal-hapus",
      catatanPembatalan,
    );
  }
  return result;
}

// Sanggar: terima pesanan. Untuk SDM yg belum ada sdmUserId (jarang),
// bisa pass `assignSdmUserId` untuk menugaskan seniman/pelatih spesifik.
export function terimaPemesanan(input: {
  id: string;
  assignSdmUserId?: string;
  actor: Actor;
}): { ok: boolean; reason?: string } {
  let result: { ok: boolean; reason?: string } = { ok: false };
  save((db) => {
    const p = db.pemesananSewa.find((x) => x.id === input.id);
    if (!p) {
      result = { ok: false, reason: "Pesanan tidak ditemukan." };
      return;
    }
    if (!isPenyedia(p, input.actor)) {
      result = {
        ok: false,
        reason: "Hanya sanggar penyedia yang dapat menerima.",
      };
      return;
    }
    if (p.status !== "menunggu_sanggar") {
      result = { ok: false, reason: "Pesanan sudah diproses." };
      return;
    }
    const isSdm =
      p.penyediaRole !== "pelatih" &&
      (p.sumberType === "sdm-pelatih" || p.sumberType === "sdm-seniman");
    if (isSdm) {
      const target = input.assignSdmUserId ?? p.sdmUserId;
      if (!target) {
        result = {
          ok: false,
          reason: "Seniman/pelatih wajib ditugaskan terlebih dahulu.",
        };
        return;
      }
      // Validasi bahwa target benar-benar anggota sanggar ini.
      const u = db.users.find((x) => x.id === target);
      if (!u) {
        result = { ok: false, reason: "SDM tidak ditemukan." };
        return;
      }
      if (u.role !== "pelatih" && u.role !== "seniman") {
        result = {
          ok: false,
          reason: "Hanya pelatih/seniman yang dapat ditugaskan.",
        };
        return;
      }
      const member = u as PelatihUser | SenimanUser;
      if (member.sanggarId !== p.sanggarId) {
        result = { ok: false, reason: "SDM bukan anggota sanggar ini." };
        return;
      }
      const expectedRole =
        p.sumberType === "sdm-pelatih" ? "pelatih" : "seniman";
      if (member.role !== expectedRole) {
        result = {
          ok: false,
          reason: `Pesanan ini membutuhkan ${expectedRole}.`,
        };
        return;
      }
      if (member.status !== "aktif") {
        result = { ok: false, reason: "SDM yang dipilih sedang tidak aktif." };
        return;
      }
      if (
        p.sdmUserId &&
        input.assignSdmUserId &&
        p.sdmUserId !== input.assignSdmUserId
      ) {
        result = {
          ok: false,
          reason: "SDM pada item katalog tidak boleh diganti.",
        };
        return;
      }
      p.sdmUserId = target;
      p.status = "menunggu_sdm";
    } else {
      // Bukan SDM -> langsung lompat ke menunggu_ttd (penyewa & sanggar).
      p.status = "menunggu_ttd";
    }
    p.updatedAt = Date.now();
    result = { ok: true };
  });
  if (result.ok)
    logActivity(input.actor.id, input.actor.role, "pemesanan-terima", {
      id: input.id,
    });
  return result;
}

// Seniman/Pelatih: konfirmasi penugasan.
export function konfirmasiSdm(
  id: string,
  terima: boolean,
  alasan: string | undefined,
  actor: Actor,
): { ok: boolean; reason?: string } {
  const alasanBersih = alasan?.trim();
  if (!terima && !alasanBersih)
    return { ok: false, reason: "Alasan penolakan wajib diisi." };
  let result: { ok: boolean; reason?: string } = { ok: false };
  save((db) => {
    const p = db.pemesananSewa.find((x) => x.id === id);
    if (!p) {
      result = { ok: false, reason: "Pesanan tidak ditemukan." };
      return;
    }
    if (!isSdmTertugas(p, actor)) {
      result = {
        ok: false,
        reason: "Anda bukan SDM yang ditugaskan untuk pesanan ini.",
      };
      return;
    }
    if (p.status !== "menunggu_sdm") {
      result = {
        ok: false,
        reason: "Status pesanan tidak menunggu konfirmasi SDM.",
      };
      return;
    }
    if (terima) {
      p.status = "menunggu_ttd";
    } else {
      p.status = "ditolak";
      p.alasanTolak = alasanBersih!;
    }
    p.updatedAt = Date.now();
    result = { ok: true };
  });
  if (result.ok)
    logActivity(actor.id, actor.role, "pemesanan-sdm-konfirm", { id, terima });
  return result;
}

// Tanda tangan ("Setuju") salah satu pihak.
export function tandaTangan(input: { id: string; actor: Actor }): {
  ok: boolean;
  reason?: string;
  semuaTtd?: boolean;
} {
  let result: { ok: boolean; reason?: string; semuaTtd?: boolean } = {
    ok: false,
  };
  save((db) => {
    const p = db.pemesananSewa.find((x) => x.id === input.id);
    if (!p) {
      result = { ok: false, reason: "Pesanan tidak ditemukan." };
      return;
    }
    if (p.status !== "menunggu_ttd") {
      result = { ok: false, reason: "Belum siap ditandatangani." };
      return;
    }
    let pihak: PihakSewa | null = null;
    let nama = "";
    if (isPenyewa(p, input.actor)) {
      pihak = "sewa";
      const u = db.users.find((x) => x.id === input.actor.id) as
        | SewaUser
        | MitraPengrajinUser
        | undefined;
      nama = u
        ? u.role === "mitra_pengrajin"
          ? u.namaUsaha
          : u.nama
        : "Pemesan";
    } else if (isPenyedia(p, input.actor)) {
      pihak = "sanggar";
      const u = db.users.find((x) => x.id === input.actor.id) as
        | SanggarUser
        | PelatihUser
        | undefined;
      nama = u ? (u.role === "pelatih" ? u.nama : u.namaSanggar) : "Penyedia";
    } else if (isSdmTertugas(p, input.actor)) {
      pihak = "sdm";
      const u = db.users.find((x) => x.id === input.actor.id) as
        | PelatihUser
        | SenimanUser
        | undefined;
      nama = u?.nama ?? "Seniman/Pelatih";
    }
    if (!pihak) {
      result = {
        ok: false,
        reason: "Anda bukan pihak yang berwenang menandatangani.",
      };
      return;
    }
    // Pihak SDM tidak boleh ttd untuk pesanan non-SDM.
    if (pihak === "sdm" && !pihakWajib(p).includes("sdm")) {
      result = { ok: false, reason: "Pesanan ini tidak melibatkan SDM." };
      return;
    }
    if (sudahTtd(p, pihak)) {
      result = { ok: false, reason: "Anda sudah menandatangani." };
      return;
    }
    const t: TandaTanganSewa = {
      pihak,
      userId: input.actor.id,
      nama,
      ts: Date.now(),
    };
    p.ttd.push(t);
    // Auto-promote ke kontrak_aktif kalau semua pihak sudah TTD.
    const lengkap = pihakWajib(p).every((pi) =>
      p.ttd.some((x) => x.pihak === pi),
    );
    if (lengkap) {
      p.status = "kontrak_aktif";
      if (!db.contracts.some((c) => c.kerjasamaId === p.id)) {
        db.contracts.unshift({
          id: uid(),
          kerjasamaId: p.id,
          nomor: genNomor("KTR"),
          createdAt: Date.now(),
        });
      }
    }
    p.updatedAt = Date.now();
    result = { ok: true, semuaTtd: lengkap };
  });
  if (result.ok)
    logActivity(input.actor.id, input.actor.role, "pemesanan-ttd", {
      id: input.id,
    });
  return result;
}

// Sanggar: terbitkan invoice (setelah kontrak aktif).
export function terbitkanInvoice(
  id: string,
  dueDays: number,
  actor: Actor,
): { ok: boolean; reason?: string; invoice?: Invoice } {
  let result: { ok: boolean; reason?: string; invoice?: Invoice } = {
    ok: false,
  };
  save((db) => {
    const p = db.pemesananSewa.find((x) => x.id === id);
    if (!p) {
      result = { ok: false, reason: "Pesanan tidak ditemukan." };
      return;
    }
    if (!isPenyedia(p, actor)) {
      result = {
        ok: false,
        reason: "Hanya sanggar penyedia yang dapat menerbitkan invoice.",
      };
      return;
    }
    if (p.status !== "kontrak_aktif") {
      result = { ok: false, reason: "Kontrak belum aktif." };
      return;
    }
    if (p.invoiceId) {
      result = { ok: false, reason: "Invoice sudah pernah diterbitkan." };
      return;
    }
    if (!Number.isInteger(dueDays) || dueDays < 1 || dueDays > 365) {
      result = { ok: false, reason: "Tenggat pembayaran harus 1–365 hari." };
      return;
    }
    if (!Number.isFinite(p.nilaiTotal) || p.nilaiTotal < 0) {
      result = { ok: false, reason: "Nilai pesanan tidak valid." };
      return;
    }
    if (!db.contracts.some((c) => c.kerjasamaId === p.id)) {
      db.contracts.unshift({
        id: uid(),
        kerjasamaId: p.id,
        nomor: genNomor("KTR"),
        createdAt: Date.now(),
      });
    }
    const inv: Invoice = {
      id: uid(),
      // Re-use Invoice; field "kerjasamaId" kita pakai untuk menyimpan
      // pemesananSewa.id (skema generik 1 invoice per pesanan).
      kerjasamaId: p.id,
      nomor: genNomor("INV"),
      total: p.nilaiTotal,
      status: "terhutang",
      batasPembayaran: Date.now() + Math.max(1, dueDays) * 86400000,
      createdAt: Date.now(),
    };
    db.invoices.unshift(inv);
    p.invoiceId = inv.id;
    p.status = "menunggu_bayar";
    p.updatedAt = Date.now();
    result = { ok: true, invoice: inv };
  });
  if (result.ok) logActivity(actor.id, actor.role, "pemesanan-invoice", { id });
  return result;
}

// Penyewa: upload bukti pembayaran.
export function uploadBuktiBayar(input: {
  pemesananId: string;
  nominal: number;
  tanggalBayar: number;
  buktiDataUrl?: string;
  actor: Actor;
}): { ok: boolean; reason?: string; payment?: Payment } {
  let result: { ok: boolean; reason?: string; payment?: Payment } = {
    ok: false,
  };
  save((db) => {
    const p = db.pemesananSewa.find((x) => x.id === input.pemesananId);
    if (!p) {
      result = { ok: false, reason: "Pesanan tidak ditemukan." };
      return;
    }
    if (!isPenyewa(p, input.actor)) {
      result = {
        ok: false,
        reason: "Hanya penyewa yang dapat mengirim bukti bayar.",
      };
      return;
    }
    if (p.status !== "menunggu_bayar" || !p.invoiceId) {
      result = { ok: false, reason: "Belum siap pembayaran." };
      return;
    }
    const inv = db.invoices.find((i) => i.id === p.invoiceId);
    if (!inv) {
      result = { ok: false, reason: "Invoice tidak ditemukan." };
      return;
    }
    if (inv.status === "lunas") {
      result = { ok: false, reason: "Invoice sudah lunas." };
      return;
    }
    if (!isPositiveFinite(input.nominal)) {
      result = { ok: false, reason: "Nominal tidak valid." };
      return;
    }
    if (!Number.isFinite(input.tanggalBayar) || input.tanggalBayar <= 0) {
      result = { ok: false, reason: "Tanggal bayar tidak valid." };
      return;
    }
    const buktiError = validateBuktiPembayaran(input.buktiDataUrl);
    if (buktiError) {
      result = { ok: false, reason: buktiError };
      return;
    }
    if (
      db.payments.some(
        (x) =>
          x.invoiceId === inv.id &&
          (x.status === "menunggu" || x.status === "disetujui"),
      )
    ) {
      result = {
        ok: false,
        reason: "Sudah ada bukti bayar yang menunggu/disetujui.",
      };
      return;
    }
    const pay: Payment = {
      id: uid(),
      invoiceId: inv.id,
      nominal: input.nominal,
      tanggalBayar: input.tanggalBayar,
      buktiDataUrl: input.buktiDataUrl,
      status: "menunggu",
      createdAt: Date.now(),
    };
    db.payments.unshift(pay);
    result = { ok: true, payment: pay };
  });
  if (result.ok)
    logActivity(input.actor.id, input.actor.role, "pemesanan-bayar", {
      id: input.pemesananId,
    });
  return result;
}

// Sanggar: verifikasi pembayaran.
export function verifikasiPembayaran(input: {
  pemesananId: string;
  paymentId: string;
  terima: boolean;
  catatan?: string;
  actor: Actor;
}): { ok: boolean; reason?: string } {
  let result: { ok: boolean; reason?: string } = { ok: false };
  let kasInfo: {
    sanggarId: string;
    sewaId: string;
    total: number;
    nomor: string;
    pemesananId: string;
  } | null = null;
  save((db) => {
    const p = db.pemesananSewa.find((x) => x.id === input.pemesananId);
    if (!p) {
      result = { ok: false, reason: "Pesanan tidak ditemukan." };
      return;
    }
    if (!isPenyedia(p, input.actor)) {
      result = {
        ok: false,
        reason: "Hanya sanggar penyedia yang dapat memverifikasi.",
      };
      return;
    }
    if (p.status !== "menunggu_bayar") {
      result = { ok: false, reason: "Pesanan tidak lagi menunggu pembayaran." };
      return;
    }
    const pay = db.payments.find((x) => x.id === input.paymentId);
    if (!pay) {
      result = { ok: false, reason: "Pembayaran tidak ditemukan." };
      return;
    }
    if (pay.status !== "menunggu") {
      result = { ok: false, reason: "Pembayaran sudah diproses." };
      return;
    }
    const inv = db.invoices.find((i) => i.id === pay.invoiceId);
    if (!inv || inv.id !== p.invoiceId) {
      result = { ok: false, reason: "Invoice tidak cocok." };
      return;
    }
    if (inv.status !== "terhutang") {
      result = { ok: false, reason: "Invoice tidak lagi menunggu verifikasi." };
      return;
    }
    if (input.terima && pay.nominal < inv.total) {
      result = {
        ok: false,
        reason: `Nominal kurang (Rp${pay.nominal} < Rp${inv.total}).`,
      };
      return;
    }
    pay.status = input.terima ? "disetujui" : "ditolak";
    pay.catatanVerifikator = input.catatan;
    if (input.terima) {
      inv.status = "lunas";
      p.status = "lunas";
      p.updatedAt = Date.now();
      if ((p.penyediaRole ?? "sanggar") === "sanggar") {
        kasInfo = {
          sanggarId: p.sanggarId,
          sewaId: p.sewaId,
          total: inv.total,
          nomor: p.nomor,
          pemesananId: p.id,
        };
      }
    }
    result = { ok: true };
  });
  const ki = kasInfo as {
    sanggarId: string;
    sewaId: string;
    total: number;
    nomor: string;
    pemesananId: string;
  } | null;
  if (ki) {
    pushKas(
      ki.sanggarId,
      `Pembayaran sewa ${ki.nomor}`,
      ki.total,
      0,
      "pemesanan-in",
      ki.pemesananId,
    );
  }
  if (result.ok)
    logActivity(input.actor.id, input.actor.role, "pemesanan-verifikasi", {
      id: input.pemesananId,
      terima: input.terima,
    });
  return result;
}

// Penyedia: catat penyerahan barang atau akses tempat setelah pembayaran lunas.
export function konfirmasiPenyerahanSewa(input: {
  pemesananId: string;
  catatan: string;
  buktiDataUrl?: string;
  actor: Actor;
}): { ok: boolean; reason?: string } {
  const catatan = input.catatan.trim();
  if (!catatan) {
    return { ok: false, reason: "Catatan penyerahan wajib diisi." };
  }
  const buktiError = validateBuktiSerahTerima(input.buktiDataUrl);
  if (buktiError) return { ok: false, reason: buktiError };

  let result: { ok: boolean; reason?: string } = { ok: false };
  save((db) => {
    const p = db.pemesananSewa.find((item) => item.id === input.pemesananId);
    if (!p) {
      result = { ok: false, reason: "Pesanan tidak ditemukan." };
      return;
    }
    if (!isPenyedia(p, input.actor)) {
      result = {
        ok: false,
        reason: "Hanya penyedia yang dapat mengonfirmasi penyerahan.",
      };
      return;
    }
    if (!memerlukanPengembalianSewa(p)) {
      result = { ok: false, reason: "Pesanan ini bukan objek sewa." };
      return;
    }
    if (p.status !== "lunas") {
      result = {
        ok: false,
        reason: "Objek hanya dapat diserahkan setelah pembayaran lunas.",
      };
      return;
    }
    if (p.penyerahanSewa) {
      result = { ok: false, reason: "Penyerahan sudah pernah dicatat." };
      return;
    }
    if (p.sumberType === "aset") {
      const aset = db.aset.find((item) => item.id === p.sumberId);
      if (!aset || aset.jumlahTersedia < p.jumlah) {
        result = {
          ok: false,
          reason: "Stok tersedia tidak mencukupi untuk penyerahan ini.",
        };
        return;
      }
      aset.jumlahTersedia -= p.jumlah;
    }
    p.penyerahanSewa = {
      diserahkanAt: Date.now(),
      diserahkanOlehId: input.actor.id,
      catatan,
      buktiDataUrl: input.buktiDataUrl,
    };
    p.status = "sedang_disewa";
    p.updatedAt = Date.now();
    result = { ok: true };
  });
  if (result.ok) {
    logActivity(input.actor.id, input.actor.role, "pemesanan-penyerahan", {
      id: input.pemesananId,
    });
  }
  return result;
}

// Penyewa: menyatakan barang telah dikembalikan atau pemakaian tempat selesai.
export function ajukanPengembalianSewa(input: {
  pemesananId: string;
  catatan: string;
  buktiDataUrl?: string;
  actor: Actor;
}): { ok: boolean; reason?: string } {
  const catatan = input.catatan.trim();
  if (!catatan) {
    return { ok: false, reason: "Catatan pengembalian wajib diisi." };
  }
  const buktiError = validateBuktiSerahTerima(input.buktiDataUrl);
  if (buktiError) return { ok: false, reason: buktiError };

  let result: { ok: boolean; reason?: string } = { ok: false };
  save((db) => {
    const p = db.pemesananSewa.find((item) => item.id === input.pemesananId);
    if (!p) {
      result = { ok: false, reason: "Pesanan tidak ditemukan." };
      return;
    }
    if (!isPenyewa(p, input.actor)) {
      result = {
        ok: false,
        reason: "Hanya penyewa yang dapat mengajukan pengembalian.",
      };
      return;
    }
    if (!memerlukanPengembalianSewa(p) || p.status !== "sedang_disewa") {
      result = {
        ok: false,
        reason: "Pesanan belum berada pada tahap pengembalian.",
      };
      return;
    }
    p.pengembalianSewa = {
      status: "diajukan",
      diajukanAt: Date.now(),
      diajukanOlehId: input.actor.id,
      catatanPenyewa: catatan,
      buktiDataUrl: input.buktiDataUrl,
    };
    p.status = "menunggu_konfirmasi_pengembalian";
    p.updatedAt = Date.now();
    result = { ok: true };
  });
  if (result.ok) {
    logActivity(input.actor.id, input.actor.role, "pemesanan-pengembalian", {
      id: input.pemesananId,
    });
  }
  return result;
}

// Penyedia: terima pengembalian atau kembalikan ke penyewa untuk tindak lanjut.
export function verifikasiPengembalianSewa(input: {
  pemesananId: string;
  terima: boolean;
  kondisi?: KondisiPengembalianSewa;
  catatan?: string;
  actor: Actor;
}): { ok: boolean; reason?: string } {
  const catatan = input.catatan?.trim();
  if (!input.terima && !catatan) {
    return {
      ok: false,
      reason: "Alasan tindak lanjut pengembalian wajib diisi.",
    };
  }
  if (input.terima && !input.kondisi) {
    return { ok: false, reason: "Kondisi objek saat kembali wajib dipilih." };
  }

  let result: { ok: boolean; reason?: string } = { ok: false };
  save((db) => {
    const p = db.pemesananSewa.find((item) => item.id === input.pemesananId);
    if (!p) {
      result = { ok: false, reason: "Pesanan tidak ditemukan." };
      return;
    }
    if (!isPenyedia(p, input.actor)) {
      result = {
        ok: false,
        reason: "Hanya penyedia yang dapat memeriksa pengembalian.",
      };
      return;
    }
    if (
      p.status !== "menunggu_konfirmasi_pengembalian" ||
      p.pengembalianSewa?.status !== "diajukan"
    ) {
      result = {
        ok: false,
        reason: "Belum ada pengembalian yang menunggu pemeriksaan.",
      };
      return;
    }

    p.pengembalianSewa = {
      ...p.pengembalianSewa,
      status: input.terima ? "diterima" : "perlu_tindak_lanjut",
      diperiksaAt: Date.now(),
      diperiksaOlehId: input.actor.id,
      kondisi: input.terima ? input.kondisi : undefined,
      catatanPenyedia: catatan,
    };
    if (input.terima) {
      if (p.sumberType === "aset" && input.kondisi === "baik") {
        const aset = db.aset.find((item) => item.id === p.sumberId);
        if (aset) {
          aset.jumlahTersedia = stokSetelahPengembalian({
            tersedia: aset.jumlahTersedia,
            total: aset.jumlahTotal,
            jumlahDikembalikan: p.jumlah,
            kondisi: input.kondisi,
          });
        }
      }
      p.status = "dikembalikan";
    } else {
      p.status = "sedang_disewa";
    }
    p.updatedAt = Date.now();
    result = { ok: true };
  });
  if (result.ok) {
    logActivity(
      input.actor.id,
      input.actor.role,
      "pemesanan-verifikasi-pengembalian",
      { id: input.pemesananId, terima: input.terima },
    );
  }
  return result;
}

// Sanggar: finalisasi BAST -> selesai.
export function finalkanBast(
  id: string,
  actor: Actor,
): { ok: boolean; reason?: string; bast?: Bast } {
  let result: { ok: boolean; reason?: string; bast?: Bast } = { ok: false };
  save((db) => {
    const p = db.pemesananSewa.find((x) => x.id === id);
    if (!p) {
      result = { ok: false, reason: "Pesanan tidak ditemukan." };
      return;
    }
    if (!isPenyedia(p, actor)) {
      result = {
        ok: false,
        reason: "Hanya sanggar penyedia yang dapat memfinalkan BAST.",
      };
      return;
    }
    const perluPengembalian = memerlukanPengembalianSewa(p);
    const statusSiapFinal = perluPengembalian
      ? p.status === "dikembalikan"
      : p.status === "lunas";
    if (!statusSiapFinal) {
      result = {
        ok: false,
        reason: perluPengembalian
          ? "BAST hanya dapat difinalkan setelah pengembalian diterima penyedia."
          : "Status pesanan belum lunas.",
      };
      return;
    }
    if (!perluPengembalian && p.tanggalSelesai > todayIsoLocal()) {
      result = {
        ok: false,
        reason: "BAST baru dapat difinalkan setelah periode kegiatan selesai.",
      };
      return;
    }
    let bast = p.bastId ? db.bast.find((b) => b.id === p.bastId) : undefined;
    if (!bast) {
      bast = {
        id: uid(),
        kerjasamaId: p.id,
        nomor: genNomor("BAST"),
        status: "final",
        createdAt: Date.now(),
        finalAt: Date.now(),
      };
      db.bast.unshift(bast);
      p.bastId = bast.id;
    } else {
      bast.status = "final";
      bast.finalAt = Date.now();
    }
    p.status = "selesai";
    p.updatedAt = Date.now();
    result = { ok: true, bast };
  });
  if (result.ok) logActivity(actor.id, actor.role, "pemesanan-bast", { id });
  return result;
}

// Lookup nama pihak (untuk UI kontrak).
export function namaPihak(p: PemesananSewa, pihak: PihakSewa): string {
  const db = load();
  if (pihak === "sewa") {
    const u = db.users.find((x) => x.id === p.sewaId) as
      | SewaUser
      | MitraPengrajinUser
      | undefined;
    if (!u) return "Pemesan";
    return u.role === "mitra_pengrajin" ? u.namaUsaha : u.nama;
  }
  if (pihak === "sanggar") {
    const u = db.users.find((x) => x.id === p.sanggarId) as
      | SanggarUser
      | PelatihUser
      | undefined;
    if (!u) return "Penyedia";
    return u.role === "pelatih" ? u.nama : u.namaSanggar;
  }
  if (pihak === "sdm") {
    if (!p.sdmUserId) return "Belum ditugaskan";
    const u = db.users.find((x) => x.id === p.sdmUserId) as
      | PelatihUser
      | SenimanUser
      | undefined;
    return u?.nama ?? "Seniman/Pelatih";
  }
  return "-";
}

// Lookup user record yang memesan / penyedia / SDM.
export function pihakUser(
  p: PemesananSewa,
  pihak: PihakSewa,
): AnyUser | undefined {
  const db = load();
  if (pihak === "sewa") return db.users.find((x) => x.id === p.sewaId);
  if (pihak === "sanggar") return db.users.find((x) => x.id === p.sanggarId);
  if (pihak === "sdm" && p.sdmUserId)
    return db.users.find((x) => x.id === p.sdmUserId);
  return undefined;
}
