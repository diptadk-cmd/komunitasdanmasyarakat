import assert from "node:assert/strict";
import test from "node:test";

import {
  anotasiTabelDokumenTemplate,
  cssDenganLayoutDokumenTemplate,
  CSS_LAYOUT_DOKUMEN_TEMPLATE,
  CSS_PRATINJAU_DOKUMEN_TEMPLATE,
} from "../../../artifacts/jak-sanggar/src/lib/dokumen-template-layout.ts";

const atributLayout =
  'data-docx-source-table="true" data-docx-table-border="layout" data-docx-column-count="1"';

function tabelLayout(rows) {
  return `<table ${atributLayout}>${rows
    .map((text) => `<tr><td><p>${text}</p></td></tr>`)
    .join("")}</table>`;
}

test("tabel transparan berdekatan tetap menjadi blok terpisah", () => {
  const html = anotasiTabelDokumenTemplate(
    `${tabelLayout(["BAB I"])}${tabelLayout(["Pasal 1"])}`,
  );

  assert.equal((html.match(/<table\b/g) ?? []).length, 2);
  assert.equal((html.match(/<\/table>/g) ?? []).length, 2);
  assert.equal(
    (html.match(/dokumen-template__table--atomic/g) ?? []).length,
    2,
  );
  assert.match(html, /dokumen-template__table--judul/);
  assert.match(html, /data-dokumen-template-row-count="1"/);
});

test("tabel transparan panjang ditandai sebagai aliran per baris", () => {
  const html = anotasiTabelDokumenTemplate(
    tabelLayout(["Satu", "Dua", "Tiga", "Empat"]),
  );

  assert.match(html, /dokumen-template__table--flow/);
  assert.match(html, /data-dokumen-template-row-count="4"/);
  assert.doesNotMatch(html, /dokumen-template__table--atomic/);
});

test("paragraf panjang satu baris kembali menjadi blok prosa yang dapat berpaginasi", () => {
  const html = anotasiTabelDokumenTemplate(
    tabelLayout(["Isi panjang ".repeat(80)]),
  );

  assert.match(html, /dokumen-template__table--prose/);
  assert.match(html, /dokumen-template__table--flow/);
  assert.doesNotMatch(html, /dokumen-template__table--atomic/);
});

test("pemisah halaman Word dinormalisasi tanpa paragraf kosong", () => {
  const html = anotasiTabelDokumenTemplate(
    '<p><hr class="dokumen-template__page-break" /></p><p>Lampiran</p>',
  );

  assert.match(
    html,
    /^<div class="dokumen-template__page-break" aria-hidden="true">&#8203;<\/div><div class="dokumen-template__mulai-halaman"><p>Lampiran<\/p><\/div>$/,
  );
  assert.doesNotMatch(html, /<p>\s*<hr/i);
});

test("isi setelah pemisah halaman tetap berada dalam paragraf", () => {
  const html = anotasiTabelDokumenTemplate(
    '<p class="lampiran"><hr class="dokumen-template__page-break" /><strong>LAMPIRAN</strong></p>',
  );

  assert.match(
    html,
    /^<div class="dokumen-template__page-break" aria-hidden="true">&#8203;<\/div><div class="dokumen-template__mulai-halaman"><p class="lampiran"><strong>LAMPIRAN<\/strong><\/p><\/div>$/,
  );
});

test("blok tanda tangan unit dipisahkan menjadi dua kolom", () => {
  const html = anotasiTabelDokumenTemplate(
    '<p>Jakarta, 20 Agustus 2026</p><p>KETUA INDUK,</p><p>NAMA KETUA PIMPINAN UNIT KEGIATAN</p><p>SANGGAR CONTOH,</p><p>NAMA PIMPINAN</p><p><hr class="dokumen-template__page-break" /><strong>LAMPIRAN</strong></p>',
  );

  assert.match(html, /dokumen-template__table--tanda-tangan/);
  assert.match(html, /<strong>NAMA KETUA<\/strong>/);
  assert.match(html, /<p>PIMPINAN UNIT KEGIATAN<\/p>/);
  assert.match(html, /<strong>NAMA PIMPINAN<\/strong>/);
  assert.doesNotMatch(html, /NAMA KETUA PIMPINAN UNIT KEGIATAN/);
});

test("metadata Word layout tetap menang walaupun sumber memakai thead", () => {
  const html = anotasiTabelDokumenTemplate(
    `<table ${atributLayout}><thead><tr><th><p>Baris pertama</p></th></tr></thead></table>`,
  );

  assert.match(html, /dokumen-template__table--layout/);
  assert.match(html, /dokumen-template__table--atomic/);
  assert.doesNotMatch(html, /dokumen-template__table--grid/);
});

test("tabel daftar panjang memakai tata letak padat", () => {
  const rows = Array.from(
    { length: 10 },
    (_, index) => `<tr><td><p>${index + 1}</p></td><td><p>Nama</p></td></tr>`,
  ).join("");
  const html = anotasiTabelDokumenTemplate(
    `<table data-docx-source-table="true" data-docx-table-border="grid" data-docx-column-count="2">${rows}</table>`,
  );

  assert.match(html, /dokumen-template__table--dense/);
});

test("CSS memisahkan tabel transparan dan hanya mengulang header grid", () => {
  assert.match(
    CSS_LAYOUT_DOKUMEN_TEMPLATE,
    /\.dokumen-template__table thead \{ display: table-row-group; \}/,
  );
  assert.match(
    CSS_LAYOUT_DOKUMEN_TEMPLATE,
    /\.dokumen-template__table--grid thead \{ display: table-header-group; \}/,
  );
  assert.match(
    CSS_LAYOUT_DOKUMEN_TEMPLATE,
    /\.dokumen-template__table--layout \{[\s\S]*?border-collapse: separate;/,
  );
  assert.match(
    CSS_LAYOUT_DOKUMEN_TEMPLATE,
    /\.dokumen-template__table--atomic \{[\s\S]*?break-inside: avoid;/,
  );
  assert.match(
    CSS_LAYOUT_DOKUMEN_TEMPLATE,
    /\.dokumen-template__table--prose[\s\S]*?display: block;/,
  );
  assert.match(
    CSS_LAYOUT_DOKUMEN_TEMPLATE,
    /\.dokumen-template__mulai-halaman[\s\S]*?page-break-before: always;/,
  );
  assert.match(CSS_PRATINJAU_DOKUMEN_TEMPLATE, /@page/);
});

test("layout Word mempertahankan ukuran halaman dan margin sumber", () => {
  const css = cssDenganLayoutDokumenTemplate({
    pageWidthMm: 210,
    pageHeightMm: 297,
    marginTopMm: 25.01,
    marginRightMm: 25.01,
    marginBottomMm: 20,
    marginLeftMm: 30,
  });

  assert.match(css, /size: 210mm 297mm;/);
  assert.match(css, /margin: 25\.01mm 25\.01mm 20mm 30mm;/);
});

test("judul formulir dan bagian menjadi teks kapital dengan format tetap utuh", () => {
  const html = anotasiTabelDokumenTemplate(tabelLayout([
    '<strong>Formulir data sanggar Melati &amp; budaya</strong>',
    '<strong>A. Identitas sanggar</strong>',
  ]));
  assert.match(html, /FORMULIR DATA SANGGAR MELATI &amp; BUDAYA/);
  assert.match(html, /A\. IDENTITAS SANGGAR/);
  assert.match(html, /data-dokumen-heading="title"/);
  assert.match(html, /<strong>/);
  assert.equal(anotasiTabelDokumenTemplate(html), html);
});

test("kalimat keputusan dan daftar huruf tidak salah dianggap judul", () => {
  for (const isi of ['Keputusan ini mulai berlaku pada tanggal ditetapkan.', '<strong>Formulir ini harus diserahkan kepada pengurus</strong>', 'a. Anggota wajib mengikuti latihan.', 'Keputusan ini ' + 'berlaku untuk kegiatan sanggar '.repeat(15)]) {
    const html = anotasiTabelDokumenTemplate(tabelLayout([isi]));
    assert.doesNotMatch(html, /table--judul|data-dokumen-heading/);
    assert.ok(html.includes(isi));
  }
});

test("nomor surat dan label Pasal tidak ikut dikapitalisasi sebagai judul", () => {
  const html = anotasiTabelDokumenTemplate(tabelLayout(['Pasal 10']) + '<p>Nomor: 001/Ab/IX/2026</p>');
  assert.match(html, />Pasal 10</);
  assert.match(html, />Nomor: 001\/Ab\/IX\/2026</);
});
test("judul formulir dengan baris nomor dan tanggal tetap dikenali", () => {
  const html = anotasiTabelDokumenTemplate(tabelLayout(['<strong>Formulir pendaftaran</strong>', 'Nomor: 01/Ab/2026', 'Tanggal: 14 September 2026']));
  assert.match(html, /FORMULIR PENDAFTARAN/);
  assert.match(html, />Nomor: 01\/Ab\/2026</);
  assert.match(html, />Tanggal: 14 September 2026</);
});
test("paragraf biasa tentang kegiatan mempertahankan huruf kalimat", () => {
  const teks = 'Tentang pelaksanaan kegiatan, pengurus menyampaikan laporan.';
  assert.ok(anotasiTabelDokumenTemplate(`<p>${teks}</p>`).includes(teks));
});
