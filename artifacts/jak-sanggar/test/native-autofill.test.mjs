import assert from 'node:assert/strict';
import test from 'node:test';
import { buildAutofill, cleanAutofillValue } from '../public/assets/native-autofill-20260915.mjs';

const id = 'sg-a';
const key = `${id}:native-fix-mandiri-nonbadan-hukum`;

test('pendaftaran memuat identitas, kontak, seni dan sumber yang dapat ditelusuri', () => {
  const { values, sources } = buildAutofill({id, role: 'sanggar', namaSanggar: ' Sanggar A ', namaKetua: 'Ketua A', alamat: 'Alamat A', noHp: '0812345', email: 'a@example.test', jenisKesenian: ['Musik', 'Tari'], tahunBerdiri: 2010}, {}, key);
  assert.equal(values.NAM_SA2, 'Sanggar A');
  assert.equal(values.NAMA_SANGGAR, 'Sanggar A');
  assert.equal(values.ALA_LE2, 'Alamat A');
  assert.equal(values.TEL_SAN, '0812345');
  assert.equal(values.BID_SEN, 'Musik\nTari');
  assert.equal(values.KETUA, 'Ketua A');
  assert.equal(sources.KETUA, 'Pendaftaran / profil');
  for (const field of ['NAM_PEN', 'NAM_TTD_', 'TGL_BER', 'TGL_FOR', 'TAN', 'KOTA']) assert.equal(values[field], undefined);
});

test('sumber hanya milik sanggar aktif, termasuk prefix ID yang mirip', () => {
  const { values } = buildAutofill({id}, {
    [`${id}:old`]: {NAMA_SANGGAR: 'Milik A'},
    'sg-ab:old': {EMAIL: 'milik-b@example.test'},
    'sg-b:old': {SEK: 'Sekretaris B'},
  }, key, [
    {sanggarId: 'sg-b', values: {BEN: 'Bendahara B'}},
    {values: {TELEPON: 'Tanpa pemilik'}},
    {sanggarId: id, values: {EMAIL_SANGGAR: 'milik-a@example.test'}},
  ]);
  assert.equal(values.NAM_SA2, 'Milik A');
  assert.equal(values.EMAIL, 'milik-a@example.test');
  assert.equal(values.SEK, undefined);
  assert.equal(values.BEN, undefined);
  assert.equal(values.TELEPON, undefined);
  assert.equal(buildAutofill({id}, {'sg-b:old': {NAM_SA2:'B'}}, 'sg-b:old').values.NAM_SA2, undefined);
  assert.deepEqual(buildAutofill({id, role:'kurator'}, {[key]: {NAM_SA2:'A'}}, key).values, {});
});

test('isian tersimpan paling tinggi dan kosong eksplisit tetap kosong', () => {
  const selected = {NAM_SA2:'Nama pilihan sendiri', EMAIL:'', TELEPON:' — ', TGL_FOR:'15 September 2026', DUR_BAK:0, SETUJU:false};
  const saved = {[key]: selected, [`${id}:other`]: {NAM_SA2:'Lama', EMAIL:'old@example.test'}};
  const snapshot = structuredClone(saved);
  const {values, sources} = buildAutofill({id, namaSanggar:'Profil baru', email:'new@example.test', noHp:'08111'}, saved, key);
  assert.equal(values.NAM_SA2, 'Nama pilihan sendiri');
  assert.equal(values.NAMA_SANGGAR, 'Nama pilihan sendiri');
  assert.equal(values.EMAIL, '');
  assert.equal(values.EMA_SAN, '');
  assert.equal(values.TELEPON, '08111');
  assert.equal(values.TGL_FOR, '15 September 2026');
  assert.equal(values.DUR_BAK, '0');
  assert.equal(values.SETUJU, 'false');
  assert.equal(sources.DUR_BAK, 'Formulir tersimpan');
  assert.deepEqual(saved, snapshot);
});

test('profil terkini lebih dipercaya dari data lintas formulir', () => {
  const {values, sources} = buildAutofill({id, namaSanggar:'Nama terbaru'}, {[`${id}:native-fix-unit-nonbadan-hukum`]:{NAMA_SANGGAR:'Nama lama', SEK:'Sekretaris A'}}, key);
  assert.equal(values.NAM_SA2, 'Nama terbaru');
  assert.equal(sources.NAM_SA2, 'Pendaftaran / profil');
  assert.equal(values.SEK, 'Sekretaris A');
  assert.equal(sources.SEK, 'Formulir lain');
});

test('silang formulir hanya identitas yang jelas, tanpa nomor, tanggal rapat atau data anggota', () => {
  const {values} = buildAutofill({id}, {[`${id}:native-fix-unit-nonbadan-hukum`]: {NAM_SA2:'A', NO_BA:'123', TGL_FOR:'2026-09-15', NAM_PEN:'Penanda tangan', NIK:'1234567890123456', NAM_1:'Anggota', O_NAM_SA2:'Induk', NAM_IN2:'Induk', NPWP:'NPWP lain', BID_SEN:'Musik', TGL_BER:'12 Mei 2004'}}, key);
  assert.equal(values.NAM_SA2, 'A');
  assert.equal(values.BID_SEN, 'Musik');
  assert.equal(values.TGL_BER, '12 Mei 2004');
  for (const field of ['NO_BA','TGL_FOR','NAM_PEN','NIK','NAM_1','O_NAM_SA2','NAM_IN2','NPWP']) assert.equal(values[field], undefined);
});

test('isian berbeda antar formulir tidak dipilih secara sembarang', () => {
  const {values} = buildAutofill({id}, {[`${id}:native-fix-unit-nonbadan-hukum`]:{SEK:'A'}, [`${id}:two`]:{NAMA_SEKRETARIS_SANGGAR:'B'}}, key);
  assert.equal(values.SEK, undefined);
});

test('token generik formulir lama tidak menyalin alamat atau kontak pribadi', () => {
  const {values} = buildAutofill({id}, {[`${id}:mandiri-non-bh`]: {ALAMAT:'Alamat anggota', EMAIL:'anggota@example.test', TELEPON:'Telepon anggota', NAMA:'Anggota', NAMA_SANGGAR:'Sanggar A', ALAMAT_LENGKAP_SANGGAR:'Alamat sanggar'}}, key, [{sanggarId:id, values:{ALAMAT:'Alamat orang lain', EMAIL:'privat@example.test'}}]);
  assert.equal(values.NAM_SA2,'Sanggar A');
  assert.equal(values.ALAMAT,'Alamat sanggar');
  assert.equal(values.EMAIL,undefined);
  assert.equal(values.TELEPON,undefined);
});

test('organisasi induk dan badan mengikuti arti kelompok serta legalitas pendaftaran', () => {
  const profile = {id, legalitas:'Yayasan', namaSanggar:'Sanggar A', namaBadanHukum:'Yayasan Budaya A', npwp:'123'};
  const mandiri = buildAutofill(profile, {}, `${id}:native-fix-mandiri-berbadan-hukum-yayasan`).values;
  const unit = buildAutofill(profile, {}, `${id}:native-fix-unit-badan-hukum-yayasan`).values;
  const cv = buildAutofill(profile, {}, `${id}:native-fix-unit-badan-usaha-persekutuan-komanditer`).values;
  assert.equal(mandiri.NAM_BA2,'Budaya A');
  assert.equal(mandiri.NAM_PE3,'Yayasan Budaya A');
  assert.equal(mandiri.NAM_IN2,undefined);
  assert.equal(unit.NAM_IN2,'Budaya A');
  assert.equal(unit.NAM_BA2,undefined);
  assert.equal(unit.NPWP,undefined);
  assert.equal(cv.NAM_IN2,undefined);
  assert.equal(cv.NAM_PE3,undefined);
  assert.equal(cv.NAM_SA2,'Sanggar A');
});

test('placeholder dibersihkan tanpa mengubah angka nol, false, dan tanggal', () => {
  for (const value of ['-', ' — ', '\n--\n', '', null, {}, [], NaN]) assert.equal(cleanAutofillValue(value), '');
  for (const [input,expected] of [[0,'0'],[false,'false'],['2026-09-15','2026-09-15'],['15/09/2026','15/09/2026']]) assert.equal(cleanAutofillValue(input), expected);
});
