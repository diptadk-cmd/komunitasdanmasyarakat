import assert from "node:assert/strict";
import test from "node:test";
import {
  fieldValidasiStandar,
  validasiFormDokumen,
  nipDokumen,
} from "../src/lib/dokumen-form.ts";

const profile = {
  namaSanggar: "Sanggar Uji",
  namaKetua: "Ketua Uji",
  alamat: "Alamat Uji",
};

test("ketentuan tambahan opsional boleh dikosongkan tanpa menghalangi unduhan", () => {
  const fields = [
    { key: "catatanTambahan", label: "Ketentuan Tambahan", opsional: true },
  ];
  assert.equal(validasiFormDokumen(fields, {}, profile).lengkap, true);
  assert.equal(
    validasiFormDokumen(
      [{ key: "nomor", label: "Nomor Surat" }, ...fields],
      {},
      profile,
    ).lengkap,
    false,
  );
});

test("nomor dan tanggal akta menerima teks rujukan lengkap", () => {
  const fields = [
    { key: "aktaNotaris", label: "Nomor & Tanggal Akta Notaris" },
    { key: "aktaUsaha", label: "Nomor & Tanggal Akta Pendirian Usaha" },
  ];
  const result = validasiFormDokumen(
    fields,
    {
      aktaNotaris: "No. 12 tanggal 5 Januari 2020, Notaris Contoh",
      aktaUsaha: "No. 7 tanggal 12 Maret 2021, Notaris Contoh",
    },
    profile,
  );
  assert.equal(result.lengkap, true);
  assert.equal(
    fieldValidasiStandar({ key: "hariTanggal", label: "Hari / Tanggal" }).jenis,
    "tanggal",
  );
});

test("form surat yang terisi tidak meloloskan profil kosong atau tanda strip", () => {
  const result = validasiFormDokumen(
    [{ key: "nomor", label: "Nomor Surat" }],
    { nomor: "001/UJI/2026" },
    {
      namaSanggar: "Sanggar Uji",
      namaKetua: "-",
      alamat: "  ",
    },
  );
  assert.equal(result.lengkap, false);
  assert.deepEqual(result.fieldBermasalah.map((f) => f.key).sort(), [
    "__profil_alamat",
    "__profil_namaKetua",
  ]);
});

test("NIP profil konsisten dengan formulir dan pengosongan eksplisit dihormati", () => {
  assert.equal(nipDokumen({}, "123456"), "123456");
  assert.equal(nipDokumen({ __nip_override: "" }, "123456"), undefined);
  assert.equal(nipDokumen({ __nip_override: " 654321 " }, "123456"), "654321");
});
