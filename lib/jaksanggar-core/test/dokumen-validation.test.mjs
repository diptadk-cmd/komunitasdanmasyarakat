import assert from "node:assert/strict";
import test from "node:test";

import {
  ringkasFieldKosong,
  validasiIsianDokumen,
} from "../src/dokumen-validation.ts";

const fields = [
  { key: "nomor", label: "Nomor surat" },
  { key: "tujuan", label: "Tujuan" },
  { key: "agenda", label: "Agenda" },
];

test("tanggal harus ada di kalender dan nama hari harus sesuai", () => {
  const fields = [{ key: "tanggal", label: "Tanggal", jenis: "tanggal" }];
  for (const tanggal of [
    "31 Februari 2026",
    "2026-13-01",
    "29 Februari 2025",
    "20 BulanSalah 2026",
    "Senin, 20 Agustus 2026",
  ]) {
    assert.equal(
      validasiIsianDokumen(fields, { tanggal }).lengkap,
      false,
      tanggal,
    );
  }
  for (const tanggal of [
    "29 Februari 2024",
    "2026-08-20",
    "20/08/2026",
    "Kamis, 20 Agustus 2026",
  ]) {
    assert.equal(
      validasiIsianDokumen(fields, { tanggal }).lengkap,
      true,
      tanggal,
    );
  }
});

test("validasi dokumen menolak nilai kosong dan spasi", () => {
  const result = validasiIsianDokumen(fields, {
    nomor: "001/UND/VIII/2026",
    tujuan: "   ",
  });

  assert.equal(result.lengkap, false);
  assert.equal(result.terisi, 1);
  assert.equal(result.total, 3);
  assert.equal(result.persentase, 33);
  assert.deepEqual(
    result.fieldKosong.map((field) => field.key),
    ["tujuan", "agenda"],
  );
});

test("validasi dokumen menerima semua nilai wajib yang terisi", () => {
  const result = validasiIsianDokumen(fields, {
    nomor: "001/UND/VIII/2026",
    tujuan: "Seluruh anggota",
    agenda: "Rapat persiapan pentas",
  });

  assert.equal(result.lengkap, true);
  assert.equal(result.terisi, 3);
  assert.equal(result.persentase, 100);
  assert.deepEqual(result.fieldKosong, []);
});

test("ringkasan field kosong membatasi daftar yang ditampilkan", () => {
  assert.equal(
    ringkasFieldKosong(fields, 2),
    "Nomor surat, Tujuan, dan 1 lainnya",
  );
});

test("validasi dokumen menolak tanda strip dan format administratif yang salah", () => {
  const result = validasiIsianDokumen(
    [
      { key: "nik", label: "NIK", jenis: "nik" },
      { key: "email", label: "Email", jenis: "email" },
      { key: "tanggal", label: "Tanggal", jenis: "tanggal" },
    ],
    { nik: "-", email: "bukan-email", tanggal: "20 Agustus 2026" },
  );

  assert.equal(result.lengkap, false);
  assert.equal(result.terisi, 1);
  assert.deepEqual(
    result.fieldTidakValid.map((field) => field.key),
    ["nik", "email"],
  );
});

test("validasi dokumen menerima NIK, email, telepon, dan tanggal yang benar", () => {
  const result = validasiIsianDokumen(
    [
      { key: "nik", label: "NIK", jenis: "nik" },
      { key: "email", label: "Email", jenis: "email" },
      { key: "telepon", label: "Telepon", jenis: "telepon" },
      { key: "tanggal", label: "Tanggal", jenis: "tanggal" },
    ],
    {
      nik: "3171234567890123",
      email: "sanggar@example.id",
      telepon: "+62 812-3456-7890",
      tanggal: "20 Agustus 2026",
    },
  );

  assert.equal(result.lengkap, true);
  assert.deepEqual(result.fieldBermasalah, []);
});
