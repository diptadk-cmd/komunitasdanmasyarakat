import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeAlamatFromReverse,
  normalizeWilayahFromReverse,
} from "../src/lib/reverse-geocode.ts";

test("mengisi nama jalan dan seluruh tingkat wilayah dari hasil lengkap", () => {
  const hasil = normalizeAlamatFromReverse({
    display_name:
      "21, Jalan Jenderal Sudirman, RW 03, Karet Semanggi, Setiabudi, Jakarta Selatan, Daerah Khusus Ibukota Jakarta, 12930, Indonesia",
    address: {
      house_number: "21",
      road: "Jalan Jenderal Sudirman",
      city_block: "RW 03",
      village: "Karet Semanggi",
      suburb: "Setiabudi",
      city: "Jakarta Selatan",
      state: "Daerah Khusus Ibukota Jakarta",
      postcode: "12930",
      country: "Indonesia",
    },
  });

  assert.deepEqual(hasil.wilayah, {
    provinsi: "DKI JAKARTA",
    kota: "Jakarta Selatan",
    kecamatan: "Setiabudi",
    kelurahan: "Karet Semanggi",
    kodePos: "12930",
  });
  assert.equal(
    hasil.alamatDetail,
    "Jalan Jenderal Sudirman No. 21, RW 03",
  );
});

test("mengambil kecamatan dari display_name ketika Nominatim tidak memberi labelnya", () => {
  const hasil = normalizeAlamatFromReverse({
    name: "Jalan Melawai V",
    display_name:
      "Jalan Melawai V, RW 01, Melawai, Kebayoran Baru, Jakarta Selatan, Daerah Khusus Ibukota Jakarta, 12160, Indonesia",
    address: {
      road: "Jalan Melawai V",
      city_block: "RW 01",
      village: "Melawai",
      city: "Jakarta Selatan",
      "ISO3166-2-lvl4": "ID-JK",
      postcode: "12160",
      country: "Indonesia",
      country_code: "id",
    },
  });

  assert.equal(hasil.wilayah.kecamatan, "Kebayoran Baru");
  assert.equal(hasil.wilayah.kelurahan, "Melawai");
  assert.equal(hasil.alamatDetail, "Jalan Melawai V, RW 01");
});

test("tetap mendukung normalisasi objek address tanpa pembungkus respons", () => {
  assert.deepEqual(
    normalizeWilayahFromReverse({
      road: "Jalan Asia Afrika",
      village: "Braga",
      district: "Sumur Bandung",
      city: "Kota Bandung",
      state: "Jawa Barat",
      postcode: "40111",
    }),
    {
      provinsi: "Jawa Barat",
      kota: "Kota Bandung",
      kecamatan: "Sumur Bandung",
      kelurahan: "Braga",
      kodePos: "40111",
    },
  );
});
