import assert from "node:assert/strict";
import test from "node:test";

import JSZip from "jszip";

import {
  buildKurasiTemplateXlsx,
  KURASI_TEMPLATE_FORMAT,
  KURASI_TEMPLATE_MIME,
  namaFileTemplateKurasi,
} from "../src/lib/kurasi-template-xlsx.ts";
import {
  parseKurasiXlsx,
  parseWorksheet,
} from "../src/lib/kurasi-matrix-import.ts";

const matrixPatokan = [
  { id: "nilai-0", nilai: 0, nama: "Tidak ada", persentaseBobot: 0 },
  { id: "nilai-5", nilai: 5, nama: "Tidak sesuai", persentaseBobot: 50 },
  { id: "nilai-10", nilai: 10, nama: "Sesuai", persentaseBobot: 100 },
];

function fixture() {
  return {
    indikator: [
      {
        id: "indikator-manajemen",
        nama: "Manajemen Sanggar",
        bobot: 30,
        tipe: "manajemen",
        sumber: "Dokumen & arsip <utama>",
        pilar: [
          {
            id: "pilar-manajemen",
            nama: "Tata Kelola",
            bobot: 100,
            variabel: [
              {
                id: "variabel-multi-bukti",
                nama: "Legalitas & Struktur",
                bobot: 60,
                bobotSumber: 60,
                persyaratanBuktiDukung: [
                  {
                    id: "bukti-akta",
                    nama: 'Akta, surat "utama"\nbaris kedua',
                    patokanNilai: [
                      {
                        id: "akta-0",
                        nilai: 0,
                        nama: "Belum ada",
                        persentaseBobot: 0,
                      },
                      {
                        id: "akta-10",
                        nilai: 10,
                        nama: "Lengkap",
                        persentaseBobot: 100,
                      },
                    ],
                  },
                  {
                    id: "bukti-struktur",
                    nama: "Bagan struktur organisasi",
                    patokanNilai: matrixPatokan.map((item) => ({ ...item })),
                  },
                ],
              },
              {
                id: "variabel-tanpa-bukti",
                nama: "=SUM(A1:A2) harus tetap teks",
                bobot: 40,
                bobotSumber: 40,
                patokanNilai: [
                  {
                    id: "langsung-0",
                    nilai: 0,
                    nama: "Belum",
                    persentaseBobot: 0,
                  },
                  {
                    id: "langsung-10",
                    nilai: 10,
                    nama: "Terpenuhi",
                    persentaseBobot: 100,
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        id: "indikator-seni",
        nama: "Seni Pertunjukan",
        bobot: 70,
        tipe: "seni",
        versi: "v1",
        catatanBobot: "Bobot sumber 70%",
        pilar: [
          {
            id: "pilar-seni",
            nama: "Penyajian",
            bobot: 100,
            bobotSumber: 70,
            variabel: [
              {
                id: "variabel-teknik",
                nama: "Teknik",
                bobot: 50,
                bobotSumber: 35,
                halamanSumber: 123,
                persyaratanBuktiDukung: [
                  {
                    id: "bukti-video",
                    nama: "Video pertunjukan",
                    patokanNilai: matrixPatokan.map((item) => ({ ...item })),
                  },
                ],
              },
              {
                id: "variabel-ekspresi",
                nama: "Ekspresi",
                bobot: 50,
                bobotSumber: 35,
                persyaratanBuktiDukung: [
                  {
                    id: "bukti-ekspresi",
                    nama: "Rekaman ekspresi",
                    patokanNilai: matrixPatokan.map((item) => ({ ...item })),
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
    patokanNilai: matrixPatokan.map((item) => ({ ...item })),
    predikat: [
      {
        id: "predikat-muda",
        nama: "MUDA",
        min: 0,
        warna: "hsl(150 60% 30%)",
        tingkat: "Kecamatan",
      },
      {
        id: "predikat-mahir",
        nama: "MAHIR",
        min: 80,
        warna: "hsl(40 80% 45%)",
        tingkat: "Provinsi",
      },
    ],
    updatedAt: Date.UTC(2026, 7, 23, 0, 0, 0),
  };
}

const generatedAt = Date.UTC(2026, 7, 23, 2, 3, 4);

test("generator membuat paket XLSX asli dengan seluruh sheet kurasi", async () => {
  const input = fixture();
  const before = structuredClone(input);
  const bytes = await buildKurasiTemplateXlsx(input, generatedAt);

  assert.equal(bytes[0], 0x50);
  assert.equal(bytes[1], 0x4b);
  assert.equal(
    KURASI_TEMPLATE_MIME,
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
  assert.equal(
    namaFileTemplateKurasi(generatedAt),
    "template-kurasi-jaksanggar-20260823.xlsx",
  );
  assert.deepEqual(
    input,
    before,
    "generator tidak boleh mengubah matriks sumber",
  );

  const zip = await JSZip.loadAsync(bytes);
  for (const path of [
    "[Content_Types].xml",
    "_rels/.rels",
    "docProps/core.xml",
    "docProps/app.xml",
    "xl/workbook.xml",
    "xl/_rels/workbook.xml.rels",
    "xl/styles.xml",
  ]) {
    assert.ok(zip.file(path), `${path} wajib tersedia`);
  }

  const workbookXml = await zip.file("xl/workbook.xml").async("text");
  for (const name of [
    "Petunjuk",
    "Manifest",
    "Indikator",
    "Pilar",
    "Variabel",
    "Persyaratan",
    "Patokan Nilai",
    "Predikat",
  ]) {
    assert.match(workbookXml, new RegExp(`name="${name}"`));
  }
  assert.equal(
    Array.from(workbookXml.matchAll(/<sheet\b/g)).length,
    8,
    "workbook harus memiliki delapan sheet",
  );

  const contentTypes = await zip.file("[Content_Types].xml").async("text");
  assert.match(
    contentTypes,
    /application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet\.main\+xml/,
  );
  const styles = await zip.file("xl/styles.xml").async("text");
  assert.match(styles, /formatCode="General&quot;%&quot;"/);

  const manifestXml = await zip.file("xl/worksheets/sheet2.xml").async("text");
  const manifestRows = parseWorksheet(manifestXml, []);
  assert.equal(manifestRows[0][0], "Format");
  assert.equal(manifestRows[0][1], KURASI_TEMPLATE_FORMAT);

  const indicatorXml = await zip.file("xl/worksheets/sheet3.xml").async("text");
  const indicatorRows = parseWorksheet(indicatorXml, []);
  assert.deepEqual(indicatorRows[0].slice(0, 5), [
    "Urutan",
    "ID Indikator",
    "Nama Indikator",
    "Bobot Indikator (%)",
    "Tipe",
  ]);
  assert.equal(indicatorRows[1][2], "Manajemen Sanggar");
  assert.equal(indicatorRows[2][2], "Seni Pertunjukan");

  const variableXml = await zip.file("xl/worksheets/sheet5.xml").async("text");
  assert.doesNotMatch(variableXml, /<f>SUM\(A1:A2\)/);
  const variableRows = parseWorksheet(variableXml, []);
  assert.equal(variableRows[2][3], "=SUM(A1:A2) harus tetap teks");

  const requirementXml = await zip
    .file("xl/worksheets/sheet6.xml")
    .async("text");
  const requirementRows = parseWorksheet(requirementXml, []);
  assert.equal(requirementRows[1][3], 'Akta, surat "utama"\nbaris kedua');
});

test("template Excel dapat diimpor kembali tanpa kehilangan struktur", async () => {
  const input = fixture();
  const bytes = await buildKurasiTemplateXlsx(input, generatedAt);
  const arrayBuffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  );
  const result = await parseKurasiXlsx({
    name: namaFileTemplateKurasi(generatedAt),
    async arrayBuffer() {
      return arrayBuffer;
    },
  });

  assert.equal(result.jenis, "lengkap");
  assert.equal(result.namaSheet, "Template Kurasi");
  assert.equal(result.jumlahPilar, 2);
  assert.equal(result.jumlahBaris, 4);
  assert.deepEqual(result.indikator, input.indikator);
  assert.deepEqual(result.patokanNilai, input.patokanNilai);
  assert.deepEqual(result.predikat, input.predikat);
});
