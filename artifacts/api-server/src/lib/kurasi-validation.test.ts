import assert from "node:assert/strict";
import test from "node:test";

import {
  hasKurasiScoringActivity,
  isKurasiFinalizedForJuri,
  sanitizeKurasiMatrixSetting,
  sanitizeKurasiMatrixSnapshot,
  validateAndAggregateKurasiScores,
} from "./kurasi-validation";

function matrixInput(): Record<string, any> {
  return {
    indikator: [
      {
        id: "indikator-1",
        nama: " Indikator ",
        bobot: 100,
        tipe: "manajemen",
        pilar: [
          {
            id: "pilar-1",
            nama: "Pilar",
            bobot: 100,
            variabel: [
              {
                id: "variabel-1",
                nama: "Variabel Satu",
                bobot: 50,
                bobotSumber: 50,
                patokanNilai: [
                  {
                    id: "variabel-kurang",
                    nilai: 2.5,
                    nama: "Kurang",
                    persentaseBobot: 25,
                  },
                  {
                    id: "variabel-baik",
                    nilai: 7.5,
                    nama: "Baik",
                    persentaseBobot: 75,
                  },
                ],
                persyaratanBuktiDukung: [
                  {
                    id: "bukti-1",
                    nama: "Surat keterangan",
                    patokanNilai: [
                      {
                        id: "bukti-tidak-ada",
                        nilai: 0,
                        nama: "Tidak ada",
                        persentaseBobot: 0,
                      },
                      {
                        id: "bukti-sesuai",
                        nilai: 10,
                        nama: "Sesuai",
                        persentaseBobot: 100,
                      },
                    ],
                  },
                  { id: "bukti-2", nama: "Foto kegiatan" },
                ],
                contoh: {
                  name: "rahasia.pdf",
                  dataUrl: "data:application/pdf;base64,AAAA",
                  size: 4,
                },
                unexpected: "tidak boleh tersimpan",
              },
              {
                id: "variabel-2",
                nama: "Variabel Dua",
                bobot: 50,
                bobotSumber: 50,
                persyaratanBuktiDukung: [],
              },
            ],
          },
        ],
      },
    ],
    patokanNilai: [
      { id: "nilai-2", nilai: 2, nama: "Kurang", persentaseBobot: 20 },
      { id: "nilai-7", nilai: 7, nama: "Baik", persentaseBobot: 70 },
    ],
    updatedAt: 123,
    unexpected: { admin: true },
  };
}

test("setting disanitasi dan snapshot membuang contoh berkas", () => {
  const setting = sanitizeKurasiMatrixSetting(matrixInput());
  assert.ok(setting);
  assert.equal(setting.indikator[0].nama, "Indikator");
  assert.equal(
    setting.indikator[0].pilar[0].variabel[0].contoh?.dataUrl,
    "data:application/pdf;base64,AAAA",
  );
  assert.equal("unexpected" in setting, false);
  assert.equal(
    "unexpected" in setting.indikator[0].pilar[0].variabel[0],
    false,
  );

  const snapshot = sanitizeKurasiMatrixSnapshot(setting);
  assert.ok(snapshot);
  assert.equal("contoh" in snapshot.indikator[0].pilar[0].variabel[0], false);
  assert.deepEqual(
    snapshot.indikator[0].pilar[0].variabel[0].persyaratanBuktiDukung?.[0]
      ?.patokanNilai,
    [
      {
        id: "bukti-tidak-ada",
        nilai: 0,
        nama: "Tidak ada",
        persentaseBobot: 0,
      },
      {
        id: "bukti-sesuai",
        nilai: 10,
        nama: "Sesuai",
        persentaseBobot: 100,
      },
    ],
  );
});

test("setting ketat menolak bobot sumber dan metadata penilaian yang rusak", () => {
  const sourcePillar = matrixInput();
  sourcePillar.indikator[0].pilar[0].bobotSumber = 100;
  const sanitizedSourcePillar = sanitizeKurasiMatrixSetting(sourcePillar);
  assert.ok(sanitizedSourcePillar);
  assert.equal(sanitizedSourcePillar.indikator[0].pilar[0].bobotSumber, 100);

  const wrongSourcePillarTotal = matrixInput();
  wrongSourcePillarTotal.indikator[0].pilar[0].bobotSumber = 90;
  assert.equal(sanitizeKurasiMatrixSetting(wrongSourcePillarTotal), null);

  const wrongSourceTotal = matrixInput();
  wrongSourceTotal.indikator[0].pilar[0].variabel[0].bobotSumber = 40;
  assert.equal(sanitizeKurasiMatrixSetting(wrongSourceTotal), null);

  const malformedPredikat = matrixInput();
  malformedPredikat.predikat = [null];
  assert.equal(sanitizeKurasiMatrixSetting(malformedPredikat), null);

  const emptyTargetPatokan = matrixInput();
  emptyTargetPatokan.indikator[0].pilar[0].variabel[0].persyaratanBuktiDukung[0].patokanNilai =
    [];
  assert.equal(sanitizeKurasiMatrixSetting(emptyTargetPatokan), null);

  const duplicateTargetPatokan = matrixInput();
  duplicateTargetPatokan.indikator[0].pilar[0].variabel[0].persyaratanBuktiDukung[0].patokanNilai.push(
    {
      id: "duplikat",
      nilai: 10,
      nama: "Duplikat",
      persentaseBobot: 100,
    },
  );
  assert.equal(sanitizeKurasiMatrixSetting(duplicateTargetPatokan), null);
});

test("setting mempertahankan bobot sumber Seni 70% yang dinormalisasi internal", () => {
  const source70 = matrixInput();
  source70.indikator[0].tipe = "seni";
  source70.indikator[0].bobot = 70;
  source70.indikator[0].pilar[0].bobotSumber = 70;
  source70.indikator[0].pilar[0].variabel[0].bobotSumber = 35;
  source70.indikator[0].pilar[0].variabel[1].bobotSumber = 35;
  source70.indikator.push({
    id: "indikator-manajemen",
    nama: "Manajemen Sanggar",
    bobot: 30,
    tipe: "manajemen",
    pilar: [
      {
        id: "pilar-manajemen",
        nama: "Manajemen",
        bobot: 100,
        variabel: [
          {
            id: "variabel-manajemen",
            nama: "Kelengkapan",
            bobot: 100,
            bobotSumber: 100,
          },
        ],
      },
    ],
  });

  const sanitized = sanitizeKurasiMatrixSetting(source70);
  assert.ok(sanitized);
  assert.equal(sanitized.indikator[0].pilar[0].bobot, 100);
  assert.equal(sanitized.indikator[0].pilar[0].bobotSumber, 70);
  assert.deepEqual(
    sanitized.indikator[0].pilar[0].variabel.map((item) => item.bobotSumber),
    [35, 35],
  );
});

test("draft merata-ratakan semua persyaratan dan yang belum diisi bernilai nol", () => {
  const matrix = sanitizeKurasiMatrixSnapshot(matrixInput());
  assert.ok(matrix);

  const result = validateAndAggregateKurasiScores({
    // Nilai agregat kiriman untuk variabel berbukti tidak dipercaya; API
    // selalu menghitungnya kembali dari requirementScores.
    scores: { "variabel-1": 999, "variabel-2": 70 },
    requirementScores: { "variabel-1": { "bukti-1": 100 } },
    matrix,
    finalize: false,
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.requirementScores, {
    "variabel-1": { "bukti-1": 100 },
  });
  assert.equal(result.scores["variabel-1"], 50);
  assert.equal(result.scores["variabel-2"], 70);

  const missingDirect = validateAndAggregateKurasiScores({
    scores: {},
    requirementScores: { "variabel-1": { "bukti-1": 100 } },
    matrix,
    finalize: false,
  });
  assert.equal(missingDirect.ok, true);
  if (!missingDirect.ok) return;
  assert.equal(missingDirect.scores["variabel-1"], 50);
  assert.equal(Object.hasOwn(missingDirect.scores, "variabel-2"), false);
});

test("draft kosong tetap kosong dan agregat draft lama dipertahankan", () => {
  const matrix = sanitizeKurasiMatrixSnapshot(matrixInput());
  assert.ok(matrix);

  const untouched = validateAndAggregateKurasiScores({
    scores: {},
    requirementScores: {},
    matrix,
    finalize: false,
  });
  assert.deepEqual(untouched, {
    ok: true,
    scores: {},
    requirementScores: {},
  });
  assert.equal(
    hasKurasiScoringActivity({
      scores: { juri: untouched.ok ? untouched.scores : {} },
      requirementScores: {
        juri: untouched.ok ? untouched.requirementScores : {},
      },
      finalized: {},
    }),
    false,
  );

  const legacyDraft = validateAndAggregateKurasiScores({
    scores: { "variabel-1": 43.25 },
    requirementScores: {},
    matrix,
    finalize: false,
  });
  assert.equal(legacyDraft.ok, true);
  if (!legacyDraft.ok) return;
  assert.deepEqual(legacyDraft.scores, { "variabel-1": 43.25 });
  assert.deepEqual(legacyDraft.requirementScores, {});

  const brokenLegacyDraft = validateAndAggregateKurasiScores({
    scores: { "variabel-1": 101 },
    requirementScores: {},
    matrix,
    finalize: false,
  });
  assert.equal(brokenLegacyDraft.ok, false);
  if (!brokenLegacyDraft.ok) {
    assert.match(brokenLegacyDraft.error, /agregat lama/i);
  }
});

test("final wajib mengisi setiap bukti dan target variabel tanpa bukti", () => {
  const matrix = sanitizeKurasiMatrixSnapshot(matrixInput());
  assert.ok(matrix);

  const missingRequirement = validateAndAggregateKurasiScores({
    scores: { "variabel-2": 70 },
    requirementScores: { "variabel-1": { "bukti-1": 100 } },
    matrix,
    finalize: true,
  });
  assert.equal(missingRequirement.ok, false);
  if (!missingRequirement.ok) {
    assert.match(missingRequirement.error, /seluruh persyaratan/i);
  }

  const missingDirectTarget = validateAndAggregateKurasiScores({
    scores: {},
    requirementScores: {
      "variabel-1": { "bukti-1": 100, "bukti-2": 75 },
    },
    matrix,
    finalize: true,
  });
  assert.equal(missingDirectTarget.ok, false);
  if (!missingDirectTarget.ok) {
    assert.match(missingDirectTarget.error, /variabel tanpa persyaratan/i);
  }

  const complete = validateAndAggregateKurasiScores({
    scores: { "variabel-1": 0, "variabel-2": 20 },
    requirementScores: {
      "variabel-1": { "bukti-1": 100, "bukti-2": 75 },
    },
    matrix,
    finalize: true,
  });
  assert.equal(complete.ok, true);
  if (!complete.ok) return;
  assert.equal(complete.scores["variabel-1"], 87.5);
  assert.equal(complete.scores["variabel-2"], 20);
});

test("setiap target memakai patokan khusus lalu fallback variabel dan matriks", () => {
  const matrix = sanitizeKurasiMatrixSnapshot(matrixInput());
  assert.ok(matrix);

  const wrongRequirementFallback = validateAndAggregateKurasiScores({
    scores: { "variabel-2": 70 },
    requirementScores: {
      "variabel-1": { "bukti-1": 100, "bukti-2": 70 },
    },
    matrix,
    finalize: false,
  });
  assert.equal(wrongRequirementFallback.ok, false);
  if (!wrongRequirementFallback.ok) {
    assert.match(wrongRequirementFallback.error, /Foto kegiatan/i);
  }

  const wrongMatrixFallback = validateAndAggregateKurasiScores({
    scores: { "variabel-2": 75 },
    requirementScores: {},
    matrix,
    finalize: false,
  });
  assert.equal(wrongMatrixFallback.ok, false);
  if (!wrongMatrixFallback.ok) {
    assert.match(wrongMatrixFallback.error, /Variabel Dua/i);
  }
});

test("ID variabel dan persyaratan asing serta rincian pada variabel biasa ditolak", () => {
  const matrix = sanitizeKurasiMatrixSnapshot(matrixInput());
  assert.ok(matrix);

  for (const input of [
    {
      scores: { "variabel-lain": 20 },
      requirementScores: {},
      pattern: /variabel penilaian tidak dikenal/i,
    },
    {
      scores: {},
      requirementScores: { "variabel-lain": {} },
      pattern: /variabel persyaratan tidak dikenal/i,
    },
    {
      scores: {},
      requirementScores: { "variabel-1": { "bukti-lain": 100 } },
      pattern: /persyaratan penilaian tidak dikenal/i,
    },
    {
      scores: {},
      requirementScores: { "variabel-2": {} },
      pattern: /tidak memiliki persyaratan/i,
    },
  ]) {
    const result = validateAndAggregateKurasiScores({
      scores: input.scores,
      requirementScores: input.requirementScores,
      matrix,
      finalize: false,
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.error, input.pattern);
  }
});

test("snapshot lama satu teks dimigrasikan menjadi target stabil saat dinilai", () => {
  const input = matrixInput();
  const variable = input.indikator[0].pilar[0].variabel[0];
  delete variable.persyaratanBuktiDukung;
  delete variable.patokanNilai;
  variable.persyaratanDataDukung = "Bukti lama";
  delete input.patokanNilai;
  const matrix = sanitizeKurasiMatrixSnapshot(input);
  assert.ok(matrix);

  const result = validateAndAggregateKurasiScores({
    scores: { "variabel-2": 100 },
    requirementScores: {
      "variabel-1": { "persyaratan-variabel-1-1": 50 },
    },
    matrix,
    finalize: true,
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.scores["variabel-1"], 50);
  assert.equal(result.scores["variabel-2"], 100);
});

test("aktivitas skor membekukan snapshot dan marker final lama tetap dikenali", () => {
  assert.equal(
    hasKurasiScoringActivity({
      scores: { juri: {} },
      requirementScores: { juri: {} },
      finalized: {},
    }),
    false,
  );
  assert.equal(
    hasKurasiScoringActivity({
      requirementScores: { juri: { variabel: { bukti: 0 } } },
    }),
    true,
  );
  assert.equal(
    hasKurasiScoringActivity({ scores: { juri: { variabel: 70 } } }),
    true,
  );
  assert.equal(hasKurasiScoringActivity({ finalized: true }), true);
  assert.equal(hasKurasiScoringActivity({ finalized: { lama: 0 } }), true);

  assert.equal(isKurasiFinalizedForJuri(true, "juri"), true);
  assert.equal(
    isKurasiFinalizedForJuri({ juri: 123, lain: 456 }, "juri"),
    true,
  );
  assert.equal(isKurasiFinalizedForJuri({ lain: 456 }, "juri"), false);
});
