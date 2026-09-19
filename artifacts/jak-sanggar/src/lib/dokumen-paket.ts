// Paket Dokumen Resmi — katalog paket template dokumen administrasi hasil
// konversi docx (scripts/src/convert-dokumen-paket.ts) menjadi JSON HTML di
// public/dokumen-paket/katalog/<paketId>.json. Setiap dokumen berisi token
// {{NAMA_TOKEN}}
// yang diisi lewat formulir; isian dibagi bersama seluruh dokumen dalam paket.
import type { BentukKedudukanId, SanggarUser } from "@/lib/types";
import { escapeHtml } from "@/lib/utils";
import { load } from "@/lib/store";

export interface PaketInfo {
  paketId: string;
  bentukId: BentukKedudukanId;
  variantId: string | null;
  variantLabel: string | null;
  label: string;
  /** Paket contoh (unit-non-bh): dokumen induk berisi teks contoh AD/ART dsb. */
  contoh?: boolean;
}

export interface PaketDokumen {
  id: string;
  judul: string;
  html: string;
  /** Pengaturan halaman hasil penyuntingan kurator, bila ada. */
  layout?: {
    fontFamily?: string;
    fontSizePt?: number;
    lineHeight?: number;
    pageWidthMm?: number;
    pageHeightMm?: number;
    orientation?: "portrait" | "landscape";
    marginTopMm?: number;
    marginRightMm?: number;
    marginBottomMm?: number;
    marginLeftMm?: number;
  };
}

export interface PaketData {
  paketId: string;
  bentukId: string;
  variantId: string | null;
  label: string;
  /** DOCX sumber tersedia untuk ekspor Word dengan fidelity penuh. */
  wordTemplateAvailable?: boolean;
  dokumen: PaketDokumen[];
}

export interface PaketField {
  /** Kunci penyimpanan. Field tabel memakai kunci per dokumen dan per baris. */
  key: string;
  /** Token asli yang terdapat di HTML template. */
  token: string;
  label: string;
  dokumenId?: string;
  dokumenJudul?: string;
  kemunculan?: number;
  jumlahKemunculan?: number;
  perBaris: boolean;
  opsional: boolean;
}

export const PAKET_DOKUMEN: PaketInfo[] = [
  {
    paketId: "mandiri-non-bh",
    bentukId: "mandiri-non-bh",
    variantId: null,
    variantLabel: null,
    label: "Sanggar Mandiri Tidak Berbadan Hukum",
  },
  {
    paketId: "mandiri-bh-yayasan",
    bentukId: "mandiri-bh",
    variantId: "yayasan",
    variantLabel: "Yayasan",
    label: "Sanggar Mandiri Berbadan Hukum - Yayasan",
  },
  {
    paketId: "mandiri-bh-perkumpulan",
    bentukId: "mandiri-bh",
    variantId: "perkumpulan",
    variantLabel: "Perkumpulan",
    label: "Sanggar Mandiri Berbadan Hukum - Perkumpulan",
  },
  {
    paketId: "mandiri-bh-koperasi",
    bentukId: "mandiri-bh",
    variantId: "koperasi",
    variantLabel: "Koperasi",
    label: "Sanggar Mandiri Berbadan Hukum - Koperasi",
  },
  {
    paketId: "mandiri-bh-pt",
    bentukId: "mandiri-bh",
    variantId: "pt",
    variantLabel: "Perseroan Terbatas (PT)",
    label: "Sanggar Mandiri Berbadan Hukum - PT",
  },
  {
    paketId: "mandiri-bu-firma",
    bentukId: "mandiri-bu",
    variantId: "firma",
    variantLabel: "Firma",
    label: "Sanggar Mandiri Berbadan Usaha - Firma",
  },
  {
    paketId: "mandiri-bu-cv",
    bentukId: "mandiri-bu",
    variantId: "cv",
    variantLabel: "CV",
    label: "Sanggar Mandiri Berbadan Usaha - CV",
  },
  {
    paketId: "unit-bh-yayasan",
    bentukId: "unit-bh",
    variantId: "yayasan",
    variantLabel: "Yayasan",
    label: "Unit Sanggar di Bawah Yayasan",
  },
  {
    paketId: "unit-bh-perkumpulan",
    bentukId: "unit-bh",
    variantId: "perkumpulan",
    variantLabel: "Perkumpulan",
    label: "Unit Sanggar di Bawah Perkumpulan",
  },
  {
    paketId: "unit-bh-koperasi",
    bentukId: "unit-bh",
    variantId: "koperasi",
    variantLabel: "Koperasi",
    label: "Unit Sanggar di Bawah Koperasi",
  },
  {
    paketId: "unit-bh-pt",
    bentukId: "unit-bh",
    variantId: "pt",
    variantLabel: "Perseroan Terbatas (PT)",
    label: "Unit Sanggar di Bawah PT",
  },
  {
    paketId: "unit-bu-firma",
    bentukId: "unit-bu",
    variantId: "firma",
    variantLabel: "Firma",
    label: "Unit Sanggar di Bawah Firma",
  },
  {
    paketId: "unit-bu-cv",
    bentukId: "unit-bu",
    variantId: "cv",
    variantLabel: "CV",
    label: "Unit Sanggar di Bawah CV",
  },
  {
    paketId: "unit-non-bh-atribut-induk",
    bentukId: "unit-non-bh",
    variantId: "atribut-induk",
    variantLabel: "Atribut Mengikuti Induk",
    label: "Unit Non-Badan Hukum - Atribut Mengikuti Induk",
    contoh: true,
  },
  {
    paketId: "unit-non-bh-atribut-khusus",
    bentukId: "unit-non-bh",
    variantId: "atribut-khusus",
    variantLabel: "Atribut Khusus Unit",
    label: "Unit Non-Badan Hukum - Atribut Khusus Unit",
    contoh: true,
  },
];

export function paketUntukBentuk(bentukId: BentukKedudukanId): PaketInfo[] {
  return PAKET_DOKUMEN.filter((p) => p.bentukId === bentukId);
}

const cache = new Map<string, Promise<PaketData>>();

export function fetchPaket(paketId: string): Promise<PaketData> {
  let p = cache.get(paketId);
  if (!p) {
    const base = import.meta.env.BASE_URL ?? "/";
    p = fetch(`${base}dokumen-paket/katalog/${paketId}.json`).then((r) => {
      if (!r.ok) throw new Error(`Gagal memuat paket dokumen (${r.status})`);
      return r.json() as Promise<PaketData>;
    });
    p.catch(() => cache.delete(paketId));
    cache.set(paketId, p);
  }
  // Sumber JSON tetap dicache, tetapi override kurator selalu dibaca ulang
  // agar perubahan di konsol langsung dipakai saat dokumen dibuka kembali.
  return p.then((data) => {
    const overrides = load().appearance.dokumenTemplates ?? {};
    return {
      ...data,
      dokumen: data.dokumen.map((dokumen) => {
        const override = overrides[`${paketId}:${dokumen.id}`];
        return override
          ? {
              ...dokumen,
              html: override.html,
              layout: { ...dokumen.layout, ...override.layout },
            }
          : dokumen;
      }),
    };
  });
}

const TOKEN_RE = /\{\{[A-Z0-9_/]+\}\}/g;

// Token generik di tabel tidak boleh dibagi sebagai satu nilai global. Contoh:
// delapan {{NAMA}} pada daftar pengurus adalah delapan orang berbeda. Token
// semantik seperti NAMA_SANGGAR tetap dipakai bersama di seluruh paket.
const TOKEN_PER_BARIS = new Set([
  "NAMA",
  "JABATAN",
  "IDENTITAS",
  "KONTAK",
  "DASAR",
  "KETERANGAN",
  "NOMINAL",
  "NILAI",
  "JUMLAH",
  "TANGGAL",
  "TEMPAT",
  "NAMA_KEGIATAN",
  "NIK/IDENTITAS",
  "NAMA/JABATAN",
  "JABATAN/STATUS",
  "JABATAN/ORGAN",
  "JABATAN/ORGAN_INDUK",
  "JABATAN_PENETAP/ORGAN_PENGAWAS",
  "HASIL/OUTPUT",
  "LOKASI_TAUTAN/NAMA_FOLDER",
  "TANGGAL/PERIODE",
  "PERSENTASE/NOMINAL",
  "REKENING_RESMI_INDUK/REKENING_UNIT_YANG_DISETUJUI",
]);

const TOKEN_OPSIONAL = new Set(["LOGO", "LOGO_INDUK", "LOGO_SANGGAR"]);
const TOKEN_DAFTAR_FLEKSIBEL = new Set([
  "NAMA",
  "JABATAN",
  "IDENTITAS",
  "KONTAK",
  "NIK/IDENTITAS",
  "JABATAN/STATUS",
  "JABATAN/ORGAN",
]);

export function tokenAdalahPerBaris(token: string): boolean {
  return TOKEN_PER_BARIS.has(token);
}

export function kunciFieldPaket(
  dokumenId: string,
  token: string,
  kemunculan: number,
): string {
  return `dokumen:${dokumenId}:${token}:${kemunculan}`;
}

/** Token unik dalam urutan kemunculan pada HTML dokumen. */
export function tokenDokumen(html: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of html.match(TOKEN_RE) ?? []) {
    const t = m.slice(2, -2);
    if (!seen.has(t)) {
      seen.add(t);
      out.push(t);
    }
  }
  return out;
}

/** Token unik seluruh paket, urutan kemunculan lintas dokumen. */
export function tokenPaket(data: PaketData): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const d of data.dokumen) {
    for (const t of tokenDokumen(d.html)) {
      if (!seen.has(t)) {
        seen.add(t);
        out.push(t);
      }
    }
  }
  return out;
}

/** Field formulir sebuah dokumen, termasuk setiap baris tabel secara terpisah. */
export function fieldDokumenPaket(dokumen: PaketDokumen): PaketField[] {
  const urutan = (dokumen.html.match(TOKEN_RE) ?? []).map((m) =>
    m.slice(2, -2),
  );
  const total = new Map<string, number>();
  for (const token of urutan) total.set(token, (total.get(token) ?? 0) + 1);

  const sudahGlobal = new Set<string>();
  const nomor = new Map<string, number>();
  const fields: PaketField[] = [];
  for (const token of urutan) {
    const perBaris = tokenAdalahPerBaris(token);
    if (!perBaris && sudahGlobal.has(token)) continue;
    if (!perBaris) sudahGlobal.add(token);

    const kemunculan = perBaris ? (nomor.get(token) ?? 0) + 1 : undefined;
    if (perBaris) nomor.set(token, kemunculan!);
    const jumlahKemunculan = total.get(token) ?? 1;
    const labelDasar = labelToken(token);
    const opsional =
      TOKEN_OPSIONAL.has(token) ||
      (perBaris &&
        TOKEN_DAFTAR_FLEKSIBEL.has(token) &&
        jumlahKemunculan >= 4 &&
        kemunculan! > 1);
    const labelBaris =
      perBaris && jumlahKemunculan > 1
        ? `${labelDasar} - baris ${kemunculan}`
        : labelDasar;
    fields.push({
      key: perBaris ? kunciFieldPaket(dokumen.id, token, kemunculan!) : token,
      token,
      label:
        opsional && !labelBaris.toLowerCase().includes("(opsional)")
          ? `${labelBaris} (opsional)`
          : labelBaris,
      dokumenId: perBaris ? dokumen.id : undefined,
      dokumenJudul: perBaris ? dokumen.judul : undefined,
      kemunculan,
      jumlahKemunculan,
      perBaris,
      opsional,
    });
  }
  return fields;
}

/** Seluruh field paket; hanya token semantik yang dideduplikasi lintas dokumen. */
export function fieldPaket(data: PaketData): PaketField[] {
  const sudah = new Set<string>();
  const fields: PaketField[] = [];
  for (const dokumen of data.dokumen) {
    for (const field of fieldDokumenPaket(dokumen)) {
      if (sudah.has(field.key)) continue;
      sudah.add(field.key);
      fields.push(field);
    }
  }
  return fields;
}

// Label ramah untuk token yang sering muncul; sisanya di-humanize otomatis.
const LABEL_TOKEN: Record<string, string> = {
  NAMA_SANGGAR: "Nama sanggar",
  NAMA: "Nama",
  NAMA_INDUK: "Nama organisasi/badan induk",
  JABATAN_PENETAP: "Jabatan penetap dokumen",
  NAMA_PENETAP: "Nama penetap dokumen",
  JABATAN: "Jabatan",
  KONTAK: "Kontak",
  KOTA: "Kota/kabupaten",
  ALAMAT_LENGKAP_SANGGAR: "Alamat lengkap sanggar",
  ALAMAT_LENGKAP_INDUK: "Alamat lengkap induk",
  IDENTITAS: "Identitas (NIK/paspor)",
  TANGGAL: "Tanggal",
  SEBUTAN_UNIT: "Sebutan unit (mis. Unit Kegiatan, Divisi)",
  TANGGAL_MUSYAWARAH: "Tanggal musyawarah",
  NOMINAL: "Nominal (Rp)",
  KETERANGAN: "Keterangan",
  LOGO_INDUK: "Keterangan logo induk (opsional)",
  LOGO_SANGGAR: "Keterangan logo sanggar (opsional)",
  LOGO: "Keterangan logo (opsional)",
  HARI: "Hari",
  TELEPON: "Nomor telepon",
  EMAIL: "Email",
  TELEPON_INDUK: "Telepon induk",
  EMAIL_INDUK: "Email induk",
  NOMOR_KEPUTUSAN_PEMBENTUKAN: "Nomor keputusan pembentukan",
  NOMOR_BERITA_ACARA: "Nomor berita acara",
  NOMOR_BERITA_ACARA_UNIT: "Nomor berita acara unit",
  NOMOR_KEPUTUSAN_PENGELOLA: "Nomor keputusan pengelola",
  NOMOR_KEPUTUSAN_KEUANGAN: "Nomor keputusan keuangan",
  NOMOR_KEPUTUSAN_PELATIH: "Nomor keputusan pelatih",
  DASAR: "Dasar hukum/pertimbangan",
  NAMA_NOTULIS: "Nama notulis",
  NOMOR_AKTA: "Nomor akta",
  TANGGAL_AKTA: "Tanggal akta",
  NAMA_NOTARIS: "Nama notaris",
  NAMA_KETUA_INDUK: "Nama ketua induk",
  NAMA_KETUA: "Nama ketua",
  NAMA_PIMPINAN: "Nama pimpinan",
  NAMA_PIMPINAN_RAPAT: "Nama pimpinan rapat",
  NAMA_PIMPINAN_MUSYAWARAH: "Nama pimpinan musyawarah",
  NAMA_PIMPINAN_UNIT: "Nama pimpinan unit",
  NAMA_SEKRETARIS: "Nama sekretaris",
  NAMA_SEKRETARIS_RAPAT: "Nama sekretaris rapat",
  NAMA_BENDAHARA: "Nama bendahara",
  NAMA_WAKIL_KETUA: "Nama wakil ketua",
  WAKTU_MULAI: "Waktu mulai",
  WAKTU_SELESAI: "Waktu selesai",
  PUKUL_MULAI: "Pukul mulai",
  PUKUL_SELESAI: "Pukul selesai",
  RUANG_LINGKUP_KEGIATAN_SANGGAR: "Ruang lingkup kegiatan sanggar",
  NILAI: "Nilai",
  TANGGAL_RAPAT: "Tanggal rapat",
  ORGAN_BERWENANG: "Organ berwenang (mis. Pengurus, Pembina)",
  TANGGAL_BERITA_ACARA: "Tanggal berita acara",
  PERIODE_LAPORAN: "Periode laporan",
  TEMPAT: "Tempat",
  TEMPAT_RAPAT: "Tempat rapat",
  JUMLAH_PESERTA: "Jumlah peserta",
  NOMOR_SK_PENGESAHAN: "Nomor SK pengesahan",
  WILAYAH_KEGIATAN: "Wilayah kegiatan",
  TANGGAL_KESEDIAAN: "Tanggal pernyataan kesediaan",
  TANGGAL_MULAI: "Tanggal mulai",
  TANGGAL_AKHIR: "Tanggal akhir",
  PERIODE_EVALUASI: "Periode evaluasi",
  NOMOR_SURAT_PERNYATAAN: "Nomor surat pernyataan",
  TOTAL: "Total",
  JENIS_RAPAT: "Jenis rapat",
  AGENDA_RAPAT: "Agenda rapat",
  NAMA_KEGIATAN: "Nama kegiatan",
  PIHAK_BERWENANG: "Pihak berwenang",
  BIDANG_SENI: "Bidang seni",
  NIB: "NIB",
  NPWP: "NPWP",
  BANK: "Nama bank",
  NOMOR_REKENING: "Nomor rekening",
  NAMA_REKENING: "Nama pemilik rekening",
  KOP_SURAT_INDUK: "Kop surat induk (baris teks)",
  KOP_SURAT_UNIT: "Kop surat unit (baris teks)",
  MASA_BAKTI_TAHUN: "Masa bakti (tahun)",
  NIK_PIMPINAN_UNIT: "NIK pimpinan unit",
  NIK_SEKRETARIS: "NIK sekretaris",
  NIK_BENDAHARA: "NIK bendahara",
  NAMA_KOORDINATOR_LATIHAN: "Nama koordinator latihan",
  NAMA_KOORDINATOR_PERLENGKAPAN: "Nama koordinator perlengkapan",
  NAMA_KOORDINATOR_HUMAS: "Nama koordinator humas",
  NIK_KOORDINATOR_LATIHAN: "NIK koordinator latihan",
  NIK_KOORDINATOR_PERLENGKAPAN: "NIK koordinator perlengkapan",
  NIK_KOORDINATOR_HUMAS: "NIK koordinator humas",
  BIAYA_PENDAFTARAN: "Biaya pendaftaran (Rp)",
  IURAN_BULANAN: "Iuran bulanan (Rp)",
  BIAYA_LATIHAN_PER_PERTEMUAN: "Biaya latihan per pertemuan (Rp)",
  DANA_KOSTUM_PROPERTI: "Dana kostum/properti (Rp)",
  HONORARIUM_PELATIH: "Honorarium pelatih (Rp)",
  NAMA_PELATIH_1: "Nama pelatih 1 (tari)",
  NAMA_PELATIH_2: "Nama pelatih 2 (musik pengiring)",
  NAMA_PELATIH_3: "Nama pelatih 3 (vokal/teater/umum)",
  STATUS_PELATIH_1: "Status pelatih 1 (aktif/tidak aktif)",
  STATUS_PELATIH_2: "Status pelatih 2 (aktif/tidak aktif)",
  STATUS_PELATIH_3: "Status pelatih 3 (aktif/tidak aktif)",
  BULAN: "Bulan",
  TAHUN: "Tahun",
  TAHUN_TERBILANG: "Tahun (terbilang)",
  TANGGAL_TERBILANG: "Tanggal (terbilang)",
  ZONA_WAKTU: "Zona waktu (mis. WIB)",
};

function titleCase(s: string): string {
  return s.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());
}

/** Label ramah untuk sebuah token. */
export function labelToken(token: string): string {
  const known = LABEL_TOKEN[token];
  if (known) return known;
  if (token.includes("/")) {
    return token
      .split("/")
      .map((o) => titleCase(o.replace(/_/g, " ")))
      .join(" / ");
  }
  return titleCase(token.replace(/_/g, " "));
}

/** Token bertanda opsional tidak menghalangi pencetakan hasil final. */
export function tokenWajibDokumen(html: string): string[] {
  return tokenDokumen(html).filter((token) => !TOKEN_OPSIONAL.has(token));
}

const OPSI_TOKEN: Record<string, string[]> = {
  "BULANAN/TAHUNAN": ["Bulanan", "Tahunan"],
  "PER_PERTEMUAN/PERIODE": ["Per Pertemuan", "Periode"],
  "SEKALI/LAINNYA": ["Sekali", "Lainnya"],
  "UNDANGAN/KEPUTUSAN/INSTRUKSI/KEBUTUHAN_ORGANISASI": [
    "Undangan",
    "Keputusan",
    "Instruksi",
    "Kebutuhan Organisasi",
  ],
  "TARI/MUSIK/TEATER/SASTRA/RUPA/MULTIDISIPLIN": [
    "Tari",
    "Musik",
    "Teater",
    "Sastra",
    "Rupa",
    "Multidisiplin",
  ],
  "TARI/MUSIK/TEATER/SASTRA/SENI_RUPA/MULTIDISIPLIN/LAINNYA": [
    "Tari",
    "Musik",
    "Teater",
    "Sastra",
    "Seni Rupa",
    "Multidisiplin",
    "Lainnya",
  ],
  "PELATIHAN/PRODUKSI/PERTUNJUKAN/LAINNYA": [
    "Pelatihan",
    "Produksi",
    "Pertunjukan",
    "Lainnya",
  ],
};

/** Opsi hanya untuk token yang memang didefinisikan sebagai pilihan. */
export function opsiToken(token: string): string[] | null {
  return OPSI_TOKEN[token] ?? null;
}

/** Token yang wajar diisi teks panjang (textarea). */
export function tokenPanjang(token: string): boolean {
  return /ALAMAT|KETERANGAN|URAIAN|DESKRIPSI|AGENDA|POKOK_PEMBAHASAN|KEPUTUSAN_\d|RUANG_LINGKUP|DASAR|DATA_PEMILIK/.test(
    token,
  );
}

export type JenisFieldDokumen =
  | "text"
  | "email"
  | "telepon"
  | "nik"
  | "identitas"
  | "npwp"
  | "tanggal"
  | "tahun"
  | "angka"
  | "nominal";

/** Jenis data administratif untuk atribut input dan validasi. */
export function jenisFieldToken(token: string): JenisFieldDokumen {
  if (/^EMAIL(?:_|$)/.test(token)) return "email";
  if (/^TELEPON(?:_|$)/.test(token)) return "telepon";
  if (/^NIK(?:_|$)/.test(token)) return "nik";
  if (token === "NIK/IDENTITAS" || token === "IDENTITAS") return "identitas";
  if (/^NPWP(?:_|$)/.test(token)) return "npwp";
  if (token === "TANGGAL" || /^TANGGAL_(?!TERBILANG)/.test(token)) {
    return "tanggal";
  }
  if (token === "TAHUN" || /^TAHUN_(?!TERBILANG)/.test(token)) return "tahun";
  if (/^(JUMLAH|MASA_BAKTI_TAHUN)(?:_|$)/.test(token)) return "angka";
  if (/NOMINAL|BIAYA|IURAN|DANA|HONORARIUM|TOTAL|NILAI|PERSENTASE/.test(token))
    return "nominal";
  return "text";
}

/** Prefill nilai token dari profil sanggar (hanya token yang belum terisi). */
export function prefillDariProfil(sg: SanggarUser): Record<string, string> {
  const v: Record<string, string> = {};
  const set = (k: string, val?: string | null) => {
    if (val && String(val).trim()) v[k] = String(val).trim();
  };
  set("NAMA_SANGGAR", sg.namaSanggar);
  set("NAMA_KETUA", sg.namaKetua);
  set("ALAMAT_LENGKAP_SANGGAR", sg.alamat);
  set("TELEPON", sg.noHp);
  set("EMAIL", sg.email);
  set("NPWP", sg.npwp);
  set("KOTA", sg.wilayah?.kota);
  set(
    "WILAYAH_KEGIATAN",
    [sg.wilayah?.kecamatan, sg.wilayah?.kota, sg.wilayah?.provinsi]
      .filter(Boolean)
      .join(", "),
  );
  set("BIDANG_SENI", (sg.jenisKesenian ?? []).join(", "));
  if (sg.tahunBerdiri) set("TAHUN_BERDIRI", String(sg.tahunBerdiri));
  return v;
}

const BLANK_HTML =
  '<span style="letter-spacing:2px;color:#666">………………………</span>';

/** Substitusi token dengan nilai isian (di-escape); kosong → titik-titik. */
export function substitusi(
  html: string,
  isian: Record<string, string>,
): string {
  return html.replace(TOKEN_RE, (m) => {
    const token = m.slice(2, -2);
    const val = isian[token];
    if (val === undefined || val.trim() === "") return BLANK_HTML;
    return escapeHtml(val).replace(/\n/g, "<br>");
  });
}

/**
 * Substitusi khusus paket. Token tabel generik dibaca per kemunculan sehingga
 * nama/NIK/jabatan pada baris berbeda tidak lagi terduplikasi otomatis.
 */
export function substitusiDokumenPaket(
  dokumen: PaketDokumen,
  isian: Record<string, string>,
): string {
  const nomor = new Map<string, number>();
  return dokumen.html.replace(TOKEN_RE, (m) => {
    const token = m.slice(2, -2);
    let val: string | undefined;
    if (tokenAdalahPerBaris(token)) {
      const kemunculan = (nomor.get(token) ?? 0) + 1;
      nomor.set(token, kemunculan);
      const key = kunciFieldPaket(dokumen.id, token, kemunculan);
      val = isian[key];
      // Migrasi lunak data lama: nilai global lama hanya dipakai pada baris 1,
      // bukan disalin lagi ke seluruh tabel.
      if (val === undefined && kemunculan === 1) val = isian[token];
    } else {
      val = isian[token];
    }
    if (val === undefined || val.trim() === "") return BLANK_HTML;
    return escapeHtml(val).replace(/\n/g, "<br>");
  });
}

export function fieldWajibDokumenPaket(dokumen: PaketDokumen): PaketField[] {
  return fieldDokumenPaket(dokumen).filter((field) => !field.opsional);
}

export function nilaiFieldPaket(
  field: PaketField,
  isian: Record<string, string>,
): string {
  if (isian[field.key] !== undefined) return isian[field.key];
  if (field.perBaris && field.kemunculan === 1) return isian[field.token] ?? "";
  return "";
}

/** Jumlah token terisi / total untuk sebuah dokumen. */
export function progresDokumen(
  html: string,
  isian: Record<string, string>,
): { terisi: number; total: number } {
  const tokens = tokenWajibDokumen(html);
  const terisi = tokens.filter((t) => (isian[t] ?? "").trim() !== "").length;
  return { terisi, total: tokens.length };
}

export function progresDokumenPaket(
  dokumen: PaketDokumen,
  isian: Record<string, string>,
): { terisi: number; total: number } {
  const fields = fieldWajibDokumenPaket(dokumen);
  const terisi = fields.filter(
    (field) => nilaiFieldPaket(field, isian).trim() !== "",
  ).length;
  return { terisi, total: fields.length };
}
