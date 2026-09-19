import assert from 'node:assert/strict';
import test from 'node:test';
import { buildAutofill, cleanAutofillValue, deriveAutofill } from '../public/assets/native-autofill-20260915.mjs';

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

const fields = (...keys) => keys.map(key => ({key}));
const derive = (values, keys, profile = {}, groupId = 'mandiri-nonbadan-hukum') => deriveAutofill(profile, values, {groupId, fields: fields(...keys)});

test('derive hanya mengusulkan field aktif yang belum ada dan tidak mengubah input', () => {
  const profile = {id, namaSanggar:'Sanggar A', noHp:'08111', namaKetua:'Ketua A'};
  const input = {EMAIL:'', HAR_FOR:'Pilihan khusus', TGL_FOR:'2026-09-20', BLN:0, THN:false};
  const snapshot = structuredClone({profile, input});
  const result = derive(input, ['NAM_SA2', 'EMAIL', 'HAR_FOR', 'BLN', 'THN'], profile);
  assert.deepEqual(result.values, {NAM_SA2:'Sanggar A'});
  assert.equal(result.sources.NAM_SA2, 'Pendaftaran / profil');
  assert.deepEqual({profile, input}, snapshot);
  assert.deepEqual(deriveAutofill(profile, input).values, {});
  assert.deepEqual(derive(input, ['NAM_SA2'], {...profile, role:'kurator'}).values, {});
});

test('alias identitas memakai isian eksplisit dengan arti sama, tanpa mengubah pejabat forum', () => {
  const result = derive({NAM_SA2:'Nama diketik', EMAIL:'sanggar@example.test', KETUA:'Ketua tetap'}, ['NAMA_SANGGAR', 'EMA_SAN', 'NAM_PEN', 'NAM_TTD_', 'PIM_FOR', 'NAM_PIM', 'NAM_SEK', 'DAT_PEM'], {namaSanggar:'Nama profil'});
  assert.deepEqual(result.values, {NAMA_SANGGAR:'Nama diketik', EMA_SAN:'sanggar@example.test'});
  assert.deepEqual(derive({NAM_SA2:'', EMAIL:'a@example.test', EMA_SAN:'b@example.test'}, ['NAMA_SANGGAR','EMAIL_SANGGAR'], {namaSanggar:'Profil',email:'profil@example.test'}).values, {});
});

test('tanggal forum menjadi hari dan periode nomor dengan zona waktu stabil', () => {
  for (const value of ['2026-09-20', '20/09/2026', '20 September 2026']) {
    const result = derive({TGL_FOR:value}, ['HAR_FOR','BLN','THN','TAN','TGL_BER','NO_BA']);
    assert.deepEqual(result.values, {HAR_FOR:'Minggu', BLN:'IX', THN:'2026'});
    assert.equal(result.sources.HAR_FOR, 'Dari tanggal forum');
  }
  assert.deepEqual(derive({TGL_FOR:'2024-02-29'}, ['HAR_FOR','BLN','THN']).values, {HAR_FOR:'Kamis',BLN:'II',THN:'2024'});
  for (const value of ['2026', '31/02/2026','2026-02-29','2026-13-01','besok','2026-09-20T00:00:00Z','20 Sep 2026']) {
    assert.deepEqual(derive({TGL_FOR:value}, ['HAR_FOR','BLN','THN']).values, {}, value);
  }
});

test('setiap tanggal keputusan dan masa bakti hanya mengisi dependensinya sendiri', () => {
  const result = derive({TGL_SK_A:'2026-08-01', TGL_SK_K:'2027-02-03', TGL_SK_P:'2028-12-31', TGL_AWA_:'2026-01-01', TGL_AKH_:'2030-12-31', TAN_RAP:'2026-09-21'}, ['BLN_ATR','THN_ATR','BLN_KEU','THN_KEU','BLN_PLT','THN_PLT','THN_AWA_','THN_AKH_','HAR','BLN','THN','NO_ATR','DUR_BAK']);
  assert.deepEqual(result.values, {BLN_ATR:'VIII',THN_ATR:'2026',BLN_KEU:'II',THN_KEU:'2027',BLN_PLT:'XII',THN_PLT:'2028',THN_AWA_:'2026',THN_AKH_:'2030',HAR:'Senin'});
  assert.deepEqual(derive({TAN:'2029-04-05'}, ['TAN','BLN','THN']).values, {BLN:'IV',THN:'2029'});
  assert.deepEqual(derive({TAN:'2029-04-05'}, ['BLN','THN']).values, {});
  assert.deepEqual(derive({TGL_FOR:'', TAN:'2029-04-05'}, ['TAN','BLN','THN']).values, {});
});

test('tanggal dan nominal induk tidak diturunkan dari sanggar ataupun sebaliknya', () => {
  assert.deepEqual(derive({TGL_FOR:'2026-09-20', IUR_BLN:'10000'}, ['O_HAR_FO','O_BLN','O_THN','O_TER_BL']).values, {});
  assert.deepEqual(derive({O_TGL_FO:'2026-09-21', O_IUR_BL:'20000'}, ['HAR_FOR','BLN','THN','TER_BLN']).values, {});
  assert.deepEqual(derive({O_TGL_FO:'2026-09-21', O_IUR_BL:'20000'}, ['O_HAR_FO','O_BLN','O_THN','O_TER_BL']).values, {O_HAR_FO:'Senin',O_BLN:'IX',O_THN:'2026',O_TER_BL:'Dua puluh ribu rupiah'});
});

test('terbilang mengikuti nominal rupiah eksplisit termasuk nol tanpa menentukan biaya', () => {
  const result = derive({IUR_BLN:'Rp 25.000,00', IUR_THN:1200000, U_DAFTAR:0}, ['TER_BLN','TER_THN','TER_DAF','TAH_BAY','IUR_BLN','IUR_THN','U_DAFTAR']);
  assert.deepEqual(result.values, {TER_BLN:'Dua puluh lima ribu rupiah',TER_THN:'Satu juta dua ratus ribu rupiah',TER_DAF:'Nol rupiah'});
  assert.equal(result.sources.TER_DAF, 'Terbilang dari biaya pendaftaran');
  for (const [value, expected] of [['11','Sebelas'], ['15','Lima belas'], ['101','Seratus satu'], ['1001','Seribu satu'], ['1000000001','Satu miliar satu'], ['1000000000000','Satu triliun']]) {
    assert.equal(derive({IUR_BLN:value}, ['TER_BLN']).values.TER_BLN, `${expected} rupiah`);
  }
});

test('nominal ambigu atau pecahan tidak dibulatkan menjadi kewajiban keuangan', () => {
  for (const value of ['', false, -1, '1e3','1,000','1.00','1.234,50','50.000 / bulan','5 juta','1.000.000.000.000.000',Infinity]) {
    assert.deepEqual(derive({IUR_BLN:value}, ['TER_BLN']).values, {}, String(value));
  }
  assert.deepEqual(derive({IUR_BLN:'50000',TER_BLN:''}, ['TER_BLN']).values, {});
  assert.deepEqual(derive({IUR_BLN:'50000',TER_BLN:'Lima puluh ribu sesuai kesepakatan'}, ['TER_BLN']).values, {});
});

test('hasil derived dapat dihitung ulang setelah metadata UI mengeluarkan hasil otomatis lama', () => {
  const keys = ['HAR_FOR','BLN','THN','TER_BLN'];
  const initial = derive({TGL_FOR:'2026-09-20',IUR_BLN:'10000'}, keys).values;
  assert.deepEqual(derive({...initial,TGL_FOR:'2027-10-01',IUR_BLN:'20000'}, keys).values, {});
  const refreshed = derive({TGL_FOR:'2027-10-01',IUR_BLN:'20000'}, keys).values;
  assert.deepEqual(refreshed, {HAR_FOR:'Jumat',BLN:'X',THN:'2027',TER_BLN:'Dua puluh ribu rupiah'});
  assert.equal(derive({TGL_FOR:'2027-10-01',HAR_FOR:''},keys).values.HAR_FOR, undefined);
});

test('rekening badan berasal dari pemilik yang cocok dan mempertahankan nol awal nomor', () => {
  const profile = {id, role:'sanggar', legalitas:'Yayasan', namaBadanHukum:'Yayasan A', rekening:{bank:'BCA',nomor:'001234',atasNama:'Yayasan A'}};
  const bankFields = ['BAN','NOM_REK','NAM_REK'].map(key => ({key,context:'{{BAN}} / {{NOM_REK}} / {{NAM_REK}}'}));
  const run = (p=profile, values={}, groupId='mandiri-berbadan-hukum-yayasan', f=bankFields) => deriveAutofill(p, values, {groupId,fields:f}).values;
  assert.deepEqual(run(), {BAN:'BCA',NOM_REK:'001234',NAM_REK:'Yayasan A'});
  assert.deepEqual(run({...profile,rekening:{...profile.rekening,atasNama:'Ketua A'}}), {});
  assert.deepEqual(run({...profile,bentukKedudukan:'unit-bh'}), {});
  assert.deepEqual(run(profile,{},'mandiri-badan-usaha-firma'), {});
  assert.deepEqual(run(profile,{},'unit-badan-hukum-yayasan'), {});
  assert.deepEqual(run(profile,{BAN:'Mandiri'}), {});
  assert.deepEqual(run(profile,{NOM_REK:''}), {});
  assert.deepEqual(run(profile,{NAM_BA2:'Badan lain'}), {});
  assert.deepEqual(run(profile,{NAM_PE3:''}), {});
  assert.deepEqual(run(profile,{},undefined,bankFields.map(f=>({...f,context:'Rekening pihak kedua '+f.context}))), {});
  assert.deepEqual(run(profile,{},undefined,fields('BAN','NOM_REK','NAM_REK','REKENING','REK_RES')), {});
});

test('NPW hanya alias badan mandiri yang sama dan tidak menyalin NPWP ke induk', () => {
  const profile = {legalitas:'Yayasan',npwp:'0001'};
  assert.equal(derive({},['NPW'],profile,'mandiri-berbadan-hukum-yayasan').values.NPW,'0001');
  assert.equal(derive({NPWP:'0099'},['NPW'],profile,'mandiri-berbadan-hukum-yayasan').values.NPW,'0099');
  assert.deepEqual(derive({NPWP:''},['NPW'],profile,'mandiri-berbadan-hukum-yayasan').values,{});
  assert.deepEqual(derive({},['NPW','NPW_IND'],profile,'unit-badan-hukum-yayasan').values,{});
  assert.deepEqual(derive({NAM_BA2:'Badan baru'},['NPW'],{...profile,namaBadanHukum:'Yayasan Lama'},'mandiri-berbadan-hukum-yayasan').values,{});
});

test('identitas induk eksplisit tidak diambil dari kontak sanggar atau grup legal lain', () => {
  const profile = {id,legalitas:'Yayasan',namaBadanHukum:'Yayasan A',namaInduk:'Yayasan A',alamat:'Alamat sanggar',email:'sanggar@example.test',noHp:'0800',alamatInduk:'Alamat induk',emailInduk:'induk@example.test',teleponInduk:'0900',npwpInduk:'123',nibInduk:'456',namaKetua:'Ketua sanggar',pimpinanInduk:'Pimpinan induk'};
  const keys = ['O_ALAMAT','ALA_LEN','EMA_IND','TEL_IND','NPW_IND','NIB_IND','NAM_PEN'];
  const result = derive({}, keys, profile, 'unit-badan-hukum-yayasan').values;
  assert.equal(result.O_ALAMAT,'Alamat induk');
  assert.equal(result.ALA_LEN,'Alamat induk');
  assert.equal(result.EMA_IND,'induk@example.test');
  assert.equal(result.TEL_IND,'0900');
  assert.equal(result.NPW_IND,'123');
  assert.equal(result.NIB_IND,'456');
  assert.equal(result.NAM_PEN,undefined);
  for (const group of ['unit-badan-usaha-firma','mandiri-berbadan-hukum-yayasan']) {
    const result = derive({},keys,profile,group).values;
    for (const field of ['O_ALAMAT','ALA_LEN','EMA_IND','TEL_IND','NPW_IND','NIB_IND']) assert.equal(result[field],undefined);
  }
  assert.deepEqual(derive({NAM_IN2:'Induk baru'},keys,profile,'unit-badan-hukum-yayasan').values,{});
  assert.deepEqual(derive({NAM_IN2:''},keys,profile,'unit-badan-hukum-yayasan').values,{});
  assert.equal(derive({NAM_IN2:'A',ALA_LEN:''},keys,profile,'unit-badan-hukum-yayasan').values.ALA_LEN,undefined);
  assert.equal(derive({O_ALAMAT:'Alamat diketik'},['ALA_LEN'],profile,'unit-badan-hukum-yayasan').values.ALA_LEN,'Alamat diketik');
  assert.deepEqual(derive({O_ALAMAT:''},['ALA_LEN'],profile,'unit-badan-hukum-yayasan').values,{});
  assert.deepEqual(derive({O_ALAMAT:'Alamat induk'},['ALAMAT','ALA_LEN'],{},'mandiri-nonbadan-hukum').values,{});
});

test('kontak arsip induk tidak dicampur ke formulir baru, simpanan kelompok aktif tetap dipertahankan', () => {
  const profile = {id,legalitas:'Yayasan',namaBadanHukum:'Yayasan Baru'};
  const key = `${id}:native-fix-unit-badan-hukum-yayasan`;
  const sources = [
    {sanggarId:id,groupId:'unit-bh',values:{namaInduk:'Yayasan Baru',alamatInduk:'Alamat benar',emailInduk:'a@example.test'}},
    {sanggarId:id,groupId:'unit-bh',values:{namaInduk:'Yayasan Lama',alamatInduk:'Alamat lama',teleponInduk:'099'}},
    {sanggarId:'sg-ab',groupId:'unit-bh',values:{namaInduk:'Yayasan Baru',alamatInduk:'Alamat akun lain',nibInduk:'999'}},
    {sanggarId:id,groupId:'unit-bu',values:{namaInduk:'Yayasan Baru',alamatInduk:'Alamat grup lain',npwpInduk:'888'}},
  ];
  const result = buildAutofill(profile,{},key,sources);
  for (const field of ['ALA_LEN','EMA_IND','TEL_IND','NPW_IND','NIB_IND']) assert.equal(result.values[field],undefined);
  assert.equal(buildAutofill(profile,{[key]:{ALA_LEN:'Alamat yang disimpan sendiri'}},key,sources).values.ALA_LEN,'Alamat yang disimpan sendiri');
  assert.equal(buildAutofill(profile,{[key]:{ALA_LEN:''}},key,sources).values.ALA_LEN,'');
});
