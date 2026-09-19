import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const baca = async (relativePath) =>
  readFile(new URL(relativePath, import.meta.url), "utf8");

test("dokumen profil mengikuti struktur template Word yang diberikan", async () => {
  const source = await baca("../src/lib/profil-dokumen.ts");
  assert.match(source, /profil-dokumen__header/);
  assert.match(source, /profil-dokumen__logo/);
  assert.match(source, /profil-dokumen__rule-green/);
  assert.match(source, /profil-dokumen__rule-red/);
  assert.match(source, /Identitas|sections/);
  assert.match(source, /profil-dokumen__signature/);
  assert.match(source, /Halaman \{page\} dari \{pages\}/);
  assert.match(source, /fontFamily: "Arial/);
  assert.match(source, /pageMarginsMm/);
  assert.match(source, /data:image\\\//);
});

test("seluruh halaman profil akun menyediakan Word dan PDF", async () => {
  const sources = await Promise.all([
    baca("../src/pages/sanggar/Profile.tsx"),
    baca("../src/pages/juri/Profile.tsx"),
    baca("../src/pages/shared/AnggotaProfile.tsx"),
    baca("../src/pages/pengrajin/PengrajinHome.tsx"),
    baca("../src/pages/mitra-pengrajin/MitraPengrajinHome.tsx"),
  ]);
  for (const source of sources) {
    assert.match(source, /unduhProfilDokumen/);
    assert.match(source, /button-download-word/);
    assert.match(source, /button-download-pdf/);
    assert.match(source, />Unduh Word</);
    assert.match(source, />Unduh PDF</);
    assert.doesNotMatch(source, /Preview PDF/);
  }
});

test("exporter mendukung margin, font, footer, dan total halaman khusus profil", async () => {
  const source = await baca("../src/lib/dokumen-export.ts");
  assert.match(source, /pageMarginsMm/);
  assert.match(source, /fontFamily/);
  assert.match(source, /NUMPAGES/);
  assert.match(source, /\{pages\}/);
  assert.match(source, /HelveticaOblique/);
});
