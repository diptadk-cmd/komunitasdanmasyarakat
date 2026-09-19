import assert from 'node:assert/strict';
import test from 'node:test';
import { workspaceAutofill, GENERATED_AUTOFILL_KEY } from '../public/assets/native-autofill-workspace-20260920.mjs';

const profile = { id: 'sg', role: 'sanggar', namaSanggar: 'Sanggar A' };
const key = 'sg:native-fix-mandiri-nonbadan-hukum';
const fields = ['TGL_FOR', 'HAR_FOR', 'BLN', 'THN'].map(key => ({ key }));
const run = (saved = {}, edits = {}, activeFields = fields) => workspaceAutofill(profile, { [key]: saved }, key, [], edits, activeFields, 'mandiri-nonbadan-hukum');

test('tanggal yang dipilih mengisi hari dan nomor forum; perubahan sumber dihitung ulang', () => {
  const first = run({}, { TGL_FOR: '20 September 2026' });
  assert.equal(first.values.HAR_FOR, 'Minggu');
  assert.equal(first.values.BLN, 'IX');
  assert.equal(first.values.THN, '2026');
  const next = run({}, { TGL_FOR: '21 September 2026' });
  assert.equal(next.values.HAR_FOR, 'Senin');
  assert.match(next.sources.HAR_FOR, /tanggal forum/);
});

test('hasil otomatis tetap mengikuti tanggal setelah disimpan dan dimuat ulang', () => {
  const first = run({}, { TGL_FOR: '20 September 2026' });
  const saved = { ...first.values, [GENERATED_AUTOFILL_KEY]: JSON.stringify(first.generated) };
  const snapshot = structuredClone(saved);
  const reloaded = run(saved, { TGL_FOR: '1 Oktober 2026' });
  assert.equal(reloaded.values.HAR_FOR, 'Kamis');
  assert.equal(reloaded.values.BLN, 'X');
  assert.equal(reloaded.values.THN, '2026');
  assert.deepEqual(saved, snapshot);
  assert.equal(reloaded.values[GENERATED_AUTOFILL_KEY], undefined);
});

test('menghapus tanggal menghapus hasil otomatis lama, tetapi nilai manual dan kosong dipertahankan', () => {
  const first = run({}, { TGL_FOR: '20 September 2026' });
  const saved = { ...first.values, [GENERATED_AUTOFILL_KEY]: JSON.stringify(first.generated) };
  const cleared = run(saved, { TGL_FOR: '' });
  assert.equal(cleared.values.HAR_FOR, undefined);
  assert.equal(cleared.values.BLN, undefined);
  assert.equal(cleared.values.THN, undefined);
  assert.equal(run(saved, { TGL_FOR: '21 September 2026', HAR_FOR: 'Hari pilihan sendiri' }).values.HAR_FOR, 'Hari pilihan sendiri');
  assert.equal(run(saved, { TGL_FOR: '21 September 2026', HAR_FOR: '' }).values.HAR_FOR, '');
  assert.equal(run({ TGL_FOR: '20 September 2026', HAR_FOR: '' }).values.HAR_FOR, '');
});

test('metadata rusak atau milik akun lain tidak mengambil alih nilai pengguna', () => {
  assert.equal(run({ TGL_FOR: '20 September 2026', HAR_FOR: 'Catatan lama', [GENERATED_AUTOFILL_KEY]: '{invalid' }).values.HAR_FOR, 'Catatan lama');
  const other = workspaceAutofill(profile, { 'other:native-fix-mandiri-nonbadan-hukum': { TGL_FOR: '20 September 2026', [GENERATED_AUTOFILL_KEY]: '{"HAR_FOR":"Minggu"}' } }, key, [], {}, fields, 'mandiri-nonbadan-hukum');
  assert.equal(other.values.HAR_FOR, undefined);
  assert.equal(other.values.TGL_FOR, undefined);
});

test('pilihan dokumen lain tidak menghapus hasil turunan dari kolom yang tidak aktif', () => {
  const first = run({}, { TGL_FOR: '20 September 2026' });
  const saved = { ...first.values, [GENERATED_AUTOFILL_KEY]: JSON.stringify(first.generated) };
  const otherDocument = run(saved, {}, [{ key: 'NAM_SA2' }]);
  assert.equal(otherDocument.values.HAR_FOR, 'Minggu');
  assert.equal(otherDocument.generated.HAR_FOR, 'Minggu');
});
