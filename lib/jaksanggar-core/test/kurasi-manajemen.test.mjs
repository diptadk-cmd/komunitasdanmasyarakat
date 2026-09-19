import assert from "node:assert/strict";
import test from "node:test";

import {
  agregasikanRequirementScores,
  createKurasiMatrixSnapshot,
  createDefaultManajemenIndikator,
  DEFAULT_PATOKAN_NILAI,
  indikatorScoreOf,
  migrateMatrix,
  nilaiVariabelDariPersyaratan,
  normalisasiBobotVariabel,
  patokanNilaiPersyaratan,
  patokanNilaiVariabel,
  persyaratanBuktiDukungOf,
} from "../src/kurasi.ts";

test("normalisasi bobot aman untuk daftar kosong dan seluruh bobot nol", () => {
  assert.deepEqual(normalisasiBobotVariabel([]), []);

  const hasil = normalisasiBobotVariabel([
    { id: "a", bobotSumber: 0 },
    { id: "b", bobotSumber: 0 },
    { id: "c", bobotSumber: 0 },
  ]);

  assert.ok(hasil.every((item) => Number.isFinite(item.bobot)));
  assert.ok(
    Math.abs(hasil.reduce((total, item) => total + item.bobot, 0) - 100) <
      0.001,
  );
});

test("indikator manajemen sanggar memuat 30 butir dari empat pilar", () => {
  const indikator = createDefaultManajemenIndikator();
  const variabel = indikator.pilar.flatMap((pilar) => pilar.variabel);

  assert.equal(indikator.bobot, 30);
  assert.deepEqual(
    indikator.pilar.map((pilar) => pilar.bobot),
    [30, 25, 25, 20],
  );
  assert.equal(variabel.length, 30);
  assert.equal(
    indikator.pilar.reduce((total, pilar) => total + pilar.bobot, 0),
    100,
  );
  for (const pilar of indikator.pilar) {
    const total = pilar.variabel.reduce(
      (sum, variabelPilar) => sum + variabelPilar.bobot,
      0,
    );
    assert.ok(Math.abs(total - 100) < 0.001);
  }
});

test("bobot sumber setiap pilar tepat dan nilai penuh tetap 100", () => {
  const indikator = createDefaultManajemenIndikator();
  const totalSumber = indikator.pilar.reduce(
    (total, pilar) =>
      total +
      pilar.variabel.reduce(
        (sum, variabel) => sum + (variabel.bobotSumber ?? 0),
        0,
      ),
    0,
  );
  const totalSumberPilarDua = indikator.pilar[1].variabel.reduce(
    (sum, variabel) => sum + (variabel.bobotSumber ?? 0),
    0,
  );
  const nilaiPenuh = Object.fromEntries(
    indikator.pilar.flatMap((pilar) =>
      pilar.variabel.map((variabel) => [variabel.id, 100]),
    ),
  );

  assert.equal(totalSumber, 100);
  assert.equal(totalSumberPilarDua, 25);
  assert.ok(Math.abs(indikatorScoreOf(indikator, nilaiPenuh) - 100) < 0.001);
});

test("matriks bawaan lama dimigrasikan ke indikator manajemen terbaru", () => {
  const matrix = migrateMatrix({
    indikator: [
      {
        id: "legacy-management",
        nama: "Manajemen Sanggar",
        bobot: 30,
        tipe: "manajemen",
        pilar: [
          {
            id: "legacy-p1",
            nama: "Tata Kelola Kelembagaan",
            bobot: 40,
            variabel: [
              {
                id: "legacy-v1",
                nama: "Legalitas & Struktur Organisasi",
                bobot: 50,
              },
              { id: "legacy-v2", nama: "Sistem Administrasi", bobot: 50 },
            ],
          },
          {
            id: "legacy-p2",
            nama: "Kapasitas Organisasi",
            bobot: 30,
            variabel: [
              {
                id: "legacy-v3",
                nama: "Keuangan & Pelaporan",
                bobot: 50,
              },
              { id: "legacy-v4", nama: "Sumber Daya & Sarana", bobot: 50 },
            ],
          },
          {
            id: "legacy-p3",
            nama: "Mutu Pembelajaran",
            bobot: 30,
            variabel: [
              { id: "legacy-v5", nama: "Kurikulum & Metode", bobot: 50 },
              {
                id: "legacy-v6",
                nama: "Capaian Peserta Didik",
                bobot: 50,
              },
            ],
          },
        ],
      },
    ],
    updatedAt: 1,
  });

  assert.equal(
    matrix.indikator[0].pilar.flatMap((pilar) => pilar.variabel).length,
    30,
  );
  assert.equal(matrix.indikator[0].id, "indikator-manajemen-sanggar");
});

test("indikator manajemen versi sebelumnya diperbarui ke bobot sumber terbaru", () => {
  const indikatorLama = createDefaultManajemenIndikator();
  indikatorLama.versi = "indikator-manajemen-sanggar-2026-07-26";
  const variabelIuran = indikatorLama.pilar[1].variabel.find(
    (variabel) => variabel.id === "manajemen-p2-05",
  );
  assert.ok(variabelIuran);
  variabelIuran.bobotSumber = 5;

  const matrix = migrateMatrix({ indikator: [indikatorLama], updatedAt: 1 });
  const hasil = matrix.indikator[0];
  const hasilIuran = hasil.pilar[1].variabel.find(
    (variabel) => variabel.id === "manajemen-p2-05",
  );

  assert.equal(hasil.versi, "indikator-manajemen-sanggar-2026-07-26-v2");
  assert.equal(hasilIuran?.bobotSumber, 3);
  assert.ok(
    Math.abs(
      hasil.pilar[1].variabel.reduce(
        (total, variabel) => total + variabel.bobot,
        0,
      ) - 100,
    ) < 0.001,
  );
});

test("indikator hasil injek Excel tidak ditimpa oleh migrasi matriks bawaan", () => {
  const hasilInjek = createDefaultManajemenIndikator();
  hasilInjek.versi = "injek-file-pengguna";
  hasilInjek.sumber = "Indikator_Kurasi_Manajemen_Sanggar.xlsx";
  hasilInjek.pilar[0].variabel[0].nama = "Komponen dari sheet pertama";

  const matrix = migrateMatrix({ indikator: [hasilInjek], updatedAt: 1 });

  assert.equal(matrix.indikator[0].versi, "injek-file-pengguna");
  assert.equal(
    matrix.indikator[0].pilar[0].variabel[0].nama,
    "Komponen dari sheet pertama",
  );
});

test("migrasi mengubah persyaratan lama menjadi daftar dan menambah patokan bawaan", () => {
  const matrix = migrateMatrix({
    indikator: [
      {
        id: "ind-custom",
        nama: "Indikator Kustom",
        bobot: 100,
        tipe: "seni",
        pilar: [
          {
            id: "pilar-custom",
            nama: "Pilar Kustom",
            bobot: 100,
            variabel: [
              {
                id: "var-legacy",
                nama: "Variabel Lama",
                bobot: 50,
                persyaratanDataDukung: "Surat keterangan",
              },
              {
                id: "var-empty",
                nama: "Tanpa Persyaratan",
                bobot: 50,
                persyaratanBuktiDukung: [],
                persyaratanDataDukung: "Teks lama harus diabaikan",
              },
            ],
          },
        ],
      },
    ],
    updatedAt: 1,
  });

  const [legacy, kosong] = matrix.indikator[0].pilar[0].variabel;
  assert.deepEqual(
    persyaratanBuktiDukungOf(legacy).map((item) => item.nama),
    ["Surat keterangan"],
  );
  assert.deepEqual(persyaratanBuktiDukungOf(kosong), []);
  assert.deepEqual(matrix.patokanNilai, DEFAULT_PATOKAN_NILAI);
});

test("snapshot matriks mempertahankan aturan tetapi tidak menyalin contoh berkas", () => {
  const matrix = migrateMatrix({
    indikator: [
      {
        id: "ind-snapshot",
        nama: "Indikator Snapshot",
        bobot: 100,
        tipe: "seni",
        pilar: [
          {
            id: "pilar-snapshot",
            nama: "Pilar Snapshot",
            bobot: 100,
            variabel: [
              {
                id: "var-snapshot",
                nama: "Variabel Snapshot",
                bobot: 100,
                persyaratanBuktiDukung: [
                  {
                    id: "bukti-1",
                    nama: "Dokumen utama",
                    patokanNilai: [
                      {
                        id: "bukti-baik",
                        nilai: 8,
                        nama: "Baik",
                        persentaseBobot: 80,
                      },
                    ],
                  },
                ],
                patokanNilai: [
                  {
                    id: "variabel-cukup",
                    nilai: 6,
                    nama: "Cukup",
                    persentaseBobot: 60,
                  },
                ],
                contoh: {
                  name: "contoh.pdf",
                  dataUrl: "data:application/pdf;base64,AAAA",
                  size: 4,
                },
              },
            ],
          },
        ],
      },
    ],
    patokanNilai: [
      { id: "pilihan-7", nilai: 7, nama: "Cukup", persentaseBobot: 70 },
    ],
    updatedAt: 123,
  });

  const snapshot = createKurasiMatrixSnapshot(matrix);
  const variabel = snapshot.indikator[0].pilar[0].variabel[0];
  assert.equal(variabel.contoh, undefined);
  assert.deepEqual(variabel.persyaratanBuktiDukung, [
    {
      id: "bukti-1",
      nama: "Dokumen utama",
      patokanNilai: [
        {
          id: "bukti-baik",
          nilai: 8,
          nama: "Baik",
          persentaseBobot: 80,
        },
      ],
    },
  ]);
  assert.deepEqual(variabel.patokanNilai, [
    {
      id: "variabel-cukup",
      nilai: 6,
      nama: "Cukup",
      persentaseBobot: 60,
    },
  ]);
  assert.deepEqual(snapshot.patokanNilai, [
    { id: "pilihan-7", nilai: 7, nama: "Cukup", persentaseBobot: 70 },
  ]);

  matrix.indikator[0].pilar[0].variabel[0].persyaratanBuktiDukung[0].patokanNilai[0].nama =
    "Berubah";
  matrix.indikator[0].pilar[0].variabel[0].patokanNilai[0].nama = "Berubah";
  assert.equal(variabel.persyaratanBuktiDukung[0].patokanNilai[0].nama, "Baik");
  assert.equal(variabel.patokanNilai[0].nama, "Cukup");
});

test("patokan bukti mengikuti fallback bukti lalu variabel lalu matriks", () => {
  const matrix = {
    indikator: [],
    patokanNilai: [
      { id: "global", nilai: 4, nama: "Global", persentaseBobot: 40 },
    ],
    updatedAt: 1,
  };
  const variabel = {
    id: "variabel",
    nama: "Variabel",
    bobot: 100,
    patokanNilai: [
      { id: "variabel", nilai: 6, nama: "Variabel", persentaseBobot: 60 },
    ],
    persyaratanBuktiDukung: [
      {
        id: "khusus",
        nama: "Bukti khusus",
        patokanNilai: [
          { id: "khusus", nilai: 8, nama: "Khusus", persentaseBobot: 80 },
        ],
      },
      { id: "turunan", nama: "Bukti turunan" },
    ],
  };

  assert.equal(patokanNilaiVariabel(variabel, matrix)[0].id, "variabel");
  assert.equal(
    patokanNilaiPersyaratan(
      variabel.persyaratanBuktiDukung[0],
      variabel,
      matrix,
    )[0].id,
    "khusus",
  );
  assert.equal(
    patokanNilaiPersyaratan(
      variabel.persyaratanBuktiDukung[1],
      variabel,
      matrix,
    )[0].id,
    "variabel",
  );

  delete variabel.patokanNilai;
  assert.equal(
    patokanNilaiPersyaratan(
      variabel.persyaratanBuktiDukung[1],
      variabel,
      matrix,
    )[0].id,
    "global",
  );
  assert.deepEqual(patokanNilaiVariabel(variabel), DEFAULT_PATOKAN_NILAI);
});

test("agregasi bukti memakai seluruh persyaratan sebagai penyebut dan menjaga skor lama", () => {
  const variabelDenganBukti = {
    id: "dengan-bukti",
    nama: "Dengan bukti",
    bobot: 50,
    persyaratanBuktiDukung: [
      { id: "a", nama: "A" },
      { id: "b", nama: "B" },
      { id: "c", nama: "C" },
    ],
  };
  const variabelTanpaBukti = {
    id: "tanpa-bukti",
    nama: "Tanpa bukti",
    bobot: 50,
    persyaratanBuktiDukung: [],
  };
  const matrix = {
    indikator: [
      {
        id: "indikator",
        nama: "Indikator",
        bobot: 100,
        tipe: "seni",
        pilar: [
          {
            id: "pilar",
            nama: "Pilar",
            bobot: 100,
            variabel: [variabelDenganBukti, variabelTanpaBukti],
          },
        ],
      },
    ],
    updatedAt: 1,
  };

  assert.equal(
    nilaiVariabelDariPersyaratan(variabelDenganBukti, { a: 100, b: 50 }),
    50,
  );
  assert.deepEqual(
    agregasikanRequirementScores(
      matrix,
      { "dengan-bukti": 70, "tanpa-bukti": 50 },
      {},
    ),
    { "dengan-bukti": 70, "tanpa-bukti": 50 },
  );

  const hasil = agregasikanRequirementScores(
    matrix,
    { "dengan-bukti": 70, "tanpa-bukti": 50 },
    { "dengan-bukti": { a: 100 } },
  );
  assert.ok(Math.abs(hasil["dengan-bukti"] - 100 / 3) < 0.000001);
  assert.equal(hasil["tanpa-bukti"], 50);
});
