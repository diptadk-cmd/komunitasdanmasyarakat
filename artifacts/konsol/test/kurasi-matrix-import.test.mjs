import assert from "node:assert/strict";
import test from "node:test";

import JSZip from "jszip";

import { DEFAULT_PATOKAN_NILAI, naFromScores } from "../src/lib/kurasi.ts";
import {
  buildManajemenIndikatorDariBaris,
  buildSeniIndikatorDariBaris,
  gantiIndikatorHasilInjek,
  parseKurasiIndikatorXlsx,
  parseKurasiManajemenXlsx,
  parseKurasiSeniXlsx,
  parseWorksheet,
} from "../src/lib/kurasi-matrix-import.ts";

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

test("parser worksheet menjaga alamat A–F/H di sekitar sel kosong self-closing", () => {
  const worksheet = `<worksheet><sheetData><row r="1">
    <c r="A1"><v>1</v></c><c r="B1"/><c r="C1"><v>3</v></c>
    <c r="D1"><v>4</v></c><c r="E1"><v>5</v></c><c r="F1"><v>6</v></c>
    <c r="G1"/><c r="H1"><f>SUM(A1:F1)</f><v>8</v></c><c r="I1"/>
  </row></sheetData></worksheet>`;
  assert.deepEqual(parseWorksheet(worksheet, [])[0], [
    "1",
    "",
    "3",
    "4",
    "5",
    "6",
    "",
    "8",
    "",
  ]);
});

test("injek XLSX membaca sheet pertama, persyaratan, dan menormalisasi bobot", async () => {
  const strings = [
    "No.",
    "Pilar",
    "Bobot Pilar (total tabel)",
    "Komponen Penilaian",
    "Persyaratan Data Dukung",
    "Bobot Indikator (tercantum)",
    "Halaman PDF",
    "Pilar I",
    "Legalitas",
    "Akta pendirian",
    "Pilar II",
    "Program",
    "Rencana kerja",
    "Kurikulum",
    "Dokumen kurikulum",
    "Pilar III",
    "SDM",
    "Sertifikat pelatih",
    "Pilar IV",
    "Dampak",
    "Laporan sosial",
  ];
  const sharedStrings = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${strings.length}" uniqueCount="${strings.length}">
      ${strings.map((value) => `<si><t>${escapeXml(value)}</t></si>`).join("")}
    </sst>`;
  const stringIndex = (value) => strings.indexOf(value);
  const stringCell = (address, value) =>
    `<c r="${address}" t="s"><v>${stringIndex(value)}</v></c>`;
  const numberCell = (address, value) =>
    `<c r="${address}"><v>${value}</v></c>`;
  const rows = [
    `<row r="1">${["No.", "Pilar", "Bobot Pilar (total tabel)", "Komponen Penilaian", "Persyaratan Data Dukung", "Bobot Indikator (tercantum)", "Halaman PDF"].map((value, index) => stringCell(`${String.fromCharCode(65 + index)}1`, value)).join("")}</row>`,
    `<row r="2">${numberCell("A2", 1)}${stringCell("B2", "Pilar I")}${numberCell("C2", 0.3)}${stringCell("D2", "Legalitas")}${stringCell("E2", "Akta pendirian")}${numberCell("F2", 0.3)}${numberCell("G2", 3)}</row>`,
    `<row r="3">${numberCell("A3", 2)}${stringCell("B3", "Pilar II")}${numberCell("C3", 0.25)}${stringCell("D3", "Program")}${stringCell("E3", "Rencana kerja")}${numberCell("F3", 0.2)}${numberCell("G3", 4)}</row>`,
    `<row r="4">${numberCell("A4", 3)}${stringCell("B4", "Pilar II")}${numberCell("C4", 0.25)}${stringCell("D4", "Kurikulum")}${stringCell("E4", "Dokumen kurikulum")}${numberCell("F4", 0.07)}${numberCell("G4", 5)}</row>`,
    `<row r="5">${numberCell("A5", 4)}${stringCell("B5", "Pilar III")}${numberCell("C5", 0.25)}${stringCell("D5", "SDM")}${stringCell("E5", "Sertifikat pelatih")}${numberCell("F5", 0.25)}${numberCell("G5", 6)}</row>`,
    `<row r="6">${numberCell("A6", 5)}${stringCell("B6", "Pilar IV")}${numberCell("C6", 0.2)}${stringCell("D6", "Dampak")}${stringCell("E6", "Laporan sosial")}${numberCell("F6", 0.2)}${numberCell("G6", 7)}</row>`,
  ];
  const worksheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows.join("")}</sheetData></worksheet>`;

  const zip = new JSZip();
  zip.file(
    "xl/workbook.xml",
    `<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Sheet Indikator" sheetId="1" r:id="rId1"/></sheets></workbook>`,
  );
  zip.file(
    "xl/_rels/workbook.xml.rels",
    `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`,
  );
  zip.file("xl/sharedStrings.xml", sharedStrings);
  zip.file("xl/worksheets/sheet1.xml", worksheet);
  const bytes = await zip.generateAsync({ type: "uint8array" });

  const file = {
    name: "indikator.xlsx",
    async arrayBuffer() {
      return Uint8Array.from(bytes).buffer;
    },
  };
  const hasil = await parseKurasiManajemenXlsx(file);
  const hasilAuto = await parseKurasiIndikatorXlsx(file);

  assert.equal(hasil.jenis, "manajemen");
  assert.equal(hasilAuto.jenis, "manajemen");
  assert.equal(hasil.namaSheet, "Sheet Indikator");
  assert.equal(hasil.jumlahBaris, 5);
  assert.equal(hasil.jumlahPilar, 4);
  assert.deepEqual(
    hasil.indikator.pilar[0].variabel[0].persyaratanBuktiDukung.map(
      (item) => item.nama,
    ),
    ["Akta pendirian"],
  );
  const persyaratanPertama =
    hasil.indikator.pilar[0].variabel[0].persyaratanBuktiDukung[0];
  const persyaratanKedua =
    hasil.indikator.pilar[1].variabel[0].persyaratanBuktiDukung[0];
  assert.deepEqual(persyaratanPertama.patokanNilai, DEFAULT_PATOKAN_NILAI);
  assert.notStrictEqual(persyaratanPertama.patokanNilai, DEFAULT_PATOKAN_NILAI);
  assert.notStrictEqual(
    persyaratanPertama.patokanNilai[0],
    DEFAULT_PATOKAN_NILAI[0],
  );
  assert.notStrictEqual(
    persyaratanPertama.patokanNilai,
    persyaratanKedua.patokanNilai,
  );
  assert.notStrictEqual(
    persyaratanPertama.patokanNilai[0],
    persyaratanKedua.patokanNilai[0],
  );
  assert.equal(hasil.indikator.pilar[0].variabel[0].halamanSumber, 3);
  assert.equal(hasil.indikator.pilar[1].variabel[0].bobotSumber, 20);
  assert.equal(hasil.indikator.pilar[1].variabel[1].bobotSumber, 7);
  assert.ok(
    Math.abs(
      hasil.indikator.pilar[1].variabel.reduce(
        (sum, variabel) => sum + variabel.bobot,
        0,
      ) - 100,
    ) < 0.001,
  );
  assert.equal(hasil.peringatan.length, 1);
});

test("ID persyaratan hasil injek tidak berubah saat redaksinya diperbaiki", () => {
  const baris = {
    nomor: 1,
    pilar: "Pilar I",
    bobotPilar: 100,
    komponen: "Legalitas",
    persyaratanDataDukung: "Akta pendirian",
    bobotSumber: 100,
  };
  const options = { namaSheet: "Indikator", namaFile: "indikator.xlsx" };

  const hasilAwal = buildManajemenIndikatorDariBaris([baris], options);
  const hasilPerbaikan = buildManajemenIndikatorDariBaris(
    [{ ...baris, persyaratanDataDukung: "Akta pendirian yang sah" }],
    options,
  );
  const persyaratanAwal =
    hasilAwal.indikator.pilar[0].variabel[0].persyaratanBuktiDukung[0];
  const persyaratanPerbaikan =
    hasilPerbaikan.indikator.pilar[0].variabel[0].persyaratanBuktiDukung[0];

  assert.equal(persyaratanAwal.id, persyaratanPerbaikan.id);
  assert.notEqual(persyaratanAwal.nama, persyaratanPerbaikan.nama);
});

const SENI_ROWS = [
  {
    nomor: 1,
    pilar: "Ide, Gagasan, dan Identitas Budaya",
    bobotPilar: 20,
    komponen: "Kejelasan tema dan konsep karya",
    persyaratanDataDukung:
      "Sinopsis atau deskripsi karya yang menjelaskan tema dan konsep penciptaan",
    bobotSumber: 5,
  },
  {
    nomor: 2,
    pilar: "Ide, Gagasan, dan Identitas Budaya",
    bobotPilar: 20,
    komponen: "Kedalaman pengolahan nilai budaya",
    persyaratanDataDukung:
      "Penjelasan nilai, tradisi, sejarah, atau unsur budaya yang diangkat",
    bobotSumber: 5,
  },
  {
    nomor: 3,
    pilar: "Ide, Gagasan, dan Identitas Budaya",
    bobotPilar: 20,
    komponen: "Orisinalitas gagasan",
    persyaratanDataDukung:
      "Konsep penciptaan dan penjelasan mengenai kebaruan atau ciri khas karya",
    bobotSumber: 5,
  },
  {
    nomor: 4,
    pilar: "Ide, Gagasan, dan Identitas Budaya",
    bobotPilar: 20,
    komponen: "Kesesuaian konsep dengan bentuk penyajian",
    persyaratanDataDukung:
      "Kesesuaian antara konsep tertulis dengan video atau penampilan langsung",
    bobotSumber: 5,
  },
  {
    nomor: 5,
    pilar: "Kreativitas, Koreografi, dan Keutuhan Estetika",
    bobotPilar: 25,
    komponen: "Inovasi koreografi",
    persyaratanDataDukung:
      "Video atau penampilan langsung yang memperlihatkan kebaruan pengembangan koreografi",
    bobotSumber: 5,
  },
  {
    nomor: 6,
    pilar: "Kreativitas, Koreografi, dan Keutuhan Estetika",
    bobotPilar: 25,
    komponen: "Eksplorasi gerak",
    persyaratanDataDukung:
      "Susunan, variasi, dan pengembangan ragam gerak dalam karya",
    bobotSumber: 5,
  },
  {
    nomor: 7,
    pilar: "Kreativitas, Koreografi, dan Keutuhan Estetika",
    bobotPilar: 25,
    komponen: "Komposisi",
    persyaratanDataDukung:
      "Pola lantai, penggunaan ruang, dinamika, fokus, dan susunan penari",
    bobotSumber: 5,
  },
  {
    nomor: 8,
    pilar: "Kreativitas, Koreografi, dan Keutuhan Estetika",
    bobotPilar: 25,
    komponen: "Garapan musik",
    persyaratanDataDukung:
      "Rekaman atau iringan musik serta kesesuaiannya dengan konsep dan gerak tari",
    bobotSumber: 5,
  },
  {
    nomor: 9,
    pilar: "Kreativitas, Koreografi, dan Keutuhan Estetika",
    bobotPilar: 25,
    komponen: "Kostum, properti, dan tata artistik",
    persyaratanDataDukung:
      "Kostum, properti, dokumentasi, dan penataan artistik yang mendukung pertunjukan",
    bobotSumber: 5,
  },
  {
    nomor: 10,
    pilar: "Teknik dan Kualitas Penyajian Pertunjukan",
    bobotPilar: 25,
    komponen: "Penguasaan teknik gerak",
    persyaratanDataDukung:
      "Penampilan langsung atau rekaman yang menunjukkan ketepatan teknik gerak",
    bobotSumber: 5,
  },
  {
    nomor: 11,
    pilar: "Teknik dan Kualitas Penyajian Pertunjukan",
    bobotPilar: 25,
    komponen: "Kualitas penari",
    persyaratanDataDukung:
      "Ketepatan, keluwesan, kekuatan, keseimbangan, dan konsistensi gerak penari",
    bobotSumber: 5,
  },
  {
    nomor: 12,
    pilar: "Teknik dan Kualitas Penyajian Pertunjukan",
    bobotPilar: 25,
    komponen: "Kerja sama kelompok",
    persyaratanDataDukung:
      "Kekompakan, keseragaman, koordinasi, dan interaksi antarpemain",
    bobotSumber: 5,
  },
  {
    nomor: 13,
    pilar: "Teknik dan Kualitas Penyajian Pertunjukan",
    bobotPilar: 25,
    komponen: "Musikalitas",
    persyaratanDataDukung:
      "Ketepatan gerak terhadap tempo, ritme, dinamika, dan iringan musik",
    bobotSumber: 5,
  },
  {
    nomor: 14,
    pilar: "Teknik dan Kualitas Penyajian Pertunjukan",
    bobotPilar: 25,
    komponen: "Ekspresi dan penghayatan",
    persyaratanDataDukung:
      "Ekspresi, karakter, penjiwaan, dan kemampuan menyampaikan makna karya",
    bobotSumber: 5,
  },
];

const inlineStringCell = (address, value) =>
  `<c r="${address}" t="inlineStr"><is><t>${escapeXml(value)}</t></is></c>`;
const numericCell = (address, value) => `<c r="${address}"><v>${value}</v></c>`;

async function buildSeniWorkbookBytes(options = {}) {
  const data = SENI_ROWS.map((item, index) =>
    index === 0 && options.persyaratanPertama
      ? { ...item, persyaratanDataDukung: options.persyaratanPertama }
      : item,
  );
  const titleRows = [
    `<row r="1">${inlineStringCell("A1", "INSTRUMEN PENILAIAN SENI PERTUNJUKAN")}</row>`,
    `<row r="3">${inlineStringCell("A3", options.subjudul ?? "Bobot Seni Pertunjukan 70% | Skala Nilai 0, 5, dan 10")}</row>`,
  ];
  const headers = [
    "No.",
    "Pilar",
    "Bobot Pilar (%)",
    "Variabel",
    "Data Dukung",
    "Bobot Variabel (%)",
    "Nilai (0/5/10)",
    "Bobot Diperoleh (%)",
    "Catatan Penilai",
  ];
  const headerRow = `<row r="8">${headers
    .map((value, index) =>
      inlineStringCell(`${String.fromCharCode(65 + index)}8`, value),
    )
    .join("")}</row>`;
  const dataRows = data.map((item, index) => {
    const row = index + 9;
    return `<row r="${row}">${numericCell(`A${row}`, item.nomor)}${inlineStringCell(`B${row}`, item.pilar)}${numericCell(`C${row}`, item.bobotPilar)}${inlineStringCell(`D${row}`, item.komponen)}${inlineStringCell(`E${row}`, item.persyaratanDataDukung)}${numericCell(`F${row}`, item.bobotSumber)}<c r="G${row}"/><c r="H${row}"><f>IF(G${row}="",0,G${row}/10*F${row})</f><v>0</v></c><c r="I${row}"/></row>`;
  });
  const worksheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${[
      ...titleRows,
      headerRow,
      ...dataRows,
      '<row r="23"></row>',
      `<row r="24">${inlineStringCell("A24", "REKAPITULASI NILAI")}</row>`,
      `<row r="26">${inlineStringCell("B26", SENI_ROWS[0].pilar)}${numericCell("C26", 20)}${numericCell("D26", 0)}${inlineStringCell("E26", "Total Nilai Seni Pertunjukan")}${numericCell("F26", 0)}</row>`,
    ].join("")}</sheetData></worksheet>`;
  const rubrik = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>
      <row r="1">${inlineStringCell("A1", "RUBRIK DAN PATOKAN NILAI DATA DUKUNG")}</row>
      <row r="5">${numericCell("A5", 0)}</row><row r="6">${numericCell("A6", 5)}</row><row r="7">${numericCell("A7", 10)}</row>
    </sheetData></worksheet>`;

  const zip = new JSZip();
  zip.file(
    "xl/workbook.xml",
    `<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Instrumen Penilaian" sheetId="1" r:id="rId1"/><sheet name="Rubrik Nilai" sheetId="2" r:id="rId2"/></sheets></workbook>`,
  );
  zip.file(
    "xl/_rels/workbook.xml.rels",
    `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/></Relationships>`,
  );
  zip.file("xl/worksheets/sheet1.xml", worksheet);
  zip.file("xl/worksheets/sheet2.xml", rubrik);
  return zip.generateAsync({ type: "uint8array" });
}

function fileFromBytes(bytes) {
  return {
    name: "Instrumen_Penilaian_Seni_Pertunjukan_70_Persen.xlsx",
    async arrayBuffer() {
      return Uint8Array.from(bytes).buffer;
    },
  };
}

test("injek Seni membaca 14 variabel asli dan menormalisasi bobot sumber 70%", async () => {
  const bytes = await buildSeniWorkbookBytes();
  const file = fileFromBytes(bytes);
  const hasil = await parseKurasiIndikatorXlsx(file);
  const hasilLangsung = await parseKurasiSeniXlsx(file);

  assert.equal(hasil.jenis, "seni");
  assert.equal(hasilLangsung.jenis, "seni");
  assert.equal(hasil.indikator.id, "indikator-seni-pertunjukan");
  assert.equal(hasil.indikator.nama, "Seni Pertunjukan");
  assert.equal(hasil.indikator.tipe, "seni");
  assert.equal(hasil.indikator.bobot, 70);
  assert.equal(hasil.jumlahBaris, 14);
  assert.equal(hasil.jumlahPilar, 3);
  assert.deepEqual(
    hasil.indikator.pilar.map((item) => item.bobotSumber),
    [20, 25, 25],
  );
  assert.ok(
    Math.abs(
      hasil.indikator.pilar.reduce((sum, item) => sum + item.bobot, 0) - 100,
    ) < 0.000001,
  );
  assert.deepEqual(
    hasil.indikator.pilar.flatMap((pilar) =>
      pilar.variabel.map((variabel) => variabel.nama),
    ),
    SENI_ROWS.map((item) => item.komponen),
  );
  assert.deepEqual(
    hasil.indikator.pilar.flatMap((pilar) =>
      pilar.variabel.map((variabel) => variabel.persyaratanBuktiDukung[0].nama),
    ),
    SENI_ROWS.map((item) => item.persyaratanDataDukung),
  );
  for (const pilar of hasil.indikator.pilar) {
    assert.ok(
      Math.abs(
        pilar.variabel.reduce((sum, item) => sum + item.bobot, 0) - 100,
      ) < 0.000001,
    );
    assert.ok(pilar.variabel.every((item) => item.bobotSumber === 5));
  }
  const nilaiPenuh = Object.fromEntries(
    hasil.indikator.pilar.flatMap((pilar) =>
      pilar.variabel.map((variabel) => [variabel.id, 100]),
    ),
  );
  assert.ok(
    Math.abs(
      naFromScores({ indikator: [hasil.indikator], updatedAt: 1 }, nilaiPenuh) -
        70,
    ) < 0.000001,
  );

  const persyaratan = hasil.indikator.pilar.flatMap((pilar) =>
    pilar.variabel.map((variabel) => variabel.persyaratanBuktiDukung[0]),
  );
  assert.ok(
    persyaratan.every(
      (item) =>
        JSON.stringify(item.patokanNilai) ===
        JSON.stringify(DEFAULT_PATOKAN_NILAI),
    ),
  );
  assert.notStrictEqual(
    persyaratan[0].patokanNilai,
    persyaratan[1].patokanNilai,
  );
  assert.notStrictEqual(
    persyaratan[0].patokanNilai[0],
    persyaratan[1].patokanNilai[0],
  );
});

test("ID Seni stabil saat redaksi data dukung diperbaiki", () => {
  const options = {
    namaSheet: "Instrumen Penilaian",
    namaFile: "seni.xlsx",
    bobotIndikator: 70,
  };
  const hasilAwal = buildSeniIndikatorDariBaris(SENI_ROWS, options);
  const hasilPerbaikan = buildSeniIndikatorDariBaris(
    [
      {
        ...SENI_ROWS[0],
        persyaratanDataDukung: `${SENI_ROWS[0].persyaratanDataDukung} terbaru`,
      },
      ...SENI_ROWS.slice(1),
    ],
    options,
  );

  const variabelAwal = hasilAwal.indikator.pilar[0].variabel[0];
  const variabelPerbaikan = hasilPerbaikan.indikator.pilar[0].variabel[0];
  assert.equal(variabelAwal.id, variabelPerbaikan.id);
  assert.equal(
    variabelAwal.persyaratanBuktiDukung[0].id,
    variabelPerbaikan.persyaratanBuktiDukung[0].id,
  );
  assert.notEqual(
    variabelAwal.persyaratanBuktiDukung[0].nama,
    variabelPerbaikan.persyaratanBuktiDukung[0].nama,
  );
});

test("penggantian hasil injek hanya mengganti Seni pada posisi semula", () => {
  const manajemen = {
    id: "indikator-manajemen-sanggar",
    nama: "Manajemen Sanggar",
    bobot: 30,
    tipe: "manajemen",
    pilar: [],
  };
  const seniLama = {
    id: "id-seni-lama",
    nama: "Seni Pertunjukan",
    bobot: 70,
    tipe: "seni",
    pilar: [],
  };
  const seniLain = {
    id: "seni-lain",
    nama: "Seni Rupa",
    bobot: 0,
    tipe: "seni",
    pilar: [],
  };
  const seniBaru = buildSeniIndikatorDariBaris(SENI_ROWS, {
    namaSheet: "Instrumen Penilaian",
    namaFile: "seni.xlsx",
    bobotIndikator: 70,
  }).indikator;

  const hasil = gantiIndikatorHasilInjek(
    [manajemen, seniLama, seniLain],
    seniBaru,
  );
  assert.equal(hasil.length, 3);
  assert.strictEqual(hasil[0], manajemen);
  assert.strictEqual(hasil[1], seniBaru);
  assert.strictEqual(hasil[2], seniLain);
});

test("injek Seni menolak subjudul tanpa bobot dan total pilar yang tidak 70%", async () => {
  const tanpaBobot = await buildSeniWorkbookBytes({
    subjudul: "Skala Nilai 0, 5, dan 10",
  });
  await assert.rejects(
    parseKurasiSeniXlsx(fileFromBytes(tanpaBobot)),
    /Bobot Seni Pertunjukan tidak ditemukan/i,
  );

  assert.throws(
    () =>
      buildSeniIndikatorDariBaris(
        SENI_ROWS.map((item) =>
          item.pilar === "Teknik dan Kualitas Penyajian Pertunjukan"
            ? { ...item, bobotPilar: 20 }
            : item,
        ),
        {
          namaSheet: "Instrumen Penilaian",
          namaFile: "seni.xlsx",
          bobotIndikator: 70,
        },
      ),
    /harus 70%/i,
  );
});
