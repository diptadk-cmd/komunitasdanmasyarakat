// Sumber dan data awal untuk mode Dokumen Standar AD/ART.
//
// Mode ini sengaja memakai naskah lengkap hasil konversi paket dokumen,
// bukan template `ad-art` ringkas di dokumen-admin.ts. Dengan begitu seluruh
// bab AD dan ART tetap tersedia untuk diedit setelah identitas inti diisi.
import type { SanggarUser } from "@/lib/types";
import {
  validasiIsianDokumen,
  type DokumenFieldWajib,
  type HasilValidasiDokumen,
} from "@workspace/jaksanggar-core/dokumen-validation";
import {
  fetchPaket,
  prefillDariProfil,
  substitusi,
  tokenDokumen,
  jenisFieldToken,
  labelToken,
  type PaketData,
  type PaketDokumen,
} from "@/lib/dokumen-paket";

/** Identitas stabil untuk draft/arsip mode AD/ART standar di masa depan. */
export const ADART_STANDAR_TEMPLATE_ID = "ad-art-standar-v1";

/**
 * Satu-satunya sumber AD/ART lengkap yang sudah tersedia saat ini.
 * Naskah ini khusus Sanggar Mandiri Tidak Berbadan Hukum; jangan dipakai
 * sebagai dasar hukum untuk bentuk kedudukan lain tanpa naskah yang sesuai.
 */
export const SUMBER_ADART_STANDAR = {
  id: ADART_STANDAR_TEMPLATE_ID,
  paketId: "mandiri-non-bh",
  bentukId: "mandiri-non-bh",
  label: "AD/ART Standar Sanggar Mandiri Tidak Berbadan Hukum",
  dokumen: {
    ad: {
      id: "04_AD",
      judul: "Anggaran Dasar",
      jumlahBab: 17,
    },
    art: {
      id: "05_ART",
      judul: "Anggaran Rumah Tangga",
      jumlahBab: 19,
    },
  },
} as const;

export type JenisDokumenAdartStandar =
  keyof typeof SUMBER_ADART_STANDAR.dokumen;

/**
 * Enam token identitas. Ketentuan organisasi di ART mempunyai token tambahan
 * yang juga wajib diisi sebelum dokumen dianggap lengkap.
 */
export const TOKEN_INTI_ADART_STANDAR = [
  "NAMA_SANGGAR",
  "NAMA_KETUA",
  "NAMA_SEKRETARIS",
  "ALAMAT_LENGKAP_SANGGAR",
  "KOTA",
  "TANGGAL_MUSYAWARAH",
] as const;

export type TokenIntiAdartStandar = (typeof TOKEN_INTI_ADART_STANDAR)[number];
export type NilaiIntiAdartStandar = Record<TokenIntiAdartStandar, string>;
export type NilaiAdartStandar = NilaiIntiAdartStandar & Record<string, string>;

/** Cadangan untuk validasi arsip sebelum sumber dinamis selesai dimuat. */
export const TOKEN_KEPUTUSAN_ADART_STANDAR = [
  "HARI_KEBERATAN",
  "HARI_UNDANGAN",
  "HARI_MUSYAWARAH_KEDUA",
  "HARI_LPJ_UANG_MUKA",
  "PERSEN_PELAKU",
  "PERSEN_TIM_KREATIF",
  "PERSEN_PRODUKSI",
  "PERSEN_KAS_OPERASIONAL",
  "PERSEN_PENGEMBANGAN",
  "PERSEN_CADANGAN",
] as const;

const LABEL_KEPUTUSAN: Record<string, string> = {
  HARI_KEBERATAN: "Batas pengajuan keberatan (hari)",
  HARI_UNDANGAN: "Jarak penyampaian undangan sebelum musyawarah (hari)",
  HARI_MUSYAWARAH_KEDUA: "Jarak paling cepat musyawarah kedua (hari)",
  HARI_LPJ_UANG_MUKA: "Batas pertanggungjawaban uang muka (hari)",
  PERSEN_PELAKU: "Bagian pelaku/penampil (%)",
  PERSEN_TIM_KREATIF: "Bagian tim kreatif (%)",
  PERSEN_PRODUKSI: "Bagian produksi dan teknis (%)",
  PERSEN_KAS_OPERASIONAL: "Bagian kas operasional (%)",
  PERSEN_PENGEMBANGAN: "Bagian pengembangan (%)",
  PERSEN_CADANGAN: "Bagian cadangan dan sosial (%)",
};

/** Semua token aktual, dengan identitas didahulukan agar formulir tetap jelas. */
export function fieldAdartStandar(
  sumber?: DokumenAdartStandarTermuat | null,
): DokumenFieldWajib[] {
  const tokens = sumber
    ? [
        ...new Set([
          ...TOKEN_INTI_ADART_STANDAR,
          ...tokenDokumen(sumber.dokumen.ad.html),
          ...tokenDokumen(sumber.dokumen.art.html),
        ]),
      ]
    : [...TOKEN_INTI_ADART_STANDAR, ...TOKEN_KEPUTUSAN_ADART_STANDAR];
  return tokens.map((token) => ({
    key: token,
    label: LABEL_KEPUTUSAN[token] || labelToken(token),
    jenis: /^HARI_/.test(token) ? "angka" : jenisFieldToken(token),
  }));
}

function persentase(nilai?: string): number | null {
  const teks = nilai?.trim() ?? "";
  if (!/^\d+(?:[.,]\d+)?\s*%?$/.test(teks)) return null;
  const angka = Number(teks.replace(/\s*%$/, "").replace(",", "."));
  return angka >= 0 && angka <= 100 ? angka : null;
}

/** Kelengkapan semua ketentuan, termasuk total pembagian yang harus 100%. */
export function validasiDataAdartStandar(
  nilai: Readonly<Record<string, string | null | undefined>>,
  sumber?: DokumenAdartStandarTermuat | null,
): HasilValidasiDokumen {
  const fields = fieldAdartStandar(sumber);
  const hasil = validasiIsianDokumen(fields, nilai);
  const bermasalah = new Set(hasil.fieldBermasalah.map((field) => field.key));
  const tambahMasalah = (field: DokumenFieldWajib, alasan: string) => {
    if (bermasalah.has(field.key)) return;
    bermasalah.add(field.key);
    const masalah = { ...field, alasan };
    hasil.fieldTidakValid.push(masalah);
    hasil.fieldBermasalah.push(masalah);
  };
  for (const field of fields) {
    const isi = nilai[field.key]?.trim();
    if (!isi) continue;
    if (/^HARI_/.test(field.key) && !/^\d+$/.test(isi)) {
      tambahMasalah(field, "isi jumlah hari dengan bilangan bulat");
    }
    if (/^PERSEN_/.test(field.key) && persentase(isi) === null) {
      tambahMasalah(field, "isi persentase antara 0 dan 100");
    }
  }
  const pembagian = fields.filter((field) => /^PERSEN_/.test(field.key));
  if (
    pembagian.length &&
    pembagian.every((field) => !bermasalah.has(field.key))
  ) {
    const total = pembagian.reduce(
      (jumlah, field) => jumlah + persentase(nilai[field.key] ?? undefined)!,
      0,
    );
    if (Math.abs(total - 100) > 0.000001) {
      for (const field of pembagian) {
        tambahMasalah(
          field,
          `total pembagian harus 100% (saat ini ${Number(total.toFixed(6))}%)`,
        );
      }
    }
  }
  hasil.terisi = hasil.total - hasil.fieldBermasalah.length;
  hasil.lengkap = hasil.fieldBermasalah.length === 0;
  hasil.persentase = hasil.total
    ? Math.round((hasil.terisi / hasil.total) * 100)
    : 100;
  return hasil;
}

export interface DokumenAdartStandarTermuat {
  sumber: typeof SUMBER_ADART_STANDAR;
  paket: PaketData;
  dokumen: Record<JenisDokumenAdartStandar, PaketDokumen>;
  /** Token inti yang terkonfirmasi muncul pada naskah sumber, tanpa duplikasi. */
  tokenInti: TokenIntiAdartStandar[];
}

const tokenIntiSet = new Set<string>(TOKEN_INTI_ADART_STANDAR);

function isTokenIntiAdartStandar(
  token: string,
): token is TokenIntiAdartStandar {
  return tokenIntiSet.has(token);
}

function cariDokumen(
  paket: PaketData,
  jenis: JenisDokumenAdartStandar,
): PaketDokumen {
  const info = SUMBER_ADART_STANDAR.dokumen[jenis];
  const dokumen = paket.dokumen.find((item) => item.id === info.id);
  if (!dokumen) {
    throw new Error(
      `Dokumen standar ${info.id} tidak ditemukan pada paket ${SUMBER_ADART_STANDAR.paketId}.`,
    );
  }
  return dokumen;
}

/**
 * Ambil token inti dari dua naskah dengan urutan pertama muncul dan tanpa
 * duplikasi. Validasi loader di bawah memastikan keenam token tersedia.
 */
export function tokenIntiAdartStandar(
  dokumen: readonly PaketDokumen[],
): TokenIntiAdartStandar[] {
  const ditemukan = new Set<TokenIntiAdartStandar>();
  for (const item of dokumen) {
    for (const token of tokenDokumen(item.html)) {
      if (isTokenIntiAdartStandar(token)) ditemukan.add(token);
    }
  }
  return TOKEN_INTI_ADART_STANDAR.filter((token) => ditemukan.has(token));
}

/**
 * Muat dua naskah AD/ART lengkap sekaligus: 04_AD (17 BAB) dan 05_ART
 * (19 BAB). Source diperiksa agar perubahan asset tidak diam-diam membuat
 * formulir standar kehilangan token identitas yang wajib.
 */
export async function loadAdartStandar(): Promise<DokumenAdartStandarTermuat> {
  const paket = await fetchPaket(SUMBER_ADART_STANDAR.paketId);
  if (paket.paketId !== SUMBER_ADART_STANDAR.paketId) {
    throw new Error("Paket sumber AD/ART standar tidak sesuai.");
  }

  const ad = cariDokumen(paket, "ad");
  const art = cariDokumen(paket, "art");
  const tokenInti = tokenIntiAdartStandar([ad, art]);
  const hilang = TOKEN_INTI_ADART_STANDAR.filter(
    (token) => !tokenInti.includes(token),
  );
  if (hilang.length > 0) {
    throw new Error(
      `Token inti AD/ART standar tidak lengkap: ${hilang.join(", ")}.`,
    );
  }

  return {
    sumber: SUMBER_ADART_STANDAR,
    paket,
    dokumen: { ad, art },
    tokenInti,
  };
}

/** Muat hanya satu naskah standar bila editor menampilkan tab AD atau ART. */
export async function loadDokumenAdartStandar(
  jenis: JenisDokumenAdartStandar,
): Promise<PaketDokumen> {
  const termuat = await loadAdartStandar();
  return termuat.dokumen[jenis];
}

function teks(value: string | undefined): string {
  return value?.trim() ?? "";
}

function nilaiDenganOverride(
  token: TokenIntiAdartStandar,
  fallback: string,
  overrides: Partial<NilaiIntiAdartStandar>,
): string {
  return Object.prototype.hasOwnProperty.call(overrides, token)
    ? teks(overrides[token])
    : fallback;
}

/**
 * Prefill formulir identitas minimal.
 *
 * Empat nilai berasal dari profil sanggar bila tersedia. Nama sekretaris
 * memang belum ada sebagai field profil, sehingga dibiarkan kosong. Tanggal
 * musyawarah juga diisi dari catatan kejadian, tidak diasumsikan tanggal cetak.
 */
export function prefillAdartStandar(
  sanggar: SanggarUser,
  overrides: Partial<NilaiIntiAdartStandar> = {},
): NilaiIntiAdartStandar {
  const profil = prefillDariProfil(sanggar);
  const defaults: NilaiIntiAdartStandar = {
    NAMA_SANGGAR: teks(profil.NAMA_SANGGAR) || teks(sanggar.namaSanggar),
    NAMA_KETUA: teks(profil.NAMA_KETUA) || teks(sanggar.namaKetua),
    NAMA_SEKRETARIS: "",
    ALAMAT_LENGKAP_SANGGAR:
      teks(profil.ALAMAT_LENGKAP_SANGGAR) || teks(sanggar.alamat),
    KOTA: teks(profil.KOTA) || teks(sanggar.wilayah?.kota),
    TANGGAL_MUSYAWARAH: "",
  };

  return {
    NAMA_SANGGAR: nilaiDenganOverride(
      "NAMA_SANGGAR",
      defaults.NAMA_SANGGAR,
      overrides,
    ),
    NAMA_KETUA: nilaiDenganOverride(
      "NAMA_KETUA",
      defaults.NAMA_KETUA,
      overrides,
    ),
    NAMA_SEKRETARIS: nilaiDenganOverride(
      "NAMA_SEKRETARIS",
      defaults.NAMA_SEKRETARIS,
      overrides,
    ),
    ALAMAT_LENGKAP_SANGGAR: nilaiDenganOverride(
      "ALAMAT_LENGKAP_SANGGAR",
      defaults.ALAMAT_LENGKAP_SANGGAR,
      overrides,
    ),
    KOTA: nilaiDenganOverride("KOTA", defaults.KOTA, overrides),
    TANGGAL_MUSYAWARAH: nilaiDenganOverride(
      "TANGGAL_MUSYAWARAH",
      defaults.TANGGAL_MUSYAWARAH,
      overrides,
    ),
  };
}

/** Render seluruh token; persentase angka selalu diberi satu tanda persen. */
export function renderDokumenAdartStandar(
  dokumen: PaketDokumen,
  nilai: Readonly<Record<string, string>>,
): string {
  const isian = Object.fromEntries(
    Object.entries(nilai).map(([token, isi]) => [
      token,
      /^PERSEN_/.test(token) && persentase(isi) !== null
        ? `${isi.trim().replace(/\s*%$/, "")}%`
        : isi,
    ]),
  );
  return substitusi(dokumen.html, isian);
}
