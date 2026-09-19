import assert from "node:assert/strict";
import test from "node:test";
import { defaults } from "../public/assets/native-ui-20260914-v3.mjs";

test("alias nama, alamat, dan kontak native memakai identitas profil yang sama", () => {
  const value = defaults({
    namaSanggar: " Sanggar Uji ", alamat: "Alamat Sanggar", whatsapp: "081234567890",
    email: "uji@example.com", instagram: "@sanggaruji", website: "https://example.com",
  });
  assert.equal(value.NAM_SA2, "Sanggar Uji");
  assert.equal(value.NAM_SANGGAR, value.NAM_SA2);
  assert.equal(value.NAMA_SANGGAR, value.NAM_SA2);
  assert.equal(value.ALA_LE2, value.ALAMAT);
  assert.equal(value.TEL_SAN, value.TELEPON);
  assert.equal(value.MED_SOS, "@sanggaruji · https://example.com");
});

test("nama badan tidak menggandakan bentuk badan yang sudah tercetak pada template", () => {
  const value = defaults({ namaBadanHukum: "Yayasan Budaya Betawi Merah" });
  assert.equal(`Yayasan ${value.NAM_BA2}`, "Yayasan Budaya Betawi Merah");
  assert.equal(value.NAM_PE3, "Yayasan Budaya Betawi Merah");
  assert.equal(defaults({ namaBadanHukum: "CV. Kembang Setaman" }).NAM_BA2, "Kembang Setaman");
  assert.equal(defaults({ namaBadanHukum: "Budaya Nusantara" }).NAM_BA2, "Budaya Nusantara");
});

test("identitas induk, penandatangan, dan tanggal tidak direka dari nama atau tahun sanggar", () => {
  const value = defaults({ namaSanggar: "Sanggar Uji", namaKetua: "Ketua Uji", tahunBerdiri: 2015 });
  for (const key of ["NAM_IN2", "NAM_PEN", "NAM_TTD_", "TGL_BER", "TGL_FOR", "TAN"]) {
    assert.equal(value[key], undefined);
  }
  assert.equal(value.NAM_PE3, "");
});
