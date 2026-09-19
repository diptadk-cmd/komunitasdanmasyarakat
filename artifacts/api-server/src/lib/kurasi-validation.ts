type UnknownRecord = Record<string, unknown>;

export type KurasiPatokanNilai = {
  id: string;
  nilai: number;
  nama: string;
  persentaseBobot: number;
};

export type KurasiMatrixSnapshot = {
  indikator: Array<{
    id: string;
    nama: string;
    bobot: number;
    tipe: "manajemen" | "seni";
    versi?: string;
    sumber?: string;
    catatanBobot?: string;
    pilar: Array<{
      id: string;
      nama: string;
      bobot: number;
      bobotSumber?: number;
      variabel: Array<{
        id: string;
        nama: string;
        bobot: number;
        bobotSumber?: number;
        halamanSumber?: number;
        persyaratanBuktiDukung?: Array<{
          id: string;
          nama: string;
          patokanNilai?: KurasiPatokanNilai[];
        }>;
        patokanNilai?: KurasiPatokanNilai[];
        persyaratanDataDukung?: string;
        contoh?: {
          name: string;
          size: number;
          url?: string;
          dataUrl?: string;
        };
      }>;
    }>;
  }>;
  predikat?: Array<{
    id: string;
    nama: string;
    min: number;
    warna: string;
    tingkat: string;
  }>;
  patokanNilai: KurasiPatokanNilai[];
  updatedAt: number;
};

export type KurasiRequirementScoreMap = Record<string, Record<string, number>>;

export type KurasiScoreValidationResult =
  | {
      ok: true;
      scores: Record<string, number>;
      requirementScores: KurasiRequirementScoreMap;
    }
  | { ok: false; error: string };

const DEFAULT_PATOKAN: KurasiPatokanNilai[] = [
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

const TOTAL_TOLERANCE = 0.001;
const MAX_EXAMPLE_BYTES = 2 * 1024 * 1024;
const MAX_DATA_URL_LENGTH = 3_000_000;

function record(value: unknown): UnknownRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : null;
}

function requiredText(value: unknown, max = 500): string | null {
  if (typeof value !== "string") return null;
  const result = value.trim();
  return result.length > 0 && result.length <= max ? result : null;
}

/** undefined = tidak diisi, null = tipe/panjang tidak valid. */
function optionalText(value: unknown, max = 2_000): string | undefined | null {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") return null;
  const result = value.trim();
  if (result.length === 0) return undefined;
  return result.length <= max ? result : null;
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function percentage(value: unknown): number | null {
  const result = finiteNumber(value);
  return result !== null && result >= 0 && result <= 100 ? result : null;
}

function totalIs(value: number, target = 100): boolean {
  return Math.abs(value - target) < TOTAL_TOLERANCE;
}

/**
 * undefined = properti tidak ada (boleh memakai fallback), null = nilai rusak.
 */
function sanitizePatokan(
  value: unknown,
  strict: boolean,
): KurasiPatokanNilai[] | undefined | null {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length === 0) {
    return strict ? null : undefined;
  }

  const result: KurasiPatokanNilai[] = [];
  for (const rawItem of value) {
    const item = record(rawItem);
    const id = requiredText(item?.id, 200);
    const nama = requiredText(item?.nama, 500);
    const nilai = percentage(item?.nilai);
    const persentaseBobot = percentage(item?.persentaseBobot);
    if (!id || !nama || nilai === null || persentaseBobot === null) {
      return null;
    }
    result.push({ id, nilai, nama, persentaseBobot });
  }

  if (
    new Set(result.map((item) => item.id)).size !== result.length ||
    new Set(result.map((item) => item.nilai)).size !== result.length ||
    new Set(result.map((item) => item.persentaseBobot)).size !== result.length
  ) {
    return null;
  }
  return result;
}

function sanitizeExample(
  value: unknown,
):
  | KurasiMatrixSnapshot["indikator"][number]["pilar"][number]["variabel"][number]["contoh"]
  | null {
  const source = record(value);
  if (!source) return null;
  const name = requiredText(source.name, 255);
  const size = finiteNumber(source.size);
  if (
    !name ||
    size === null ||
    !Number.isInteger(size) ||
    size < 0 ||
    size > MAX_EXAMPLE_BYTES
  ) {
    return null;
  }

  let url: string | undefined;
  if (source.url !== undefined) {
    url = requiredText(source.url, 2_000) ?? undefined;
    if (!url || !/^\/api\/uploads\/[0-9a-f-]{36}\/raw$/i.test(url)) {
      return null;
    }
  }

  let dataUrl: string | undefined;
  if (source.dataUrl !== undefined) {
    dataUrl = requiredText(source.dataUrl, MAX_DATA_URL_LENGTH) ?? undefined;
    if (
      !dataUrl ||
      !/^data:(?:application\/pdf|image\/[a-z0-9.+-]+);base64,/i.test(dataUrl)
    ) {
      return null;
    }
  }

  if (!url && !dataUrl) return null;
  return {
    name,
    size,
    ...(url ? { url } : {}),
    ...(dataUrl ? { dataUrl } : {}),
  };
}

function sanitizeKurasiMatrix(
  value: unknown,
  options: { strictSetting: boolean; keepExamples: boolean },
): KurasiMatrixSnapshot | null {
  const source = record(value);
  if (!source || !Array.isArray(source.indikator)) return null;

  const indikator: KurasiMatrixSnapshot["indikator"] = [];
  for (const rawIndikator of source.indikator) {
    const item = record(rawIndikator);
    if (!item || !Array.isArray(item.pilar) || item.pilar.length === 0) {
      return null;
    }
    const id = requiredText(item.id, 200);
    const nama = requiredText(item.nama, 500);
    const bobot = percentage(item.bobot);
    const tipe =
      item.tipe === "manajemen" || item.tipe === "seni" ? item.tipe : null;
    const versi = optionalText(item.versi, 200);
    const sumber = optionalText(item.sumber, 2_000);
    const catatanBobot = optionalText(item.catatanBobot, 2_000);
    if (
      !id ||
      !nama ||
      bobot === null ||
      !tipe ||
      versi === null ||
      sumber === null ||
      catatanBobot === null
    ) {
      return null;
    }

    const pilar: KurasiMatrixSnapshot["indikator"][number]["pilar"] = [];
    for (const rawPilar of item.pilar) {
      const pilarItem = record(rawPilar);
      if (
        !pilarItem ||
        !Array.isArray(pilarItem.variabel) ||
        pilarItem.variabel.length === 0
      ) {
        return null;
      }
      const pilarId = requiredText(pilarItem.id, 200);
      const pilarNama = requiredText(pilarItem.nama, 500);
      const pilarBobot = percentage(pilarItem.bobot);
      const pilarBobotSumber = percentage(pilarItem.bobotSumber);
      if (
        !pilarId ||
        !pilarNama ||
        pilarBobot === null ||
        (pilarItem.bobotSumber !== undefined && pilarBobotSumber === null)
      ) {
        return null;
      }

      const variabel: KurasiMatrixSnapshot["indikator"][number]["pilar"][number]["variabel"] =
        [];
      for (const rawVariabel of pilarItem.variabel) {
        const variabelItem = record(rawVariabel);
        if (!variabelItem) return null;
        const variabelId = requiredText(variabelItem.id, 200);
        const variabelNama = requiredText(variabelItem.nama, 500);
        const variabelBobot = percentage(variabelItem.bobot);
        const bobotSumber = percentage(variabelItem.bobotSumber);
        const halamanSumber = finiteNumber(variabelItem.halamanSumber);
        if (
          !variabelId ||
          !variabelNama ||
          variabelBobot === null ||
          (variabelItem.bobotSumber !== undefined && bobotSumber === null) ||
          (variabelItem.halamanSumber !== undefined &&
            (halamanSumber === null ||
              !Number.isInteger(halamanSumber) ||
              halamanSumber < 1 ||
              halamanSumber > 10_000))
        ) {
          return null;
        }

        const patokanNilai = sanitizePatokan(
          variabelItem.patokanNilai,
          options.strictSetting,
        );
        if (patokanNilai === null) return null;

        let persyaratanBuktiDukung:
          | NonNullable<
              KurasiMatrixSnapshot["indikator"][number]["pilar"][number]["variabel"][number]["persyaratanBuktiDukung"]
            >
          | undefined;
        if (variabelItem.persyaratanBuktiDukung !== undefined) {
          if (!Array.isArray(variabelItem.persyaratanBuktiDukung)) return null;
          persyaratanBuktiDukung = [];
          for (const rawPersyaratan of variabelItem.persyaratanBuktiDukung) {
            const persyaratan = record(rawPersyaratan);
            const persyaratanId = requiredText(persyaratan?.id, 200);
            const persyaratanNama = requiredText(persyaratan?.nama, 1_000);
            const patokanPersyaratan = sanitizePatokan(
              persyaratan?.patokanNilai,
              options.strictSetting,
            );
            if (
              !persyaratanId ||
              !persyaratanNama ||
              patokanPersyaratan === null
            ) {
              return null;
            }
            persyaratanBuktiDukung.push({
              id: persyaratanId,
              nama: persyaratanNama,
              ...(patokanPersyaratan
                ? { patokanNilai: patokanPersyaratan }
                : {}),
            });
          }
          if (
            new Set(persyaratanBuktiDukung.map((item) => item.id)).size !==
            persyaratanBuktiDukung.length
          ) {
            return null;
          }
        }

        const persyaratanDataDukung = optionalText(
          variabelItem.persyaratanDataDukung,
          2_000,
        );
        if (persyaratanDataDukung === null) return null;

        let contoh:
          | KurasiMatrixSnapshot["indikator"][number]["pilar"][number]["variabel"][number]["contoh"]
          | undefined;
        if (options.keepExamples && variabelItem.contoh !== undefined) {
          contoh = sanitizeExample(variabelItem.contoh) ?? undefined;
          if (!contoh) return null;
        }

        variabel.push({
          id: variabelId,
          nama: variabelNama,
          bobot: variabelBobot,
          ...(bobotSumber !== null ? { bobotSumber } : {}),
          ...(halamanSumber !== null ? { halamanSumber } : {}),
          ...(persyaratanBuktiDukung !== undefined
            ? { persyaratanBuktiDukung }
            : {}),
          ...(patokanNilai ? { patokanNilai } : {}),
          ...(persyaratanBuktiDukung === undefined && persyaratanDataDukung
            ? { persyaratanDataDukung }
            : {}),
          ...(contoh ? { contoh } : {}),
        });
      }

      if (!totalIs(variabel.reduce((sum, item) => sum + item.bobot, 0))) {
        return null;
      }
      const memilikiBobotSumberVariabel = variabel.some(
        (item) => item.bobotSumber !== undefined,
      );
      if (
        options.strictSetting &&
        (tipe === "manajemen" ||
          pilarBobotSumber !== null ||
          memilikiBobotSumberVariabel)
      ) {
        const targetBobotSumber = pilarBobotSumber ?? pilarBobot;
        const totalBobotSumber = variabel.reduce(
          (sum, item) =>
            sum +
            (item.bobotSumber ??
              Number(((item.bobot * targetBobotSumber) / 100).toFixed(6))),
          0,
        );
        if (!totalIs(totalBobotSumber, targetBobotSumber)) return null;
      }

      pilar.push({
        id: pilarId,
        nama: pilarNama,
        bobot: pilarBobot,
        ...(pilarBobotSumber !== null ? { bobotSumber: pilarBobotSumber } : {}),
        variabel,
      });
    }

    if (!totalIs(pilar.reduce((sum, item) => sum + item.bobot, 0))) {
      return null;
    }
    if (
      options.strictSetting &&
      pilar.some((item) => item.bobotSumber !== undefined)
    ) {
      const totalBobotPilarSumber = pilar.reduce(
        (sum, item) =>
          sum +
          (item.bobotSumber ?? Number(((item.bobot * bobot) / 100).toFixed(6))),
        0,
      );
      if (!totalIs(totalBobotPilarSumber, bobot)) return null;
    }
    indikator.push({
      id,
      nama,
      bobot,
      tipe,
      ...(versi ? { versi } : {}),
      ...(sumber ? { sumber } : {}),
      ...(catatanBobot ? { catatanBobot } : {}),
      pilar,
    });
  }

  if (
    indikator.length === 0 ||
    !totalIs(indikator.reduce((sum, item) => sum + item.bobot, 0))
  ) {
    return null;
  }

  const indicatorIds = indikator.map((item) => item.id);
  const pillarIds = indikator.flatMap((item) =>
    item.pilar.map((pilarItem) => pilarItem.id),
  );
  const variableIds = indikator.flatMap((item) =>
    item.pilar.flatMap((pilarItem) =>
      pilarItem.variabel.map((variabelItem) => variabelItem.id),
    ),
  );
  if (
    new Set(indicatorIds).size !== indicatorIds.length ||
    new Set(pillarIds).size !== pillarIds.length ||
    new Set(variableIds).size !== variableIds.length
  ) {
    return null;
  }

  const sanitizedPatokan = sanitizePatokan(
    source.patokanNilai,
    options.strictSetting,
  );
  if (sanitizedPatokan === null) return null;
  const patokanNilai =
    sanitizedPatokan ?? DEFAULT_PATOKAN.map((item) => ({ ...item }));

  let predikat: KurasiMatrixSnapshot["predikat"];
  if (source.predikat !== undefined) {
    if (!Array.isArray(source.predikat) || source.predikat.length === 0) {
      if (options.strictSetting) return null;
    } else {
      predikat = [];
      for (const rawPredikat of source.predikat) {
        const item = record(rawPredikat);
        const id = requiredText(item?.id, 200);
        const nama = requiredText(item?.nama, 500);
        const min = percentage(item?.min);
        const warna = optionalText(item?.warna, 200);
        const tingkat = optionalText(item?.tingkat, 1_000);
        if (
          !id ||
          !nama ||
          min === null ||
          warna === null ||
          tingkat === null
        ) {
          return null;
        }
        predikat.push({
          id,
          nama,
          min,
          warna: warna ?? "hsl(150 60% 30%)",
          tingkat: tingkat ?? "",
        });
      }
      if (
        new Set(predikat.map((item) => item.id)).size !== predikat.length ||
        new Set(predikat.map((item) => item.min)).size !== predikat.length ||
        !predikat.some((item) => item.min === 0)
      ) {
        return null;
      }
      predikat.sort((a, b) => a.min - b.min);
    }
  }

  const updatedAt = finiteNumber(source.updatedAt);
  if (source.updatedAt !== undefined && (updatedAt === null || updatedAt < 0)) {
    return null;
  }
  return {
    indikator,
    ...(predikat && predikat.length > 0 ? { predikat } : {}),
    patokanNilai,
    updatedAt: updatedAt ?? Date.now(),
  };
}

/** Salinan matriks tanpa contoh berkas/data URL agar aman disimpan per pengajuan. */
export function sanitizeKurasiMatrixSnapshot(
  value: unknown,
): KurasiMatrixSnapshot | null {
  return sanitizeKurasiMatrix(value, {
    strictSetting: false,
    keepExamples: false,
  });
}

/**
 * Matriks untuk setting global: struktur divalidasi ketat dan hanya field aman
 * yang dikembalikan. Route wajib menyimpan hasil ini, bukan payload mentah.
 */
export function sanitizeKurasiMatrixSetting(
  value: unknown,
): KurasiMatrixSnapshot | null {
  return sanitizeKurasiMatrix(value, {
    strictSetting: true,
    keepExamples: true,
  });
}

type MatrixVariable =
  KurasiMatrixSnapshot["indikator"][number]["pilar"][number]["variabel"][number];

function requirementsOf(variable: MatrixVariable) {
  if (Array.isArray(variable.persyaratanBuktiDukung)) {
    return variable.persyaratanBuktiDukung;
  }
  const legacy = variable.persyaratanDataDukung?.trim();
  return legacy
    ? [
        {
          id: `persyaratan-${variable.id}-1`,
          nama: legacy,
          patokanNilai: undefined,
        },
      ]
    : [];
}

function scoreMatchesPatokan(
  value: unknown,
  patokan: KurasiPatokanNilai[],
): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    patokan.some((item) => Math.abs(item.persentaseBobot - value) < 0.000001)
  );
}

/**
 * Validasi nilai mentah Juri lalu bentuk ulang skor agregat per variabel.
 * Setiap persyaratan adalah satu target; persyaratan yang kosong pada draft
 * bernilai nol namun tetap menjadi penyebut rata-rata.
 */
export function validateAndAggregateKurasiScores(args: {
  scores: unknown;
  requirementScores?: unknown;
  matrix: KurasiMatrixSnapshot;
  finalize: boolean;
}): KurasiScoreValidationResult {
  const directScores = record(args.scores);
  const rawRequirementScores =
    args.requirementScores === undefined ? {} : record(args.requirementScores);
  if (!directScores || !rawRequirementScores) {
    return { ok: false, error: "Data nilai tidak valid." };
  }

  const variables = args.matrix.indikator.flatMap((indikator) =>
    indikator.pilar.flatMap((pilar) => pilar.variabel),
  );
  const variablesById = new Map(variables.map((item) => [item.id, item]));

  for (const variableId of Object.keys(directScores)) {
    if (!variablesById.has(variableId)) {
      return {
        ok: false,
        error: `Variabel penilaian tidak dikenal: ${variableId}`,
      };
    }
  }
  for (const variableId of Object.keys(rawRequirementScores)) {
    if (!variablesById.has(variableId)) {
      return {
        ok: false,
        error: `Variabel persyaratan tidak dikenal: ${variableId}`,
      };
    }
  }

  const scores: Record<string, number> = {};
  const requirementScores: KurasiRequirementScoreMap = {};
  for (const variable of variables) {
    const requirements = requirementsOf(variable);
    const rawNested = rawRequirementScores[variable.id];

    if (requirements.length > 0) {
      if (rawNested !== undefined && !record(rawNested)) {
        return {
          ok: false,
          error: `Rincian nilai pada variabel "${variable.nama}" tidak valid.`,
        };
      }
      const nested = record(rawNested) ?? {};
      const requirementsById = new Map(
        requirements.map((item) => [item.id, item]),
      );
      for (const requirementId of Object.keys(nested)) {
        if (!requirementsById.has(requirementId)) {
          return {
            ok: false,
            error: `Persyaratan penilaian tidak dikenal: ${requirementId}`,
          };
        }
      }

      if (!args.finalize && Object.keys(nested).length === 0) {
        if (Object.hasOwn(directScores, variable.id)) {
          const legacyAggregate = directScores[variable.id];
          if (
            typeof legacyAggregate !== "number" ||
            !Number.isFinite(legacyAggregate) ||
            legacyAggregate < 0 ||
            legacyAggregate > 100
          ) {
            return {
              ok: false,
              error: `Nilai agregat lama pada variabel "${variable.nama}" tidak valid.`,
            };
          }
          scores[variable.id] = legacyAggregate;
        }
        continue;
      }

      const cleanNested: Record<string, number> = {};
      let total = 0;
      for (const requirement of requirements) {
        const hasScore = Object.hasOwn(nested, requirement.id);
        if (args.finalize && !hasScore) {
          return {
            ok: false,
            error:
              "Seluruh persyaratan bukti wajib dinilai sebelum finalisasi.",
          };
        }
        if (!hasScore) continue;
        const effectivePatokan =
          requirement.patokanNilai && requirement.patokanNilai.length > 0
            ? requirement.patokanNilai
            : variable.patokanNilai && variable.patokanNilai.length > 0
              ? variable.patokanNilai
              : args.matrix.patokanNilai;
        const value = nested[requirement.id];
        if (!scoreMatchesPatokan(value, effectivePatokan)) {
          return {
            ok: false,
            error: `Nilai untuk persyaratan "${requirement.nama}" harus mengikuti patokan yang ditetapkan Kurator.`,
          };
        }
        cleanNested[requirement.id] = value;
        total += value;
      }
      if (Object.keys(cleanNested).length > 0) {
        requirementScores[variable.id] = cleanNested;
      }
      scores[variable.id] = total / requirements.length;
      continue;
    }

    if (rawNested !== undefined) {
      return {
        ok: false,
        error: `Variabel "${variable.nama}" tidak memiliki persyaratan bukti.`,
      };
    }
    const hasScore = Object.hasOwn(directScores, variable.id);
    if (args.finalize && !hasScore) {
      return {
        ok: false,
        error:
          "Seluruh variabel tanpa persyaratan wajib dinilai sebelum finalisasi.",
      };
    }
    if (!hasScore) {
      continue;
    }
    const effectivePatokan =
      variable.patokanNilai && variable.patokanNilai.length > 0
        ? variable.patokanNilai
        : args.matrix.patokanNilai;
    const value = directScores[variable.id];
    if (!scoreMatchesPatokan(value, effectivePatokan)) {
      return {
        ok: false,
        error: `Nilai untuk variabel "${variable.nama}" harus mengikuti patokan yang ditetapkan Kurator.`,
      };
    }
    scores[variable.id] = value;
  }

  return { ok: true, scores, requirementScores };
}

function containsFiniteNumber(value: unknown, depth = 0): boolean {
  if (typeof value === "number") return Number.isFinite(value);
  if (depth >= 4) return false;
  const source = record(value);
  return source
    ? Object.values(source).some((item) =>
        containsFiniteNumber(item, depth + 1),
      )
    : false;
}

/** Apakah snapshot submission sudah harus dibekukan. */
export function hasKurasiScoringActivity(value: unknown): boolean {
  const data = record(value);
  if (!data) return false;
  if (data.finalized === true) return true;
  const finalized = record(data.finalized);
  if (finalized && Object.keys(finalized).length > 0) return true;
  return (
    containsFiniteNumber(data.scores) ||
    containsFiniteNumber(data.requirementScores)
  );
}

/** Mendukung marker final lama berupa boolean maupun peta per username. */
export function isKurasiFinalizedForJuri(
  finalized: unknown,
  username: string,
): boolean {
  if (finalized === true) return true;
  const value = record(finalized)?.[username];
  return Boolean(value);
}
