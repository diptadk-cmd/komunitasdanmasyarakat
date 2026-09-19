import assert from "node:assert/strict";
import test from "node:test";

import { tempatTandaTanganDariProvinsi } from "../src/lib/lokasi-dokumen.ts";

test("tempat tanda tangan menormalisasi provinsi Jakarta", () => {
  assert.equal(tempatTandaTanganDariProvinsi("DKI Jakarta"), "Jakarta");
  assert.equal(
    tempatTandaTanganDariProvinsi(undefined, "Jl. Mitra Jakarta No. 2"),
    "Jakarta",
  );
  assert.equal(
    tempatTandaTanganDariProvinsi(undefined, "Jakarta Selatan"),
    "Jakarta",
  );
});

test("tempat tanda tangan memakai provinsi terstruktur atau nama provinsi dalam alamat", () => {
  assert.equal(tempatTandaTanganDariProvinsi("Provinsi Jawa Barat"), "Jawa Barat");
  assert.equal(
    tempatTandaTanganDariProvinsi(undefined, "Kota Bandung, Jawa Barat"),
    "Jawa Barat",
  );
  assert.equal(
    tempatTandaTanganDariProvinsi(undefined, "Tanjung Pinang, Kepulauan Riau"),
    "Kepulauan Riau",
  );
});
