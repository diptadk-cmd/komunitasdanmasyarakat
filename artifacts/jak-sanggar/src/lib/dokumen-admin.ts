// Tools Dokumen Administrasi Sanggar — template surat/dokumen yang isinya
// menyesuaikan bentuk & kedudukan sanggar (6 varian). Body HTML dirender
// tanpa kop/ttd; halaman pemanggil menggabungkan kopHtml() + body + blok ttd
// (ttdHtml sanggar, atau ttd kustom bila dokumen ditandatangani pihak induk).
// Format disusun sebagai administrasi organisasi sanggar. Tata naskah dinas
// Pemprov DKI Jakarta hanya menjadi rujukan kerapihan, bukan dasar untuk
// menerbitkan naskah dinas atau produk hukum daerah.
// Klasifikasi: AD/ART memakai susunan berpasal; keputusan organisasi memakai
// konsiderans dan diktum; surat serta berita acara memakai bentuk masing-masing.
// Generator ini tidak membuat Pergub maupun produk hukum pemerintah daerah.
import type { SanggarUser, BentukKedudukanId } from "./types";
import { safeHtml, rawHtml } from "./print";
import { tanggalCetak, jabatanPemilikDenganNama } from "./dokumen";
import {
  paragrafHtml,
  paragrafPreHtml,
  tabelIdentitasHtml,
  tujuanHtml,
  salamHtml,
  blokNomorHtml,
  ttdDkiHtml,
  tembusanHtml,
  lampiranHtml,
  pasalHtml,
  ayatHtml,
  hurufHtml,
  nomorHurufDokumen,
  judulSuratDenganNomorHtml,
  tentangHtml,
  bismillahHtml,
  menimbangHtml,
  mengingatHtml,
  memutuskanHtml,
  menetapkanHtml,
  diktumHtml,
  diktumDenganHuruf,
  keRomawi,
  keKata,
  TND,
  babHtml,
  bagianHtml,
} from "./dokumen-dki";

// ── Bentuk & kedudukan ───────────────────────────────────────────────────────
export interface BentukKedudukan {
  id: BentukKedudukanId;
  nama: string;
  ringkas: string;
  /** Dasar legitimasi yang dirujuk di dalam dokumen. */
  dasar: string;
  /** Punya organisasi induk? */
  induk: boolean;
  badan: "non" | "hukum" | "usaha";
}

export const BENTUK_KEDUDUKAN: BentukKedudukan[] = [
  {
    id: "mandiri-non-bh",
    nama: "Sanggar Mandiri Non Badan Hukum",
    ringkas:
      "Berdiri sendiri atas kesepakatan para pendiri/anggota, belum berbadan hukum.",
    dasar: "kesepakatan musyawarah pendirian para pendiri/anggota sanggar",
    induk: false,
    badan: "non",
  },
  {
    id: "unit-non-bh",
    nama: "Sanggar Unit di Bawah Organisasi Non Badan Hukum",
    ringkas:
      "Unit kegiatan kesenian dari organisasi/komunitas induk yang belum berbadan hukum.",
    dasar: "surat penunjukan/kesepakatan organisasi induk",
    induk: true,
    badan: "non",
  },
  {
    id: "mandiri-bh",
    nama: "Sanggar Mandiri Berbadan Hukum",
    ringkas:
      "Berdiri sendiri sebagai yayasan/perkumpulan dengan akta notaris dan pengesahan Kemenkumham.",
    dasar:
      "akta pendirian badan hukum beserta surat keputusan pengesahan Kemenkumham",
    induk: false,
    badan: "hukum",
  },
  {
    id: "mandiri-bu",
    nama: "Sanggar Mandiri Berbadan Usaha",
    ringkas:
      "Berdiri sendiri sebagai badan usaha (PT/CV) dengan akta pendirian usaha dan NIB.",
    dasar: "akta pendirian badan usaha beserta Nomor Induk Berusaha (NIB)",
    induk: false,
    badan: "usaha",
  },
  {
    id: "unit-bh",
    nama: "Sanggar Unit di Bawah Organisasi Berbadan Hukum",
    ringkas:
      "Unit kegiatan kesenian dari organisasi induk yang berbadan hukum (yayasan/perkumpulan).",
    dasar:
      "surat keputusan penetapan unit oleh organisasi induk berbadan hukum",
    induk: true,
    badan: "hukum",
  },
  {
    id: "unit-bu",
    nama: "Sanggar Unit di Bawah Organisasi Berbadan Usaha",
    ringkas:
      "Unit kegiatan kesenian dari perusahaan induk berbadan usaha (PT/CV).",
    dasar: "surat keputusan penetapan unit oleh perusahaan induk",
    induk: true,
    badan: "usaha",
  },
];

export function bentukById(id: BentukKedudukanId): BentukKedudukan {
  return BENTUK_KEDUDUKAN.find((b) => b.id === id) ?? BENTUK_KEDUDUKAN[0];
}

/** Default bentuk bila sanggar belum pernah memilih — diturunkan dari Legalitas. */
export function bentukDefault(sg: SanggarUser): BentukKedudukanId {
  if (sg.bentukKedudukan) return sg.bentukKedudukan;
  switch (sg.legalitas) {
    case "Yayasan":
      return "mandiri-bh";
    case "PT":
    case "CV":
      return "mandiri-bu";
    default:
      return "mandiri-non-bh";
  }
}

// ── Field form ───────────────────────────────────────────────────────────────
export interface FieldDef {
  key: string;
  label: string;
  opsional?: boolean;
  /**
   * - `text` / `textarea` : isian bebas.
   * - `pilihan`           : pilih satu dari daftar `opsi`.
   * - `pilihan-ganda`     : centang beberapa dari daftar `opsi`
   *                         (nilai disimpan satu baris per pilihan).
   */
  type?: "text" | "textarea" | "pilihan" | "pilihan-ganda";
  placeholder?: string;
  /** Nilai awal berdasarkan profil sanggar. */
  isiAwal?: (sg: SanggarUser) => string;
  /** Daftar pilihan untuk type `pilihan` / `pilihan-ganda`. */
  opsi?: string[];
  /**
   * Nilai baku yang dipakai tombol "Isi Standar".
   * Untuk `pilihan-ganda`, tulis satu pilihan per baris.
   */
  standar?: string;
  /**
   * Sediakan kotak kosong agar pengguna bisa menambah isian sendiri
   * di luar daftar pilihan. Default: true untuk field berpilihan.
   */
  izinkanLainnya?: boolean;
  /** Keterangan singkat di bawah label. */
  petunjuk?: string;
}

/** Field berpilihan (perlu UI centang/dropdown, bukan kotak teks biasa). */
export function fieldBerpilihan(f: FieldDef): boolean {
  return f.type === "pilihan" || f.type === "pilihan-ganda";
}

/** Pecah nilai `pilihan-ganda` menjadi daftar baris. */
export function pecahPilihan(nilai: string | undefined): string[] {
  return (nilai ?? "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Gabungkan daftar pilihan menjadi satu nilai tersimpan. */
export function gabungPilihan(daftar: string[]): string {
  return daftar
    .map((s) => s.trim())
    .filter(Boolean)
    .join("\n");
}

/**
 * Nilai standar seluruh field pada satu template — dipakai tombol
 * "Isi Standar" agar dokumen langsung terisi sesuai rumusan baku.
 * Field tanpa `standar` dibiarkan apa adanya (tidak ditimpa jadi kosong).
 */
export function isiStandarField(
  fields: FieldDef[],
  sebelumnya: Record<string, string>,
): Record<string, string> {
  const hasil = { ...sebelumnya };
  for (const f of fields) {
    if (f.standar !== undefined) hasil[f.key] = f.standar;
  }
  return hasil;
}

/** Apakah template punya rumusan standar (menentukan tampil/tidaknya tombol). */
export function punyaStandar(fields: FieldDef[]): boolean {
  return fields.some((f) => f.standar !== undefined);
}

// ── Autofill lintas formulir ─────────────────────────────────────────────────
// Data yang pernah diisi pada satu dokumen otomatis muncul kembali pada
// dokumen lain yang memakai field dengan nama sama, sehingga pemilik sanggar
// tidak perlu mengetik ulang data yang itu-itu juga.

/**
 * Field yang TIDAK boleh diwarisi antar-dokumen karena harus unik atau
 * spesifik per surat. Menyalinnya justru berisiko (mis. nomor surat ganda).
 */
const FIELD_TIDAK_DIWARISI = new Set([
  "nomor", // nomor surat wajib unik tiap dokumen
  "__nip_override",
  // Nama yang sama tidak selalu bermakna data yang sama. Contoh: `tujuan`
  // pada surat permohonan berbeda dengan `tujuan` organisasi; `periode` bisa
  // menjadi periode laporan maupun masa jabatan. Jangan autofill ambigu —
  // pengguna cukup mengisi sekali lewat formulir paket/data bersama bila
  // memang ingin dipakai lintas naskah.
  "tujuan",
  "keperluan",
  "isi",
  "periode",
  "tanggal",
  "tempat",
  "keterangan",
  "ringkasan",
  "rencana",
  "acara",
  "hariTanggal",
  "waktu",
  "agenda",
  "petugas",
  "tugas",
  "waktuPelaksanaan",
  "jumlahPeserta",
  "hasil",
  "perihal",
  "tanggalPenetapan",
  "tanggalSurat",
]);

/**
 * Kumpulkan nilai terakhir tiap field dari arsip dokumen sanggar.
 * Arsip yang lebih baru menimpa yang lama, sehingga yang dipakai selalu
 * data terkini yang pernah diinput pemilik sanggar.
 *
 * @param arsip Seluruh entri arsip milik sanggar (urutan bebas).
 */
export function ingatanField(
  arsip: { nilai: Record<string, string>; updatedAt: number }[],
): Record<string, string> {
  const ingatan: Record<string, string> = {};
  // Urut dari terlama → terbaru supaya nilai terbaru menang.
  for (const a of [...arsip].sort((x, y) => x.updatedAt - y.updatedAt)) {
    for (const [k, v] of Object.entries(a.nilai ?? {})) {
      if (FIELD_TIDAK_DIWARISI.has(k)) continue;
      if (typeof v === "string" && v.trim()) ingatan[k] = v;
    }
  }
  return ingatan;
}

/**
 * Nilai awal formulir dokumen dengan prioritas:
 *   1. Data profil sanggar (isiAwal) — paling tepercaya karena resmi.
 *   2. Ingatan lintas formulir — data yang pernah diketik sebelumnya.
 *   3. Kosong.
 */
export function isiAwalField(
  fields: FieldDef[],
  sg: SanggarUser,
  ingatan: Record<string, string>,
): Record<string, string> {
  const awal: Record<string, string> = {};
  for (const f of fields) {
    const dariProfil = f.isiAwal?.(sg)?.trim();
    awal[f.key] = dariProfil || ingatan[f.key] || "";
  }
  return awal;
}

/** Field tambahan sesuai bentuk: rujukan legalitas & data organisasi induk. */
export function fieldTambahanBentuk(b: BentukKedudukan): FieldDef[] {
  const f: FieldDef[] = [];
  if (b.badan === "hukum") {
    f.push(
      {
        key: "aktaNotaris",
        label: "Nomor & Tanggal Akta Notaris",
        placeholder: "No. 12 tanggal 5 Januari 2020, Notaris ...",
      },
      {
        key: "skKemenkumham",
        label: "Nomor SK Kemenkumham",
        placeholder: "AHU-0001234.AH.01.04.Tahun 2020",
      },
    );
  }
  if (b.badan === "usaha") {
    f.push(
      {
        key: "aktaUsaha",
        label: "Nomor & Tanggal Akta Pendirian Usaha",
        placeholder: "No. 7 tanggal 12 Maret 2021, Notaris ...",
      },
      {
        key: "nib",
        label: "Nomor Induk Berusaha (NIB)",
        placeholder: "1234567890123",
      },
    );
  }
  if (b.induk) {
    f.push(
      {
        key: "namaInduk",
        label: "Nama Organisasi/Perusahaan Induk",
        placeholder: "Nama organisasi induk",
        isiAwal: (sg) => sg.namaBadanHukum ?? "",
      },
      {
        key: "alamatInduk",
        label: "Alamat Organisasi Induk",
        placeholder: "Alamat lengkap induk",
      },
      {
        key: "pimpinanInduk",
        label: "Nama Pimpinan Induk",
        placeholder: "Nama pimpinan/ketua induk",
      },
      {
        key: "jabatanPimpinanInduk",
        label: "Jabatan Pimpinan Induk",
        placeholder: "Ketua Umum / Direktur",
      },
    );
  }
  return f;
}

// ── Template dokumen ─────────────────────────────────────────────────────────
export interface RenderCtx {
  sg: SanggarUser;
  bentuk: BentukKedudukan;
  v: Record<string, string>;
}

export interface TemplateDokumen {
  id: string;
  judul: string;
  deskripsi: string;
  /** "semua" atau daftar bentuk yang relevan. */
  bentuk: "semua" | BentukKedudukanId[];
  /** Field khusus template (di luar field tambahan bentuk). */
  fields: FieldDef[];
  /** Sertakan field tambahan bentuk (legalitas/induk)? Default true. */
  pakaiFieldBentuk?: boolean;
  render: (ctx: RenderCtx) => string;
  /** Bila dokumen ditandatangani pihak lain (mis. pimpinan induk). */
  ttdOverride?: (
    ctx: RenderCtx,
  ) => { jabatan: string; nama: string } | undefined;
}

const GAYA_PARAGRAF = `font-size:${TND.ukuranIsi};line-height:${TND.spasi};text-align:justify;margin:0 0 10px`;

function judulHtml(judul: string, nomor?: string): string {
  return judulSuratDenganNomorHtml(judul, nomor);
}

function p(teks: string): string {
  return paragrafHtml(teks);
}

function pra(teks: string): string {
  return paragrafPreHtml(teks);
}

/**
 * Tabel "label : nilai" untuk blok keterangan singkat pada surat.
 * Baris tanpa nilai otomatis disembunyikan oleh tabelIdentitasHtml.
 */
function barisTabel(baris: { label: string; nilai?: string }[]): string {
  return tabelIdentitasHtml(baris);
}

/** Tabel identitas sanggar + rujukan legal/induk sesuai bentuk. */
export function identitasHtml(ctx: RenderCtx): string {
  const { sg, bentuk, v } = ctx;
  const rows = [
    { label: "Nama Sanggar", nilai: sg.namaSanggar },
    { label: "Bentuk & Kedudukan", nilai: bentuk.nama },
    ...(bentuk.badan !== "non"
      ? [{ label: "Nama Badan", nilai: sg.namaBadanHukum }]
      : []),
    { label: "Nama Ketua/Pemilik", nilai: sg.namaKetua },
    { label: "Alamat", nilai: sg.alamat },
    ...(sg.npwp ? [{ label: "NPWP", nilai: sg.npwp }] : []),
    ...(bentuk.badan === "hukum"
      ? [{ label: "Akta Notaris", nilai: v.aktaNotaris }]
      : []),
    ...(bentuk.badan === "hukum"
      ? [{ label: "SK Kemenkumham", nilai: v.skKemenkumham }]
      : []),
    ...(bentuk.badan === "usaha"
      ? [{ label: "Akta Pendirian Usaha", nilai: v.aktaUsaha }]
      : []),
    ...(bentuk.badan === "usaha" ? [{ label: "NIB", nilai: v.nib }] : []),
    ...(bentuk.induk
      ? [{ label: "Organisasi Induk", nilai: v.namaInduk }]
      : []),
    ...(bentuk.induk ? [{ label: "Alamat Induk", nilai: v.alamatInduk }] : []),
  ];
  return tabelIdentitasHtml(rows);
}

/** Kalimat rujukan dasar kedudukan, dipakai berulang di beberapa template. */
function kalimatDasar(ctx: RenderCtx): string {
  const { bentuk, v } = ctx;
  switch (bentuk.id) {
    case "mandiri-non-bh":
      return "Sanggar berkedudukan sebagai sanggar mandiri yang belum berbadan hukum, berdiri atas dasar kesepakatan musyawarah para pendiri/anggota.";
    case "unit-non-bh":
      return `Sanggar berkedudukan sebagai unit kegiatan kesenian di bawah ${v.namaInduk?.trim() || "organisasi induk"} (organisasi non badan hukum), berdasarkan penunjukan/kesepakatan organisasi induk.`;
    case "mandiri-bh":
      return `Sanggar berkedudukan sebagai sanggar mandiri berbadan hukum berdasarkan ${v.aktaNotaris?.trim() ? `Akta Notaris ${v.aktaNotaris.trim()}` : "akta pendirian badan hukum"}${v.skKemenkumham?.trim() ? ` dan SK Kemenkumham Nomor ${v.skKemenkumham.trim()}` : ""}.`;
    case "mandiri-bu":
      return `Sanggar berkedudukan sebagai sanggar mandiri berbadan usaha berdasarkan ${v.aktaUsaha?.trim() ? `Akta Pendirian Usaha ${v.aktaUsaha.trim()}` : "akta pendirian badan usaha"}${v.nib?.trim() ? ` dengan NIB ${v.nib.trim()}` : ""}.`;
    case "unit-bh":
      return `Sanggar berkedudukan sebagai unit kegiatan kesenian di bawah ${v.namaInduk?.trim() || "organisasi induk"} (berbadan hukum), berdasarkan surat keputusan penetapan unit oleh organisasi induk.`;
    case "unit-bu":
      return `Sanggar berkedudukan sebagai unit kegiatan kesenian di bawah ${v.namaInduk?.trim() || "perusahaan induk"} (berbadan usaha), berdasarkan surat keputusan penetapan unit oleh perusahaan induk.`;
  }
}

export const TEMPLATE_DOKUMEN: TemplateDokumen[] = [
  {
    id: "keterangan-kedudukan",
    judul: "Surat Keterangan Bentuk & Kedudukan Sanggar",
    deskripsi:
      "Menerangkan bentuk dan kedudukan sanggar beserta dasar legitimasinya — lampiran umum untuk pengajuan ke dinas/lembaga.",
    bentuk: "semua",
    fields: [
      {
        key: "nomor",
        label: "Nomor Surat",
        placeholder: "001/SKK/SGR/VII/2026",
      },
      {
        key: "keperluan",
        label: "Keperluan Surat",
        type: "pilihan",
        opsi: [
          "pendaftaran kurasi sanggar",
          "pengajuan fasilitasi kegiatan kesenian",
          "pendataan sanggar di Dinas Kebudayaan",
          "pengajuan bantuan/hibah kegiatan kebudayaan",
          "kelengkapan administrasi kerja sama",
        ],
        standar: "pendaftaran kurasi sanggar",
      },
    ],
    render: (ctx) =>
      judulHtml("Surat Keterangan", ctx.v.nomor) +
      p(
        `Yang bertanda tangan di bawah ini, ${jabatanPemilikDenganNama(ctx.sg)}, dengan ini menerangkan identitas dan kedudukan sanggar sebagai berikut:`,
      ) +
      identitasHtml(ctx) +
      p(kalimatDasar(ctx)) +
      p(
        `Surat keterangan ini dibuat dengan sebenar-benarnya untuk keperluan ${ctx.v.keperluan?.trim() || "administrasi"}, dan dapat dipergunakan sebagaimana mestinya.`,
      ),
  },
  {
    id: "pernyataan-pendirian",
    judul: "Surat Pernyataan Pendirian Sanggar",
    deskripsi:
      "Pernyataan berdirinya sanggar atas kesepakatan para pendiri untuk administrasi sanggar yang belum berbadan hukum.",
    bentuk: ["mandiri-non-bh"],
    fields: [
      {
        key: "tanggalPendirian",
        label: "Tanggal Pendirian",
        placeholder: "17 Agustus 2015",
        petunjuk: "Isi tanggal pendirian yang tercatat dalam kesepakatan para pendiri.",
      },
      {
        key: "paraPendiri",
        label: "Para Pendiri (satu per baris)",
        type: "textarea",
        placeholder: "1. Nama — alamat\n2. Nama — alamat",
      },
      {
        key: "maksudTujuan",
        label: "Maksud & Tujuan",
        type: "textarea",
        placeholder: "Melestarikan dan mengembangkan kesenian Betawi ...",
      },
    ],
    render: (ctx) =>
      judulHtml("Surat Pernyataan Pendirian Sanggar") +
      p(
        `Berdasarkan kesepakatan para pendiri ${ctx.sg.namaSanggar}, pada ${ctx.v.tanggalPendirian?.trim() || "tanggal yang disepakati"} telah didirikan sanggar kesenian dengan identitas sebagai berikut:`,
      ) +
      identitasHtml(ctx) +
      (ctx.v.maksudTujuan?.trim()
        ? p("Maksud dan tujuan pendirian sanggar:") + pra(ctx.v.maksudTujuan)
        : "") +
      (ctx.v.paraPendiri?.trim()
        ? p("Para pendiri:") + pra(ctx.v.paraPendiri)
        : "") +
      p(
        "Sanggar didirikan atas dasar kesepakatan musyawarah para pendiri dan belum berbadan hukum. Pernyataan ini dibuat dengan sebenar-benarnya untuk dipergunakan sebagaimana mestinya.",
      ),
  },
  {
    id: "sk-pengurus",
    judul: "Keputusan Organisasi tentang Susunan Pengurus",
    deskripsi:
      "Penetapan susunan pengurus sanggar untuk satu periode, dengan dasar keputusan menyesuaikan bentuk sanggar.",
    bentuk: "semua",
    fields: [
      { key: "nomor", label: "Nomor SK", placeholder: "001/SK/SGR/VII/2026" },
      {
        key: "periode",
        label: "Periode Kepengurusan",
        placeholder: "2026–2029",
      },
      {
        key: "susunanPengurus",
        label: "Susunan Pengurus (satu per baris)",
        type: "textarea",
        placeholder: "Ketua: Nama\nSekretaris: Nama\nBendahara: Nama",
      },
      {
        key: "tanggalPenetapan",
        label: "Tanggal Penetapan",
        isiAwal: () => tanggalCetak(),
      },
    ],
    render: (ctx) =>
      judulHtml("Keputusan Organisasi", ctx.v.nomor) +
      tentangHtml(
        `Penetapan Susunan Pengurus ${ctx.sg.namaSanggar} Periode ${ctx.v.periode?.trim() || "berjalan"}`,
      ) +
      menimbangHtml([
        "Demi kelancaran organisasi dan kegiatan kesenian, perlu ditetapkan susunan pengurus sanggar.",
      ]) +
      mengingatHtml([ctx.bentuk.dasar]) +
      memutuskanHtml() +
      menetapkanHtml(`Keputusan tentang Susunan Pengurus ${ctx.sg.namaSanggar}.`) +
      diktumHtml("Kesatu", "Menetapkan susunan pengurus sebagai berikut:") +
      pra(ctx.v.susunanPengurus?.trim() || "-") +
      diktumHtml(
        "Kedua",
        `Keputusan ini berlaku sejak tanggal ditetapkan (${ctx.v.tanggalPenetapan?.trim() || tanggalCetak()}) sampai akhir periode kepengurusan, dan akan ditinjau kembali apabila terdapat kekeliruan.`,
      ),
  },
  {
    id: "penetapan-unit",
    judul: "Surat Penetapan Unit Sanggar oleh Induk",
    deskripsi:
      "Draf surat keputusan organisasi/perusahaan induk yang menetapkan sanggar sebagai unit kegiatannya — ditandatangani pimpinan induk.",
    bentuk: ["unit-non-bh", "unit-bh", "unit-bu"],
    fields: [
      {
        key: "nomor",
        label: "Nomor Surat",
        placeholder: "005/SK-UNIT/VII/2026",
      },
      {
        key: "tugasUnit",
        label: "Tugas/Lingkup Unit",
        type: "textarea",
        placeholder: "Menyelenggarakan latihan dan pertunjukan kesenian ...",
      },
    ],
    render: (ctx) =>
      judulHtml("Surat Penetapan Unit Kegiatan Kesenian", ctx.v.nomor) +
      bismillahHtml() +
      p(
        `Yang bertanda tangan di bawah ini, ${ctx.v.jabatanPimpinanInduk?.trim() || "Pimpinan"} ${ctx.v.namaInduk?.trim() || "organisasi induk"}${ctx.v.alamatInduk?.trim() ? `, beralamat di ${ctx.v.alamatInduk.trim()}` : ""}, dengan ini menetapkan:`,
      ) +
      diktumHtml(
        "Kesatu",
        `Menetapkan ${ctx.sg.namaSanggar} sebagai unit kegiatan kesenian yang berada di bawah dan bertanggung jawab kepada ${ctx.v.namaInduk?.trim() || "organisasi induk"}.`,
      ) +
      identitasHtml(ctx) +
      (ctx.v.tugasUnit?.trim()
        ? diktumHtml("Kedua", "Lingkup tugas unit:") + pra(ctx.v.tugasUnit)
        : "") +
      diktumHtml(
        ctx.v.tugasUnit?.trim() ? "Ketiga" : "Kedua",
        "Surat penetapan ini berlaku sejak tanggal ditetapkan dan menjadi dasar kedudukan unit dalam menjalankan kegiatannya.",
      ),
    ttdOverride: (ctx) => ({
      jabatan: ctx.v.jabatanPimpinanInduk?.trim() || "Pimpinan Induk",
      nama: ctx.v.pimpinanInduk?.trim() || "………………………",
    }),
  },
  {
    id: "permohonan-pencatatan",
    judul: "Surat Permohonan Pencatatan/Pendataan Sanggar",
    deskripsi:
      "Permohonan pencatatan sanggar ke Dinas Kebudayaan dengan lampiran dokumen sesuai bentuk sanggar.",
    bentuk: "semua",
    fields: [
      {
        key: "nomor",
        label: "Nomor Surat",
        placeholder: "002/PMH/SGR/VII/2026",
      },
      {
        key: "tujuan",
        label: "Ditujukan Kepada",
        isiAwal: () => "Kepala Dinas Kebudayaan Provinsi DKI Jakarta",
      },
    ],
    render: (ctx) => {
      const lampiran: string[] = ["Profil sanggar", "Susunan pengurus"];
      if (ctx.bentuk.badan === "hukum")
        lampiran.push("Salinan akta notaris dan SK Kemenkumham");
      if (ctx.bentuk.badan === "usaha")
        lampiran.push("Salinan akta pendirian usaha dan NIB");
      if (ctx.bentuk.badan === "non" && !ctx.bentuk.induk)
        lampiran.push("Surat pernyataan pendirian sanggar");
      if (ctx.bentuk.induk)
        lampiran.push("Surat penetapan unit dari organisasi induk");
      const itemLampiran = lampiran
        .map((l) => safeHtml`<li style="margin:2px 0">${l}</li>`)
        .join("");
      return (
        judulHtml("Surat Permohonan Pencatatan Sanggar", ctx.v.nomor) +
        p(
          `Kepada Yth. ${ctx.v.tujuan?.trim() || "Kepala Dinas Kebudayaan Provinsi DKI Jakarta"} di tempat.`,
        ) +
        p(
          `Dengan hormat, kami ${jabatanPemilikDenganNama(ctx.sg)} mengajukan permohonan pencatatan/pendataan sanggar dengan identitas sebagai berikut:`,
        ) +
        identitasHtml(ctx) +
        p(kalimatDasar(ctx)) +
        p("Sebagai kelengkapan, bersama surat ini kami lampirkan:") +
        `<ol style="margin:0 0 12px;padding-left:30px">${itemLampiran}</ol>` +
        p(
          "Demikian permohonan ini kami sampaikan. Atas perhatian dan perkenannya kami ucapkan terima kasih.",
        )
      );
    },
  },
  {
    id: "surat-permohonan",
    judul: "Surat Permohonan Umum",
    deskripsi:
      "Surat permohonan bebas (izin kegiatan, dukungan, fasilitasi, dsb.) dengan identitas kedudukan sanggar.",
    bentuk: "semua",
    fields: [
      {
        key: "nomor",
        label: "Nomor Surat",
        placeholder: "003/PMH/SGR/VII/2026",
      },
      {
        key: "perihal",
        label: "Perihal",
        type: "pilihan",
        opsi: [
          "Permohonan izin penyelenggaraan pentas seni",
          "Permohonan penggunaan gedung/tempat latihan",
          "Permohonan dukungan kegiatan kebudayaan",
          "Permohonan narasumber/pelatih",
          "Permohonan audiensi",
        ],
        standar: "Permohonan izin penyelenggaraan pentas seni",
      },
      {
        key: "tujuan",
        label: "Ditujukan Kepada",
        type: "pilihan",
        opsi: [
          "Kepala Dinas Kebudayaan Provinsi DKI Jakarta",
          "Kepala Suku Dinas Kebudayaan Kota Administrasi",
          "Camat setempat",
          "Lurah setempat",
          "Kepala Sekolah / Pimpinan Instansi",
        ],
        standar: "Kepala Dinas Kebudayaan Provinsi DKI Jakarta",
      },
      {
        key: "isi",
        label: "Isi Permohonan",
        type: "textarea",
        placeholder: "Sehubungan dengan rencana kegiatan ...",
      },
    ],
    render: (ctx) =>
      judulHtml("Surat Permohonan", ctx.v.nomor) +
      (ctx.v.perihal?.trim() ? p(`Perihal: ${ctx.v.perihal.trim()}`) : "") +
      p(
        `Kepada Yth. ${ctx.v.tujuan?.trim() || "pihak yang dituju"} di tempat.`,
      ) +
      p(
        `Dengan hormat, kami ${jabatanPemilikDenganNama(ctx.sg)} menyampaikan permohonan sebagai berikut:`,
      ) +
      pra(ctx.v.isi?.trim() || "-") +
      p(kalimatDasar(ctx)) +
      p(
        "Demikian permohonan ini kami sampaikan. Atas perhatian dan perkenannya kami ucapkan terima kasih.",
      ),
  },
  {
    id: "surat-undangan",
    judul: "Surat Undangan",
    deskripsi: "Undangan rapat, latihan gabungan, atau kegiatan sanggar.",
    bentuk: "semua",
    pakaiFieldBentuk: false,
    fields: [
      {
        key: "nomor",
        label: "Nomor Surat",
        placeholder: "004/UND/SGR/VII/2026",
      },
      {
        key: "tujuan",
        label: "Ditujukan Kepada",
        isiAwal: () => "Seluruh Anggota Sanggar",
      },
      {
        key: "acara",
        label: "Nama Acara",
        placeholder: "Rapat persiapan pentas seni",
      },
      {
        key: "hariTanggal",
        label: "Hari / Tanggal",
        placeholder: "Sabtu, 1 Agustus 2026",
      },
      { key: "waktu", label: "Waktu", placeholder: "13.00 WIB — selesai" },
      { key: "tempat", label: "Tempat", isiAwal: (sg) => sg.alamat },
      {
        key: "agenda",
        label: "Agenda (satu per baris)",
        type: "textarea",
        placeholder: "1. Pembahasan jadwal\n2. Pembagian tugas",
      },
    ],
    render: (ctx) =>
      judulHtml("Surat Undangan", ctx.v.nomor) +
      p(
        `Kepada Yth. ${ctx.v.tujuan?.trim() || "Bapak/Ibu/Saudara"} di tempat.`,
      ) +
      p(
        `Dengan hormat, dalam rangka ${ctx.v.acara?.trim() || "kegiatan sanggar"}, kami mengundang Bapak/Ibu/Saudara untuk hadir pada:`,
      ) +
      barisTabel([
        { label: "Hari / Tanggal", nilai: ctx.v.hariTanggal },
        { label: "Waktu", nilai: ctx.v.waktu },
        { label: "Tempat", nilai: ctx.v.tempat },
      ]) +
      (ctx.v.agenda?.trim() ? p("Agenda:") + pra(ctx.v.agenda) : "") +
      p(
        "Mengingat pentingnya acara tersebut, kehadiran tepat waktu sangat kami harapkan. Atas perhatiannya kami ucapkan terima kasih.",
      ),
  },
  {
    id: "surat-tugas",
    judul: "Surat Tugas",
    deskripsi:
      "Penugasan pengurus/anggota untuk mewakili sanggar dalam suatu kegiatan.",
    bentuk: "semua",
    pakaiFieldBentuk: false,
    fields: [
      {
        key: "nomor",
        label: "Nomor Surat",
        placeholder: "005/ST/SGR/VII/2026",
      },
      {
        key: "petugas",
        label: "Yang Ditugaskan (Nama — Jabatan, satu per baris)",
        type: "textarea",
        placeholder: "Nama — Pelatih Tari\nNama — Anggota",
      },
      {
        key: "tugas",
        label: "Untuk / Tugas",
        type: "textarea",
        placeholder: "Mewakili sanggar pada Festival Kesenian Jakarta ...",
      },
      {
        key: "waktuPelaksanaan",
        label: "Waktu Pelaksanaan",
        placeholder: "1–3 Agustus 2026",
      },
      { key: "tempat", label: "Tempat", placeholder: "Taman Ismail Marzuki" },
    ],
    render: (ctx) =>
      judulHtml("Surat Tugas", ctx.v.nomor) +
      p(
        `Yang bertanda tangan di bawah ini, ${jabatanPemilikDenganNama(ctx.sg)}, dengan ini menugaskan:`,
      ) +
      pra(ctx.v.petugas?.trim() || "-") +
      p("Untuk:") +
      pra(ctx.v.tugas?.trim() || "-") +
      barisTabel([
        { label: "Waktu Pelaksanaan", nilai: ctx.v.waktuPelaksanaan },
        { label: "Tempat", nilai: ctx.v.tempat },
      ]) +
      p(
        "Demikian surat tugas ini dibuat untuk dilaksanakan dengan penuh tanggung jawab, dan kepada pihak terkait dimohon bantuannya.",
      ),
  },
  {
    id: "berita-acara",
    judul: "Berita Acara Musyawarah/Rapat",
    deskripsi: "Dokumentasi resmi hasil musyawarah atau rapat sanggar.",
    bentuk: "semua",
    pakaiFieldBentuk: false,
    fields: [
      { key: "nomor", label: "Nomor", placeholder: "006/BA/SGR/VII/2026" },
      {
        key: "acara",
        label: "Nama Acara/Rapat",
        placeholder: "Musyawarah anggota tahunan",
      },
      {
        key: "hariTanggal",
        label: "Hari / Tanggal",
        placeholder: "Sabtu, 1 Agustus 2026",
      },
      { key: "tempat", label: "Tempat", isiAwal: (sg) => sg.alamat },
      {
        key: "jumlahPeserta",
        label: "Jumlah Peserta",
        placeholder: "25",
      },
      {
        key: "hasil",
        label: "Hasil / Keputusan (satu per baris)",
        type: "textarea",
        placeholder: "1. ...\n2. ...",
      },
    ],
    render: (ctx) =>
      judulHtml("Berita Acara", ctx.v.nomor) +
      p(
        `Pada ${ctx.v.hariTanggal?.trim() || "hari yang telah ditentukan"}, bertempat di ${ctx.v.tempat?.trim() || "sekretariat sanggar"}, telah dilaksanakan ${ctx.v.acara?.trim() || "musyawarah/rapat"} ${ctx.sg.namaSanggar}${ctx.v.jumlahPeserta?.trim() ? ` yang dihadiri ${ctx.v.jumlahPeserta.trim()}${/\b(?:orang|peserta)\s*$/i.test(ctx.v.jumlahPeserta.trim()) ? "" : " peserta"}` : ""}.`,
      ) +
      p("Musyawarah/rapat menghasilkan keputusan sebagai berikut:") +
      pra(ctx.v.hasil?.trim() || "-") +
      p(
        "Demikian berita acara ini dibuat dengan sebenar-benarnya untuk dipergunakan sebagaimana mestinya.",
      ),
  },
  {
    id: "surat-pernyataan",
    judul: "Surat Pernyataan",
    deskripsi:
      "Pernyataan resmi atas nama sanggar (kesanggupan, tanggung jawab, keabsahan data, dsb.).",
    bentuk: "semua",
    fields: [
      {
        key: "isi",
        label: "Isi Pernyataan",
        type: "textarea",
        placeholder:
          "Menyatakan sanggup mengikuti seluruh rangkaian pembinaan ...",
      },
    ],
    render: (ctx) =>
      judulHtml("Surat Pernyataan") +
      p(
        `Yang bertanda tangan di bawah ini, ${jabatanPemilikDenganNama(ctx.sg)}, atas nama sanggar dengan identitas:`,
      ) +
      identitasHtml(ctx) +
      p("dengan ini menyatakan dengan sesungguhnya:") +
      pra(ctx.v.isi?.trim() || "-") +
      p(
        "Demikian pernyataan ini dibuat dengan sadar dan tanpa paksaan dari pihak mana pun, untuk dipergunakan sebagaimana mestinya.",
      ),
  },
  {
    id: "surat-kuasa",
    judul: "Surat Kuasa",
    deskripsi:
      "Pemberian kuasa kepada pengurus/anggota untuk mengurus keperluan administrasi sanggar.",
    bentuk: "semua",
    pakaiFieldBentuk: false,
    fields: [
      {
        key: "penerimaNama",
        label: "Nama Penerima Kuasa",
        placeholder: "Nama lengkap",
      },
      {
        key: "penerimaJabatan",
        label: "Jabatan Penerima Kuasa",
        type: "pilihan",
        opsi: [
          "Sekretaris Sanggar",
          "Bendahara Sanggar",
          "Wakil Ketua Sanggar",
          "Pengurus Bidang",
          "Anggota Sanggar",
        ],
        standar: "Sekretaris Sanggar",
      },
      {
        key: "keperluan",
        label: "Untuk Keperluan",
        type: "textarea",
        placeholder: "Mengurus pendaftaran sanggar di Dinas Kebudayaan ...",
      },
    ],
    render: (ctx) =>
      judulHtml("Surat Kuasa") +
      p(
        `Yang bertanda tangan di bawah ini, ${ctx.sg.namaKetua}, selaku ${jabatanPemilikDenganNama(ctx.sg)}, memberikan kuasa kepada:`,
      ) +
      barisTabel([
        { label: "Nama", nilai: ctx.v.penerimaNama },
        { label: "Jabatan", nilai: ctx.v.penerimaJabatan },
      ]) +
      p("Untuk keperluan:") +
      pra(ctx.v.keperluan?.trim() || "-") +
      p(
        "Segala akibat yang timbul dari pemberian kuasa ini menjadi tanggung jawab pemberi kuasa. Demikian surat kuasa ini dibuat untuk dipergunakan sebagaimana mestinya.",
      ),
  },
  {
    id: "laporan-kegiatan-induk",
    judul: "Laporan Kegiatan kepada Organisasi Induk",
    deskripsi:
      "Laporan berkala kegiatan unit sanggar kepada organisasi/perusahaan induk.",
    bentuk: ["unit-non-bh", "unit-bh", "unit-bu"],
    fields: [
      {
        key: "periode",
        label: "Periode Laporan",
        placeholder: "Semester I 2026",
      },
      {
        key: "ringkasan",
        label: "Ringkasan Kegiatan (satu per baris)",
        type: "textarea",
        placeholder: "1. Latihan rutin ...\n2. Pentas ...",
      },
      {
        key: "rencana",
        label: "Rencana Berikutnya",
        type: "textarea",
        placeholder: "1. ...",
      },
    ],
    render: (ctx) =>
      judulHtml(`Laporan Kegiatan ${ctx.v.periode?.trim() || ""}`.trim()) +
      p(
        `Kepada Yth. ${ctx.v.jabatanPimpinanInduk?.trim() || "Pimpinan"} ${ctx.v.namaInduk?.trim() || "organisasi induk"} di tempat.`,
      ) +
      p(
        `Bersama ini kami sampaikan laporan kegiatan ${ctx.sg.namaSanggar} selaku unit kegiatan kesenian, periode ${ctx.v.periode?.trim() || "berjalan"}:`,
      ) +
      pra(ctx.v.ringkasan?.trim() || "-") +
      (ctx.v.rencana?.trim()
        ? p("Rencana kegiatan berikutnya:") + pra(ctx.v.rencana)
        : "") +
      p(
        "Demikian laporan ini kami sampaikan sebagai bentuk pertanggungjawaban unit kepada organisasi induk. Atas perhatiannya kami ucapkan terima kasih.",
      ),
  },

  // ── ANGGARAN DASAR & ANGGARAN RUMAH TANGGA ────────────────────────────────
  // Seluruh bagian dapat dipilih (pilihan ganda) dan tersedia rumusan standar
  // melalui tombol "Isi Standar". Setiap pilihan masih dapat diubah/ditambah
  // lewat kotak isian bebas.
  {
    id: "ad-art",
    judul: "Anggaran Dasar & Anggaran Rumah Tangga (AD/ART)",
    deskripsi:
      "Dokumen dasar organisasi: maksud & tujuan, visi-misi, keanggotaan, kepengurusan, permusyawaratan, dan keuangan. Bisa diisi otomatis dengan rumusan standar lalu disesuaikan.",
    bentuk: "semua",
    pakaiFieldBentuk: false,
    fields: [
      {
        key: "tempatKedudukan",
        label: "Tempat Kedudukan",
        isiAwal: (sg) => sg.alamat ?? "",
        placeholder: "Jakarta",
      },
      {
        key: "tahunPendirian",
        label: "Tahun Pendirian",
        placeholder: "2020",
      },
      {
        key: "asas",
        label: "Asas Organisasi",
        type: "pilihan",
        opsi: [
          "Pancasila dan Undang-Undang Dasar Negara Republik Indonesia Tahun 1945",
          "Pancasila, UUD 1945, serta nilai budaya Betawi",
          "Kekeluargaan, gotong royong, dan pelestarian budaya",
        ],
        standar:
          "Pancasila dan Undang-Undang Dasar Negara Republik Indonesia Tahun 1945",
        petunjuk: "Dasar/asas yang dicantumkan pada Bab Asas dan Sifat.",
      },
      {
        key: "sifat",
        label: "Sifat Organisasi",
        type: "pilihan",
        opsi: [
          "Independen, nirlaba, dan terbuka bagi masyarakat",
          "Sosial, kekeluargaan, dan tidak berafiliasi politik",
          "Kekaryaan, profesional, dan berorientasi pembinaan",
        ],
        standar: "Independen, nirlaba, dan terbuka bagi masyarakat",
      },
      {
        key: "maksudTujuan",
        label: "Maksud & Tujuan",
        type: "pilihan-ganda",
        opsi: [
          "Melestarikan dan mengembangkan kesenian tradisional, khususnya seni budaya Betawi.",
          "Menjadi wadah pembinaan, pelatihan, dan regenerasi seniman.",
          "Meningkatkan apresiasi masyarakat terhadap seni dan budaya daerah.",
          "Menyelenggarakan pendidikan seni yang terstruktur dan berkelanjutan.",
          "Menjalin kerja sama dengan pemerintah, lembaga, dan komunitas seni lain.",
          "Meningkatkan kesejahteraan anggota melalui kegiatan seni yang produktif.",
          "Mendokumentasikan, mengarsipkan, dan menyebarluaskan pengetahuan seni secara bertanggung jawab.",
          "Membuka akses berkesenian yang ramah anak, inklusif, dan menghormati keberagaman.",
          "Mencegah segala bentuk eksploitasi terhadap seniman, anak, dan perempuan.",
        ],
        standar: [
          "Melestarikan dan mengembangkan kesenian tradisional, khususnya seni budaya Betawi.",
          "Menjadi wadah pembinaan, pelatihan, dan regenerasi seniman.",
          "Meningkatkan apresiasi masyarakat terhadap seni dan budaya daerah.",
          "Menjalin kerja sama dengan pemerintah, lembaga, dan komunitas seni lain.",
        ].join("\n"),
        petunjuk:
          "Centang yang sesuai. Bisa ditambah sendiri pada kotak isian bebas.",
      },
      {
        key: "visi",
        label: "Visi",
        type: "pilihan",
        opsi: [
          "Menjadi sanggar seni yang unggul, mandiri, dan berperan aktif dalam pelestarian budaya daerah.",
          "Menjadi pusat pembinaan seni budaya yang profesional dan berkelanjutan.",
          "Terwujudnya generasi pelestari budaya yang berkarakter dan berdaya saing.",
        ],
        standar:
          "Menjadi sanggar seni yang unggul, mandiri, dan berperan aktif dalam pelestarian budaya daerah.",
      },
      {
        key: "misi",
        label: "Misi",
        type: "pilihan-ganda",
        opsi: [
          "Menyelenggarakan latihan rutin dan pembinaan seni secara terstruktur.",
          "Menyelenggarakan pertunjukan dan pergelaran seni secara berkala.",
          "Mengembangkan kurikulum dan metode pelatihan seni yang sistematis.",
          "Membangun tata kelola organisasi yang tertib, transparan, dan akuntabel.",
          "Menjalin kemitraan dengan pemerintah, sekolah, dan komunitas seni.",
          "Mendorong regenerasi melalui pelibatan anak dan remaja.",
          "Menjaga ruang berkesenian yang aman, inklusif, dan bebas diskriminasi.",
          "Mengembangkan dokumentasi, publikasi, dan pemanfaatan teknologi secara bertanggung jawab.",
          "Melakukan evaluasi program dan pengelolaan risiko secara berkala.",
        ],
        standar: [
          "Menyelenggarakan latihan rutin dan pembinaan seni secara terstruktur.",
          "Menyelenggarakan pertunjukan dan pergelaran seni secara berkala.",
          "Membangun tata kelola organisasi yang tertib, transparan, dan akuntabel.",
          "Mendorong regenerasi melalui pelibatan anak dan remaja.",
        ].join("\n"),
      },
      {
        key: "jenisKeanggotaan",
        label: "Jenis Keanggotaan",
        type: "pilihan-ganda",
        opsi: [
          "Anggota Relawan — pihak yang membantu kegiatan tanpa status peserta latihan tetap.",
          "Anggota Alumni — mantan peserta/pengurus yang tetap mendukung program sanggar.",
          "Anggota Biasa — seniman/peserta didik yang terdaftar dan aktif mengikuti kegiatan.",
          "Anggota Muda — peserta didik pemula yang masih dalam masa pembinaan dasar.",
          "Anggota Luar Biasa — anggota yang tidak aktif berlatih namun mendukung kegiatan.",
          "Anggota Kehormatan — tokoh atau pihak yang berjasa bagi sanggar.",
          "Pelatih/Instruktur — anggota yang bertugas membina dan melatih.",
          "Anggota Kolektif — kelompok/komunitas yang bergabung secara kelembagaan.",
        ],
        standar: [
          "Anggota Biasa — seniman/peserta didik yang terdaftar dan aktif mengikuti kegiatan.",
          "Anggota Muda — peserta didik pemula yang masih dalam masa pembinaan dasar.",
          "Anggota Kehormatan — tokoh atau pihak yang berjasa bagi sanggar.",
          "Pelatih/Instruktur — anggota yang bertugas membina dan melatih.",
        ].join("\n"),
      },
      {
        key: "strukturPengurus",
        label: "Struktur Kepengurusan",
        type: "pilihan-ganda",
        opsi: [
          "Pembina",
          "Penasihat",
          "Ketua",
          "Wakil Ketua",
          "Sekretaris",
          "Wakil Sekretaris",
          "Bendahara",
          "Wakil Bendahara",
          "Bidang Kesenian dan Latihan",
          "Bidang Produksi dan Pertunjukan",
          "Bidang Humas dan Publikasi",
          "Bidang Sarana dan Prasarana",
          "Bidang Keanggotaan dan Kaderisasi",
          "Bidang Usaha dan Kemitraan",
          "Bidang Pendidikan dan Kurikulum",
          "Bidang Keuangan dan Penggalangan Dana",
          "Bidang Perlindungan, Kesejahteraan, dan Keselamatan Peserta",
          "Koordinator Wilayah/Komunitas",
        ],
        standar: [
          "Pembina",
          "Ketua",
          "Sekretaris",
          "Bendahara",
          "Bidang Kesenian dan Latihan",
          "Bidang Produksi dan Pertunjukan",
          "Bidang Humas dan Publikasi",
        ].join("\n"),
        petunjuk: "Jabatan yang dicantumkan pada Bab Kepengurusan.",
      },
      {
        key: "masaJabatan",
        label: "Masa Jabatan Pengurus",
        type: "pilihan",
        opsi: ["3 (tiga) tahun", "4 (empat) tahun", "5 (lima) tahun"],
        standar: "3 (tiga) tahun",
      },
      {
        key: "jenisRapat",
        label: "Jenis Rapat / Permusyawaratan",
        type: "pilihan-ganda",
        opsi: [
          "Rapat Koordinasi Daring — koordinasi melalui media elektronik bila diperlukan.",
          "Rapat Konsultasi/Pembina — meminta masukan dari pembina, penasihat, atau pihak yang kompeten.",
          "Musyawarah Besar — forum tertinggi, diselenggarakan setiap akhir masa jabatan.",
          "Musyawarah Luar Biasa — diselenggarakan bila terjadi keadaan mendesak.",
          "Rapat Kerja — menyusun program kerja dan anggaran tahunan.",
          "Rapat Pengurus Harian — evaluasi pelaksanaan kegiatan secara berkala.",
          "Rapat Anggota — menyampaikan aspirasi dan laporan kepada anggota.",
          "Rapat Bidang — koordinasi teknis pada masing-masing bidang.",
          "Rapat Evaluasi Kegiatan — dilaksanakan setelah pergelaran/kegiatan besar.",
        ],
        standar: [
          "Musyawarah Besar — forum tertinggi, diselenggarakan setiap akhir masa jabatan.",
          "Rapat Kerja — menyusun program kerja dan anggaran tahunan.",
          "Rapat Pengurus Harian — evaluasi pelaksanaan kegiatan secara berkala.",
          "Rapat Anggota — menyampaikan aspirasi dan laporan kepada anggota.",
        ].join("\n"),
      },
      {
        key: "sumberKeuangan",
        label: "Sumber Keuangan",
        type: "pilihan-ganda",
        opsi: [
          "Iuran anggota",
          "Hasil pementasan dan jasa kesenian",
          "Bantuan pemerintah yang sah dan tidak mengikat",
          "Sumbangan donatur yang sah dan tidak mengikat",
          "Usaha lain yang halal dan tidak bertentangan dengan peraturan",
          "Hasil kerja sama dengan mitra atau sponsor",
          "Pendapatan kelas, pelatihan, atau jasa kesenian yang sah",
          "Penggalangan dana yang sah, transparan, dan dapat dipertanggungjawabkan",
          "Pemanfaatan aset sanggar sesuai keputusan organisasi",
        ],
        standar: [
          "Iuran anggota",
          "Hasil pementasan dan jasa kesenian",
          "Bantuan pemerintah yang sah dan tidak mengikat",
          "Sumbangan donatur yang sah dan tidak mengikat",
        ].join("\n"),
      },
      {
        key: "kewajibanAnggota",
        label: "Kewajiban Anggota",
        type: "pilihan-ganda",
        opsi: [
          "Menaati Anggaran Dasar, Anggaran Rumah Tangga, dan keputusan organisasi.",
          "Mengikuti latihan dan kegiatan sanggar secara tertib.",
          "Menjaga nama baik sanggar di dalam maupun di luar kegiatan.",
          "Membayar iuran yang telah ditetapkan.",
          "Memelihara sarana, prasarana, dan properti sanggar.",
          "Menjaga kerukunan serta menghindari perbuatan diskriminatif.",
          "Menjaga keselamatan, kenyamanan, dan kerahasiaan data pribadi sesama anggota.",
          "Melaporkan konflik kepentingan atau potensi pelanggaran kepada pengurus.",
        ],
        standar: [
          "Menaati Anggaran Dasar, Anggaran Rumah Tangga, dan keputusan organisasi.",
          "Mengikuti latihan dan kegiatan sanggar secara tertib.",
          "Menjaga nama baik sanggar di dalam maupun di luar kegiatan.",
          "Membayar iuran yang telah ditetapkan.",
        ].join("\n"),
      },
      {
        key: "hakAnggota",
        label: "Hak Anggota",
        type: "pilihan-ganda",
        opsi: [
          "Mengikuti seluruh kegiatan dan pelatihan yang diselenggarakan sanggar.",
          "Menyampaikan pendapat, usul, dan saran kepada pengurus.",
          "Memilih dan dipilih menjadi pengurus sesuai ketentuan.",
          "Memperoleh pembinaan, bimbingan, dan sertifikat/tanda lulus.",
          "Mendapat perlakuan yang setara tanpa diskriminasi.",
          "Memperoleh pembagian hasil pementasan sesuai ketentuan yang berlaku.",
          "Memperoleh informasi program, keputusan, dan pertanggungjawaban keuangan secara proporsional.",
          "Mendapat perlindungan dari kekerasan, pelecehan, dan perlakuan tidak patut dalam kegiatan sanggar.",
        ],
        standar: [
          "Mengikuti seluruh kegiatan dan pelatihan yang diselenggarakan sanggar.",
          "Menyampaikan pendapat, usul, dan saran kepada pengurus.",
          "Memilih dan dipilih menjadi pengurus sesuai ketentuan.",
          "Mendapat perlakuan yang setara tanpa diskriminasi.",
        ].join("\n"),
      },
      {
        key: "catatanTambahan",
        opsional: true,
        label: "Ketentuan Tambahan (opsional)",
        type: "textarea",
        placeholder:
          "Hal khusus yang ingin dicantumkan pada Ketentuan Penutup.",
      },
    ],
    render: (ctx) => {
      const { sg, v } = ctx;
      const nama = sg.namaSanggar;
      const daftar = (nilai?: string) => pecahPilihan(nilai);
      const ayatDaftar = (nilai: string | undefined, kosong: string) => {
        const items = daftar(nilai);
        if (items.length === 0) return hurufHtml("a", kosong);
        return items
          .map((t, i) => hurufHtml(nomorHurufDokumen(i), t))
          .join("");
      };
      const tempat = v.tempatKedudukan?.trim() || sg.alamat || "Jakarta";

      return (
        judulHtml("Anggaran Dasar dan Anggaran Rumah Tangga") +
        safeHtml`<div style="text-align:center;font-weight:bold;margin:-4px 0 14px">${nama.toUpperCase()}</div>` +
        babHtml("BAB I") +
        bagianHtml("NAMA, WAKTU, DAN TEMPAT KEDUDUKAN") +
        pasalHtml(1) +
        ayatHtml(
          1,
          `Organisasi ini bernama ${nama}, selanjutnya disebut Sanggar.`,
        ) +
        ayatHtml(
          2,
          `Sanggar didirikan pada tahun ${v.tahunPendirian?.trim() || "……"} untuk jangka waktu yang tidak ditentukan lamanya.`,
        ) +
        ayatHtml(3, `Sanggar berkedudukan di ${tempat}.`) +
        babHtml("BAB II") +
        bagianHtml("ASAS DAN SIFAT") +
        pasalHtml(2) +
        ayatHtml(
          1,
          `Sanggar berasaskan ${v.asas?.trim() || "Pancasila dan Undang-Undang Dasar Negara Republik Indonesia Tahun 1945"}.`,
        ) +
        ayatHtml(
          2,
          `Sanggar bersifat ${v.sifat?.trim() || "independen, nirlaba, dan terbuka bagi masyarakat"}.`,
        ) +
        babHtml("BAB III") +
        bagianHtml("MAKSUD DAN TUJUAN") +
        pasalHtml(3) +
        ayatDaftar(
          v.maksudTujuan,
          "Melestarikan dan mengembangkan kesenian tradisional.",
        ) +
        babHtml("BAB IV") +
        bagianHtml("VISI DAN MISI") +
        pasalHtml(4) +
        ayatHtml(1, `Visi: ${v.visi?.trim() || "……"}`) +
        `<div style="margin:4px 0 2px">(2) Misi:</div>` +
        ayatDaftar(v.misi, "……") +
        babHtml("BAB V") +
        bagianHtml("KEANGGOTAAN") +
        pasalHtml(5) +
        `<div style="margin:4px 0 2px">(1) Keanggotaan Sanggar terdiri atas:</div>` +
        ayatDaftar(v.jenisKeanggotaan, "Anggota Biasa.") +
        pasalHtml(6) +
        `<div style="margin:4px 0 2px">(1) Setiap anggota berhak:</div>` +
        ayatDaftar(v.hakAnggota, "Mengikuti kegiatan sanggar.") +
        `<div style="margin:8px 0 2px">(2) Setiap anggota berkewajiban:</div>` +
        ayatDaftar(
          v.kewajibanAnggota,
          "Menaati AD/ART dan keputusan organisasi.",
        ) +
        babHtml("BAB VI") +
        bagianHtml("KEPENGURUSAN") +
        pasalHtml(7) +
        `<div style="margin:4px 0 2px">(1) Susunan pengurus Sanggar terdiri atas:</div>` +
        ayatDaftar(v.strukturPengurus, "Ketua, Sekretaris, dan Bendahara.") +
        ayatHtml(
          2,
          `Masa jabatan pengurus adalah ${v.masaJabatan?.trim() || "3 (tiga) tahun"} dan setelahnya dapat dipilih kembali.`,
        ) +
        ayatHtml(
          3,
          "Pengurus dipilih dan ditetapkan melalui forum permusyawaratan tertinggi.",
        ) +
        babHtml("BAB VII") +
        bagianHtml("PERMUSYAWARATAN") +
        pasalHtml(8) +
        `<div style="margin:4px 0 2px">(1) Permusyawaratan dalam Sanggar terdiri atas:</div>` +
        ayatDaftar(v.jenisRapat, "Musyawarah Besar dan Rapat Pengurus.") +
        ayatHtml(
          2,
          "Keputusan diambil secara musyawarah untuk mufakat; apabila tidak tercapai, dilakukan pemungutan suara.",
        ) +
        babHtml("BAB VIII") +
        bagianHtml("KEUANGAN DAN KEKAYAAN") +
        pasalHtml(9) +
        `<div style="margin:4px 0 2px">(1) Keuangan Sanggar diperoleh dari:</div>` +
        ayatDaftar(v.sumberKeuangan, "Iuran anggota.") +
        ayatHtml(
          2,
          "Pengelolaan keuangan dilakukan secara tertib, transparan, dan dapat dipertanggungjawabkan kepada anggota.",
        ) +
        babHtml("BAB IX") +
        bagianHtml("PERUBAHAN DAN PEMBUBARAN") +
        pasalHtml(10) +
        ayatHtml(
          1,
          "Perubahan Anggaran Dasar dan Anggaran Rumah Tangga hanya dapat dilakukan melalui forum permusyawaratan tertinggi.",
        ) +
        ayatHtml(
          2,
          "Pembubaran Sanggar ditetapkan melalui forum permusyawaratan tertinggi dan kekayaan yang tersisa diserahkan kepada lembaga sejenis atau kegiatan sosial.",
        ) +
        babHtml("BAB X") +
        bagianHtml("KETENTUAN PENUTUP") +
        pasalHtml(11) +
        (v.catatanTambahan?.trim()
          ? ayatHtml(1, v.catatanTambahan.trim())
          : "") +
        ayatHtml(
          v.catatanTambahan?.trim() ? 2 : 1,
          "Hal-hal yang belum diatur dalam Anggaran Dasar ini diatur lebih lanjut dalam Anggaran Rumah Tangga dan peraturan organisasi.",
        ) +
        ayatHtml(
          v.catatanTambahan?.trim() ? 3 : 2,
          "Anggaran Dasar dan Anggaran Rumah Tangga ini berlaku sejak tanggal ditetapkan.",
        )
      );
    },
  },
];

export function templateUntukBentuk(id: BentukKedudukanId): TemplateDokumen[] {
  return TEMPLATE_DOKUMEN.filter(
    (t) => t.bentuk === "semua" || t.bentuk.includes(id),
  );
}

/** Blok TTD kustom (mis. pimpinan induk) — format TND DKI Jakarta. */
export function ttdKustomHtml(jabatan: string, nama: string): string {
  return ttdDkiHtml({
    kota: "Jakarta",
    tanggal: tanggalCetak(),
    jabatan,
    nama,
  });
}

// Re-export format helpers untuk penggunaan di luar modul ini
export {
  pasalHtml,
  ayatHtml,
  hurufHtml,
  menimbangHtml,
  mengingatHtml,
  memutuskanHtml,
  menetapkanHtml,
  diktumHtml,
  diktumDenganHuruf,
  keRomawi,
  keKata,
  TND,
} from "./dokumen-dki";
