import JSZip from "jszip";

import { DEFAULT_PATOKAN_NILAI, normalisasiBobotVariabel } from "@/lib/kurasi";
import {
  KURASI_TEMPLATE_FORMAT,
  KURASI_TEMPLATE_VERSION,
} from "@/lib/kurasi-template-xlsx";
import type {
  Indikator,
  PatokanNilaiKurasi,
  Pilar,
  PredikatBand,
  Variabel,
} from "@/lib/types";

export interface BarisIndikatorManajemen {
  nomor: number;
  pilar: string;
  bobotPilar: number;
  komponen: string;
  persyaratanDataDukung: string;
  bobotSumber: number;
  halamanSumber?: number;
}

export interface HasilInjekKurasiManajemen {
  jenis: "manajemen";
  indikator: Indikator;
  jumlahBaris: number;
  jumlahPilar: number;
  namaSheet: string;
  peringatan: string[];
}

export interface HasilInjekKurasiSeni {
  jenis: "seni";
  indikator: Indikator;
  jumlahBaris: number;
  jumlahPilar: number;
  namaSheet: string;
  peringatan: string[];
}

export interface HasilInjekKurasiLengkap {
  jenis: "lengkap";
  indikator: Indikator[];
  predikat: PredikatBand[];
  patokanNilai: PatokanNilaiKurasi[];
  jumlahBaris: number;
  jumlahPilar: number;
  namaSheet: string;
  peringatan: string[];
}

export type HasilInjekKurasi =
  | HasilInjekKurasiManajemen
  | HasilInjekKurasiSeni
  | HasilInjekKurasiLengkap;

type PilarDenganBobotSumber = Pilar & { bobotSumber?: number };

interface WorksheetPertama {
  namaSheet: string;
  rows: string[][];
}

interface WorkbookKurasi {
  worksheets: WorksheetPertama[];
}

interface FileExcelInput {
  name: string;
  arrayBuffer(): Promise<ArrayBuffer>;
}

function decodeXml(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, decimal: string) =>
      String.fromCodePoint(Number.parseInt(decimal, 10)),
    )
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function attributesOf(tag: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  for (const match of tag.matchAll(/([\w:-]+)="([^"]*)"/g)) {
    attributes[match[1]] = decodeXml(match[2]);
  }
  return attributes;
}

function textNodesOf(xml: string): string {
  return Array.from(xml.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g), (match) =>
    decodeXml(match[1]),
  ).join("");
}

function zipPath(base: string, target: string): string {
  if (target.startsWith("/")) return target.slice(1);
  const segments = `${base}/${target}`.split("/");
  const normalized: string[] = [];
  for (const segment of segments) {
    if (!segment || segment === ".") continue;
    if (segment === "..") normalized.pop();
    else normalized.push(segment);
  }
  return normalized.join("/");
}

function columnIndex(address: string): number {
  const letters = address.match(/^[A-Z]+/i)?.[0].toUpperCase() ?? "";
  return (
    letters
      .split("")
      .reduce((value, letter) => value * 26 + letter.charCodeAt(0) - 64, 0) - 1
  );
}

export function parseWorksheet(
  worksheetXml: string,
  sharedStrings: string[],
): string[][] {
  const rows: string[][] = [];
  for (const rowMatch of worksheetXml.matchAll(
    /<row\b[^>]*>([\s\S]*?)<\/row>/g,
  )) {
    const row: string[] = [];
    for (const cellMatch of rowMatch[1].matchAll(
      /<c\b([^>]*?)(?:\/\s*>|>([\s\S]*?)<\/c>)/g,
    )) {
      const attributes = attributesOf(cellMatch[1]);
      const index = columnIndex(attributes.r ?? "");
      if (index < 0) continue;
      const body = cellMatch[2] ?? "";
      const rawValue = body.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? "";
      if (attributes.t === "s") {
        row[index] = sharedStrings[Number(rawValue)] ?? "";
      } else if (attributes.t === "inlineStr") {
        row[index] = textNodesOf(body);
      } else {
        row[index] = decodeXml(rawValue);
      }
    }
    rows.push(row);
  }
  return rows;
}

function normalizeHeader(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function parsePercent(value: string, label: string, rowNumber: number): number {
  const cleaned = value.trim().replace(/%$/, "").replace(",", ".");
  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${label} pada baris Excel ${rowNumber} tidak valid.`);
  }
  const percent = value.includes("%") || parsed > 1 ? parsed : parsed * 100;
  return Number(percent.toFixed(6));
}

function stableId(prefix: string, value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `${prefix}-${(hash >>> 0).toString(36)}`;
}

export function buildManajemenIndikatorDariBaris(
  rows: BarisIndikatorManajemen[],
  options: { namaSheet: string; namaFile: string },
): HasilInjekKurasiManajemen {
  if (rows.length === 0) {
    throw new Error(
      "Sheet pertama tidak memiliki baris indikator yang dapat diinjek.",
    );
  }

  const groups = new Map<string, BarisIndikatorManajemen[]>();
  for (const row of rows) {
    const group = groups.get(row.pilar) ?? [];
    group.push(row);
    groups.set(row.pilar, group);
  }

  const peringatan: string[] = [];
  const pilar: Pilar[] = Array.from(groups.entries()).map(([nama, detail]) => {
    const bobotPilar = detail[0].bobotPilar;
    if (detail.some((item) => Math.abs(item.bobotPilar - bobotPilar) > 0.001)) {
      throw new Error(
        `Bobot pilar "${nama}" tidak konsisten pada sheet pertama.`,
      );
    }
    const totalSumber = detail.reduce((sum, item) => sum + item.bobotSumber, 0);
    if (Math.abs(totalSumber - bobotPilar) > 0.001) {
      peringatan.push(
        `${nama}: total bobot rincian ${totalSumber}% dinormalisasi ke bobot pilar ${bobotPilar}%.`,
      );
    }

    const variables = normalisasiBobotVariabel(
      detail.map<Omit<Variabel, "bobot"> & { bobotSumber: number }>((item) => {
        const id = stableId(
          "injek-variabel",
          `${nama}|${item.nomor}|${item.komponen}`,
        );
        return {
          id,
          nama: item.komponen,
          persyaratanBuktiDukung: [
            {
              id: stableId("injek-persyaratan", `${id}|1`),
              nama: item.persyaratanDataDukung,
              patokanNilai: DEFAULT_PATOKAN_NILAI.map((patokan) => ({
                ...patokan,
              })),
            },
          ],
          bobotSumber: item.bobotSumber,
          halamanSumber: item.halamanSumber,
        };
      }),
    );

    return {
      id: stableId("injek-pilar", nama),
      nama,
      bobot: bobotPilar,
      variabel: variables,
    };
  });

  const totalPilar = pilar.reduce((sum, item) => sum + item.bobot, 0);
  if (Math.abs(totalPilar - 100) > 0.001) {
    throw new Error(
      `Total bobot pilar hasil injek harus 100%, saat ini ${totalPilar}%.`,
    );
  }

  const catatanBobot =
    peringatan.length > 0
      ? `Bobot pilar berjumlah 100%. ${peringatan.join(" ")} Bobot yang ditampilkan mengikuti dokumen sumber. Patokan penilaian ditetapkan dan dapat diubah oleh Kurator.`
      : "Bobot yang ditampilkan mengikuti dokumen sumber. Patokan penilaian ditetapkan dan dapat diubah oleh Kurator.";

  return {
    jenis: "manajemen",
    indikator: {
      id: "indikator-manajemen-sanggar",
      nama: "Manajemen Sanggar",
      bobot: 30,
      tipe: "manajemen",
      versi: stableId(
        "injek",
        `${options.namaFile}|${options.namaSheet}|${rows.length}`,
      ),
      sumber: `${options.namaFile} — sheet pertama: ${options.namaSheet}`,
      catatanBobot,
      pilar,
    },
    jumlahBaris: rows.length,
    jumlahPilar: pilar.length,
    namaSheet: options.namaSheet,
    peringatan,
  };
}

export function buildSeniIndikatorDariBaris(
  rows: BarisIndikatorManajemen[],
  options: {
    namaSheet: string;
    namaFile: string;
    bobotIndikator: number;
  },
): HasilInjekKurasiSeni {
  if (rows.length === 0) {
    throw new Error(
      "Sheet pertama tidak memiliki baris indikator Seni Pertunjukan yang dapat diinjek.",
    );
  }
  if (
    !Number.isFinite(options.bobotIndikator) ||
    options.bobotIndikator <= 0 ||
    options.bobotIndikator > 100
  ) {
    throw new Error("Bobot indikator Seni Pertunjukan tidak valid.");
  }

  const groups = new Map<string, BarisIndikatorManajemen[]>();
  for (const row of rows) {
    const group = groups.get(row.pilar) ?? [];
    group.push(row);
    groups.set(row.pilar, group);
  }

  const sourcePillars = Array.from(groups.entries()).map(([nama, detail]) => {
    const bobotSumber = detail[0].bobotPilar;
    if (
      detail.some((item) => Math.abs(item.bobotPilar - bobotSumber) > 0.001)
    ) {
      throw new Error(
        `Bobot pilar "${nama}" tidak konsisten pada sheet pertama.`,
      );
    }
    return { nama, detail, bobotSumber };
  });
  const totalPilarSumber = sourcePillars.reduce(
    (sum, item) => sum + item.bobotSumber,
    0,
  );
  if (Math.abs(totalPilarSumber - options.bobotIndikator) > 0.001) {
    throw new Error(
      `Total bobot pilar Seni Pertunjukan harus ${options.bobotIndikator}%, saat ini ${totalPilarSumber}%.`,
    );
  }

  const peringatan: string[] = [];
  let bobotPilarTerpakai = 0;
  const pilar: PilarDenganBobotSumber[] = sourcePillars.map(
    ({ nama, detail, bobotSumber }, index) => {
      const totalVariabelSumber = detail.reduce(
        (sum, item) => sum + item.bobotSumber,
        0,
      );
      if (Math.abs(totalVariabelSumber - bobotSumber) > 0.001) {
        peringatan.push(
          `${nama}: total bobot variabel ${totalVariabelSumber}% dinormalisasi dalam pilar berbobot ${bobotSumber}%.`,
        );
      }

      const variabel = normalisasiBobotVariabel(
        detail.map<Omit<Variabel, "bobot"> & { bobotSumber: number }>(
          (item) => {
            const id = stableId(
              "injek-seni-variabel",
              `${nama}|${item.nomor}|${item.komponen}`,
            );
            return {
              id,
              nama: item.komponen,
              persyaratanBuktiDukung: [
                {
                  id: stableId("injek-seni-persyaratan", `${id}|1`),
                  nama: item.persyaratanDataDukung,
                  patokanNilai: DEFAULT_PATOKAN_NILAI.map((patokan) => ({
                    ...patokan,
                  })),
                },
              ],
              bobotSumber: item.bobotSumber,
              halamanSumber: item.halamanSumber,
            };
          },
        ),
      );

      const bobot =
        index === sourcePillars.length - 1
          ? Number((100 - bobotPilarTerpakai).toFixed(6))
          : Number(((bobotSumber / options.bobotIndikator) * 100).toFixed(6));
      bobotPilarTerpakai += bobot;
      return {
        id: stableId("injek-seni-pilar", nama),
        nama,
        bobot,
        bobotSumber,
        variabel,
      };
    },
  );

  const catatanNormalisasi = `Bobot sumber Seni Pertunjukan berjumlah ${options.bobotIndikator}% dan dinormalisasi secara internal menjadi 100% agar kontribusinya terhadap Nilai Akhir tetap tepat ${options.bobotIndikator}%.`;
  const catatanBobot =
    peringatan.length > 0
      ? `${catatanNormalisasi} ${peringatan.join(" ")} Patokan setiap bukti dapat diubah oleh Kurator.`
      : `${catatanNormalisasi} Patokan setiap bukti dapat diubah oleh Kurator.`;

  return {
    jenis: "seni",
    indikator: {
      id: "indikator-seni-pertunjukan",
      nama: "Seni Pertunjukan",
      bobot: options.bobotIndikator,
      tipe: "seni",
      versi: stableId(
        "injek-seni",
        `${options.namaFile}|${options.namaSheet}|${rows.length}`,
      ),
      sumber: `${options.namaFile} — sheet pertama: ${options.namaSheet}`,
      catatanBobot,
      pilar,
    },
    jumlahBaris: rows.length,
    jumlahPilar: pilar.length,
    namaSheet: options.namaSheet,
    peringatan,
  };
}

async function readWorkbookWorksheets(
  file: FileExcelInput,
): Promise<WorkbookKurasi> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const workbookXml = await zip.file("xl/workbook.xml")?.async("text");
  const relationshipsXml = await zip
    .file("xl/_rels/workbook.xml.rels")
    ?.async("text");
  if (!workbookXml || !relationshipsXml) {
    throw new Error("Struktur workbook Excel tidak valid.");
  }

  const sheetTags = Array.from(
    workbookXml.matchAll(/<sheet\b[^>]*\/>/g),
    (match) => attributesOf(match[0]),
  );
  if (sheetTags.length === 0) throw new Error("Workbook tidak memiliki sheet.");
  const relationships = Array.from(
    relationshipsXml.matchAll(/<Relationship\b[^>]*\/>/g),
    (match) => attributesOf(match[0]),
  );

  const sharedStringsXml = await zip
    .file("xl/sharedStrings.xml")
    ?.async("text");
  const sharedStrings = sharedStringsXml
    ? Array.from(
        sharedStringsXml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g),
        (match) => textNodesOf(match[1]),
      )
    : [];

  const worksheets: WorksheetPertama[] = [];
  for (let index = 0; index < sheetTags.length; index += 1) {
    const sheetAttributes = sheetTags[index];
    const relationshipId = sheetAttributes["r:id"];
    const relationship = relationships.find(
      (item) => item.Id === relationshipId,
    );
    if (!relationship?.Target) {
      throw new Error(
        `Sheet ${sheetAttributes.name || index + 1} tidak dapat ditemukan di dalam workbook.`,
      );
    }
    const worksheetPath = zipPath("xl", relationship.Target);
    const worksheetXml = await zip.file(worksheetPath)?.async("text");
    if (!worksheetXml) {
      throw new Error(
        `Isi sheet ${sheetAttributes.name || index + 1} tidak dapat dibaca.`,
      );
    }
    worksheets.push({
      namaSheet: sheetAttributes.name || `Sheet ${index + 1}`,
      rows: parseWorksheet(worksheetXml, sharedStrings),
    });
  }

  return { worksheets };
}

async function readFirstWorksheet(
  file: FileExcelInput,
): Promise<WorksheetPertama> {
  const workbook = await readWorkbookWorksheets(file);
  const first = workbook.worksheets[0];
  if (!first) throw new Error("Workbook tidak memiliki sheet.");
  return first;
}

type FormatIndikatorXlsx = "manajemen" | "seni";

function findHeaderIndex(
  sheetRows: string[][],
  format: FormatIndikatorXlsx,
): number {
  return sheetRows.findIndex((row) => {
    const headers = row.map(normalizeHeader);
    const hasKomponen =
      format === "manajemen"
        ? headers.some((value) => value.includes("komponen penilaian"))
        : headers.some((value) => value === "variabel");
    const hasPersyaratan =
      format === "manajemen"
        ? headers.some((value) => value.includes("persyaratan data dukung"))
        : headers.some((value) => value === "data dukung");
    return (
      headers.some((value) => value === "pilar") &&
      hasKomponen &&
      hasPersyaratan
    );
  });
}

function parseIndicatorRows(
  sheetRows: string[][],
  headerIndex: number,
  format: FormatIndikatorXlsx,
): BarisIndikatorManajemen[] {
  if (headerIndex < 0) {
    throw new Error(
      format === "seni"
        ? "Header Pilar, Variabel, dan Data Dukung tidak ditemukan pada sheet pertama."
        : "Header Pilar, Komponen Penilaian, dan Persyaratan Data Dukung tidak ditemukan pada sheet pertama.",
    );
  }

  const headers = sheetRows[headerIndex].map(normalizeHeader);
  const findColumn = (
    predicate: (header: string) => boolean,
    label: string,
  ) => {
    const index = headers.findIndex(predicate);
    if (index < 0)
      throw new Error(`Kolom ${label} tidak ditemukan pada sheet pertama.`);
    return index;
  };
  const column = {
    nomor: findColumn((header) => header === "no." || header === "no", "No."),
    pilar: findColumn((header) => header === "pilar", "Pilar"),
    bobotPilar: findColumn(
      (header) => header.startsWith("bobot pilar"),
      "Bobot Pilar",
    ),
    komponen: findColumn(
      (header) =>
        format === "seni"
          ? header === "variabel"
          : header.includes("komponen penilaian"),
      format === "seni" ? "Variabel" : "Komponen Penilaian",
    ),
    persyaratan: findColumn(
      (header) =>
        format === "seni"
          ? header === "data dukung"
          : header.includes("persyaratan data dukung"),
      format === "seni" ? "Data Dukung" : "Persyaratan Data Dukung",
    ),
    bobotSumber: findColumn(
      (header) =>
        header.startsWith("bobot indikator") ||
        header.startsWith("bobot variabel"),
      "Bobot Indikator/Variabel",
    ),
    halaman: headers.findIndex((header) => header.startsWith("halaman")),
  };

  const rows: BarisIndikatorManajemen[] = [];
  for (let index = headerIndex + 1; index < sheetRows.length; index += 1) {
    const row = sheetRows[index];
    const pilar = (row[column.pilar] ?? "").trim();
    const komponen = (row[column.komponen] ?? "").trim();
    const persyaratanDataDukung = (row[column.persyaratan] ?? "").trim();
    const nomorRaw = (row[column.nomor] ?? "").trim();
    const nomorSumber = Number(nomorRaw);
    if (format === "seni" && !Number.isFinite(nomorSumber)) {
      if (rows.length > 0) break;
      continue;
    }
    if (!pilar && !komponen && !persyaratanDataDukung) {
      if (format === "seni" && rows.length > 0) break;
      continue;
    }
    if (!pilar || !komponen || !persyaratanDataDukung) {
      throw new Error(
        `Data indikator pada baris Excel ${index + 1} belum lengkap.`,
      );
    }

    const nomor = nomorSumber || rows.length + 1;
    const halamanRaw = column.halaman >= 0 ? row[column.halaman] : undefined;
    const halamanSumber = halamanRaw ? Number(halamanRaw) : undefined;
    rows.push({
      nomor,
      pilar,
      bobotPilar: parsePercent(
        row[column.bobotPilar] ?? "",
        "Bobot Pilar",
        index + 1,
      ),
      komponen,
      persyaratanDataDukung,
      bobotSumber: parsePercent(
        row[column.bobotSumber] ?? "",
        "Bobot Indikator/Variabel",
        index + 1,
      ),
      halamanSumber:
        halamanSumber !== undefined && Number.isFinite(halamanSumber)
          ? halamanSumber
          : undefined,
    });
  }

  return rows;
}

function buildManajemenFromWorksheet(
  worksheet: WorksheetPertama,
  file: FileExcelInput,
): HasilInjekKurasiManajemen {
  const headerIndex = findHeaderIndex(worksheet.rows, "manajemen");
  const rows = parseIndicatorRows(worksheet.rows, headerIndex, "manajemen");

  return buildManajemenIndikatorDariBaris(rows, {
    namaSheet: worksheet.namaSheet,
    namaFile: file.name,
  });
}

function bobotIndikatorSeniDariJudul(
  worksheet: WorksheetPertama,
  headerIndex: number,
): number {
  const intro = worksheet.rows
    .slice(0, Math.max(0, headerIndex))
    .flat()
    .join(" ")
    .replace(/\s+/g, " ");
  const match = intro.match(
    /bobot\s+seni\s+pertunjukan\s+(\d+(?:[.,]\d+)?)\s*%/i,
  );
  if (!match) {
    throw new Error(
      "Bobot Seni Pertunjukan tidak ditemukan pada judul atau subjudul sheet pertama.",
    );
  }
  const bobot = Number(match[1].replace(",", "."));
  if (!Number.isFinite(bobot) || bobot <= 0 || bobot > 100) {
    throw new Error("Bobot Seni Pertunjukan pada judul tidak valid.");
  }
  return bobot;
}

function buildSeniFromWorksheet(
  worksheet: WorksheetPertama,
  file: FileExcelInput,
): HasilInjekKurasiSeni {
  const headerIndex = findHeaderIndex(worksheet.rows, "seni");
  const rows = parseIndicatorRows(worksheet.rows, headerIndex, "seni");
  return buildSeniIndikatorDariBaris(rows, {
    namaSheet: worksheet.namaSheet,
    namaFile: file.name,
    bobotIndikator: bobotIndikatorSeniDariJudul(worksheet, headerIndex),
  });
}

function worksheetByName(
  workbook: WorkbookKurasi,
  name: string,
): WorksheetPertama | undefined {
  const normalizedName = normalizeHeader(name);
  return workbook.worksheets.find(
    (worksheet) => normalizeHeader(worksheet.namaSheet) === normalizedName,
  );
}

function parseTemplateNumber(
  value: string | undefined,
  label: string,
  options: { allowBlank?: boolean; allowZero?: boolean; max?: number } = {},
): number | undefined {
  const cleaned = (value ?? "").trim().replace(/%$/, "").replace(",", ".");
  if (!cleaned && options.allowBlank) return undefined;
  const parsed = Number(cleaned);
  const minimum = options.allowZero ? 0 : Number.EPSILON;
  const maximum = options.max ?? 100;
  if (!Number.isFinite(parsed) || parsed < minimum || parsed > maximum) {
    const range = options.max === undefined ? "0–100" : "0 atau lebih";
    throw new Error(`${label} harus berupa angka ${range} yang valid.`);
  }
  return Number(parsed.toFixed(6));
}

function parseTemplateOrder(value: string | undefined, label: string): number {
  const parsed = Number((value ?? "").trim());
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${label} harus berupa bilangan bulat mulai dari 1.`);
  }
  return parsed;
}

function requiredTemplateText(
  value: string | undefined,
  label: string,
): string {
  const result = (value ?? "").trim();
  if (!result) throw new Error(`${label} tidak boleh kosong.`);
  return result;
}

function readTemplateTable(
  workbook: WorkbookKurasi,
  sheetName: string,
  headers: string[],
): Array<Record<string, string>> {
  const worksheet = worksheetByName(workbook, sheetName);
  if (!worksheet) {
    throw new Error(
      `Sheet "${sheetName}" tidak ditemukan pada template Excel.`,
    );
  }
  const normalizedHeaders = headers.map(normalizeHeader);
  const headerIndex = worksheet.rows.findIndex((row) => {
    const rowHeaders = row.map(normalizeHeader);
    return normalizedHeaders.every((header) => rowHeaders.includes(header));
  });
  if (headerIndex < 0) {
    throw new Error(`Judul kolom sheet "${sheetName}" tidak sesuai template.`);
  }
  const rowHeaders = worksheet.rows[headerIndex].map(normalizeHeader);
  const indexes = normalizedHeaders.map((header) => rowHeaders.indexOf(header));
  const result: Array<Record<string, string>> = [];
  for (
    let rowIndex = headerIndex + 1;
    rowIndex < worksheet.rows.length;
    rowIndex += 1
  ) {
    const row = worksheet.rows[rowIndex];
    const values = indexes.map((index) => (row[index] ?? "").trim());
    if (values.every((value) => !value)) continue;
    result.push(
      Object.fromEntries(
        headers.map((header, index) => [header, values[index]]),
      ),
    );
  }
  return result;
}

function templateManifestValid(workbook: WorkbookKurasi): boolean {
  const manifest = worksheetByName(workbook, "Manifest");
  if (!manifest) return false;
  const entries = new Map(
    manifest.rows
      .filter((row) => row.some((value) => value?.trim()))
      .map((row) => [normalizeHeader(row[0] ?? ""), (row[1] ?? "").trim()]),
  );
  return (
    entries.get("format") === KURASI_TEMPLATE_FORMAT &&
    Number(entries.get("versi format")) === KURASI_TEMPLATE_VERSION
  );
}

function totalMatches(value: number, target = 100): boolean {
  return Math.abs(value - target) < 0.001;
}

function validatePatokanTemplate(
  items: PatokanNilaiKurasi[],
  context: string,
): void {
  if (items.length === 0) return;
  const ids = new Set<string>();
  const values = new Set<number>();
  const weights = new Set<number>();
  for (const item of items) {
    if (ids.has(item.id)) throw new Error(`ID patokan ganda pada ${context}.`);
    if (values.has(item.nilai))
      throw new Error(`Nilai patokan ganda pada ${context}.`);
    if (weights.has(item.persentaseBobot))
      throw new Error(`Bobot patokan ganda pada ${context}.`);
    ids.add(item.id);
    values.add(item.nilai);
    weights.add(item.persentaseBobot);
  }
}

function buildTemplateLengkapFromWorkbook(
  workbook: WorkbookKurasi,
): HasilInjekKurasiLengkap {
  const indikatorRows = readTemplateTable(workbook, "Indikator", [
    "Urutan",
    "ID Indikator",
    "Nama Indikator",
    "Bobot Indikator (%)",
    "Tipe",
    "Versi",
    "Sumber",
    "Catatan Bobot",
  ]);
  const pilarRows = readTemplateTable(workbook, "Pilar", [
    "ID Indikator",
    "Urutan Pilar",
    "ID Pilar",
    "Nama Pilar",
    "Bobot Internal (%)",
    "Bobot Sumber (%)",
  ]);
  const variabelRows = readTemplateTable(workbook, "Variabel", [
    "ID Pilar",
    "Urutan Variabel",
    "ID Variabel",
    "Nama Variabel",
    "Bobot Internal (%)",
    "Bobot Sumber (%)",
    "Halaman Sumber",
  ]);
  const persyaratanRows = readTemplateTable(workbook, "Persyaratan", [
    "ID Variabel",
    "Urutan Persyaratan",
    "ID Persyaratan",
    "Persyaratan Bukti Dukung",
  ]);
  const patokanRows = readTemplateTable(workbook, "Patokan Nilai", [
    "Lingkup",
    "ID Variabel",
    "ID Persyaratan",
    "Urutan Patokan",
    "ID Patokan",
    "Nilai",
    "Nama Patokan",
    "Bobot Diperoleh (%)",
  ]);
  const predikatRows = readTemplateTable(workbook, "Predikat", [
    "Urutan",
    "ID Predikat",
    "Nama Predikat",
    "Ambang Minimum",
    "Warna",
    "Tingkat",
  ]);

  if (indikatorRows.length === 0) {
    throw new Error("Template Excel harus memiliki minimal satu indikator.");
  }

  const indikatorById = new Map<string, { order: number; item: Indikator }>();
  for (const row of indikatorRows) {
    const id = requiredTemplateText(row["ID Indikator"], "ID Indikator");
    if (indikatorById.has(id)) throw new Error(`ID indikator "${id}" ganda.`);
    const tipe = requiredTemplateText(row["Tipe"], `Tipe indikator ${id}`);
    if (tipe !== "manajemen" && tipe !== "seni") {
      throw new Error(`Tipe indikator "${tipe}" harus manajemen atau seni.`);
    }
    indikatorById.set(id, {
      order: parseTemplateOrder(row["Urutan"], `Urutan indikator ${id}`),
      item: {
        id,
        nama: requiredTemplateText(
          row["Nama Indikator"],
          `Nama indikator ${id}`,
        ),
        bobot: parseTemplateNumber(
          row["Bobot Indikator (%)"],
          `Bobot indikator ${id}`,
        )!,
        tipe,
        ...(row["Versi"] ? { versi: row["Versi"] } : {}),
        ...(row["Sumber"] ? { sumber: row["Sumber"] } : {}),
        ...(row["Catatan Bobot"] ? { catatanBobot: row["Catatan Bobot"] } : {}),
        pilar: [],
      },
    });
  }

  const pilarById = new Map<string, { order: number; item: Pilar }>();
  for (const row of pilarRows) {
    const indicatorId = requiredTemplateText(
      row["ID Indikator"],
      "ID Indikator pada sheet Pilar",
    );
    const indicator = indikatorById.get(indicatorId)?.item;
    if (!indicator) {
      throw new Error(
        `ID indikator "${indicatorId}" pada sheet Pilar tidak ditemukan.`,
      );
    }
    const id = requiredTemplateText(row["ID Pilar"], "ID Pilar");
    if (pilarById.has(id)) throw new Error(`ID pilar "${id}" ganda.`);
    const bobotSumber = parseTemplateNumber(
      row["Bobot Sumber (%)"],
      `Bobot sumber pilar ${id}`,
      { allowBlank: true },
    );
    const item: Pilar = {
      id,
      nama: requiredTemplateText(row["Nama Pilar"], `Nama pilar ${id}`),
      bobot: parseTemplateNumber(
        row["Bobot Internal (%)"],
        `Bobot internal pilar ${id}`,
      )!,
      ...(bobotSumber !== undefined ? { bobotSumber } : {}),
      variabel: [],
    };
    pilarById.set(id, {
      order: parseTemplateOrder(row["Urutan Pilar"], `Urutan pilar ${id}`),
      item,
    });
    indicator.pilar.push(item);
  }

  for (const { item: indikator } of indikatorById.values()) {
    indikator.pilar.sort(
      (left, right) =>
        (pilarById.get(left.id)?.order ?? 0) -
        (pilarById.get(right.id)?.order ?? 0),
    );
  }

  const variabelById = new Map<string, { order: number; item: Variabel }>();
  for (const row of variabelRows) {
    const pilarId = requiredTemplateText(
      row["ID Pilar"],
      "ID Pilar pada sheet Variabel",
    );
    const pilar = pilarById.get(pilarId)?.item;
    if (!pilar) {
      throw new Error(
        `ID pilar "${pilarId}" pada sheet Variabel tidak ditemukan.`,
      );
    }
    const id = requiredTemplateText(row["ID Variabel"], "ID Variabel");
    if (variabelById.has(id)) throw new Error(`ID variabel "${id}" ganda.`);
    const bobotSumber = parseTemplateNumber(
      row["Bobot Sumber (%)"],
      `Bobot sumber variabel ${id}`,
      { allowBlank: true },
    );
    const halamanSumber = parseTemplateNumber(
      row["Halaman Sumber"],
      `Halaman sumber variabel ${id}`,
      { allowBlank: true, allowZero: true, max: Number.MAX_SAFE_INTEGER },
    );
    const item: Variabel = {
      id,
      nama: requiredTemplateText(row["Nama Variabel"], `Nama variabel ${id}`),
      bobot: parseTemplateNumber(
        row["Bobot Internal (%)"],
        `Bobot internal variabel ${id}`,
      )!,
      ...(bobotSumber !== undefined ? { bobotSumber } : {}),
      ...(halamanSumber !== undefined ? { halamanSumber } : {}),
      persyaratanBuktiDukung: [],
    };
    variabelById.set(id, {
      order: parseTemplateOrder(
        row["Urutan Variabel"],
        `Urutan variabel ${id}`,
      ),
      item,
    });
    pilar.variabel.push(item);
  }

  for (const { item: pilar } of pilarById.values()) {
    pilar.variabel.sort(
      (left, right) =>
        (variabelById.get(left.id)?.order ?? 0) -
        (variabelById.get(right.id)?.order ?? 0),
    );
  }

  const persyaratanByKey = new Map<
    string,
    {
      order: number;
      item: NonNullable<Variabel["persyaratanBuktiDukung"]>[number];
    }
  >();
  for (const row of persyaratanRows) {
    const variableId = requiredTemplateText(
      row["ID Variabel"],
      "ID Variabel pada sheet Persyaratan",
    );
    const variable = variabelById.get(variableId)?.item;
    if (!variable) {
      throw new Error(
        `ID variabel "${variableId}" pada sheet Persyaratan tidak ditemukan.`,
      );
    }
    const id = requiredTemplateText(row["ID Persyaratan"], "ID Persyaratan");
    const key = `${variableId}||${id}`;
    if (persyaratanByKey.has(key)) {
      throw new Error(
        `ID persyaratan "${id}" ganda pada variabel ${variableId}.`,
      );
    }
    const item = {
      id,
      nama: requiredTemplateText(
        row["Persyaratan Bukti Dukung"],
        `Nama persyaratan ${id}`,
      ),
    };
    persyaratanByKey.set(key, {
      order: parseTemplateOrder(
        row["Urutan Persyaratan"],
        `Urutan persyaratan ${id}`,
      ),
      item,
    });
    variable.persyaratanBuktiDukung!.push(item);
  }

  for (const { item: variable } of variabelById.values()) {
    variable.persyaratanBuktiDukung!.sort(
      (left, right) =>
        (persyaratanByKey.get(`${variable.id}||${left.id}`)?.order ?? 0) -
        (persyaratanByKey.get(`${variable.id}||${right.id}`)?.order ?? 0),
    );
  }

  const patokanGroups = new Map<
    string,
    Array<{ order: number; item: PatokanNilaiKurasi }>
  >();
  for (const row of patokanRows) {
    const scope = normalizeHeader(
      requiredTemplateText(row["Lingkup"], "Lingkup patokan"),
    );
    const variableId = (row["ID Variabel"] ?? "").trim();
    const requirementId = (row["ID Persyaratan"] ?? "").trim();
    let key: string;
    if (scope === "matrix") {
      key = "matrix";
    } else if (scope === "variabel") {
      if (!variabelById.has(variableId)) {
        throw new Error(
          `ID variabel "${variableId}" pada patokan tidak ditemukan.`,
        );
      }
      key = `variabel||${variableId}`;
    } else if (scope === "persyaratan") {
      if (!persyaratanByKey.has(`${variableId}||${requirementId}`)) {
        throw new Error(
          `ID persyaratan "${requirementId}" pada variabel ${variableId} tidak ditemukan.`,
        );
      }
      key = `persyaratan||${variableId}||${requirementId}`;
    } else {
      throw new Error(
        `Lingkup patokan "${scope}" harus matrix, variabel, atau persyaratan.`,
      );
    }
    const group = patokanGroups.get(key) ?? [];
    group.push({
      order: parseTemplateOrder(
        row["Urutan Patokan"],
        `Urutan patokan ${row["ID Patokan"]}`,
      ),
      item: {
        id: requiredTemplateText(row["ID Patokan"], "ID Patokan"),
        nilai: parseTemplateNumber(row["Nilai"], "Nilai patokan", {
          allowZero: true,
        })!,
        nama: requiredTemplateText(row["Nama Patokan"], "Nama Patokan"),
        persentaseBobot: parseTemplateNumber(
          row["Bobot Diperoleh (%)"],
          "Bobot diperoleh patokan",
          { allowZero: true },
        )!,
      },
    });
    patokanGroups.set(key, group);
  }

  const sortedPatokan = (key: string): PatokanNilaiKurasi[] | undefined => {
    const group = patokanGroups.get(key);
    if (!group) return undefined;
    const items = group
      .sort((left, right) => left.order - right.order)
      .map(({ item }) => item);
    validatePatokanTemplate(items, key);
    return items;
  };
  for (const { item: variable } of variabelById.values()) {
    const variablePatokan = sortedPatokan(`variabel||${variable.id}`);
    if (variablePatokan) variable.patokanNilai = variablePatokan;
    variable.persyaratanBuktiDukung?.forEach((persyaratan) => {
      const requirementPatokan = sortedPatokan(
        `persyaratan||${variable.id}||${persyaratan.id}`,
      );
      if (requirementPatokan) persyaratan.patokanNilai = requirementPatokan;
    });
    if (variable.persyaratanBuktiDukung?.length === 0) {
      delete variable.persyaratanBuktiDukung;
    }
  }
  const patokanNilai =
    sortedPatokan("matrix") ??
    DEFAULT_PATOKAN_NILAI.map((item) => ({ ...item }));

  const predikatWithOrder = predikatRows.map((row) => {
    const id = requiredTemplateText(row["ID Predikat"], "ID Predikat");
    return {
      order: parseTemplateOrder(row["Urutan"], `Urutan predikat ${id}`),
      item: {
        id,
        nama: requiredTemplateText(row["Nama Predikat"], `Nama predikat ${id}`),
        min: parseTemplateNumber(
          row["Ambang Minimum"],
          `Ambang predikat ${id}`,
          {
            allowZero: true,
          },
        )!,
        warna: requiredTemplateText(row["Warna"], `Warna predikat ${id}`),
        tingkat: (row["Tingkat"] ?? "").trim(),
      } satisfies PredikatBand,
    };
  });
  const predikatIds = new Set<string>();
  for (const { item } of predikatWithOrder) {
    if (predikatIds.has(item.id))
      throw new Error(`ID predikat "${item.id}" ganda.`);
    predikatIds.add(item.id);
  }
  const predikat = predikatWithOrder
    .sort((left, right) => left.order - right.order)
    .map(({ item }) => item);

  const indikator = Array.from(indikatorById.values())
    .sort((left, right) => left.order - right.order)
    .map(({ item }) => item);
  const totalIndikator = indikator.reduce((sum, item) => sum + item.bobot, 0);
  if (!totalMatches(totalIndikator)) {
    throw new Error(
      `Total bobot indikator template harus 100%, saat ini ${totalIndikator}%.`,
    );
  }
  for (const indicator of indikator) {
    if (indicator.pilar.length === 0) {
      throw new Error(`Indikator "${indicator.nama}" belum memiliki pilar.`);
    }
    const totalPilar = indicator.pilar.reduce(
      (sum, item) => sum + item.bobot,
      0,
    );
    if (!totalMatches(totalPilar)) {
      throw new Error(
        `Total bobot internal pilar "${indicator.nama}" harus 100%, saat ini ${totalPilar}%.`,
      );
    }
    if (indicator.pilar.some((item) => item.bobotSumber !== undefined)) {
      const totalSumber = indicator.pilar.reduce(
        (sum, item) => sum + (item.bobotSumber ?? 0),
        0,
      );
      if (!totalMatches(totalSumber, indicator.bobot)) {
        throw new Error(
          `Total bobot sumber pilar "${indicator.nama}" harus ${indicator.bobot}%, saat ini ${totalSumber}%.`,
        );
      }
    }
    for (const pilar of indicator.pilar) {
      if (pilar.variabel.length === 0) {
        throw new Error(`Pilar "${pilar.nama}" belum memiliki variabel.`);
      }
      const totalVariabel = pilar.variabel.reduce(
        (sum, item) => sum + item.bobot,
        0,
      );
      if (!totalMatches(totalVariabel)) {
        throw new Error(
          `Total bobot internal variabel "${pilar.nama}" harus 100%, saat ini ${totalVariabel}%.`,
        );
      }
      if (pilar.variabel.some((item) => item.bobotSumber !== undefined)) {
        const targetSumber = pilar.bobotSumber ?? pilar.bobot;
        const totalSumber = pilar.variabel.reduce(
          (sum, item) => sum + (item.bobotSumber ?? 0),
          0,
        );
        if (!totalMatches(totalSumber, targetSumber)) {
          throw new Error(
            `Total bobot sumber variabel "${pilar.nama}" harus ${targetSumber}%, saat ini ${totalSumber}%.`,
          );
        }
      }
    }
  }

  return {
    jenis: "lengkap",
    indikator,
    predikat,
    patokanNilai,
    jumlahBaris: variabelRows.length,
    jumlahPilar: pilarRows.length,
    namaSheet: "Template Kurasi",
    peringatan: [],
  };
}

export async function parseKurasiManajemenXlsx(
  file: FileExcelInput,
): Promise<HasilInjekKurasiManajemen> {
  return buildManajemenFromWorksheet(await readFirstWorksheet(file), file);
}

export async function parseKurasiSeniXlsx(
  file: FileExcelInput,
): Promise<HasilInjekKurasiSeni> {
  return buildSeniFromWorksheet(await readFirstWorksheet(file), file);
}

export async function parseKurasiIndikatorXlsx(
  file: FileExcelInput,
): Promise<HasilInjekKurasi> {
  const workbook = await readWorkbookWorksheets(file);
  if (templateManifestValid(workbook)) {
    return buildTemplateLengkapFromWorkbook(workbook);
  }
  const worksheet = workbook.worksheets[0];
  if (!worksheet) throw new Error("Workbook tidak memiliki sheet.");
  const headerSeni = findHeaderIndex(worksheet.rows, "seni");
  const headerManajemen = findHeaderIndex(worksheet.rows, "manajemen");
  const isiAwal = worksheet.rows
    .slice(0, Math.max(headerSeni, headerManajemen, 0) + 1)
    .flat()
    .join(" ")
    .toLowerCase();

  if (headerSeni >= 0 && /seni\s+pertunjukan/i.test(isiAwal)) {
    return buildSeniFromWorksheet(worksheet, file);
  }
  if (
    headerManajemen >= 0 &&
    (headerSeni < 0 || /manajemen\s+sanggar/i.test(isiAwal))
  ) {
    return buildManajemenFromWorksheet(worksheet, file);
  }
  if (headerSeni >= 0) return buildSeniFromWorksheet(worksheet, file);
  if (headerManajemen >= 0) return buildManajemenFromWorksheet(worksheet, file);
  throw new Error(
    "Jenis indikator Excel tidak dikenali. Gunakan format Manajemen Sanggar atau Seni Pertunjukan.",
  );
}

/** Alias ringkas untuk pemanggil UI baru. */
export const parseKurasiXlsx = parseKurasiIndikatorXlsx;

/** Mengganti tepat satu indikator target dan mempertahankan posisi serta item lain. */
export function gantiIndikatorHasilInjek(
  current: Indikator[],
  replacement: Indikator,
): Indikator[] {
  let targetIndex = current.findIndex((item) => item.id === replacement.id);
  if (targetIndex < 0) {
    const targetName = normalizeHeader(replacement.nama);
    targetIndex = current.findIndex(
      (item) =>
        item.tipe === replacement.tipe &&
        normalizeHeader(item.nama) === targetName,
    );
  }
  if (targetIndex < 0) {
    const sameType = current
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => item.tipe === replacement.tipe);
    if (sameType.length === 1) targetIndex = sameType[0].index;
  }
  if (targetIndex < 0) {
    return replacement.tipe === "manajemen"
      ? [replacement, ...current]
      : [...current, replacement];
  }
  return current.map((item, index) =>
    index === targetIndex ? replacement : item,
  );
}
