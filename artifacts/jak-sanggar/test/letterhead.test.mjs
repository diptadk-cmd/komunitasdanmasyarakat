import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { PDFDocument, PDFName } from 'pdf-lib';
import { planLetterhead, wrapLetterheadText, fitLogo, localLogo, validLogoHeader, validateLetterhead, readLetterheadLogo, letterheadPdf, LETTERHEAD_MAX_HEIGHT } from '../src/lib/letterhead.ts';

const draft = { name: 'Sanggar Melati Betawi', identity: 'Seni tari dan musik tradisi', address: 'Jalan Melati No. 10, Jakarta Timur', phone: '081234567890', email: 'sanggar@example.com', website: 'sanggar.example', layout: 'classic', logo: '' };
const measure = (text, size) => Array.from(text).length * size * 0.53;

test('kedua tata letak menempatkan seluruh teks dalam kotak kop native tanpa potong', () => {
  for (const layout of ['classic', 'modern']) {
    const plan = planLetterhead({ ...draft, layout }, measure);
    assert.equal(plan.width, 1800);
    assert.ok(plan.height <= LETTERHEAD_MAX_HEIGHT);
    assert.equal(plan.texts[0].text, draft.name);
    for (const row of plan.texts) {
      const left = row.align === 'center' ? row.x - row.width / 2 : row.x;
      assert.ok(left >= 54);
      assert.ok(left + row.width <= 1746);
      assert.ok(row.y + row.size < plan.ruleY);
    }
    assert.equal(plan.texts[0].align, layout === 'classic' ? 'center' : 'left');
  }
});

test('kata panjang dan alamat berbaris dibungkus tanpa kehilangan karakter', () => {
  const longUrl = 'https://sanggar.example/' + 'abcd'.repeat(30);
  const wrapped = wrapLetterheadText(longUrl, 200, text => text.length * 10);
  assert.equal(wrapped.join(''), longUrl);
  assert.ok(wrapped.every(line => line.length <= 20));
  assert.deepEqual(wrapLetterheadText('Jalan Melati\nJakarta Timur', 400, text => text.length * 10), ['Jalan Melati', 'Jakarta Timur']);
});

test('isian tidak valid dan tinggi berlebih ditolak, bukan dipotong diam-diam', () => {
  assert.throws(() => validateLetterhead({ ...draft, name: '  ' }), /nama organisasi/);
  assert.throws(() => validateLetterhead({ ...draft, name: 'x'.repeat(121) }), /120/);
  assert.throws(() => planLetterhead({ ...draft, name: 'Nama '.repeat(23), identity: 'Identitas '.repeat(13), address: 'Alamat '.repeat(36) }, measure), /terlalu panjang/);
  const minimal = planLetterhead({ ...draft, identity: '', address: '', phone: '', email: '', website: '' }, measure);
  assert.equal(minimal.texts.length, 1);
});

test('logo mempertahankan proporsi dan tidak memotong gambar tinggi maupun lebar', () => {
  const box = { x: 54, y: 28, size: 210 };
  assert.deepEqual(fitLogo(1000, 500, box), { x: 54, y: 80.5, width: 210, height: 105 });
  assert.deepEqual(fitLogo(500, 1000, box), { x: 106.5, y: 28, width: 105, height: 210 });
  assert.throws(() => fitLogo(0, 10, box), /Resolusi/);
  assert.throws(() => fitLogo(9000, 9000, box), /40 megapiksel/);
  const plan = planLetterhead({ ...draft, logo: 'data:image/png;base64,YWJj' }, measure);
  assert.deepEqual(plan.logoBox, box);
  assert.ok(plan.texts.every(row => (row.align === 'center' ? row.x - row.width / 2 : row.x) >= 286));
});

test('logo hanya menerima data gambar lokal dan memeriksa signature upload', async () => {
  assert.equal(localLogo('https://example.com/logo.png'), '');
  assert.equal(localLogo('data:image/svg+xml;base64,PHN2Zz4='), '');
  const bytes = new Uint8Array(await readFile(new URL('../../../services/document-renderer/test-assets/logo.png', import.meta.url)));
  assert.equal(validLogoHeader(bytes, 'image/png'), true);
  assert.equal(validLogoHeader(bytes, 'image/jpeg'), false);
  assert.equal(validLogoHeader(new TextEncoder().encode('<svg></svg>'), 'image/png'), false);
  await assert.rejects(readLetterheadLogo(new File(['bad'], 'logo.png', { type: 'image/png' })), /format gambar/);
  await assert.rejects(readLetterheadLogo(new File([''], 'empty.png', { type: 'image/png' })), /berisi gambar/);
  await assert.rejects(readLetterheadLogo(new File([new Uint8Array(8 * 1024 * 1024 + 1)], 'big.png', { type: 'image/png' })), /8 MB/);
  await assert.rejects(readLetterheadLogo(new File(['<svg/>'], 'logo.svg', { type: 'image/svg+xml' })), /PNG/);
});

test('PDF unduhan benar-benar A4 satu halaman dan memuat gambar kop', async () => {
  const png = await readFile(new URL('../../../services/document-renderer/test-assets/letterhead.png', import.meta.url));
  const blob = await letterheadPdf({ dataUrl: `data:image/png;base64,${png.toString('base64')}`, width: 1800, height: 300 });
  const pdf = await PDFDocument.load(await blob.arrayBuffer());
  assert.equal(pdf.getPageCount(), 1);
  const page = pdf.getPage(0);
  assert.ok(Math.abs(page.getWidth() - 595.28) < 0.1);
  assert.ok(Math.abs(page.getHeight() - 841.89) < 0.1);
  const resources = page.node.Resources();
  const xObjects = resources.lookup(PDFName.of('XObject'));
  assert.ok(xObjects.keys().length > 0, 'PDF harus memiliki objek gambar, bukan halaman kosong');
});
