import assert from "node:assert/strict";
import test from "node:test";

import {
  REFERENSI_EKSPEDISI,
  ekspedisiUntukMetode,
} from "../src/lib/pengiriman.ts";

test("daftar pengiriman memiliki penyedia utama dan tautan cek ongkir resmi", () => {
  const wajibAda = [
    "GoSend (Gojek)",
    "GrabExpress",
    "Lalamove",
    "Deliveree",
    "Paxel",
    "JNE",
    "J&T Express",
    "SiCepat",
    "AnterAja",
    "Ninja Xpress",
    "TIKI",
    "Pos Indonesia",
    "Lion Parcel",
  ];

  for (const nama of wajibAda) {
    const penyedia = REFERENSI_EKSPEDISI.find((item) => item.nama === nama);
    assert.ok(penyedia, `${nama} harus tersedia`);
    assert.equal(new URL(penyedia.cekOngkirUrl).protocol, "https:");
  }
});

test("penyedia disaring sesuai metode pengiriman", () => {
  assert.deepEqual(
    ekspedisiUntukMetode("instant").map((item) => item.id),
    ["gosend", "grabexpress", "lalamove", "deliveree"],
  );
  assert.ok(
    ekspedisiUntukMetode("kurir_paket").some(
      (item) => item.id === "grabexpress",
    ),
  );
  assert.ok(
    ekspedisiUntukMetode("kurir_paket").some((item) => item.id === "gosend"),
  );
  assert.deepEqual(
    ekspedisiUntukMetode("kurir_toko").map((item) => item.id),
    ["toko"],
  );
});
