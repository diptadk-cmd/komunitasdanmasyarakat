import assert from "node:assert/strict";
import test from "node:test";

import {
  createDefaultSeniPertunjukanIndikator,
  createKurasiMatrixSnapshot,
  DEFAULT_PATOKAN_NILAI,
  indikatorKontribusi,
  migrateMatrix,
  VERSI_INDIKATOR_SENI_PERTUNJUKAN,
} from "../src/kurasi.ts";

const STRUKTUR_WORKBOOK = [
  [
    "Kejelasan tema dan konsep karya",
    "Sinopsis atau deskripsi karya yang menjelaskan tema dan konsep penciptaan",
  ],
  [
    "Kedalaman pengolahan nilai budaya",
    "Penjelasan nilai, tradisi, sejarah, atau unsur budaya yang diangkat",
  ],
  [
    "Orisinalitas gagasan",
    "Konsep penciptaan dan penjelasan mengenai kebaruan atau ciri khas karya",
  ],
  [
    "Kesesuaian konsep dengan bentuk penyajian",
    "Kesesuaian antara konsep tertulis dengan video atau penampilan langsung",
  ],
  [
    "Inovasi koreografi",
    "Video atau penampilan langsung yang memperlihatkan kebaruan pengembangan koreografi",
  ],
  [
    "Eksplorasi gerak",
    "Susunan, variasi, dan pengembangan ragam gerak dalam karya",
  ],
  [
    "Komposisi",
    "Pola lantai, penggunaan ruang, dinamika, fokus, dan susunan penari",
  ],
  [
    "Garapan musik",
    "Rekaman atau iringan musik serta kesesuaiannya dengan konsep dan gerak tari",
  ],
  [
    "Kostum, properti, dan tata artistik",
    "Kostum, properti, dokumentasi, dan penataan artistik yang mendukung pertunjukan",
  ],
  [
    "Penguasaan teknik gerak",
    "Penampilan langsung atau rekaman yang menunjukkan ketepatan teknik gerak",
  ],
  [
    "Kualitas penari",
    "Ketepatan, keluwesan, kekuatan, keseimbangan, dan konsistensi gerak penari",
  ],
  [
    "Kerja sama kelompok",
    "Kekompakan, keseragaman, koordinasi, dan interaksi antarpemain",
  ],
  [
    "Musikalitas",
    "Ketepatan gerak terhadap tempo, ritme, dinamika, dan iringan musik",
  ],
  [
    "Ekspresi dan penghayatan",
    "Ekspresi, karakter, penjiwaan, dan kemampuan menyampaikan makna karya",
  ],
];

function placeholderSeniLama() {
  return {
    id: "legacy-seni",
    nama: "Seni Pertunjukan",
    bobot: 70,
    tipe: "seni",
    pilar: [
      {
        id: "legacy-seni-p1",
        nama: "Penguasaan Teknik",
        bobot: 40,
        variabel: [
          {
            id: "legacy-seni-v1",
            nama: "Teknik & Ketepatan Gerak",
            bobot: 50,
          },
          {
            id: "legacy-seni-v2",
            nama: "Sinkronisasi & Kekompakan",
            bobot: 50,
          },
        ],
      },
      {
        id: "legacy-seni-p2",
        nama: "Kualitas Artistik",
        bobot: 35,
        variabel: [
          {
            id: "legacy-seni-v3",
            nama: "Penghayatan & Ekspresi",
            bobot: 50,
          },
          {
            id: "legacy-seni-v4",
            nama: "Originalitas & Kekayaan Budaya",
            bobot: 50,
          },
        ],
      },
      {
        id: "legacy-seni-p3",
        nama: "Penyajian",
        bobot: 25,
        variabel: [
          {
            id: "legacy-seni-v5",
            nama: "Kontrol Tenaga & Tempo",
            bobot: 50,
          },
          {
            id: "legacy-seni-v6",
            nama: "Tata Penyajian & Kostum",
            bobot: 50,
          },
        ],
      },
    ],
  };
}

test("indikator Seni Pertunjukan memuat tepat 14 variabel dari workbook", () => {
  const indikator = createDefaultSeniPertunjukanIndikator();
  const variabel = indikator.pilar.flatMap((pilar) => pilar.variabel);

  assert.equal(indikator.id, "indikator-seni-pertunjukan");
  assert.equal(indikator.nama, "Seni Pertunjukan");
  assert.equal(indikator.bobot, 70);
  assert.equal(indikator.tipe, "seni");
  assert.equal(indikator.versi, VERSI_INDIKATOR_SENI_PERTUNJUKAN);
  assert.deepEqual(
    indikator.pilar.map((pilar) => pilar.nama),
    [
      "Ide, Gagasan, dan Identitas Budaya",
      "Kreativitas, Koreografi, dan Keutuhan Estetika",
      "Teknik dan Kualitas Penyajian Pertunjukan",
    ],
  );
  assert.deepEqual(
    indikator.pilar.map((pilar) => pilar.variabel.length),
    [4, 5, 5],
  );
  assert.deepEqual(
    variabel.map((item) => [item.nama, item.persyaratanBuktiDukung[0].nama]),
    STRUKTUR_WORKBOOK,
  );
});

test("bobot sumber 70% dinormalisasi tanpa mengubah kontribusi lima poin per variabel", () => {
  const indikator = createDefaultSeniPertunjukanIndikator();
  const variabel = indikator.pilar.flatMap((pilar) => pilar.variabel);

  assert.deepEqual(
    indikator.pilar.map((pilar) => pilar.bobotSumber),
    [20, 25, 25],
  );
  assert.ok(
    Math.abs(
      indikator.pilar.reduce((total, pilar) => total + pilar.bobot, 0) - 100,
    ) < 0.000001,
  );
  assert.equal(
    indikator.pilar.reduce(
      (total, pilar) => total + (pilar.bobotSumber ?? 0),
      0,
    ),
    70,
  );
  for (const pilar of indikator.pilar) {
    assert.ok(
      Math.abs(
        pilar.variabel.reduce((total, item) => total + item.bobot, 0) - 100,
      ) < 0.000001,
    );
  }
  assert.ok(variabel.every((item) => item.bobotSumber === 5));

  const skorPenuh = Object.fromEntries(variabel.map((item) => [item.id, 100]));
  assert.ok(
    Math.abs(indikatorKontribusi(indikator, skorPenuh) - 70) < 0.000001,
  );
  for (const item of variabel) {
    assert.ok(
      Math.abs(indikatorKontribusi(indikator, { [item.id]: 100 }) - 5) <
        0.000001,
    );
  }
});

test("setiap bukti memiliki clone patokan 0, 5, dan 10", () => {
  const indikator = createDefaultSeniPertunjukanIndikator();
  const persyaratan = indikator.pilar.flatMap((pilar) =>
    pilar.variabel.map((variabel) => variabel.persyaratanBuktiDukung[0]),
  );

  for (const item of persyaratan) {
    assert.deepEqual(item.patokanNilai, DEFAULT_PATOKAN_NILAI);
    assert.notStrictEqual(item.patokanNilai, DEFAULT_PATOKAN_NILAI);
    assert.notStrictEqual(item.patokanNilai[0], DEFAULT_PATOKAN_NILAI[0]);
  }
  assert.notStrictEqual(
    persyaratan[0].patokanNilai,
    persyaratan[1].patokanNilai,
  );
  assert.notStrictEqual(
    persyaratan[0].patokanNilai[0],
    persyaratan[1].patokanNilai[0],
  );
});

test("migrasi mengganti hanya placeholder Seni Pertunjukan enam variabel", () => {
  const matrix = migrateMatrix({
    indikator: [placeholderSeniLama()],
    updatedAt: 1,
  });
  const indikator = matrix.indikator[0];

  assert.equal(indikator.id, "indikator-seni-pertunjukan");
  assert.equal(indikator.versi, VERSI_INDIKATOR_SENI_PERTUNJUKAN);
  assert.equal(indikator.pilar.flatMap((pilar) => pilar.variabel).length, 14);
});

test("migrasi tidak menimpa indikator Seni Pertunjukan yang telah dikustomisasi", () => {
  const custom = placeholderSeniLama();
  custom.id = "seni-kustom";
  custom.pilar[0].variabel[0].persyaratanBuktiDukung = [
    { id: "bukti-kustom", nama: "Bukti hasil pengaturan Kurator" },
  ];

  const matrix = migrateMatrix({ indikator: [custom], updatedAt: 1 });
  const indikator = matrix.indikator[0];

  assert.equal(indikator.id, "seni-kustom");
  assert.equal(indikator.pilar.flatMap((pilar) => pilar.variabel).length, 6);
  assert.deepEqual(indikator.pilar[0].variabel[0].persyaratanBuktiDukung, [
    { id: "bukti-kustom", nama: "Bukti hasil pengaturan Kurator" },
  ]);
});

test("migrasi dan snapshot mempertahankan bobot sumber pilar", () => {
  const matrix = {
    indikator: [
      {
        id: "seni-lain",
        nama: "Seni Lain",
        bobot: 70,
        tipe: "seni",
        pilar: [
          {
            id: "pilar-lain",
            nama: "Pilar Lain",
            bobot: 100,
            bobotSumber: 70,
            variabel: [{ id: "variabel-lain", nama: "Variabel", bobot: 100 }],
          },
        ],
      },
    ],
    updatedAt: 123,
  };

  const migrated = migrateMatrix(matrix);
  const snapshot = createKurasiMatrixSnapshot(matrix);

  assert.equal(migrated.indikator[0].pilar[0].bobotSumber, 70);
  assert.equal(snapshot.indikator[0].pilar[0].bobotSumber, 70);
  assert.notStrictEqual(
    snapshot.indikator[0].pilar[0],
    matrix.indikator[0].pilar[0],
  );
});
