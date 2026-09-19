/**
 * Konversi paket template dokumen administrasi sanggar (.docx) menjadi JSON HTML
 * untuk fitur "Paket Dokumen" di halaman Tools Dokumen Administrasi.
 *
 * Sumber: hasil ekstraksi zip attached_assets/dokumen_sanggar_sesuai_jenis_kedudukan_*.zip
 * (folder Paket_Sanggar). Jalankan:
 *   pnpm --filter @workspace/scripts run convert:dokumen-paket [dir-sumber]
 * Default dir sumber: /tmp/dokumen_templates/Paket_Sanggar
 *
 * Keluaran:
 * - artifacts/jak-sanggar/public/dokumen-paket/katalog/<paketId>.json
 * - artifacts/jak-sanggar/public/dokumen-paket/word/<paketId>/*.docx
 * Bentuk: { paketId, bentukId, variantId, label, dokumen: [{ id, judul, html }] }
 *
 * Catatan penting:
 * - 00_Paket.docx dilewati (gabungan seluruh dokumen lain).
 * - Token {{NAMA_TOKEN}} bisa terpecah lintas run di XML docx sehingga mammoth
 *   menyisipkan tag di tengah token. Fungsi repairSplitTokens memperbaikinya, lalu
 *   verifikasi keras membandingkan multiset token HTML vs XML mentah.
 * - Dua paket unit-non-bh berisi dokumen CONTOH (nilai sampel "Komunitas Seni
 *   Nusantara" dst. + penanda [KURUNG]) — dinormalisasi menjadi token lewat
 *   penggantian deterministik + verifikasi residu.
 */
import * as fs from "node:fs";
import { createRequire } from "node:module";
import * as path from "node:path";
import mammoth from "mammoth";

const require = createRequire(import.meta.url);
const { openZip } = require("mammoth/lib/unzip") as {
  openZip: (options: { path: string }) => Promise<DocxZip>;
};

const DEFAULT_SOURCE = path.join(
  process.env.USERPROFILE ?? "C:\\Users\\dipta",
  "Documents",
  "Codex",
  "2026-07-31",
  "dokumen-organisasi-rapih",
  "outputs",
  "extracted",
  "Paket_Sanggar_Rapi_Final",
  "Paket_Sanggar",
);
const SRC = path.resolve(process.argv[2] ?? DEFAULT_SOURCE);
const OUT = path.resolve(
  process.argv[3] ??
    path.join(
      import.meta.dirname,
      "../../artifacts/jak-sanggar/public/dokumen-paket",
    ),
);

type DocxZip = {
  read: (name: string, encoding?: string) => Promise<string>;
  write: (name: string, contents: string) => void;
  toArrayBuffer: () => Promise<ArrayBuffer>;
};

type TabelWord = {
  bergaris: boolean;
  lebarKolom: number[];
};

type LayoutWord = {
  pageWidthMm: number;
  pageHeightMm: number;
  orientation: "portrait" | "landscape";
  marginTopMm: number;
  marginRightMm: number;
  marginBottomMm: number;
  marginLeftMm: number;
};

interface PaketDef {
  paketId: string;
  bentukId: string;
  variantId: string | null;
  label: string;
  dir: string;
  ids: readonly string[];
  contoh?: boolean;
}

const ID_MANDIRI_NON_BH = [
  "01_Form_Data",
  "02_BA_Musyawarah",
  "03_Pernyataan_Mandiri",
  "04_AD",
  "05_ART",
  "06_SK_Pembentukan",
  "07_SK_Atribut",
  "08_SK_Pelatih",
  "09_SK_Keuangan",
] as const;

const ID_MANDIRI_ORGANISASI = [
  "01_Form_Data",
  "02_BA_Operasional",
  "03_SK_Identitas",
  "04_Pedoman_TataKelola",
  "05_SK_Pengelola",
  "06_Pernyataan_Status",
  "07_SK_Keuangan",
  "08_Notulen_DaftarHadir",
  "09_Buku_Administrasi",
  "10_Checklist_Legalitas",
] as const;

const ID_UNIT_ORGANISASI = [
  "01_Form_Data",
  "02_BA_Pembentukan",
  "03_SK_Pembentukan",
  "04_Pedoman_TataKelola",
  "05_SK_Pengelola",
  "06_Pernyataan_Status",
  "07_SK_Keuangan",
  "08_Notulen_DaftarHadir",
  "09_Buku_Administrasi",
  "10_Checklist",
] as const;

// ID singkat ini sudah dipakai arsip lama dan tidak boleh diganti.
const ID_UNIT_BADAN_USAHA = [
  "01_Form",
  "02_BA_Bentuk",
  "03_SK_Bentuk",
  "04_Pedoman",
  "05_SK_Pengelola",
  "06_Pernyataan",
  "07_SK_Keuangan",
  "08_Notulen_Hadir",
  "09_Buku_Admin",
  "10_Checklist",
] as const;

const ID_UNIT_NON_BH = [
  "01_BA_Induk",
  "02_Notulen_Induk",
  "03_DaftarHadir_Induk",
  "04_AD_Induk",
  "05_ART_Induk",
  "06_SK_Bentuk_Unit",
  "07_SK_Pelatih",
  "08_SK_Keuangan",
  "09_BA_Rapat_Unit",
] as const;

const PAKET: PaketDef[] = [
  { paketId: "mandiri-non-bh", bentukId: "mandiri-non-bh", variantId: null, label: "Sanggar Mandiri Tidak Berbadan Hukum", dir: "01 Mandiri Non Badan Hukum", ids: ID_MANDIRI_NON_BH },
  { paketId: "mandiri-bh-yayasan", bentukId: "mandiri-bh", variantId: "yayasan", label: "Sanggar Mandiri Berbadan Hukum - Yayasan", dir: "02 Mandiri Badan Hukum/01 Yayasan", ids: ID_MANDIRI_ORGANISASI },
  { paketId: "mandiri-bh-perkumpulan", bentukId: "mandiri-bh", variantId: "perkumpulan", label: "Sanggar Mandiri Berbadan Hukum - Perkumpulan", dir: "02 Mandiri Badan Hukum/02 Perkumpulan", ids: ID_MANDIRI_ORGANISASI },
  { paketId: "mandiri-bh-koperasi", bentukId: "mandiri-bh", variantId: "koperasi", label: "Sanggar Mandiri Berbadan Hukum - Koperasi", dir: "02 Mandiri Badan Hukum/03 Koperasi", ids: ID_MANDIRI_ORGANISASI },
  { paketId: "mandiri-bh-pt", bentukId: "mandiri-bh", variantId: "pt", label: "Sanggar Mandiri Berbadan Hukum - Perseroan Terbatas (PT)", dir: "02 Mandiri Badan Hukum/04 Perseroan Terbatas", ids: ID_MANDIRI_ORGANISASI },
  { paketId: "mandiri-bu-firma", bentukId: "mandiri-bu", variantId: "firma", label: "Sanggar Mandiri Berbadan Usaha - Firma", dir: "03 Mandiri Badan Usaha/01 Firma", ids: ID_MANDIRI_ORGANISASI },
  { paketId: "mandiri-bu-cv", bentukId: "mandiri-bu", variantId: "cv", label: "Sanggar Mandiri Berbadan Usaha - CV", dir: "03 Mandiri Badan Usaha/02 Persekutuan Komanditer", ids: ID_MANDIRI_ORGANISASI },
  { paketId: "unit-bh-yayasan", bentukId: "unit-bh", variantId: "yayasan", label: "Unit Sanggar di Bawah Yayasan", dir: "04 Unit Bawah Badan Hukum/01 Yayasan", ids: ID_UNIT_ORGANISASI },
  { paketId: "unit-bh-perkumpulan", bentukId: "unit-bh", variantId: "perkumpulan", label: "Unit Sanggar di Bawah Perkumpulan", dir: "04 Unit Bawah Badan Hukum/02 Perkumpulan", ids: ID_UNIT_ORGANISASI },
  { paketId: "unit-bh-koperasi", bentukId: "unit-bh", variantId: "koperasi", label: "Unit Sanggar di Bawah Koperasi", dir: "04 Unit Bawah Badan Hukum/03 Koperasi", ids: ID_UNIT_ORGANISASI },
  { paketId: "unit-bh-pt", bentukId: "unit-bh", variantId: "pt", label: "Unit Sanggar di Bawah Perseroan Terbatas (PT)", dir: "04 Unit Bawah Badan Hukum/04 Perseroan Terbatas", ids: ID_UNIT_ORGANISASI },
  { paketId: "unit-bu-firma", bentukId: "unit-bu", variantId: "firma", label: "Unit Sanggar di Bawah Firma", dir: "05 Unit Badan Usaha/01 Firma", ids: ID_UNIT_BADAN_USAHA },
  { paketId: "unit-bu-cv", bentukId: "unit-bu", variantId: "cv", label: "Unit Sanggar di Bawah CV", dir: "05 Unit Badan Usaha/02 Persekutuan Komanditer", ids: ID_UNIT_BADAN_USAHA },
  { paketId: "unit-non-bh-atribut-induk", bentukId: "unit-non-bh", variantId: "atribut-induk", label: "Unit Sanggar Non-Badan Hukum - Atribut Mengikuti Induk", dir: "06 Unit Non Badan Hukum/01 Atribut Induk", ids: ID_UNIT_NON_BH, contoh: true },
  { paketId: "unit-non-bh-atribut-khusus", bentukId: "unit-non-bh", variantId: "atribut-khusus", label: "Unit Sanggar Non-Badan Hukum - Atribut Khusus Unit", dir: "06 Unit Non Badan Hukum/02 Atribut Khusus", ids: ID_UNIT_NON_BH, contoh: true },
];

const JUDUL: Record<string, string> = {
  "01_Form_Data": "Formulir Data Induk",
  "01_Form": "Formulir Data Induk",
  "02_BA_Musyawarah": "Berita Acara Musyawarah Pembentukan",
  "02_BA_Operasional": "Berita Acara Penetapan Operasional",
  "02_BA_Pembentukan": "Berita Acara Pembentukan Unit",
  "02_BA_Bentuk": "Berita Acara Pembentukan Unit",
  "03_Pernyataan_Mandiri": "Surat Pernyataan Kedudukan Mandiri",
  "03_SK_Identitas": "Keputusan Penyelenggaraan dan Identitas",
  "03_SK_Pembentukan": "Keputusan Pembentukan Unit",
  "03_SK_Bentuk": "Keputusan Pembentukan Unit",
  "04_AD": "Anggaran Dasar",
  "05_ART": "Anggaran Rumah Tangga",
  "04_Pedoman_TataKelola": "Pedoman Organisasi dan Tata Kelola",
  "04_Pedoman": "Pedoman Organisasi dan Tata Kelola",
  "05_SK_Pengelola": "Keputusan Pengangkatan Pengelola",
  "06_SK_Pembentukan": "Keputusan Pembentukan dan Pengesahan",
  "06_Pernyataan_Status": "Surat Pernyataan Status dan Kewenangan",
  "06_Pernyataan": "Surat Pernyataan Status dan Kewenangan",
  "07_SK_Atribut": "Keputusan Atribut dan Identitas",
  "07_SK_Keuangan": "Keputusan Tata Kelola Keuangan",
  "08_SK_Pelatih": "Keputusan Penugasan Pelatih/Instruktur",
  "08_Notulen_DaftarHadir": "Notulen Rapat dan Daftar Hadir",
  "08_Notulen_Hadir": "Notulen Rapat dan Daftar Hadir",
  "09_SK_Keuangan": "Keputusan Iuran, Honorarium, dan Pembagian Penghasilan",
  "09_Buku_Administrasi": "Buku Administrasi Operasional",
  "09_Buku_Admin": "Buku Administrasi Operasional",
  "10_Checklist_Legalitas": "Checklist Legalitas dan Penggunaan Dokumen",
  "10_Checklist": "Checklist Pengesahan dan Penggunaan Dokumen",
  "01_BA_Induk": "Berita Acara Musyawarah Organisasi Induk",
  "02_Notulen_Induk": "Notulen Musyawarah Organisasi Induk",
  "03_DaftarHadir_Induk": "Daftar Hadir Musyawarah Organisasi Induk",
  "04_AD_Induk": "Anggaran Dasar Organisasi Induk",
  "05_ART_Induk": "Anggaran Rumah Tangga Organisasi Induk",
  "06_SK_Bentuk_Unit": "Keputusan Pembentukan Unit Kegiatan",
  "07_SK_Pelatih": "Keputusan Penugasan Pelatih/Instruktur",
  "08_SK_Keuangan": "Keputusan Keuangan Unit Kegiatan",
  "09_BA_Rapat_Unit": "Berita Acara Rapat Pembentukan Unit",
};

const TOKEN_RE = /\{\{[A-Z0-9_/]+\}\}/g;

/** Perbaiki token {{...}} yang terpecah oleh tag HTML hasil mammoth. */
function repairSplitTokens(html: string): string {
  return html.replace(
    /\{(?:<[^>]*>)*\{((?:[A-Z0-9_/]|<[^>]*>)+?)\}(?:<[^>]*>)*\}/g,
    (_m, inner: string) => `{{${inner.replace(/<[^>]*>/g, "")}}}`,
  );
}

function tokensOf(text: string): Map<string, number> {
  const map = new Map<string, number>();
  for (const m of urutanToken(text)) map.set(m, (map.get(m) ?? 0) + 1);
  return map;
}

function urutanToken(text: string): string[] {
  return (text.match(TOKEN_RE) ?? []).filter(
    (token) => token !== "{{PLACEHOLDER}}",
  );
}

/** Penggantian berurutan: ganti kemunculan ke-n dari pola dengan token ke-n. */
function replaceSequential(html: string, needle: string, tokens: string[]): string {
  let i = 0;
  const parts = html.split(needle);
  if (parts.length === 1) return html;
  let out = parts[0];
  for (let p = 1; p < parts.length; p++) {
    const t = tokens[Math.min(i, tokens.length - 1)];
    out += (t ?? needle) + parts[p];
    i++;
  }
  return out;
}

/** Normalisasi dokumen contoh unit-non-bh menjadi token. */
function normalizeContoh(html: string, base: string): string {
  let h = html;
  const ganti = (teks: string, pengganti: string) => {
    const aman = teks.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    h = h.replace(new RegExp(aman, "gi"), () => pengganti);
  };

  // Penanda kop
  ganti("[KOP SURAT UNIT KEGIATAN SANGGAR SEKAR PANDAN]", "{{KOP_SURAT_UNIT}}");
  ganti("[KOP SURAT KOMUNITAS SENI NUSANTARA]", "{{KOP_SURAT_INDUK}}");

  // Nomor dokumen (pola lengkap, per dokumen)
  const nomorByFile: Record<string, string> = {
    "01_BA_Induk": "{{NOMOR_BERITA_ACARA}}",
    "02_Notulen_Induk": "{{NOMOR_BERITA_ACARA}}",
    "06_SK_Bentuk_Unit": "{{NOMOR_KEPUTUSAN_PEMBENTUKAN}}",
    "07_SK_Pelatih": "{{NOMOR_KEPUTUSAN_PELATIH}}",
    "08_SK_Keuangan": "{{NOMOR_KEPUTUSAN_KEUANGAN}}",
    "09_BA_Rapat_Unit": "{{NOMOR_BERITA_ACARA_UNIT}}",
  };
  const nomorToken = nomorByFile[base];
  if (nomorToken) {
    for (const pat of ["[NOMOR]/BA-ORG/V/2023", "[NOMOR]/SK/V/2023", "[NOMOR]/SK-UK/V/2023", "[NOMOR]/BA-UK/V/2023"]) {
      ganti(pat, nomorToken);
    }
    ganti("NOMOR [NOMOR] TAHUN 2023", `NOMOR ${nomorToken}`);
  }

  // Alamat & tempat (yang panjang lebih dulu)
  ganti("Jl. Mawar No. 10, Jakarta Timur", "{{ALAMAT_LENGKAP_SANGGAR}}");
  ganti("Jalan Mawar Nomor 10, Jakarta Timur", "{{ALAMAT_LENGKAP_SANGGAR}}");
  ganti("Jakarta Timur", "{{KOTA}}");

  // Nama organisasi & sanggar
  ganti("Sanggar Sekar Pandan", "{{NAMA_SANGGAR}}");
  ganti("Sekar Pandan", "{{NAMA_SANGGAR}}");
  ganti("Komunitas Seni Nusantara", "{{NAMA_INDUK}}");
  ganti("Organisasi Seni Nusantara", "{{NAMA_INDUK}}");
  ganti("Seni Nusantara", "{{NAMA_INDUK}}");

  // Nama orang (per dokumen)
  const pimpinanMusyawarah = base === "01_BA_Induk" || base === "02_Notulen_Induk";
  ganti("Budi Santoso", pimpinanMusyawarah ? "{{NAMA_PIMPINAN_MUSYAWARAH}}" : "{{NAMA_KETUA_INDUK}}");
  ganti("Siti Rahayu", pimpinanMusyawarah ? "{{NAMA_NOTULIS}}" : "{{NAMA_SEKRETARIS}}");
  ganti("Ahmad Fauzi", "{{NAMA_PIMPINAN_UNIT}}");
  ganti("Dewi Lestari", "{{NAMA_BENDAHARA}}");

  // Tanggal & hari
  ganti("Senin, tanggal 15 bulan Mei tahun 2023", "{{HARI}}, tanggal {{TANGGAL_RAPAT}}");
  ganti("Senin, 15 Mei 2023", "{{HARI}}, {{TANGGAL_MUSYAWARAH}}");
  ganti("15 Mei 2023", "{{TANGGAL_MUSYAWARAH}}");
  h = h.replace(/\bSenin\b/gi, "{{HARI}}");

  // Bidang seni pada kalimat contoh
  ganti("bidang Tari", "bidang {{BIDANG_SENI}}");

  // Penanda kurung umum
  h = h.replace(
    /\[PUKUL\]\s+s\.d\.\s+\[PUKUL\]/gi,
    "{{PUKUL_MULAI}} s.d. {{PUKUL_SELESAI}}",
  );
  h = h.replace(/\[JUMLAH\]\s+orang/gi, "{{JUMLAH_PESERTA}} orang");
  ganti("[JUMLAH TAHUN]", "{{MASA_BAKTI_TAHUN}}");

  // Baris tabel berurutan (per dokumen)
  if (base === "06_SK_Bentuk_Unit") {
    h = replaceSequential(h, "[NAMA LENGKAP]", [
      "{{NAMA_KOORDINATOR_LATIHAN}}",
      "{{NAMA_KOORDINATOR_PERLENGKAPAN}}",
      "{{NAMA_KOORDINATOR_HUMAS}}",
    ]);
    h = replaceSequential(h, "[NIK]", [
      "{{NIK_PIMPINAN_UNIT}}",
      "{{NIK_SEKRETARIS}}",
      "{{NIK_BENDAHARA}}",
      "{{NIK_KOORDINATOR_LATIHAN}}",
      "{{NIK_KOORDINATOR_PERLENGKAPAN}}",
      "{{NIK_KOORDINATOR_HUMAS}}",
    ]);
  }
  if (base === "07_SK_Pelatih") {
    h = replaceSequential(h, "[NAMA PELATIH]", ["{{NAMA_PELATIH_1}}", "{{NAMA_PELATIH_2}}", "{{NAMA_PELATIH_3}}"]);
    h = replaceSequential(h, "[AKTIF/TIDAK AKTIF]", ["{{STATUS_PELATIH_1}}", "{{STATUS_PELATIH_2}}", "{{STATUS_PELATIH_3}}"]);
  }
  if (base === "08_SK_Keuangan") {
    h = replaceSequential(h, "Rp [NOMINAL]", [
      "Rp {{BIAYA_PENDAFTARAN}}",
      "Rp {{IURAN_BULANAN}}",
      "Rp {{BIAYA_LATIHAN_PER_PERTEMUAN}}",
      "Rp {{DANA_KOSTUM_PROPERTI}}",
      "Rp {{HONORARIUM_PELATIH}}",
    ]);
  }
  if (base === "09_BA_Rapat_Unit") {
    h = replaceSequential(h, "[Nama]", [
      "{{NAMA_WAKIL_KETUA}}",
      "{{NAMA_SEKRETARIS}}",
      "{{NAMA_BENDAHARA}}",
      "{{NAMA_KOORDINATOR_LATIHAN}}",
      "{{NAMA_KOORDINATOR_PERLENGKAPAN}}",
      "{{NAMA_KOORDINATOR_HUMAS}}",
    ]);
  }

  return h;
}

const RESIDU_CONTOH = [
  "Sekar Pandan", "Nusantara", "Budi", "Santoso", "Siti", "Rahayu",
  "Ahmad Fauzi", "Fauzi", "Dewi Lestari", "Lestari", "Mei 2023", "15 Mei",
  "Jakarta Timur", "Mawar", "Senin", "[NOMOR]", "[PUKUL]", "[JUMLAH",
  "[Nama]", "[NIK]", "[NAMA", "[NOMINAL]", "[KOP", "[AKTIF",
];

const STYLE_MAP_CETAK = [
  "br[type='page'] => hr.dokumen-template__page-break:fresh",
];

/** Cari semua <w:tbl> secara bertumpuk agar urutan tabel bersarang tetap sama. */
function rentangTabelWord(xml: string): string[] {
  const tag = /<\/?w:tbl(?:\s[^>]*)?>/gi;
  const terbuka: number[] = [];
  const rentang: Array<{ mulai: number; akhir: number }> = [];
  let cocok: RegExpExecArray | null;
  while ((cocok = tag.exec(xml))) {
    if (cocok[0].startsWith("</")) {
      const mulai = terbuka.pop();
      if (mulai !== undefined) rentang.push({ mulai, akhir: tag.lastIndex });
    } else {
      terbuka.push(cocok.index);
    }
  }
  if (terbuka.length) throw new Error("Struktur tabel Word tidak seimbang.");
  return rentang
    .sort((a, b) => a.mulai - b.mulai)
    .map(({ mulai, akhir }) => xml.slice(mulai, akhir));
}

function tabelWord(xml: string): TabelWord[] {
  return rentangTabelWord(xml).map((tabel) => {
    const batasBaris = tabel.search(/<w:tr\b/i);
    const properti = batasBaris >= 0 ? tabel.slice(0, batasBaris) : tabel;
    const blokGaris =
      properti.match(
        /<w:tblBorders\b[^>]*>[\s\S]*?<\/w:tblBorders>/i,
      )?.[0] ?? "";
    const bergaris =
      /\bw:val\s*=\s*["'](?!nil["']|none["'])[^"']+["']/i.test(
        blokGaris,
      );
    const grid =
      properti.match(/<w:tblGrid\b[^>]*>([\s\S]*?)<\/w:tblGrid>/i)?.[1] ??
      "";
    const lebarKolom = Array.from(
      grid.matchAll(
        /<w:gridCol\b[^>]*\bw:w\s*=\s*["'](\d+)["'][^>]*\/?\s*>/gi,
      ),
      (cocok) => Number(cocok[1]),
    ).filter((lebar) => Number.isFinite(lebar) && lebar > 0);
    return { bergaris, lebarKolom };
  });
}

function kelasTabel(atribut: string, kelas: string): string {
  const cocok = atribut.match(/\sclass\s*=\s*(["'])(.*?)\1/i);
  if (!cocok) return `${atribut} class="${kelas}"`;
  const gabungan = Array.from(
    new Set([...cocok[2].split(/\s+/).filter(Boolean), ...kelas.split(" ")]),
  ).join(" ");
  return atribut.replace(cocok[0], ` class="${gabungan}"`);
}

function colgroup(lebarKolom: number[]): string {
  const total = lebarKolom.reduce((jumlah, lebar) => jumlah + lebar, 0);
  if (!total) return "";
  return `<colgroup>${lebarKolom
    .map(
      (lebar) =>
        `<col style="width:${((lebar / total) * 100).toFixed(4)}%">`,
    )
    .join("")}</colgroup>`;
}

function terapkanTataLetakTabel(html: string, tabel: TabelWord[]): string {
  let indeks = 0;
  const hasil = html.replace(/<table\b([^>]*)>/gi, (penuh, atribut: string) => {
    const info = tabel[indeks++];
    if (!info) return penuh;
    const jenis = info.bergaris ? "grid" : "layout";
    const attrs = kelasTabel(
      atribut,
      `dokumen-template__table dokumen-template__table--${jenis} docx-source-table docx-source-table--${jenis}`,
    );
    return `<table${attrs} data-docx-source-table="true" data-docx-table-border="${jenis}" data-docx-column-count="${info.lebarKolom.length || 1}">${colgroup(info.lebarKolom)}`;
  });
  if (indeks !== tabel.length) {
    throw new Error(
      `Jumlah tabel berbeda: HTML ${indeks}, Word ${tabel.length}.`,
    );
  }
  return hasil;
}

function atributWord(tag: string, nama: string): number | undefined {
  const cocok = tag.match(new RegExp(`\\bw:${nama}\\s*=\\s*["'](\\d+)["']`, "i"));
  if (!cocok) return undefined;
  const nilai = Number(cocok[1]);
  return Number.isFinite(nilai) ? nilai : undefined;
}

function twipKeMm(twip: number | undefined, cadangan: number): number {
  if (twip === undefined) return cadangan;
  return Number(((twip * 25.4) / 1440).toFixed(2));
}

function layoutWord(xml: string): LayoutWord {
  const semuaSection = Array.from(
    xml.matchAll(/<w:sectPr\b[^>]*>[\s\S]*?<\/w:sectPr>/gi),
    (cocok) => cocok[0],
  );
  const section = semuaSection.at(-1) ?? "";
  const ukuran = section.match(/<w:pgSz\b[^>]*\/?\s*>/i)?.[0] ?? "";
  const margin = section.match(/<w:pgMar\b[^>]*\/?\s*>/i)?.[0] ?? "";
  const width = twipKeMm(atributWord(ukuran, "w"), 210);
  const height = twipKeMm(atributWord(ukuran, "h"), 297);
  const landscape = /\bw:orient\s*=\s*["']landscape["']/i.test(ukuran);
  return {
    pageWidthMm: width,
    pageHeightMm: height,
    orientation: landscape ? "landscape" : "portrait",
    marginTopMm: twipKeMm(atributWord(margin, "top"), 25),
    marginRightMm: twipKeMm(atributWord(margin, "right"), 25),
    marginBottomMm: twipKeMm(atributWord(margin, "bottom"), 25),
    marginLeftMm: twipKeMm(atributWord(margin, "left"), 30),
  };
}

/** Ubah pageBreakBefore menjadi break eksplisit agar Mammoth dapat memetakannya. */
function materialisasiPageBreakBefore(xml: string): string {
  return xml.replace(
    /(<w:p\b[^>]*>\s*<w:pPr\b[^>]*>[\s\S]*?<w:pageBreakBefore\b[^>]*\/?\s*>[\s\S]*?<\/w:pPr>)/gi,
    '$1<w:r><w:br w:type="page"/></w:r>',
  );
}

async function konversiWord(fullPath: string): Promise<{
  html: string;
  layout: LayoutWord;
  xml: string;
  jumlahPageBreak: number;
}> {
  const zip = await openZip({ path: fullPath });
  const xml = await zip.read("word/document.xml", "utf-8");
  const jumlahBreakEksplisit = (
    xml.match(/<w:br\b[^>]*\bw:type\s*=\s*["']page["'][^>]*\/?\s*>/gi) ??
    []
  ).length;
  const jumlahBreakSebelum = (
    xml.match(/<w:pageBreakBefore\b[^>]*\/?\s*>/gi) ?? []
  ).length;
  const xmlSiap = materialisasiPageBreakBefore(xml);
  let input: { path: string } | { buffer: Buffer } = { path: fullPath };
  if (xmlSiap !== xml) {
    zip.write("word/document.xml", xmlSiap);
    input = { buffer: Buffer.from(await zip.toArrayBuffer()) };
  }
  const hasil = await mammoth.convertToHtml(input, {
    styleMap: STYLE_MAP_CETAK,
  });
  const html = terapkanTataLetakTabel(
    repairSplitTokens(hasil.value),
    tabelWord(xml),
  );
  return {
    html,
    layout: layoutWord(xml),
    xml,
    jumlahPageBreak: jumlahBreakEksplisit + jumlahBreakSebelum,
  };
}

function verifikasiToken(
  paketId: string,
  file: string,
  xml: string,
  html: string,
): string[] {
  const masalah: string[] = [];
  const want = tokensOf(xml.replace(/<[^>]*>/g, ""));
  const got = tokensOf(html);
  for (const [tok, n] of want) {
    if (got.get(tok) !== n) {
      masalah.push(
        `TOKEN MISMATCH ${paketId}/${file}: ${tok} xml=${n} html=${got.get(tok) ?? 0}`,
      );
    }
  }
  for (const tok of got.keys()) {
    if (!want.has(tok)) {
      masalah.push(
        `TOKEN ASING ${paketId}/${file}: ${tok} tidak ada di XML`,
      );
    }
  }
  const sisa = html.split(TOKEN_RE).join("").split("{{...}}").join("");
  if (sisa.includes("{") || sisa.includes("}")) {
    masalah.push(`KEMUNGKINAN TOKEN RUSAK di ${paketId}/${file}`);
  }
  return masalah;
}

async function main() {
  if (!fs.existsSync(SRC)) {
    throw new Error(`Folder sumber Word tidak ditemukan: ${SRC}`);
  }
  if (path.parse(OUT).root === OUT || OUT.length < path.parse(OUT).root.length + 12) {
    throw new Error(`Folder keluaran terlalu luas dan ditolak: ${OUT}`);
  }

  const stage = `${OUT}.next-${process.pid}`;
  const backup = `${OUT}.previous-${process.pid}`;
  fs.rmSync(stage, { recursive: true, force: true });
  fs.mkdirSync(stage, { recursive: true });
  const katalogStage = path.join(stage, "katalog");
  const wordStage = path.join(stage, "word");
  fs.mkdirSync(katalogStage, { recursive: true });
  fs.mkdirSync(wordStage, { recursive: true });
  let totalDocs = 0;
  const masalah: string[] = [];

  for (const paket of PAKET) {
    const dir = path.join(SRC, paket.dir);
    if (!fs.existsSync(dir)) {
      masalah.push(`FOLDER PAKET TIDAK DITEMUKAN: ${dir}`);
      continue;
    }
    const files = fs
      .readdirSync(dir)
      .filter((f) => f.toLowerCase().endsWith(".docx") && !f.startsWith("00"))
      .sort();
    if (files.length !== paket.ids.length) {
      masalah.push(
        `JUMLAH DOKUMEN ${paket.paketId}: Word=${files.length}, ID=${paket.ids.length}`,
      );
      continue;
    }
    const dokumen: Array<{
      id: string;
      judul: string;
      html: string;
      layout: LayoutWord;
    }> = [];
    // Paket contoh unit-non-bh masih memerlukan normalisasi isi contoh yang
    // saat ini dilakukan pada HTML. Paket lain dapat memakai DOCX sumber
    // langsung agar Word mempertahankan section, tabel, font, dan page break.
    const wordTemplateAvailable = paket.contoh !== true;
    const wordStageDir = path.join(wordStage, paket.paketId);
    if (wordTemplateAvailable) fs.mkdirSync(wordStageDir, { recursive: true });

    for (const [index, file] of files.entries()) {
      const id = paket.ids[index];
      const full = path.join(dir, file);
      const hasil = await konversiWord(full);
      let html = hasil.html;

      if (paket.contoh) {
        html = normalizeContoh(html, id);
        for (const residu of RESIDU_CONTOH) {
          const residuEscaped = residu.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          const polaResidu = residu.startsWith("[")
            ? new RegExp(residuEscaped, "iu")
            : new RegExp(`(?:^|[^\\p{L}\\p{N}_])${residuEscaped}(?=$|[^\\p{L}\\p{N}_])`, "iu");
          if (polaResidu.test(html)) {
            masalah.push(
              `RESIDU '${residu}' masih ada di ${paket.paketId}/${file}`,
            );
          }
        }
      } else {
        masalah.push(...verifikasiToken(paket.paketId, file, hasil.xml, html));
      }

      // Teks ini adalah petunjuk literal di checklist, bukan field formulir.
      // Entity HTML tetap dirender sebagai {{PLACEHOLDER}} tanpa ikut dipindai.
      html = html.replaceAll(
        "{{PLACEHOLDER}}",
        "&#123;&#123;PLACEHOLDER&#125;&#125;",
      );

      const jumlahBreakHtml = (
        html.match(/dokumen-template__page-break/g) ?? []
      ).length;
      if (jumlahBreakHtml !== hasil.jumlahPageBreak) {
        masalah.push(
          `PAGE BREAK MISMATCH ${paket.paketId}/${file}: Word=${hasil.jumlahPageBreak}, HTML=${jumlahBreakHtml}`,
        );
      }

      dokumen.push({
        id,
        judul:
          JUDUL[id] ?? id.replace(/^\d+_/, "").replace(/_/g, " "),
        html,
        layout: hasil.layout,
      });
      if (wordTemplateAvailable) {
        fs.copyFileSync(full, path.join(wordStageDir, `${id}.docx`));
      }
      totalDocs++;
    }

    if (wordTemplateAvailable) {
      const paketLengkap = fs
        .readdirSync(dir)
        .find(
          (file) =>
            file.toLowerCase().endsWith(".docx") && file.startsWith("00"),
        );
      if (!paketLengkap) {
        masalah.push(`PAKET WORD LENGKAP TIDAK DITEMUKAN: ${paket.paketId}`);
      } else {
        const paketLengkapPath = path.join(dir, paketLengkap);
        const zip = await openZip({ path: paketLengkapPath });
        const xml = await zip.read("word/document.xml", "utf-8");
        const tokenDokumen = dokumen.flatMap((item) => urutanToken(item.html));
        const tokenPaketLengkap = urutanToken(xml.replace(/<[^>]*>/g, ""));
        const indeksBeda = tokenDokumen.findIndex(
          (token, index) => tokenPaketLengkap[index] !== token,
        );
        if (
          tokenDokumen.length !== tokenPaketLengkap.length ||
          indeksBeda !== -1
        ) {
          masalah.push(
            `URUTAN TOKEN PAKET WORD TIDAK COCOK ${paket.paketId}: ` +
              `dokumen=${tokenDokumen.length}, paket=${tokenPaketLengkap.length}, ` +
              `bedaPertama=${indeksBeda}`,
          );
        }
        fs.copyFileSync(
          paketLengkapPath,
          path.join(wordStageDir, "paket-lengkap.docx"),
        );
      }
    }

    const outPath = path.join(katalogStage, `${paket.paketId}.json`);
    fs.writeFileSync(
      outPath,
      JSON.stringify({
        paketId: paket.paketId,
        bentukId: paket.bentukId,
        variantId: paket.variantId,
        label: paket.label,
        wordTemplateAvailable,
        dokumen,
      }),
    );
    console.log(`OK ${paket.paketId}: ${dokumen.length} dokumen -> ${path.relative(process.cwd(), outPath)}`);
  }

  console.log(`Total ${totalDocs} dokumen.`);
  if (masalah.length > 0) {
    fs.rmSync(stage, { recursive: true, force: true });
    throw new Error(`GAGAL: ${masalah.length} masalah verifikasi.\n${masalah.join("\n")}`);
  }
  if (totalDocs !== 147) {
    fs.rmSync(stage, { recursive: true, force: true });
    throw new Error(`GAGAL: diharapkan 147 dokumen, ditemukan ${totalDocs}.`);
  }

  fs.rmSync(backup, { recursive: true, force: true });
  let lamaDipindah = false;
  try {
    if (fs.existsSync(OUT)) {
      fs.renameSync(OUT, backup);
      lamaDipindah = true;
    }
    fs.renameSync(stage, OUT);
    fs.rmSync(backup, { recursive: true, force: true });
  } catch (error) {
    if (!fs.existsSync(OUT) && lamaDipindah && fs.existsSync(backup)) {
      fs.renameSync(backup, OUT);
    }
    throw error;
  }
  console.log(`Selesai: ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
