import assert from 'node:assert/strict';
import test from 'node:test';
import { kapitalisasiIsiJudul } from '../src/lib/dokumen-heading.ts';

test('kapitalisasi judul mempertahankan tag, atribut, URL, dan entitas', () => {
  assert.equal(kapitalisasiIsiJudul('<a href="/doc/Ab"><strong>Sanggar melati &amp; budaya</strong></a>'), '<a href="/doc/Ab"><strong>SANGGAR MELATI &amp; BUDAYA</strong></a>');
});
test('baris nomor dan tanggal dalam blok judul mempertahankan kode dan isi', () => {
  assert.equal(kapitalisasiIsiJudul('Lampiran I\nNomor: 01/Ab/2026\nTanggal: 14 September 2026\nSanggar melati'), 'LAMPIRAN I\nNomor: 01/Ab/2026\nTanggal: 14 September 2026\nSANGGAR MELATI');
});
test('nomor bertag inline tetap utuh dalam judul beberapa baris', () => {
  const html = '<strong>Formulir pendaftaran</strong><br>Nomor: <span>01/Ab/2026</span><br>Tanggal: <i>14 September 2026</i>';
  assert.equal(kapitalisasiIsiJudul(html), '<strong>FORMULIR PENDAFTARAN</strong><br>Nomor: <span>01/Ab/2026</span><br>Tanggal: <i>14 September 2026</i>');
  assert.equal(kapitalisasiIsiJudul('<p>Formulir pendaftaran</p><p>Nomor: <span>01/Ab/2026</span></p>'), '<p>FORMULIR PENDAFTARAN</p><p>Nomor: <span>01/Ab/2026</span></p>');
});
