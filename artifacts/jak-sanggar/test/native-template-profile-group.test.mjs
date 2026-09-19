import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { pilihGrupProfil } from "../public/assets/native-ui-20260914-v3.mjs";

const catalog = JSON.parse(await readFile(new URL("../public/dokumen-fix/catalog.json", import.meta.url), "utf8"));

test("profil PT lama yang tercatat sebagai badan usaha tetap memilih template PT", () => {
  assert.equal(pilihGrupProfil(catalog, { bentukKedudukan: "mandiri-bu", legalitas: "PT" }).id, "mandiri-berbadan-hukum-perseroan-terbatas");
  assert.equal(pilihGrupProfil(catalog, { bentukKedudukan: "unit-bu", legalitas: "PT" }).id, "unit-badan-hukum-perseroan-terbatas");
});

test("enam bentuk kedudukan memilih kategori yang sesuai profil", () => {
  for (const [bentukKedudukan, legalitas, expected] of [
    ["mandiri-non-bh", "Yayasan", "mandiri-nonbadan-hukum"],
    ["unit-non-bh", "Yayasan", "unit-nonbadan-hukum"],
    ["mandiri-bh", "Yayasan", "mandiri-berbadan-hukum-yayasan"],
    ["unit-bh", "Koperasi", "unit-badan-hukum-koperasi"],
    ["mandiri-bu", "CV", "mandiri-badan-usaha-persekutuan-komanditer"],
    ["unit-bu", "Firma (FA)", "unit-badan-usaha-firma"],
  ]) {
    assert.equal(pilihGrupProfil(catalog, { bentukKedudukan, legalitas }).id, expected);
  }
});

test("subgrup badan yang dikenal mengikuti legalitas untuk mandiri dan unit", () => {
  for (const [legalitas, suffix, badan] of [
    ["Yayasan", "yayasan", "hukum"],
    ["Perkumpulan / Perserikatan", "perkumpulan", "hukum"],
    ["Koperasi", "koperasi", "hukum"],
    ["PT", "perseroan-terbatas", "hukum"],
    ["PT Perorangan", "perseroan-terbatas", "hukum"],
    ["CV", "persekutuan-komanditer", "usaha"],
    ["Firma (FA)", "firma", "usaha"],
  ]) {
    const jenis = badan === "hukum" ? "bh" : "bu";
    const mandiri = badan === "hukum" ? "mandiri-berbadan-hukum" : "mandiri-badan-usaha";
    assert.equal(pilihGrupProfil(catalog, { bentukKedudukan: `mandiri-${jenis}`, legalitas }).id, `${mandiri}-${suffix}`);
    assert.equal(pilihGrupProfil(catalog, { bentukKedudukan: `unit-${jenis}`, legalitas }).id, `unit-badan-${badan}-${suffix}`);
    assert.equal(pilihGrupProfil(catalog, { legalitas }).id, `${mandiri}-${suffix}`);
  }
});

test("profil kosong atau tidak dikenal memilih nonbadan hukum, bukan entri pertama Firma", () => {
  assert.equal(catalog.groups[0].id, "mandiri-badan-usaha-firma");
  for (const profile of [undefined, null, {}, { bentukKedudukan: "tidak-dikenal", legalitas: "Lainnya" }]) {
    assert.equal(pilihGrupProfil(catalog, profile).id, "mandiri-nonbadan-hukum");
  }
  assert.equal(pilihGrupProfil({ groups: [] }, {})?.id, undefined);
});

test("pilihan bentuk eksplisit tetap mengendalikan kategori saat subgrup tidak cocok", () => {
  const group = pilihGrupProfil(catalog, { bentukKedudukan: "unit-bh", legalitas: "CV" });
  assert.equal(group.category, "Unit Badan Hukum");
});
