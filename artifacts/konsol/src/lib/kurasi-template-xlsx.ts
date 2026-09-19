import JSZip from "jszip";

import type { Indikator, PatokanNilaiKurasi, PredikatBand } from "@/lib/types";

export const KURASI_TEMPLATE_FORMAT = "JAKSANGGAR_KURASI_TEMPLATE";
export const KURASI_TEMPLATE_VERSION = 1;
export const KURASI_TEMPLATE_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export interface KurasiTemplateInput {
  indikator: Indikator[];
  patokanNilai: PatokanNilaiKurasi[];
  predikat: PredikatBand[];
  updatedAt?: number;
}

type CellValue = string | number | boolean | null | undefined;

interface CellSpec {
  value?: CellValue;
  formula?: string;
  style?: number;
}

interface SheetSpec {
  name: string;
  rows: CellSpec[][];
  widths: number[];
  merges?: string[];
  freezeRows?: number;
  autoFilter?: string;
  hiddenColumns?: number[];
}

const STYLE_DEFAULT = 0;
const STYLE_TITLE = 1;
const STYLE_SUBTITLE = 2;
const STYLE_HEADER = 3;
const STYLE_TEXT = 4;
const STYLE_NUMBER = 5;
const STYLE_PERCENT = 6;
const STYLE_LABEL = 7;
const STYLE_NOTE = 8;

const cell = (value: CellValue, style = STYLE_TEXT): CellSpec => ({
  value,
  style,
});

const formulaCell = (
  formula: string,
  value: CellValue,
  style = STYLE_NUMBER,
): CellSpec => ({ formula, value, style });

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function columnName(index: number): string {
  let value = index + 1;
  let result = "";
  while (value > 0) {
    const remainder = (value - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    value = Math.floor((value - 1) / 26);
  }
  return result;
}

function cellXml(spec: CellSpec, row: number, column: number): string {
  const address = `${columnName(column)}${row}`;
  const style = spec.style ?? STYLE_DEFAULT;
  if (spec.formula) {
    const cached =
      typeof spec.value === "number" && Number.isFinite(spec.value)
        ? `<v>${spec.value}</v>`
        : "";
    return `<c r="${address}" s="${style}"><f>${xmlEscape(spec.formula)}</f>${cached}</c>`;
  }
  if (spec.value === null || spec.value === undefined || spec.value === "") {
    return `<c r="${address}" s="${style}"/>`;
  }
  if (typeof spec.value === "number") {
    return `<c r="${address}" s="${style}"><v>${spec.value}</v></c>`;
  }
  if (typeof spec.value === "boolean") {
    return `<c r="${address}" s="${style}" t="b"><v>${spec.value ? 1 : 0}</v></c>`;
  }
  const text = xmlEscape(spec.value);
  return `<c r="${address}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${text}</t></is></c>`;
}

function worksheetXml(spec: SheetSpec): string {
  const rowCount = Math.max(1, spec.rows.length);
  const columnCount = Math.max(1, spec.widths.length);
  const lastCell = `${columnName(columnCount - 1)}${rowCount}`;
  const hidden = new Set(spec.hiddenColumns ?? []);
  const columns = spec.widths
    .map(
      (width, index) =>
        `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"${
          hidden.has(index) ? ' hidden="1"' : ""
        }/>`,
    )
    .join("");
  const rows = spec.rows
    .map((row, rowIndex) => {
      const number = rowIndex + 1;
      const height = rowIndex === 0 ? 26 : undefined;
      return `<row r="${number}"${height ? ` ht="${height}" customHeight="1"` : ""}>${row
        .map((item, columnIndex) => cellXml(item, number, columnIndex))
        .join("")}</row>`;
    })
    .join("");
  const pane = spec.freezeRows
    ? `<pane ySplit="${spec.freezeRows}" topLeftCell="A${spec.freezeRows + 1}" activePane="bottomLeft" state="frozen"/>`
    : "";
  const merges = spec.merges?.length
    ? `<mergeCells count="${spec.merges.length}">${spec.merges
        .map((range) => `<mergeCell ref="${range}"/>`)
        .join("")}</mergeCells>`
    : "";
  const autoFilter = spec.autoFilter
    ? `<autoFilter ref="${spec.autoFilter}"/>`
    : "";

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <dimension ref="A1:${lastCell}"/>
  <sheetViews><sheetView showGridLines="0" workbookViewId="0">${pane}</sheetView></sheetViews>
  <sheetFormatPr defaultRowHeight="18"/>
  <cols>${columns}</cols>
  <sheetData>${rows}</sheetData>
  ${merges}
  ${autoFilter}
</worksheet>`;
}

function stylesXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <numFmts count="1">
    <numFmt numFmtId="164" formatCode="General&quot;%&quot;"/>
  </numFmts>
  <fonts count="4">
    <font><sz val="11"/><name val="Aptos"/><family val="2"/></font>
    <font><b/><color rgb="FFFFFFFF"/><sz val="16"/><name val="Aptos Display"/></font>
    <font><b/><color rgb="FFFFFFFF"/><sz val="10"/><name val="Aptos"/></font>
    <font><b/><color rgb="FF17324D"/><sz val="10"/><name val="Aptos"/></font>
  </fonts>
  <fills count="5">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF17324D"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF0F766E"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFEAF2F8"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border>
      <left style="thin"><color rgb="FFD7DEE5"/></left>
      <right style="thin"><color rgb="FFD7DEE5"/></right>
      <top style="thin"><color rgb="FFD7DEE5"/></top>
      <bottom style="thin"><color rgb="FFD7DEE5"/></bottom>
      <diagonal/>
    </border>
  </borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="9">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFill="1" applyFont="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="2" fillId="2" borderId="0" xfId="0" applyFill="1" applyFont="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="2" fillId="3" borderId="1" xfId="0" applyFill="1" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="top"/></xf>
    <xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="top"/></xf>
    <xf numFmtId="0" fontId="3" fillId="4" borderId="1" xfId="0" applyFill="1" applyFont="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="4" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
  </cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;
}

function header(values: string[]): CellSpec[] {
  return values.map((value) => cell(value, STYLE_HEADER));
}

function buildPetunjuk(input: KurasiTemplateInput): SheetSpec {
  const pilarCount = input.indikator.reduce(
    (total, indikator) => total + indikator.pilar.length,
    0,
  );
  const variabelCount = input.indikator.reduce(
    (total, indikator) =>
      total +
      indikator.pilar.reduce(
        (pilarTotal, pilar) => pilarTotal + pilar.variabel.length,
        0,
      ),
    0,
  );
  const persyaratanCount = input.indikator.reduce(
    (total, indikator) =>
      total +
      indikator.pilar.reduce(
        (pilarTotal, pilar) =>
          pilarTotal +
          pilar.variabel.reduce(
            (variabelTotal, variabel) =>
              variabelTotal +
              (variabel.persyaratanBuktiDukung?.length ??
                (variabel.persyaratanDataDukung ? 1 : 0)),
            0,
          ),
        0,
      ),
    0,
  );
  const rows: CellSpec[][] = [
    [cell("TEMPLATE SISTEM KURASI JAKSANGGAR", STYLE_TITLE)],
    [
      cell(
        "Workbook ini mengikuti indikator, pilar, variabel, bukti dukung, patokan nilai, dan predikat pada draf Kurator saat diunduh.",
        STYLE_SUBTITLE,
      ),
    ],
    [],
    [cell("Cara menggunakan", STYLE_LABEL)],
    [
      cell(
        "1. Ubah data pada sheet yang sesuai tanpa mengganti nama sheet atau judul kolom.",
        STYLE_NOTE,
      ),
    ],
    [
      cell(
        "2. Bobot internal pilar harus berjumlah 100% per indikator; bobot internal variabel harus 100% per pilar.",
        STYLE_NOTE,
      ),
    ],
    [
      cell(
        "3. Bobot sumber boleh dikosongkan apabila indikator tidak memakai bobot dokumen sumber.",
        STYLE_NOTE,
      ),
    ],
    [
      cell(
        "4. Lingkup patokan: matrix, variabel, atau persyaratan. Patokan khusus mengalahkan patokan induknya.",
        STYLE_NOTE,
      ),
    ],
    [
      cell(
        "5. Masukkan kembali berkas melalui tombol Masukkan Excel/CSV, periksa draf, lalu tekan Simpan Matriks.",
        STYLE_NOTE,
      ),
    ],
    [],
    header(["Ringkasan", "Jumlah"]),
    [
      cell("Indikator", STYLE_LABEL),
      cell(input.indikator.length, STYLE_NUMBER),
    ],
    [cell("Pilar", STYLE_LABEL), cell(pilarCount, STYLE_NUMBER)],
    [cell("Variabel", STYLE_LABEL), cell(variabelCount, STYLE_NUMBER)],
    [
      cell("Persyaratan bukti dukung", STYLE_LABEL),
      cell(persyaratanCount, STYLE_NUMBER),
    ],
    [
      cell("Total bobot indikator", STYLE_LABEL),
      formulaCell(
        `SUM('Indikator'!D2:D${Math.max(2, input.indikator.length + 1)})`,
        input.indikator.reduce(
          (total, indikator) => total + indikator.bobot,
          0,
        ),
        STYLE_PERCENT,
      ),
    ],
  ];
  return {
    name: "Petunjuk",
    rows,
    widths: [48, 18, 16, 16, 16, 16, 16, 16],
    merges: [
      "A1:H1",
      "A2:H2",
      "A4:H4",
      "A5:H5",
      "A6:H6",
      "A7:H7",
      "A8:H8",
      "A9:H9",
    ],
  };
}

function buildManifest(
  input: KurasiTemplateInput,
  generatedAt: number,
): SheetSpec {
  const values: Array<[string, CellValue]> = [
    ["Format", KURASI_TEMPLATE_FORMAT],
    ["Versi Format", KURASI_TEMPLATE_VERSION],
    ["Aplikasi", "JakSanggar"],
    ["Dibuat", new Date(generatedAt).toISOString()],
    ["Updated At", input.updatedAt ?? generatedAt],
    ["Satuan Persentase", "Angka 0–100; contoh 5 berarti 5%"],
    ["Jumlah Indikator", input.indikator.length],
  ];
  return {
    name: "Manifest",
    rows: values.map(([label, value]) => [
      cell(label, STYLE_LABEL),
      cell(value, typeof value === "number" ? STYLE_NUMBER : STYLE_TEXT),
    ]),
    widths: [24, 56],
  };
}

function buildIndikator(input: KurasiTemplateInput): SheetSpec {
  const rows: CellSpec[][] = [
    header([
      "Urutan",
      "ID Indikator",
      "Nama Indikator",
      "Bobot Indikator (%)",
      "Tipe",
      "Versi",
      "Sumber",
      "Catatan Bobot",
    ]),
  ];
  input.indikator.forEach((indikator, index) => {
    rows.push([
      cell(index + 1, STYLE_NUMBER),
      cell(indikator.id),
      cell(indikator.nama),
      cell(indikator.bobot, STYLE_PERCENT),
      cell(indikator.tipe),
      cell(indikator.versi ?? ""),
      cell(indikator.sumber ?? ""),
      cell(indikator.catatanBobot ?? ""),
    ]);
  });
  return {
    name: "Indikator",
    rows,
    widths: [10, 30, 30, 20, 16, 20, 44, 64],
    freezeRows: 1,
    autoFilter: `A1:H${Math.max(1, rows.length)}`,
  };
}

function buildPilar(input: KurasiTemplateInput): SheetSpec {
  const rows: CellSpec[][] = [
    header([
      "ID Indikator",
      "Urutan Pilar",
      "ID Pilar",
      "Nama Pilar",
      "Bobot Internal (%)",
      "Bobot Sumber (%)",
    ]),
  ];
  input.indikator.forEach((indikator) =>
    indikator.pilar.forEach((pilar, index) =>
      rows.push([
        cell(indikator.id),
        cell(index + 1, STYLE_NUMBER),
        cell(pilar.id),
        cell(pilar.nama),
        cell(pilar.bobot, STYLE_PERCENT),
        cell(pilar.bobotSumber, STYLE_PERCENT),
      ]),
    ),
  );
  return {
    name: "Pilar",
    rows,
    widths: [30, 14, 30, 42, 21, 20],
    freezeRows: 1,
    autoFilter: `A1:F${Math.max(1, rows.length)}`,
  };
}

function buildVariabel(input: KurasiTemplateInput): SheetSpec {
  const rows: CellSpec[][] = [
    header([
      "ID Pilar",
      "Urutan Variabel",
      "ID Variabel",
      "Nama Variabel",
      "Bobot Internal (%)",
      "Bobot Sumber (%)",
      "Halaman Sumber",
    ]),
  ];
  input.indikator.forEach((indikator) =>
    indikator.pilar.forEach((pilar) =>
      pilar.variabel.forEach((variabel, index) =>
        rows.push([
          cell(pilar.id),
          cell(index + 1, STYLE_NUMBER),
          cell(variabel.id),
          cell(variabel.nama),
          cell(variabel.bobot, STYLE_PERCENT),
          cell(variabel.bobotSumber, STYLE_PERCENT),
          cell(variabel.halamanSumber, STYLE_NUMBER),
        ]),
      ),
    ),
  );
  return {
    name: "Variabel",
    rows,
    widths: [30, 16, 34, 44, 21, 20, 18],
    freezeRows: 1,
    autoFilter: `A1:G${Math.max(1, rows.length)}`,
  };
}

function buildPersyaratan(input: KurasiTemplateInput): SheetSpec {
  const rows: CellSpec[][] = [
    header([
      "ID Variabel",
      "Urutan Persyaratan",
      "ID Persyaratan",
      "Persyaratan Bukti Dukung",
    ]),
  ];
  input.indikator.forEach((indikator) =>
    indikator.pilar.forEach((pilar) =>
      pilar.variabel.forEach((variabel) => {
        const persyaratan =
          variabel.persyaratanBuktiDukung ??
          (variabel.persyaratanDataDukung
            ? [
                {
                  id: `${variabel.id}-legacy-bukti`,
                  nama: variabel.persyaratanDataDukung,
                },
              ]
            : []);
        persyaratan.forEach((item, index) =>
          rows.push([
            cell(variabel.id),
            cell(index + 1, STYLE_NUMBER),
            cell(item.id),
            cell(item.nama),
          ]),
        );
      }),
    ),
  );
  return {
    name: "Persyaratan",
    rows,
    widths: [34, 20, 36, 72],
    freezeRows: 1,
    autoFilter: `A1:D${Math.max(1, rows.length)}`,
  };
}

function buildPatokan(input: KurasiTemplateInput): SheetSpec {
  const rows: CellSpec[][] = [
    header([
      "Lingkup",
      "ID Variabel",
      "ID Persyaratan",
      "Urutan Patokan",
      "ID Patokan",
      "Nilai",
      "Nama Patokan",
      "Bobot Diperoleh (%)",
    ]),
  ];
  const pushPatokan = (
    lingkup: "matrix" | "variabel" | "persyaratan",
    variableId: string,
    requirementId: string,
    items: PatokanNilaiKurasi[] | undefined,
  ) => {
    items?.forEach((item, index) =>
      rows.push([
        cell(lingkup),
        cell(variableId),
        cell(requirementId),
        cell(index + 1, STYLE_NUMBER),
        cell(item.id),
        cell(item.nilai, STYLE_NUMBER),
        cell(item.nama),
        cell(item.persentaseBobot, STYLE_PERCENT),
      ]),
    );
  };

  pushPatokan("matrix", "", "", input.patokanNilai);
  input.indikator.forEach((indikator) =>
    indikator.pilar.forEach((pilar) =>
      pilar.variabel.forEach((variabel) => {
        pushPatokan("variabel", variabel.id, "", variabel.patokanNilai);
        variabel.persyaratanBuktiDukung?.forEach((persyaratan) =>
          pushPatokan(
            "persyaratan",
            variabel.id,
            persyaratan.id,
            persyaratan.patokanNilai,
          ),
        );
      }),
    ),
  );
  return {
    name: "Patokan Nilai",
    rows,
    widths: [16, 34, 36, 18, 32, 12, 30, 22],
    freezeRows: 1,
    autoFilter: `A1:H${Math.max(1, rows.length)}`,
  };
}

function buildPredikat(input: KurasiTemplateInput): SheetSpec {
  const rows: CellSpec[][] = [
    header([
      "Urutan",
      "ID Predikat",
      "Nama Predikat",
      "Ambang Minimum",
      "Warna",
      "Tingkat",
    ]),
  ];
  input.predikat.forEach((predikat, index) =>
    rows.push([
      cell(index + 1, STYLE_NUMBER),
      cell(predikat.id),
      cell(predikat.nama),
      cell(predikat.min, STYLE_NUMBER),
      cell(predikat.warna),
      cell(predikat.tingkat),
    ]),
  );
  return {
    name: "Predikat",
    rows,
    widths: [10, 32, 28, 20, 26, 48],
    freezeRows: 1,
    autoFilter: `A1:F${Math.max(1, rows.length)}`,
  };
}

export function buildKurasiTemplateSheets(
  input: KurasiTemplateInput,
  generatedAt = Date.now(),
): SheetSpec[] {
  return [
    buildPetunjuk(input),
    buildManifest(input, generatedAt),
    buildIndikator(input),
    buildPilar(input),
    buildVariabel(input),
    buildPersyaratan(input),
    buildPatokan(input),
    buildPredikat(input),
  ];
}

function workbookXml(sheets: SheetSpec[]): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <bookViews><workbookView activeTab="0"/></bookViews>
  <sheets>${sheets
    .map(
      (sheet, index) =>
        `<sheet name="${xmlEscape(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`,
    )
    .join("")}</sheets>
  <calcPr calcId="191029" fullCalcOnLoad="1" forceFullCalc="1"/>
</workbook>`;
}

function workbookRelationshipsXml(sheets: SheetSpec[]): string {
  const relationships = sheets
    .map(
      (_, index) =>
        `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`,
    )
    .join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${relationships}
  <Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;
}

function contentTypesXml(sheets: SheetSpec[]): string {
  const worksheetOverrides = sheets
    .map(
      (_, index) =>
        `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
    )
    .join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  ${worksheetOverrides}
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`;
}

function rootRelationshipsXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`;
}

function appPropertiesXml(sheets: SheetSpec[]): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>JakSanggar</Application>
  <DocSecurity>0</DocSecurity>
  <ScaleCrop>false</ScaleCrop>
  <HeadingPairs><vt:vector size="2" baseType="variant"><vt:variant><vt:lpstr>Worksheets</vt:lpstr></vt:variant><vt:variant><vt:i4>${sheets.length}</vt:i4></vt:variant></vt:vector></HeadingPairs>
  <TitlesOfParts><vt:vector size="${sheets.length}" baseType="lpstr">${sheets
    .map((sheet) => `<vt:lpstr>${xmlEscape(sheet.name)}</vt:lpstr>`)
    .join("")}</vt:vector></TitlesOfParts>
</Properties>`;
}

function corePropertiesXml(generatedAt: number): string {
  const iso = new Date(generatedAt).toISOString();
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>Template Sistem Kurasi JakSanggar</dc:title>
  <dc:creator>JakSanggar</dc:creator>
  <cp:lastModifiedBy>JakSanggar</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">${iso}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">${iso}</dcterms:modified>
</cp:coreProperties>`;
}

export async function buildKurasiTemplateXlsx(
  input: KurasiTemplateInput,
  generatedAt = Date.now(),
): Promise<Uint8Array> {
  if (input.indikator.length === 0) {
    throw new Error("Template Excel memerlukan minimal satu indikator.");
  }
  const sheets = buildKurasiTemplateSheets(input, generatedAt);
  const zip = new JSZip();
  zip.file("[Content_Types].xml", contentTypesXml(sheets));
  zip.file("_rels/.rels", rootRelationshipsXml());
  zip.file("docProps/app.xml", appPropertiesXml(sheets));
  zip.file("docProps/core.xml", corePropertiesXml(generatedAt));
  zip.file("xl/workbook.xml", workbookXml(sheets));
  zip.file("xl/_rels/workbook.xml.rels", workbookRelationshipsXml(sheets));
  zip.file("xl/styles.xml", stylesXml());
  sheets.forEach((sheet, index) => {
    zip.file(`xl/worksheets/sheet${index + 1}.xml`, worksheetXml(sheet));
  });
  return zip.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
    mimeType: KURASI_TEMPLATE_MIME,
  });
}

export function namaFileTemplateKurasi(generatedAt = Date.now()): string {
  const date = new Date(generatedAt)
    .toISOString()
    .slice(0, 10)
    .replace(/-/g, "");
  return `template-kurasi-jaksanggar-${date}.xlsx`;
}
