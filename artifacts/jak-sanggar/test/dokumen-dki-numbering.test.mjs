import assert from "node:assert/strict";
import test from "node:test";
import {
  angkaHtml,
  ayatDenganHuruf,
  ayatHtml,
  babHtml,
  diktumDenganHuruf,
  hurufHtml,
  hurufKurungHtml,
  judulSuratDenganNomorHtml,
  judulSuratHtml,
  mengingatHtml,
  menimbangHtml,
  nomorHurufDokumen,
  tentangHtml,
} from "../src/lib/dokumen-dki.ts";

function isiSel(html, namaKelas) {
  return [
    ...html.matchAll(
      new RegExp(`<td class="${namaKelas}"[^>]*>([^<]*)</td>`, "g"),
    ),
  ].map((match) => match[1]);
}

test("penanda ayat, huruf, angka dan huruf kurung menerima nomor yang sudah berformat", () => {
  const kasus = [
    [ayatHtml("(10)", "(10) Isi ayat."), "(10)", "Isi ayat."],
    [ayatHtml("10.", "10. Isi ayat."), "(10)", "Isi ayat."],
    [hurufHtml("A.", "a) Isi huruf."), "a.", "Isi huruf."],
    [angkaHtml("(12)", "12) Isi angka."), "12.", "Isi angka."],
    [hurufKurungHtml("(B)", "(b) Isi rincian."), "b)", "Isi rincian."],
  ];
  for (const [html, penanda, isi] of kasus) {
    assert.deepEqual(isiSel(html, "tnd-daftar-penanda"), [penanda]);
    assert.deepEqual(isiSel(html, "tnd-daftar-isi"), [isi]);
  }
});

test("normalisasi tidak menghapus nominal, tanggal atau rujukan pasal di isi", () => {
  const isi = [
    "1.500 peserta mengikuti kegiatan.",
    "Pasal 1 ayat (2) tetap berlaku.",
    "2. Isi dengan nomor berbeda tetap dipertahankan.",
    "2026 merupakan tahun pendirian.",
  ];
  for (const teks of isi) {
    assert.deepEqual(isiSel(ayatHtml(1, teks), "tnd-daftar-isi"), [teks]);
  }
});

test("kolom penanda tetap sejajar dari satu sampai tiga digit dan isi panjang dapat membungkus", () => {
  const panjang =
    "Ketentuan yang panjang tetap ditulis di kolom isi dan baris lanjutan sejajar dengan awal kalimat. ".repeat(
      6,
    );
  for (const render of [ayatHtml, angkaHtml]) {
    const widths = [1, 10, 100].map((nomor) => {
      const html = render(nomor, panjang);
      assert.doesNotMatch(html, /display:flex/);
      assert.match(html, /class="tnd-daftar-penanda"[^>]*white-space:nowrap/);
      assert.match(html, /class="tnd-daftar-isi"[^>]*vertical-align:top/);
      assert.deepEqual(isiSel(html, "tnd-daftar-isi"), [panjang]);
      return html.match(/class="tnd-daftar-penanda" style="width:([^;]+)/)[1];
    });
    assert.equal(new Set(widths).size, 1);
  }
});

test("konsiderans dan diktum mengabaikan baris kosong dan tidak menggandakan penanda", () => {
  for (const html of [
    menimbangHtml(["a. Pertama", " ", "b) Kedua"]),
    diktumDenganHuruf("Kesatu", ["a. Pertama", " ", "b) Kedua"]),
  ]) {
    assert.deepEqual(isiSel(html, "tnd-daftar-penanda"), ["a.", "b."]);
    assert.deepEqual(isiSel(html, "tnd-daftar-isi"), ["Pertama", "Kedua"]);
  }
  const dasar = mengingatHtml(["1. Dasar pertama", "", "(2) Dasar kedua"]);
  assert.deepEqual(isiSel(dasar, "tnd-daftar-penanda"), ["1.", "2."]);
  assert.deepEqual(isiSel(dasar, "tnd-daftar-isi"), [
    "Dasar pertama",
    "Dasar kedua",
  ]);
});

test("ayat dengan subhuruf memiliki HTML blok sah tanpa ayat kosong", () => {
  const html = ayatDenganHuruf("(2)", ["a. Pertama", "", "b. Kedua"]);
  assert.deepEqual(isiSel(html, "tnd-daftar-penanda"), ["(2)", "a.", "b."]);
  assert.deepEqual(isiSel(html, "tnd-daftar-isi"), ["Pertama", "Kedua"]);
  assert.doesNotMatch(html, /<span[^>]*>\s*<div/);
  assert.equal(
    (html.match(/<table\b/g) ?? []).length,
    1,
    "Subhuruf tidak boleh berupa tabel bersarang yang hilang saat konversi Word",
  );
  assert.equal(
    (html.match(/<tr\b/g) ?? []).length,
    2,
    "Setiap subhuruf harus dapat berpaginasi sebagai baris tersendiri",
  );
  assert.equal(ayatDenganHuruf(2, ["", " "]), "");
});

test("daftar lebih dari 26 butir terus memakai huruf dan tidak berubah menjadi tanda baca", () => {
  assert.deepEqual([0, 25, 26, 27, 51, 52].map(nomorHurufDokumen), [
    "a",
    "z",
    "aa",
    "ab",
    "az",
    "ba",
  ]);
  const html = menimbangHtml(
    Array.from({ length: 28 }, (_, i) => `Butir ${i + 1}`),
  );
  assert.deepEqual(isiSel(html, "tnd-daftar-penanda").slice(25), [
    "z.",
    "aa.",
    "ab.",
  ]);
});

test("judul keluaran disimpan kapital tanpa bergantung pada CSS dan nomor surat tetap asli", () => {
  assert.match(
    judulSuratHtml("Surat undangan & pernyataan"),
    />\s*SURAT UNDANGAN &amp; PERNYATAAN\s*</,
  );
  const html = judulSuratDenganNomorHtml(
    "Formulir pendaftaran anggota",
    "001/Abc/ix/2026",
  );
  assert.match(html, />\s*FORMULIR PENDAFTARAN ANGGOTA\s*</);
  assert.match(html, /Nomor: 001\/Abc\/ix\/2026/);
  assert.match(babHtml("Bab iv"), />\s*BAB IV\s*</);
  assert.match(
    tentangHtml("Pembentukan pengurus sanggar"),
    /PEMBENTUKAN PENGURUS SANGGAR/,
  );
  assert.match(
    judulSuratHtml('<script>alert("x")</script>'),
    /&lt;SCRIPT&gt;ALERT\(&quot;X&quot;\)&lt;\/SCRIPT&gt;/,
  );
});
