import type {
  Indikator,
  KurasiPersyaratanBuktiDukung,
  Pilar,
  KurasiMatrix,
  PatokanNilaiKurasi,
  PredikatBand,
  Variabel,
} from "./types";
import {
  createDefaultManajemenIndikator,
  perluPembaruanIndikatorManajemen,
} from "./kurasi-manajemen";
import {
  createDefaultSeniPertunjukanIndikator,
  perluPembaruanIndikatorSeniPertunjukan,
} from "./kurasi-seni";

export {
  CATATAN_BOBOT_MANAJEMEN_SANGGAR,
  createDefaultManajemenIndikator,
  normalisasiBobotVariabel,
  SUMBER_INDIKATOR_MANAJEMEN_SANGGAR,
  VERSI_INDIKATOR_MANAJEMEN_SANGGAR,
} from "./kurasi-manajemen";

export {
  CATATAN_BOBOT_SENI_PERTUNJUKAN,
  createDefaultSeniPertunjukanIndikator,
  perluPembaruanIndikatorSeniPertunjukan,
  SUMBER_INDIKATOR_SENI_PERTUNJUKAN,
  VERSI_INDIKATOR_SENI_PERTUNJUKAN,
} from "./kurasi-seni";

const newId = () =>
  Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export type ScoreMap = Record<string, number>; // variabelId -> nilai 0..100
export type RequirementScoreMap = Record<string, Record<string, number>>;

export const DEFAULT_PATOKAN_NILAI: PatokanNilaiKurasi[] = [
  {
    id: "patokan-tidak-ada",
    nilai: 0,
    nama: "Tidak ada",
    persentaseBobot: 0,
  },
  {
    id: "patokan-tidak-sesuai",
    nilai: 5,
    nama: "Tidak sesuai",
    persentaseBobot: 50,
  },
  {
    id: "patokan-sesuai",
    nilai: 10,
    nama: "Sesuai",
    persentaseBobot: 100,
  },
];

export function patokanNilaiKurasi(
  matrix?: KurasiMatrix,
): PatokanNilaiKurasi[] {
  const patokan = matrix?.patokanNilai;
  return patokan && patokan.length > 0 ? patokan : DEFAULT_PATOKAN_NILAI;
}

function normalisasiPatokanNilai(
  value: PatokanNilaiKurasi[] | undefined,
): PatokanNilaiKurasi[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (item) =>
        item &&
        typeof item.nilai === "number" &&
        Number.isFinite(item.nilai) &&
        typeof item.nama === "string" &&
        item.nama.trim().length > 0 &&
        typeof item.persentaseBobot === "number" &&
        Number.isFinite(item.persentaseBobot),
    )
    .map((item) => ({
      id: item.id || newId(),
      nilai: item.nilai,
      nama: item.nama.trim(),
      persentaseBobot: Math.max(0, Math.min(100, item.persentaseBobot)),
    }));
}

/** Patokan untuk variabel tanpa bukti: variabel -> matriks -> bawaan. */
export function patokanNilaiVariabel(
  variabel: Variabel,
  matrix?: KurasiMatrix,
): PatokanNilaiKurasi[] {
  const khusus = variabel.patokanNilai;
  return khusus && khusus.length > 0 ? khusus : patokanNilaiKurasi(matrix);
}

/** Patokan satu bukti: bukti -> variabel -> matriks -> bawaan. */
export function patokanNilaiPersyaratan(
  persyaratan: KurasiPersyaratanBuktiDukung,
  variabel: Variabel,
  matrix?: KurasiMatrix,
): PatokanNilaiKurasi[] {
  const khusus = persyaratan.patokanNilai;
  return khusus && khusus.length > 0
    ? khusus
    : patokanNilaiVariabel(variabel, matrix);
}

export function persyaratanBuktiDukungOf(
  variabel: Variabel,
): KurasiPersyaratanBuktiDukung[] {
  if (Array.isArray(variabel.persyaratanBuktiDukung)) {
    return variabel.persyaratanBuktiDukung;
  }
  const legacy = variabel.persyaratanDataDukung?.trim();
  return legacy ? [{ id: `persyaratan-${variabel.id}-1`, nama: legacy }] : [];
}

/**
 * Rata-rata nilai seluruh bukti pada satu variabel. Bukti yang belum diisi
 * tetap menjadi penyebut dan bernilai nol supaya draft tidak terlihat penuh.
 */
export function nilaiVariabelDariPersyaratan(
  variabel: Variabel,
  nestedScores?: Record<string, number>,
): number {
  const persyaratan = persyaratanBuktiDukungOf(variabel);
  if (persyaratan.length === 0) return 0;
  return (
    persyaratan.reduce((total, item) => {
      const value = nestedScores?.[item.id];
      return (
        total +
        (typeof value === "number" && Number.isFinite(value)
          ? Math.max(0, Math.min(100, value))
          : 0)
      );
    }, 0) / persyaratan.length
  );
}

/**
 * Bentuk ulang skor agregat dari rincian bukti. Skor numerik lama tetap
 * dipertahankan sampai rincian untuk variabel tersebut benar-benar tersedia.
 */
export function agregasikanRequirementScores(
  matrix: KurasiMatrix,
  scores: ScoreMap,
  requirementScores: RequirementScoreMap = {},
): ScoreMap {
  const result: ScoreMap = {};
  for (const indikator of matrix.indikator) {
    for (const variabel of variabelOf(indikator)) {
      const persyaratan = persyaratanBuktiDukungOf(variabel);
      const rincian = requirementScores[variabel.id];
      if (persyaratan.length > 0 && rincian !== undefined) {
        result[variabel.id] = nilaiVariabelDariPersyaratan(variabel, rincian);
      } else if (Object.hasOwn(scores, variabel.id)) {
        result[variabel.id] = scores[variabel.id];
      }
    }
  }
  return result;
}

/** Daftar predikat (hasil akhir) bawaan — dipakai bila Kurator belum menyetel sendiri. */
export const DEFAULT_PREDIKAT: PredikatBand[] = [
  {
    id: "predikat-muda",
    nama: "MUDA",
    min: 0,
    warna: "hsl(8 65% 55%)",
    tingkat: "Tingkat Kecamatan",
  },
  {
    id: "predikat-terampil",
    nama: "TERAMPIL",
    min: 60,
    warna: "hsl(42 80% 52%)",
    tingkat: "Tingkat Kota/Kabupaten Administrasi",
  },
  {
    id: "predikat-mahir",
    nama: "MAHIR",
    min: 80,
    warna: "hsl(145 60% 45%)",
    tingkat: "Tingkat Provinsi",
  },
  {
    id: "predikat-profesional",
    nama: "PROFESIONAL",
    min: 95,
    warna: "hsl(149 62% 34%)",
    tingkat: "Tingkat Nasional & Internasional",
  },
];

/** Ambil daftar band predikat yang berlaku untuk sebuah matriks (fallback ke bawaan). */
export function predikatBands(matrix?: KurasiMatrix): PredikatBand[] {
  const bands = matrix?.predikat;
  return bands && bands.length > 0 ? bands : DEFAULT_PREDIKAT;
}

/** Predikat untuk sebuah Nilai Akhir: band tertinggi yang ambang bawahnya <= NA. */
export function predikatOf(
  na: number,
  bands: PredikatBand[] = DEFAULT_PREDIKAT,
): string {
  const sorted = [...bands].sort((a, b) => a.min - b.min);
  let result = sorted[0]?.nama ?? "";
  for (const b of sorted) if (na >= b.min) result = b.nama;
  return result;
}

export function predikatColor(
  predikat: string,
  bands: PredikatBand[] = DEFAULT_PREDIKAT,
): string {
  return (
    bands.find((p) => p.nama === predikat)?.warna ?? DEFAULT_PREDIKAT[0].warna
  );
}

export function predikatTingkat(
  predikat: string,
  bands: PredikatBand[] = DEFAULT_PREDIKAT,
): string {
  return bands.find((p) => p.nama === predikat)?.tingkat ?? "";
}

/** Seluruh variabel (leaf) pada satu indikator, melintasi semua pilar. */
export function variabelOf(ind: Indikator): Variabel[] {
  return ind.pilar.flatMap((p) => p.variabel);
}

/** Skor pilar 0..100 = Σ(nilai variabel × bobot variabel / 100). */
export function pilarScoreOf(pilar: Pilar, scores: ScoreMap): number {
  return pilar.variabel.reduce(
    (s, v) => s + ((scores[v.id] ?? 0) * v.bobot) / 100,
    0,
  );
}

/** Skor indikator 0..100 = Σ(skor pilar × bobot pilar / 100). */
export function indikatorScoreOf(ind: Indikator, scores: ScoreMap): number {
  return ind.pilar.reduce(
    (s, p) => s + (pilarScoreOf(p, scores) * p.bobot) / 100,
    0,
  );
}

/** Kontribusi indikator terhadap Nilai Akhir = skor indikator × bobot indikator / 100. */
export function indikatorKontribusi(ind: Indikator, scores: ScoreMap): number {
  return (indikatorScoreOf(ind, scores) * ind.bobot) / 100;
}

/** Nilai Akhir untuk satu set skor (satu juri / live). */
export function naFromScores(matrix: KurasiMatrix, scores: ScoreMap): number {
  return matrix.indikator.reduce(
    (s, ind) => s + indikatorKontribusi(ind, scores),
    0,
  );
}

/** Nilai Akhir gabungan: rerata Nilai Akhir seluruh juri yang sudah menilai. */
export function computeNA(
  matrix: KurasiMatrix,
  scoresPerJuri: Record<string, ScoreMap>,
): { na: number; predikat: string } | null {
  const juriIds = Object.keys(scoresPerJuri);
  if (juriIds.length === 0) return null;
  const totals = juriIds.map((jid) =>
    naFromScores(matrix, scoresPerJuri[jid] ?? {}),
  );
  const na = totals.reduce((s, x) => s + x, 0) / totals.length;
  return { na, predikat: predikatOf(na, predikatBands(matrix)) };
}

/** Indikator bertipe manajemen (diisi sanggar pada Tahap 1). Fallback ke indikator pertama. */
export function manajemenIndikator(
  matrix: KurasiMatrix,
): Indikator | undefined {
  return (
    matrix.indikator.find((i) => i.tipe === "manajemen") ?? matrix.indikator[0]
  );
}

/** Indikator bertipe seni (dinilai juri via video). Fallback ke indikator non-manajemen / kedua. */
export function seniIndikator(matrix: KurasiMatrix): Indikator | undefined {
  return (
    matrix.indikator.find((i) => i.tipe === "seni") ??
    matrix.indikator.find((i) => i !== manajemenIndikator(matrix)) ??
    matrix.indikator[matrix.indikator.length - 1]
  );
}

interface LegacyVariabel {
  id: string;
  nama: string;
  bobot: number;
  bobotSumber?: number;
  persyaratanBuktiDukung?: KurasiPersyaratanBuktiDukung[];
  patokanNilai?: PatokanNilaiKurasi[];
  persyaratanDataDukung?: string;
  halamanSumber?: number;
  contoh?: Variabel["contoh"];
  subVariabel?: unknown[];
}
interface LegacyIndikator {
  id: string;
  nama: string;
  bobot: number;
  tipe?: string;
  versi?: string;
  sumber?: string;
  catatanBobot?: string;
  pilar?: Pilar[];
  variabel?: LegacyVariabel[];
}

function migrateVariabel(variabel: LegacyVariabel): Variabel {
  const variabelId = variabel.id ?? newId();
  const persyaratanBuktiDukung = Array.isArray(variabel.persyaratanBuktiDukung)
    ? variabel.persyaratanBuktiDukung
        .filter(
          (item) =>
            item &&
            typeof item.nama === "string" &&
            item.nama.trim().length > 0,
        )
        .map((item) => {
          const patokanNilai = normalisasiPatokanNilai(item.patokanNilai);
          return {
            id: item.id || newId(),
            nama: item.nama.trim(),
            ...(patokanNilai.length > 0 ? { patokanNilai } : {}),
          };
        })
    : variabel.persyaratanDataDukung?.trim()
      ? [
          {
            id: `persyaratan-${variabelId}-1`,
            nama: variabel.persyaratanDataDukung.trim(),
          },
        ]
      : [];
  const patokanNilai = normalisasiPatokanNilai(variabel.patokanNilai);
  return {
    id: variabelId,
    nama: variabel.nama,
    bobot: variabel.bobot,
    ...(variabel.bobotSumber !== undefined
      ? { bobotSumber: variabel.bobotSumber }
      : {}),
    persyaratanBuktiDukung,
    ...(patokanNilai.length > 0 ? { patokanNilai } : {}),
    ...(variabel.persyaratanDataDukung
      ? { persyaratanDataDukung: variabel.persyaratanDataDukung }
      : {}),
    ...(variabel.halamanSumber !== undefined
      ? { halamanSumber: variabel.halamanSumber }
      : {}),
    ...(variabel.contoh ? { contoh: variabel.contoh } : {}),
  };
}

/**
 * Migrasi matriks lama (Indikator → Variabel, tanpa Pilar) ke struktur baru
 * (Indikator → Pilar → Variabel). Setiap indikator lama dibungkus satu Pilar
 * default "Umum" (bobot 100) yang memuat variabel lama — ID variabel dipertahankan
 * agar skor yang sudah ada tetap valid.
 */
export function migrateMatrix(
  matrix: KurasiMatrix | undefined,
  options: { preserveExistingContent?: boolean } = {},
): KurasiMatrix {
  if (!matrix || !Array.isArray(matrix.indikator)) {
    return {
      indikator: [],
      predikat: DEFAULT_PREDIKAT.map((p) => ({ ...p })),
      patokanNilai: DEFAULT_PATOKAN_NILAI.map((p) => ({ ...p })),
      updatedAt: Date.now(),
    };
  }
  const predikat: PredikatBand[] =
    Array.isArray(matrix.predikat) && matrix.predikat.length > 0
      ? matrix.predikat.map((p) => ({
          id: p.id ?? newId(),
          nama: p.nama,
          min: p.min,
          warna: p.warna ?? DEFAULT_PREDIKAT[0].warna,
          tingkat: p.tingkat ?? "",
        }))
      : DEFAULT_PREDIKAT.map((p) => ({ ...p }));
  const patokanNilai = normalisasiPatokanNilai(matrix.patokanNilai);
  const indikator: Indikator[] = (
    matrix.indikator as unknown as LegacyIndikator[]
  ).map((ind) => {
    const tipe: Indikator["tipe"] =
      ind.tipe === "manajemen" || ind.tipe === "seni"
        ? ind.tipe
        : /(manaj|organisasi|administ|kelembagaan)/i.test(ind.nama)
          ? "manajemen"
          : "seni";
    let pilar: Pilar[];
    if (Array.isArray(ind.pilar) && ind.pilar.length > 0) {
      pilar = ind.pilar.map((p) => ({
        id: p.id ?? newId(),
        nama: p.nama,
        bobot: p.bobot,
        ...(p.bobotSumber !== undefined ? { bobotSumber: p.bobotSumber } : {}),
        variabel: (p.variabel ?? []).map((v) => migrateVariabel(v)),
      }));
    } else {
      const variabel: Variabel[] = (ind.variabel ?? []).map(migrateVariabel);
      pilar = [{ id: newId(), nama: "Umum", bobot: 100, variabel }];
    }
    const migrated: Indikator = {
      id: ind.id ?? newId(),
      nama: ind.nama,
      bobot: ind.bobot,
      tipe,
      ...(ind.versi ? { versi: ind.versi } : {}),
      ...(ind.sumber ? { sumber: ind.sumber } : {}),
      ...(ind.catatanBobot ? { catatanBobot: ind.catatanBobot } : {}),
      pilar,
    };
    if (!options.preserveExistingContent) {
      if (perluPembaruanIndikatorManajemen(migrated)) {
        return createDefaultManajemenIndikator();
      }
      if (perluPembaruanIndikatorSeniPertunjukan(migrated)) {
        return createDefaultSeniPertunjukanIndikator();
      }
    }
    return migrated;
  });
  return {
    indikator,
    predikat,
    patokanNilai:
      patokanNilai.length > 0
        ? patokanNilai
        : DEFAULT_PATOKAN_NILAI.map((p) => ({ ...p })),
    updatedAt: matrix.updatedAt ?? Date.now(),
  };
}

/**
 * Membekukan struktur dan patokan yang berlaku untuk satu pengajuan.
 * Contoh berkas sengaja tidak disalin agar snapshot tetap ringan.
 */
export function createKurasiMatrixSnapshot(matrix: KurasiMatrix): KurasiMatrix {
  const migrated = migrateMatrix(matrix);
  return {
    indikator: migrated.indikator.map((indikator) => ({
      ...indikator,
      pilar: indikator.pilar.map((pilar) => ({
        ...pilar,
        variabel: pilar.variabel.map((variabel) => ({
          id: variabel.id,
          nama: variabel.nama,
          bobot: variabel.bobot,
          ...(variabel.bobotSumber !== undefined
            ? { bobotSumber: variabel.bobotSumber }
            : {}),
          ...(variabel.halamanSumber !== undefined
            ? { halamanSumber: variabel.halamanSumber }
            : {}),
          ...(variabel.patokanNilai && variabel.patokanNilai.length > 0
            ? {
                patokanNilai: variabel.patokanNilai.map((item) => ({
                  ...item,
                })),
              }
            : {}),
          persyaratanBuktiDukung: persyaratanBuktiDukungOf(variabel).map(
            (persyaratan) => ({
              id: persyaratan.id,
              nama: persyaratan.nama,
              ...(persyaratan.patokanNilai &&
              persyaratan.patokanNilai.length > 0
                ? {
                    patokanNilai: persyaratan.patokanNilai.map((item) => ({
                      ...item,
                    })),
                  }
                : {}),
            }),
          ),
        })),
      })),
    })),
    predikat: migrated.predikat?.map((item) => ({ ...item })),
    patokanNilai: migrated.patokanNilai?.map((item) => ({ ...item })),
    updatedAt: migrated.updatedAt,
  };
}
