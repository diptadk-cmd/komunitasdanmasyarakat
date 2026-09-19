import assert from "node:assert/strict";
import test from "node:test";

import {
  OFFICIAL_DKI_DISTRICTS,
  OFFICIAL_DKI_REGENCIES,
  OFFICIAL_DKI_VILLAGES,
} from "../src/lib/dki-regions.ts";

test("Jakarta Barat dan Jakarta Utara memakai kecamatan yang benar", () => {
  const cityNames = Object.fromEntries(
    OFFICIAL_DKI_REGENCIES.map((city) => [city.id, city.name]),
  );
  assert.equal(cityNames["3174"], "KOTA JAKARTA BARAT");
  assert.equal(cityNames["3175"], "KOTA JAKARTA UTARA");

  const west = OFFICIAL_DKI_DISTRICTS["3174"].map((item) => item.name);
  const north = OFFICIAL_DKI_DISTRICTS["3175"].map((item) => item.name);
  assert.ok(west.includes("CENGKARENG"));
  assert.ok(west.includes("KEMBANGAN"));
  assert.ok(!west.includes("CILINCING"));
  assert.ok(north.includes("CILINCING"));
  assert.ok(north.includes("TANJUNG PRIOK"));
  assert.ok(!north.includes("CENGKARENG"));
});

test("kode kecamatan dan kelurahan konsisten dengan induknya", () => {
  for (const city of OFFICIAL_DKI_REGENCIES) {
    const districts = OFFICIAL_DKI_DISTRICTS[city.id] ?? [];
    assert.ok(districts.length > 0, `${city.name} tidak memiliki kecamatan`);
    for (const district of districts) {
      assert.ok(district.id.startsWith(city.id));
      const villages = OFFICIAL_DKI_VILLAGES[district.id] ?? [];
      assert.ok(
        villages.length > 0,
        `${district.name} tidak memiliki kelurahan`,
      );
      for (const village of villages) {
        assert.ok(village.id.startsWith(district.id));
      }
    }
  }
});
