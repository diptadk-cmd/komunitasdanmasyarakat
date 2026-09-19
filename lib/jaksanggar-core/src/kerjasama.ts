import type {
  AnyUser,
  SanggarUser,
  PelatihUser,
  SenimanUser,
  Aset,
  Sarpras,
  Kerjasama,
  KerjasamaKategori,
  KerjasamaSumber,
  KerjasamaStatus,
  SatuanHarga,
  Role,
  Invoice,
  Payment,
  Bast,
  JenisKesenian,
  AkomodasiMode,
  PengrajinUser,
  ProdukKerajinan,
  JenisKerajinan,
} from "./types";
import { load, save, uid, logActivity, pushKas } from "./store";

export interface KatalogItem {
  id: string;
  sumberType: KerjasamaSumber;
  sumberId: string;
  sanggarId: string;
  penyediaRole?: "sanggar" | "pelatih";
  sanggarNama: string;
  // Alamat & koordinat sanggar pemilik — otomatis ikut ke setiap item katalog
  // agar penyewa bisa melihat lokasi & membuka Google Maps.
  sanggarAlamat: string;
  lat?: number;
  lng?: number;
  kategori: KerjasamaKategori;
  judul: string;
  deskripsi: string;
  hargaSewa: number;
  satuanHarga: SatuanHarga;
  fotoDataUrl?: string;
  // Jenis kesenian terkait (untuk filter di katalog layanan).
  // - SDM: jenisKesenian milik orang itu (1 nilai)
  // - Aset / Sarpras: ambil dari sanggar pemilik (bisa beberapa)
  jenisKesenian: JenisKesenian[];
  // Nama orang untuk SDM (untuk filter "nama seniman / pelatih").
  namaSdm?: string;
  // Akomodasi PP default dari sumber. Penyewa boleh override saat pesan.
  akomodasiPP: AkomodasiMode;
  biayaAkomodasi: number;
}

const ROLE_TO_HONOR_LABEL: Record<string, number> = {
  pelatih: 250_000,
  seniman: 150_000,
};

export const MAX_BUKTI_PEMBAYARAN_BYTES = 2 * 1024 * 1024;

export function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return (
    Number.isFinite(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

export interface KatalogPengrajinItem {
  id: string;
  pengrajinId: string;
  publicId: string;
  namaUsaha: string;
  bentukUsaha: PengrajinUser["bentukUsaha"];
  alamat: string;
  lat?: number;
  lng?: number;
  noHp?: string;
  email?: string;
  jenisKerajinan: JenisKerajinan;
  produk: ProdukKerajinan;
}

/**
 * Katalog lintas modul untuk produk Pengrajin. Hanya toko aktif dan produk
 * berstatus tayang yang disertakan; setiap kanal tetap mengikuti izin pemilik.
 */
export function buildKatalogPengrajin(
  kanal: "sewa" | "kerjasama" | "publik",
): KatalogPengrajinItem[] {
  const items: KatalogPengrajinItem[] = [];
  for (const user of load().users) {
    if (user.role !== "pengrajin") continue;
    const pengrajin = user as PengrajinUser;
    if (pengrajin.tokoDipublikasikan === false) continue;
    if (kanal === "sewa" && !pengrajin.menerimaSewaJasa) continue;
    if (kanal === "kerjasama" && !pengrajin.menerimaKerjasama) continue;
    for (const produk of pengrajin.produk ?? []) {
      if (produk.khasJakarta !== true || !produk.statusPublish) continue;
      if (kanal === "sewa" && !produk.tersediaSewaJasa) continue;
      if (kanal === "kerjasama" && !produk.terbukaKerjasama) continue;
      items.push({
        id: `pengrajin-${pengrajin.id}-${produk.id}`,
        pengrajinId: pengrajin.id,
        publicId: pengrajin.apiId ?? pengrajin.id,
        namaUsaha: pengrajin.namaUsaha,
        bentukUsaha: pengrajin.bentukUsaha ?? "Perorangan",
        alamat: pengrajin.alamat,
        lat: pengrajin.lat,
        lng: pengrajin.lng,
        noHp: pengrajin.noHp,
        email: pengrajin.email,
        jenisKerajinan: produk.kategori,
        produk,
      });
    }
  }
  return items;
}

export function validatePeriode(
  tanggalMulai: string,
  tanggalSelesai: string,
): string | undefined {
  if (!isValidIsoDate(tanggalMulai) || !isValidIsoDate(tanggalSelesai)) {
    return "Tanggal wajib diisi dengan format yang valid.";
  }
  if (tanggalMulai > tanggalSelesai) {
    return "Tanggal mulai tidak boleh setelah tanggal selesai.";
  }
  return undefined;
}

export function validateBuktiPembayaran(
  dataUrl: string | undefined,
): string | undefined {
  if (!dataUrl) return "Bukti pembayaran wajib diunggah.";
  const match =
    /^data:image\/(png|jpe?g|webp);base64,([A-Za-z0-9+/]+={0,2})$/i.exec(
      dataUrl,
    );
  if (!match)
    return "Bukti pembayaran harus berupa gambar JPG, PNG, atau WebP.";
  const payload = match[2];
  const padding = payload.endsWith("==") ? 2 : payload.endsWith("=") ? 1 : 0;
  const decodedBytes = Math.floor((payload.length * 3) / 4) - padding;
  if (decodedBytes > MAX_BUKTI_PEMBAYARAN_BYTES) {
    return "Ukuran bukti pembayaran maksimal 2 MB.";
  }
  return undefined;
}

function isPositiveFinite(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function todayIsoLocal(): string {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

// ============= AUTHORIZATION =============
type Actor = { id: string; role: Role };

const TRANSITIONS: Record<KerjasamaStatus, KerjasamaStatus[]> = {
  menunggu: ["diterima", "ditolak", "negosiasi", "batal"],
  // Kesepakatan dari fase negosiasi wajib melalui applyNegosiasi agar tawaran
  // yang diterima tercatat dan tawaran lain ditutup secara konsisten.
  negosiasi: ["ditolak", "batal"],
  diterima: ["berjalan", "batal"],
  berjalan: ["selesai", "batal"],
  selesai: [],
  ditolak: [],
  batal: [],
};

function isInvolved(k: Kerjasama, actor: Actor): boolean {
  if (actor.role === "kurator") return true;
  if (actor.role !== "sanggar") return false;
  return k.sanggarPenyediaId === actor.id || k.sanggarPeminjamId === actor.id;
}
function isPenyedia(k: Kerjasama, actor: Actor): boolean {
  return actor.role === "sanggar" && k.sanggarPenyediaId === actor.id;
}
function isPeminjam(k: Kerjasama, actor: Actor): boolean {
  return actor.role === "sanggar" && k.sanggarPeminjamId === actor.id;
}

export function buildKatalog(): KatalogItem[] {
  const db = load();
  const sanggarById = new Map<string, SanggarUser>();
  for (const u of db.users) {
    if (u.role === "sanggar") sanggarById.set(u.id, u as SanggarUser);
  }
  const items: KatalogItem[] = [];

  // SDM Sanggar serta kelas privat mandiri milik Pelatih.
  for (const u of db.users) {
    if (u.role === "pelatih") {
      const p = u as PelatihUser;
      if (p.status !== "aktif") continue;
      if (p.sanggarId) {
        const sg = sanggarById.get(p.sanggarId);
        if (sg) {
          items.push({
            id: `sdm-pelatih-${p.id}`,
            sumberType: "sdm-pelatih",
            sumberId: p.id,
            sanggarId: sg.id,
            penyediaRole: "sanggar",
            sanggarNama: sg.namaSanggar,
            sanggarAlamat: sg.alamat ?? "",
            lat: sg.lat,
            lng: sg.lng,
            kategori: "sdm",
            judul: `Pelatih ${p.jenisKesenian} — ${p.nama}`,
            deskripsi: `${p.pendidikan} · ${p.usia} thn · melalui Sanggar`,
            hargaSewa: p.honorPerSesi || ROLE_TO_HONOR_LABEL.pelatih,
            satuanHarga: "per_event",
            fotoDataUrl: p.fotoProfileDataUrl,
            jenisKesenian: [p.jenisKesenian],
            namaSdm: p.nama,
            akomodasiPP: p.akomodasiPP ?? "diluar",
            biayaAkomodasi: p.biayaAkomodasi ?? 0,
          });
        }
      }
      if (p.menerimaKelasPrivat) {
        items.push({
          id: `sdm-pelatih-privat-${p.id}`,
          sumberType: "sdm-pelatih",
          sumberId: p.id,
          sanggarId: p.id,
          penyediaRole: "pelatih",
          sanggarNama: `Pelatih Mandiri · ${p.nama}`,
          sanggarAlamat: p.alamat ?? "",
          kategori: "sdm",
          judul:
            p.namaLayananPrivat?.trim() ||
            `Kelas Privat ${p.jenisKesenian} — ${p.nama}`,
          deskripsi: `${p.pendidikan} · kelas privat langsung dengan Pelatih`,
          hargaSewa:
            p.hargaKelasPrivat || p.honorPerSesi || ROLE_TO_HONOR_LABEL.pelatih,
          satuanHarga: "per_event",
          fotoDataUrl: p.fotoProfileDataUrl,
          jenisKesenian: [p.jenisKesenian],
          namaSdm: p.nama,
          akomodasiPP: p.akomodasiPP ?? "diluar",
          biayaAkomodasi: p.biayaAkomodasi ?? 0,
        });
      }
    } else if (u.role === "seniman") {
      const s = u as SenimanUser;
      if (s.status !== "aktif" || !s.sanggarId) continue;
      const sg = sanggarById.get(s.sanggarId);
      if (!sg) continue;
      items.push({
        id: `sdm-seniman-${s.id}`,
        sumberType: "sdm-seniman",
        sumberId: s.id,
        sanggarId: sg.id,
        penyediaRole: "sanggar",
        sanggarNama: sg.namaSanggar,
        sanggarAlamat: sg.alamat ?? "",
        lat: sg.lat,
        lng: sg.lng,
        kategori: "sdm",
        judul: `Seniman ${s.jenisKesenian} — ${s.nama}`,
        deskripsi: `${s.pendidikan}${s.profesi ? ` · ${s.profesi}` : ""}`,
        hargaSewa: ROLE_TO_HONOR_LABEL.seniman,
        satuanHarga: "per_event",
        fotoDataUrl: s.fotoProfileDataUrl,
        jenisKesenian: [s.jenisKesenian],
        namaSdm: s.nama,
        akomodasiPP: s.akomodasiPP ?? "diluar",
        biayaAkomodasi: s.biayaAkomodasi ?? 0,
      });
    }
    // Juri tidak masuk katalog kerjasama antar-sanggar: juri adalah aset
    // independen yang dikurasi kurator dan tidak dimiliki sanggar manapun.
  }

  for (const a of db.aset) {
    if (!a.statusPublish || a.jumlahTersedia <= 0) continue;
    const sg = sanggarById.get(a.sanggarId);
    if (!sg) continue;
    items.push({
      id: `aset-${a.id}`,
      sumberType: "aset",
      sumberId: a.id,
      sanggarId: sg.id,
      penyediaRole: "sanggar",
      sanggarNama: sg.namaSanggar,
      sanggarAlamat: sg.alamat ?? "",
      lat: sg.lat,
      lng: sg.lng,
      kategori: a.kategori,
      judul: a.nama,
      deskripsi: `${a.jenis} · tersedia ${a.jumlahTersedia}/${a.jumlahTotal}`,
      hargaSewa: a.hargaSewa,
      satuanHarga: a.satuanHarga,
      fotoDataUrl: a.fotoDataUrl,
      jenisKesenian: sg.jenisKesenian,
      akomodasiPP: a.akomodasiPP ?? "diluar",
      biayaAkomodasi: a.biayaAkomodasi ?? 0,
    });
  }
  for (const s of db.sarpras) {
    if (!s.statusPublish) continue;
    const sg = sanggarById.get(s.sanggarId);
    if (!sg) continue;
    items.push({
      id: `sarpras-${s.id}`,
      sumberType: "sarpras",
      sumberId: s.id,
      sanggarId: sg.id,
      penyediaRole: "sanggar",
      sanggarNama: sg.namaSanggar,
      sanggarAlamat: sg.alamat ?? "",
      lat: sg.lat,
      lng: sg.lng,
      kategori: "tempat_latihan",
      judul: s.namaTempat,
      deskripsi: `${s.jenisTempat.replace("_", " ")} · kapasitas ${s.kapasitas} · ${s.fasilitas}`,
      hargaSewa: s.hargaSewa,
      satuanHarga: s.satuanHarga,
      fotoDataUrl: s.fotoDataUrl,
      jenisKesenian: sg.jenisKesenian,
      akomodasiPP: s.akomodasiPP ?? "termasuk",
      biayaAkomodasi: s.biayaAkomodasi ?? 0,
    });
  }
  return items;
}

export function getKatalogItem(id: string): KatalogItem | undefined {
  return buildKatalog().find((k) => k.id === id);
}

export const SATUAN_LABEL: Record<SatuanHarga, string> = {
  per_jam: "/ jam",
  per_hari: "/ hari",
  per_event: "/ event",
};

export const STATUS_LABEL: Record<KerjasamaStatus, string> = {
  menunggu: "Menunggu",
  diterima: "Diterima",
  ditolak: "Ditolak",
  negosiasi: "Negosiasi",
  berjalan: "Berjalan",
  selesai: "Selesai",
  batal: "Batal",
};

export const STATUS_COLOR: Record<KerjasamaStatus, string> = {
  menunggu: "bg-amber-100 text-amber-800 border-amber-300",
  diterima: "bg-emerald-100 text-emerald-800 border-emerald-300",
  ditolak: "bg-rose-100 text-rose-800 border-rose-300",
  negosiasi: "bg-lime-100 text-lime-800 border-lime-300",
  berjalan: "bg-green-100 text-green-800 border-green-300",
  selesai: "bg-emerald-200 text-emerald-900 border-emerald-400",
  batal: "bg-zinc-200 text-zinc-700 border-zinc-300",
};

let kerjasamaCounter = 1;
function genNomor(prefix: string) {
  const y = new Date().getFullYear();
  const seq = String(kerjasamaCounter++).padStart(3, "0");
  return `${prefix}/${y}/${Date.now().toString().slice(-4)}${seq}`;
}

export function createKerjasama(input: {
  katalog: KatalogItem;
  peminjamSanggarId: string;
  actor: Actor;
  tanggalMulai: string;
  tanggalSelesai: string;
  lokasi: string;
  jumlah: number;
  deskripsi: string;
}): { ok: boolean; reason?: string; kerjasama?: Kerjasama } {
  // Identity binding: peminjam wajib actor sanggar sendiri
  if (input.actor.role !== "sanggar")
    return {
      ok: false,
      reason: "Hanya sanggar yang dapat membuat permintaan.",
    };
  if (input.peminjamSanggarId !== input.actor.id)
    return { ok: false, reason: "Identitas peminjam tidak cocok." };
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
    return { ok: false, reason: "Lokasi kegiatan wajib diisi." };

  // Selalu ambil ulang katalog dari penyimpanan. Snapshot dari UI dapat usang
  // atau dimodifikasi dan tidak boleh menjadi sumber harga/kepemilikan.
  const fresh = getKatalogItem(input.katalog.id);
  if (!fresh)
    return { ok: false, reason: "Item sudah tidak tersedia di katalog." };
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
  // Tidak boleh meminjam ke katalog milik sendiri.
  if (fresh.sanggarId === input.actor.id)
    return { ok: false, reason: "Tidak dapat meminjam ke katalog sendiri." };
  if (!Number.isFinite(fresh.hargaSewa) || fresh.hargaSewa < 0) {
    return { ok: false, reason: "Harga katalog tidak valid." };
  }
  const k: Kerjasama = {
    id: uid(),
    nomor: genNomor("KS"),
    sumberType: fresh.sumberType,
    sumberId: fresh.sumberId,
    sanggarPenyediaId: fresh.sanggarId,
    sanggarPeminjamId: input.peminjamSanggarId,
    kategori: fresh.kategori,
    judul: fresh.judul,
    tanggalMulai: input.tanggalMulai,
    tanggalSelesai: input.tanggalSelesai,
    lokasi: input.lokasi.trim(),
    jumlah: input.jumlah,
    satuanHarga: fresh.satuanHarga,
    deskripsi: input.deskripsi.trim(),
    hargaAwal: fresh.hargaSewa,
    nilaiTotal: fresh.hargaSewa * input.jumlah,
    status: "menunggu",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  save((db) => {
    db.kerjasama.unshift(k);
  });
  logActivity(input.actor.id, input.actor.role, "kerjasama-create", {
    nomor: k.nomor,
  });
  return { ok: true, kerjasama: k };
}

export function updateKerjasamaStatus(
  id: string,
  status: KerjasamaStatus,
  actor: Actor,
): { ok: boolean; reason?: string } {
  let result: { ok: boolean; reason?: string } = {
    ok: false,
    reason: "Tidak dikenal.",
  };
  let catatanPembatalan: Record<string, unknown> | undefined;
  save((db) => {
    const k = db.kerjasama.find((x) => x.id === id);
    if (!k) {
      result = { ok: false, reason: "Kerjasama tidak ditemukan." };
      return;
    }
    if (!isInvolved(k, actor)) {
      result = { ok: false, reason: "Tidak berwenang." };
      return;
    }
    // Authorization per transition
    if (status === "diterima" && !isPenyedia(k, actor)) {
      result = { ok: false, reason: "Hanya penyedia yang dapat menerima." };
      return;
    }
    if (status === "ditolak" && !isPenyedia(k, actor)) {
      result = { ok: false, reason: "Hanya penyedia yang dapat menolak." };
      return;
    }
    if (
      status === "batal" &&
      !isPeminjam(k, actor) &&
      actor.role !== "kurator"
    ) {
      result = {
        ok: false,
        reason: "Hanya peminjam (atau kurator) yang dapat membatalkan.",
      };
      return;
    }
    if (status === "berjalan" || status === "selesai") {
      result = {
        ok: false,
        reason:
          status === "berjalan"
            ? "Status berjalan hanya melalui penerbitan invoice."
            : "Status selesai hanya melalui finalisasi BAST.",
      };
      return;
    }
    if (!TRANSITIONS[k.status].includes(status)) {
      result = {
        ok: false,
        reason: `Tidak bisa pindah dari ${k.status} ke ${status}.`,
      };
      return;
    }
    if (status === "batal") {
      catatanPembatalan = {
        id: k.id,
        nomor: k.nomor,
        judul: k.judul,
        nilaiTotal: k.nilaiTotal,
        pihakTerkait: [k.sanggarPenyediaId, k.sanggarPeminjamId],
      };
      for (const negosiasi of db.negosiasi) {
        if (negosiasi.kerjasamaId === k.id && negosiasi.status === "diajukan") {
          negosiasi.status = "ditolak";
        }
      }
      db.kerjasama = db.kerjasama.filter((item) => item.id !== k.id);
      result = { ok: true };
      return;
    }
    k.status = status;
    k.updatedAt = Date.now();
    if (status === "diterima" || status === "ditolak") {
      for (const n of db.negosiasi) {
        if (n.kerjasamaId === k.id && n.status === "diajukan")
          n.status = "ditolak";
      }
    }
    result = { ok: true };
  });
  if (result.ok)
    logActivity(actor.id, actor.role, "kerjasama-status", {
      id,
      status,
      ...(catatanPembatalan ?? {}),
    });
  return result;
}

export function sendChat(input: {
  kerjasamaId: string;
  senderId: string;
  senderName: string;
  senderRole: Role;
  message: string;
  actor: Actor;
}): { ok: boolean; reason?: string } {
  let result: { ok: boolean; reason?: string } = { ok: false };
  // Identity binding: sender must be the authenticated actor
  if (
    input.senderId !== input.actor.id ||
    input.senderRole !== input.actor.role
  ) {
    return { ok: false, reason: "Identitas pengirim tidak cocok." };
  }
  const message = input.message.trim();
  if (!message) return { ok: false, reason: "Pesan kosong." };
  if (message.length > 2_000)
    return { ok: false, reason: "Pesan maksimal 2.000 karakter." };
  save((db) => {
    const k = db.kerjasama.find((x) => x.id === input.kerjasamaId);
    if (!k) {
      result = { ok: false, reason: "Kerjasama tidak ditemukan." };
      return;
    }
    if (!isInvolved(k, input.actor)) {
      result = { ok: false, reason: "Tidak berwenang." };
      return;
    }
    const sender = db.users.find((u) => u.id === input.actor.id);
    const senderName =
      sender?.role === "sanggar"
        ? (sender as SanggarUser).namaSanggar
        : input.senderName.trim();
    db.chatMessages.push({
      id: uid(),
      kerjasamaId: input.kerjasamaId,
      senderId: input.senderId,
      senderName: senderName || input.actor.id,
      senderRole: input.actor.role,
      message,
      ts: Date.now(),
    });
    result = { ok: true };
  });
  return result;
}

export function sendNegosiasi(input: {
  kerjasamaId: string;
  pengirimSanggarId: string;
  pengirimUserId: string;
  hargaTawar: number;
  catatan: string;
  actor: Actor;
}): { ok: boolean; reason?: string } {
  let result: { ok: boolean; reason?: string } = { ok: false };
  // Identity binding: pengirim wajib actor sendiri
  if (
    input.actor.role !== "sanggar" ||
    input.pengirimSanggarId !== input.actor.id ||
    input.pengirimUserId !== input.actor.id
  ) {
    return { ok: false, reason: "Identitas pengirim tidak cocok." };
  }
  save((db) => {
    const k = db.kerjasama.find((x) => x.id === input.kerjasamaId);
    if (!k) {
      result = { ok: false, reason: "Kerjasama tidak ditemukan." };
      return;
    }
    if (!isInvolved(k, input.actor)) {
      result = { ok: false, reason: "Tidak berwenang." };
      return;
    }
    if (!["menunggu", "negosiasi"].includes(k.status)) {
      result = { ok: false, reason: "Negosiasi sudah ditutup." };
      return;
    }
    if (!isPositiveFinite(input.hargaTawar)) {
      result = { ok: false, reason: "Harga tidak valid." };
      return;
    }
    db.negosiasi.unshift({
      id: uid(),
      kerjasamaId: input.kerjasamaId,
      pengirimSanggarId: input.pengirimSanggarId,
      pengirimUserId: input.pengirimUserId,
      hargaTawar: input.hargaTawar,
      catatan: input.catatan.trim(),
      status: "diajukan",
      createdAt: Date.now(),
    });
    if (k.status !== "diterima") {
      k.status = "negosiasi";
    }
    k.updatedAt = Date.now();
    result = { ok: true };
  });
  if (result.ok)
    logActivity(input.actor.id, input.actor.role, "kerjasama-nego", {
      id: input.kerjasamaId,
      harga: input.hargaTawar,
    });
  return result;
}

export function applyNegosiasi(
  negosiasiId: string,
  accept: boolean,
  actor: Actor,
): { ok: boolean; reason?: string } {
  let result: { ok: boolean; reason?: string } = { ok: false };
  save((db) => {
    const n = db.negosiasi.find((x) => x.id === negosiasiId);
    if (!n) {
      result = { ok: false, reason: "Negosiasi tidak ditemukan." };
      return;
    }
    if (n.status !== "diajukan") {
      result = { ok: false, reason: "Tawaran sudah diproses." };
      return;
    }
    const k = db.kerjasama.find((x) => x.id === n.kerjasamaId);
    if (!k) {
      result = { ok: false, reason: "Kerjasama tidak ditemukan." };
      return;
    }
    if (!isInvolved(k, actor)) {
      result = { ok: false, reason: "Tidak berwenang." };
      return;
    }
    if (!["menunggu", "negosiasi"].includes(k.status)) {
      result = { ok: false, reason: "Negosiasi sudah ditutup." };
      return;
    }
    // Tidak boleh menyetujui tawaran sendiri
    if (n.pengirimSanggarId === actor.id) {
      result = { ok: false, reason: "Tidak bisa memproses tawaran sendiri." };
      return;
    }
    n.status = accept ? "diterima" : "ditolak";
    if (accept) {
      k.nilaiTotal = n.hargaTawar * Math.max(1, k.jumlah);
      k.status = "diterima";
      k.updatedAt = Date.now();
      for (const other of db.negosiasi) {
        if (
          other.kerjasamaId === k.id &&
          other.id !== n.id &&
          other.status === "diajukan"
        ) {
          other.status = "ditolak";
        }
      }
    }
    result = { ok: true };
  });
  if (result.ok)
    logActivity(actor.id, actor.role, "kerjasama-nego-apply", {
      negosiasiId,
      accept,
    });
  return result;
}

export function issueInvoice(
  kerjasamaId: string,
  dueDays: number,
  actor: Actor,
): { ok: boolean; reason?: string; invoice?: Invoice } {
  let result: { ok: boolean; reason?: string; invoice?: Invoice } = {
    ok: false,
  };
  save((db) => {
    const k = db.kerjasama.find((x) => x.id === kerjasamaId);
    if (!k) {
      result = { ok: false, reason: "Kerjasama tidak ditemukan." };
      return;
    }
    if (!isPenyedia(k, actor)) {
      result = {
        ok: false,
        reason: "Hanya penyedia yang dapat menerbitkan invoice.",
      };
      return;
    }
    if (!["diterima", "berjalan"].includes(k.status)) {
      result = {
        ok: false,
        reason: "Invoice hanya untuk kerjasama yang sudah disepakati.",
      };
      return;
    }
    if (db.invoices.some((i) => i.kerjasamaId === kerjasamaId)) {
      result = { ok: false, reason: "Invoice untuk kerjasama ini sudah ada." };
      return;
    }
    if (!Number.isInteger(dueDays) || dueDays < 1 || dueDays > 365) {
      result = { ok: false, reason: "Tenggat pembayaran harus 1–365 hari." };
      return;
    }
    if (!Number.isFinite(k.nilaiTotal) || k.nilaiTotal < 0) {
      result = { ok: false, reason: "Nilai kerjasama tidak valid." };
      return;
    }
    const inv: Invoice = {
      id: uid(),
      kerjasamaId,
      nomor: genNomor("INV"),
      total: k.nilaiTotal,
      status: "terhutang",
      batasPembayaran: Date.now() + dueDays * 86400000,
      createdAt: Date.now(),
    };
    db.invoices.unshift(inv);
    k.status = "berjalan";
    k.updatedAt = Date.now();
    result = { ok: true, invoice: inv };
  });
  if (result.ok)
    logActivity(actor.id, actor.role, "invoice-issue", { kerjasamaId });
  return result;
}

export function recordPayment(input: {
  invoiceId: string;
  nominal: number;
  tanggalBayar: number;
  buktiDataUrl?: string;
  actor: Actor;
}): { ok: boolean; reason?: string; payment?: Payment } {
  let result: { ok: boolean; reason?: string; payment?: Payment } = {
    ok: false,
  };
  save((db) => {
    const inv = db.invoices.find((i) => i.id === input.invoiceId);
    if (!inv) {
      result = { ok: false, reason: "Invoice tidak ditemukan." };
      return;
    }
    if (inv.status === "lunas") {
      result = { ok: false, reason: "Invoice sudah lunas." };
      return;
    }
    const k = db.kerjasama.find((x) => x.id === inv.kerjasamaId);
    if (!k) {
      result = { ok: false, reason: "Kerjasama tidak ditemukan." };
      return;
    }
    if (!isPeminjam(k, input.actor)) {
      result = {
        ok: false,
        reason: "Hanya peminjam yang dapat mengirim bukti pembayaran.",
      };
      return;
    }
    if (k.status !== "berjalan") {
      result = {
        ok: false,
        reason: "Kerjasama belum siap menerima pembayaran.",
      };
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
    // Cegah duplikat: bila sudah ada pembayaran berstatus "menunggu" atau "disetujui", tolak
    if (
      db.payments.some(
        (p) =>
          p.invoiceId === input.invoiceId &&
          (p.status === "menunggu" || p.status === "disetujui"),
      )
    ) {
      result = {
        ok: false,
        reason:
          "Sudah ada pembayaran yang menunggu atau disetujui untuk invoice ini.",
      };
      return;
    }
    const pay: Payment = {
      id: uid(),
      invoiceId: input.invoiceId,
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
    logActivity(input.actor.id, input.actor.role, "payment-upload", {
      invoiceId: input.invoiceId,
      nominal: input.nominal,
    });
  return result;
}

export function verifyPayment(
  paymentId: string,
  accept: boolean,
  catatan: string | undefined,
  actor: Actor,
): { ok: boolean; reason?: string } {
  let result: { ok: boolean; reason?: string } = { ok: false };
  let kasInfo: { kerjasamaId: string; total: number } | null = null;
  save((db) => {
    const p = db.payments.find((x) => x.id === paymentId);
    if (!p) {
      result = { ok: false, reason: "Pembayaran tidak ditemukan." };
      return;
    }
    if (p.status !== "menunggu") {
      result = { ok: false, reason: "Pembayaran sudah diproses." };
      return;
    }
    const inv = db.invoices.find((x) => x.id === p.invoiceId);
    if (!inv) {
      result = { ok: false, reason: "Invoice tidak ditemukan." };
      return;
    }
    const k = db.kerjasama.find((x) => x.id === inv.kerjasamaId);
    if (!k) {
      result = { ok: false, reason: "Kerjasama tidak ditemukan." };
      return;
    }
    if (!isPenyedia(k, actor)) {
      result = {
        ok: false,
        reason: "Hanya penyedia yang dapat memverifikasi pembayaran.",
      };
      return;
    }
    if (k.status !== "berjalan" || inv.status !== "terhutang") {
      result = { ok: false, reason: "Invoice tidak lagi menunggu verifikasi." };
      return;
    }
    if (accept && p.nominal < inv.total) {
      result = {
        ok: false,
        reason: `Nominal pembayaran (${p.nominal}) lebih kecil dari total invoice (${inv.total}).`,
      };
      return;
    }
    p.status = accept ? "disetujui" : "ditolak";
    p.catatanVerifikator = catatan;
    if (accept) {
      inv.status = "lunas";
      kasInfo = { kerjasamaId: k.id, total: inv.total };
    }
    result = { ok: true };
  });
  const ki = kasInfo as { kerjasamaId: string; total: number } | null;
  if (ki) {
    const db2 = load();
    const k = db2.kerjasama.find((x) => x.id === ki.kerjasamaId);
    if (k) {
      pushKas(
        k.sanggarPenyediaId,
        `Pembayaran kerjasama ${k.nomor}`,
        ki.total,
        0,
        "kerjasama-in",
        k.id,
      );
      pushKas(
        k.sanggarPeminjamId,
        `Pelunasan kerjasama ${k.nomor}`,
        0,
        ki.total,
        "kerjasama-out",
        k.id,
      );
    }
  }
  if (result.ok)
    logActivity(actor.id, actor.role, "payment-verify", { paymentId, accept });
  return result;
}

export function ensureContract(kerjasamaId: string, actor: Actor) {
  const db = load();
  const k = db.kerjasama.find((x) => x.id === kerjasamaId);
  if (
    !k ||
    !isInvolved(k, actor) ||
    !["diterima", "berjalan", "selesai"].includes(k.status)
  )
    return null;
  const existing = db.contracts.find((c) => c.kerjasamaId === kerjasamaId);
  if (existing) return existing;
  const c = {
    id: uid(),
    kerjasamaId,
    nomor: genNomor("KTR"),
    createdAt: Date.now(),
  };
  save((d) => {
    d.contracts.unshift(c);
  });
  logActivity(actor.id, actor.role, "contract-create", { kerjasamaId });
  return c;
}

export function ensureBastDraft(
  kerjasamaId: string,
  actor: Actor,
): Bast | null {
  const db = load();
  const k = db.kerjasama.find((x) => x.id === kerjasamaId);
  if (
    !k ||
    !isInvolved(k, actor) ||
    !["diterima", "berjalan", "selesai"].includes(k.status)
  )
    return null;
  const existing = db.bast.find((b) => b.kerjasamaId === kerjasamaId);
  if (existing) return existing;
  const b: Bast = {
    id: uid(),
    kerjasamaId,
    nomor: genNomor("BAST"),
    status: "draft",
    createdAt: Date.now(),
  };
  save((d) => {
    d.bast.unshift(b);
  });
  logActivity(actor.id, actor.role, "bast-draft", { kerjasamaId });
  return b;
}

export function finalizeBast(
  kerjasamaId: string,
  actor: Actor,
): { ok: boolean; reason?: string } {
  const db = load();
  const k = db.kerjasama.find((x) => x.id === kerjasamaId);
  if (!k) return { ok: false, reason: "Kerjasama tidak ditemukan." };
  if (!isInvolved(k, actor)) return { ok: false, reason: "Tidak berwenang." };
  if (k.status === "selesai") return { ok: true };
  if (k.status !== "berjalan")
    return { ok: false, reason: "Kerjasama belum berjalan." };
  const inv = db.invoices.find((i) => i.kerjasamaId === kerjasamaId);
  if (!inv || inv.status !== "lunas")
    return { ok: false, reason: "Invoice belum lunas." };
  if (k.tanggalSelesai > todayIsoLocal())
    return {
      ok: false,
      reason: "BAST baru dapat difinalkan setelah periode kegiatan selesai.",
    };
  let bast = db.bast.find((b) => b.kerjasamaId === kerjasamaId);
  if (!bast) bast = ensureBastDraft(kerjasamaId, actor)!;
  if (bast.status === "final") return { ok: true };
  save((d) => {
    const b = d.bast.find((x) => x.kerjasamaId === kerjasamaId);
    if (b) {
      b.status = "final";
      b.finalAt = Date.now();
    }
    const kk = d.kerjasama.find((x) => x.id === kerjasamaId);
    if (kk) {
      kk.status = "selesai";
      kk.updatedAt = Date.now();
    }
  });
  logActivity(actor.id, actor.role, "bast-final", { kerjasamaId });
  return { ok: true };
}

export function submitRating(input: {
  kerjasamaId: string;
  dariSanggarId: string;
  rating: 1 | 2 | 3 | 4 | 5;
  ulasan: string;
  actor: Actor;
}): { ok: boolean; reason?: string } {
  let result: { ok: boolean; reason?: string } = { ok: false };
  // Identity binding: dariSanggarId wajib actor sanggar sendiri
  if (
    input.actor.role !== "sanggar" ||
    input.dariSanggarId !== input.actor.id
  ) {
    return { ok: false, reason: "Identitas pengirim rating tidak cocok." };
  }
  if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) {
    return { ok: false, reason: "Rating harus bernilai 1 sampai 5." };
  }
  save((db) => {
    const k = db.kerjasama.find((x) => x.id === input.kerjasamaId);
    if (!k) {
      result = { ok: false, reason: "Kerjasama tidak ditemukan." };
      return;
    }
    if (!isInvolved(k, input.actor)) {
      result = { ok: false, reason: "Tidak berwenang." };
      return;
    }
    if (k.status !== "selesai") {
      result = {
        ok: false,
        reason: "Rating hanya tersedia setelah kerjasama selesai.",
      };
      return;
    }
    if (
      db.ratings.some(
        (r) =>
          r.kerjasamaId === input.kerjasamaId &&
          r.dariSanggarId === input.dariSanggarId,
      )
    ) {
      result = {
        ok: false,
        reason: "Anda sudah mengirim rating untuk kerjasama ini.",
      };
      return;
    }
    db.ratings.unshift({
      id: uid(),
      kerjasamaId: input.kerjasamaId,
      dariSanggarId: input.dariSanggarId,
      rating: input.rating,
      ulasan: input.ulasan.trim(),
      createdAt: Date.now(),
    });
    result = { ok: true };
  });
  if (result.ok)
    logActivity(input.actor.id, input.actor.role, "rating-submit", {
      kerjasamaId: input.kerjasamaId,
      rating: input.rating,
    });
  return result;
}

// ===== Aset / Sarpras CRUD =====

export function upsertAset(
  a: Aset,
  actor: Actor,
): { ok: boolean; reason?: string } {
  if (actor.role !== "sanggar" || a.sanggarId !== actor.id) {
    return {
      ok: false,
      reason: "Aset hanya dapat dikelola oleh sanggar pemiliknya.",
    };
  }
  let ok = true;
  save((db) => {
    const i = db.aset.findIndex((x) => x.id === a.id);
    if (i >= 0) {
      // Cegah pengalihan kepemilikan
      if (db.aset[i].sanggarId !== actor.id) {
        ok = false;
        return;
      }
      db.aset[i] = a;
    } else {
      db.aset.unshift(a);
    }
  });
  return ok ? { ok: true } : { ok: false, reason: "Tidak berwenang." };
}
export function deleteAset(
  id: string,
  actor: Actor,
): { ok: boolean; reason?: string } {
  if (actor.role !== "sanggar")
    return { ok: false, reason: "Tidak berwenang." };
  let ok = false;
  save((db) => {
    const a = db.aset.find((x) => x.id === id);
    if (!a || a.sanggarId !== actor.id) return;
    db.aset = db.aset.filter((x) => x.id !== id);
    ok = true;
  });
  return ok
    ? { ok: true }
    : { ok: false, reason: "Tidak berwenang atau aset tidak ditemukan." };
}

export function upsertSarpras(
  s: Sarpras,
  actor: Actor,
): { ok: boolean; reason?: string } {
  if (actor.role !== "sanggar" || s.sanggarId !== actor.id) {
    return {
      ok: false,
      reason: "Sarpras hanya dapat dikelola oleh sanggar pemiliknya.",
    };
  }
  let ok = true;
  save((db) => {
    const i = db.sarpras.findIndex((x) => x.id === s.id);
    if (i >= 0) {
      if (db.sarpras[i].sanggarId !== actor.id) {
        ok = false;
        return;
      }
      db.sarpras[i] = s;
    } else {
      db.sarpras.unshift(s);
    }
  });
  return ok ? { ok: true } : { ok: false, reason: "Tidak berwenang." };
}
export function deleteSarpras(
  id: string,
  actor: Actor,
): { ok: boolean; reason?: string } {
  if (actor.role !== "sanggar")
    return { ok: false, reason: "Tidak berwenang." };
  let ok = false;
  save((db) => {
    const s = db.sarpras.find((x) => x.id === id);
    if (!s || s.sanggarId !== actor.id) return;
    db.sarpras = db.sarpras.filter((x) => x.id !== id);
    ok = true;
  });
  return ok
    ? { ok: true }
    : { ok: false, reason: "Tidak berwenang atau sarpras tidak ditemukan." };
}

// ===== SDM lookups =====

export function findUserById(id: string): AnyUser | undefined {
  return load().users.find((u) => u.id === id);
}

export function isUserInvolvedInKerjasama(
  userId: string,
  k: Kerjasama,
): boolean {
  if (k.sumberType.startsWith("sdm-") && k.sumberId === userId) return true;
  return false;
}

// ===== File helpers =====

export async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}
