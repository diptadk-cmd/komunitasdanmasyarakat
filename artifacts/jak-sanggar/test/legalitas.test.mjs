import assert from "node:assert/strict";
import test from "node:test";

import {
  getBentukUsahaOptions,
  getDefaultLegalitas,
  LEGALITAS_OPTIONS_BY_AKTA,
} from "../src/lib/legalitas.ts";

test("jenis organisasi dipisahkan menurut status akta notaris", () => {
  const berakta = LEGALITAS_OPTIONS_BY_AKTA["Berakta Notaris"].map(
    (item) => item.value,
  );
  const tidakBerakta = LEGALITAS_OPTIONS_BY_AKTA[
    "Tidak Berakta Notaris"
  ].map((item) => item.value);

  assert.ok(berakta.includes("Yayasan"));
  assert.ok(berakta.includes("Perkumpulan / Perserikatan"));
  assert.ok(berakta.includes("Koperasi"));
  assert.ok(berakta.includes("PT"));
  assert.ok(berakta.includes("CV"));
  assert.ok(!berakta.includes("PT Perorangan"));
  assert.ok(!berakta.includes("BUMDes / BUMDes Bersama"));

  assert.ok(tidakBerakta.includes("Sanggar / Padepokan / Kelompok Seni"));
  assert.ok(tidakBerakta.includes("Komunitas"));
  assert.ok(tidakBerakta.includes("Paguyuban"));
  assert.ok(tidakBerakta.includes("PT Perorangan"));
  assert.ok(tidakBerakta.includes("BUMDes / BUMDes Bersama"));
});

test("setiap jenis organisasi hanya muncul pada satu kelompok akta", () => {
  const allValues = Object.values(LEGALITAS_OPTIONS_BY_AKTA)
    .flat()
    .map((item) => item.value);
  assert.equal(new Set(allValues).size, allValues.length);
});

test("usaha perorangan hanya tersedia pada kelompok tidak berakta", () => {
  const berakta = getBentukUsahaOptions("Berakta Notaris").map(
    (item) => item.value,
  );
  const tidakBerakta = getBentukUsahaOptions("Tidak Berakta Notaris").map(
    (item) => item.value,
  );

  assert.ok(!berakta.includes("Perorangan"));
  assert.equal(tidakBerakta[0], "Perorangan");
  assert.equal(getDefaultLegalitas("Berakta Notaris"), "Yayasan");
  assert.equal(
    getDefaultLegalitas("Tidak Berakta Notaris"),
    "Sanggar / Padepokan / Kelompok Seni",
  );
});
