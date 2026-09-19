import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const baca = async (relativePath) =>
  readFile(new URL(relativePath, import.meta.url), "utf8");

test("generator dokumen menyediakan Blob DOCX/PDF asli dan batas dokumen", async () => {
  const source = await baca("../src/lib/dokumen-export.ts");
  assert.match(source, /export async function buatBlobDokumenWord/);
  assert.match(source, /type: "application\/pdf"/);
  assert.match(source, /application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document/);
  assert.match(source, /data-dokumen-boundary/);
  assert.match(source, /data-dokumen-lampiran/);
  assert.doesNotMatch(source, /download\s*=\s*[^;]*\.html/);
});

test("Sanggar memakai alur Buat, Formulir, lalu Preview besar", async () => {
  const [tools, paket, adart] = await Promise.all([
    baca("../src/pages/sanggar/DokumenTools.tsx"),
    baca("../src/pages/sanggar/PaketDokumenCard.tsx"),
    baca("../src/pages/sanggar/ADARTStandarCard.tsx"),
  ]);
  assert.match(tools, />\s*Buat\s*</);
  assert.match(tools, /button-preview-dokumen/);
  assert.match(tools, /tampilanPembuatan === "pratinjau"/);
  assert.match(paket, /button-preview-paket/);
  assert.match(paket, />\s*Buat\s*</);
  assert.match(adart, /button-preview-adart/);
  assert.match(adart, />\s*Buat AD\/ART\s*</);
});

test("pratinjau memakai lembar hasil paginasi, bukan pita warna", async () => {
  const source = await baca(
    "../src/components/dokumen/PagedDocumentPreview.tsx",
  );
  assert.match(source, /paged\.polyfill\.js\?url/);
  assert.match(source, /sandbox="allow-scripts"/);
  assert.match(source, /\.pagedjs_page/);
  assert.match(source, /gap: 28px/);
  assert.match(source, /data-page-count/);
});
