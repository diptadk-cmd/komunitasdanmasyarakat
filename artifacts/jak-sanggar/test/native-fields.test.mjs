import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { FIELD_GROUPS, fieldMeta, normalizeFieldValue, toDateInput, fromDateInput } from '../public/assets/native-fields-20260915.mjs';
import { hasFieldGuidance } from '../public/assets/native-field-guidance-20260920.mjs';

// All distinct keys from the reviewed 203-document catalog. Keep this fixture
// independent of the external production snapshot so tests also run in checkout.
const catalogKeys = `
AKH_TUG ALAMAT ALA_LE2 ALA_LEN ANG_KEL ANG_MAS ANG_SISA ATU_BAT BAN BAT_BEL BAT_GAN BAT_KAH BAT_KUA BAT_LAP BAT_PER BAT_SEN BAT_TEG BAT_TUN BEN BEN_LOG BER_ARS BIDANG_1 BIDANG_2 BIDANG_3 BID_SEN BLN BLN_ATR BLN_KEU BLN_PLT BUK_ALI_ BUK_ASE BUK_KAS B_KAS B_KREASI B_PROD B_SOSIAL B_TAMPIL B_UNIT CAT_SER DAF_AKU DAF_ARS DAF_BAR DAN_TER DAS_FOR DAS_KEW DAS_MAN DAS_SER DAT_PEM DUR_BAK EMA EMAIL EMA_IND EMA_SAN FON_LOG FOR_SEN HAK_KAR HAR HARI_14 HARI_7 HAR_FOR HAR_LPJ_ HAR_SER HAS_OUT HAS_REA
ID_BEN ID_K1 ID_K2 ID_K3 ID_K4 ID_KETUA ID_SEK ID_WAKIL IUR_BLN IUR_THN IZI_SER JAB01 JAB02 JAB03 JAB04 JAB05 JAB06 JAB07 JAB08 JAB_DIR JAB_FOR JAB_IND JAB_MIT JAB_PEN JEN_DA2 JEN_DAN JEN_PRO JUM_DAN JUM_HAD JUM_PES KBL_DAN KD KEG KEGIATAN KELUARAN KEN KENDALA KETUA KET_1 KET_2 KET_3 KET_4 KET_5 KET_6 KET_7 KET_8 KET_LOG KOD_WAR KON01 KON02 KON03 KON04 KON05 KON06 KON07 KON08 KON_AKT KOORD_1 KOORD_2 KOORD_3 KOORD_4 KOT KOTA KUASA KUA_MIT KUO_DUA_ KUO_MAY KUO_SAT_ KUO_TIG_ LEM_MIT LOGO LOG_FIN LOK_TAU MAK_LOG MANDAT MAS_ARS MAS_JAB MAS_KEW MATERI_1 MATERI_2 MATERI_3 MED_SOS MIN_LOG MIT
NAM NAM01 NAM02 NAM03 NAM04 NAM05 NAM06 NAM07 NAM08 NAMA_KOP NAM_BA2 NAM_DAN NAM_IN2 NAM_KEG NAM_LOG NAM_MIT NAM_PE3 NAM_PEN NAM_PI2 NAM_PIM NAM_REK NAM_SA2 NAM_SEK NAM_SIN NAM_TTD_ NIB NIB_IND NIK_I01 NIK_I02 NIK_I03 NIK_I04 NIK_I05 NIK_I06 NIK_I07 NIK_I08 NIL NIL_KON NOM_DAN NOM_DOK NOM_KEB NOM_KEP NOM_REK NOM_SK NOM_SKT NOM_SUR NOTARIS NOTULIS NO_AKTA NO_ATR NO_BA NO_KEU NO_KMM NO_KON NO_PEL NO_PEN NO_SERAH NPW NPW_IND ORG_IND ORG_PEN
O_ALAMAT O_BAT_BE O_BAT_GA O_BAT_LA O_BAT_TE O_BAT_TU O_BLN O_DUR_BA O_HARI_1 O_HARI_7 O_HAR_FO O_HAR_LP O_HAR_SE O_IUR_BL O_IUR_TH O_JEN_PR O_JUM_HA O_KD O_KOTA O_KUO_DU O_KUO_MA O_KUO_SA O_KUO_TI O_LOGO O_MAS_AR O_NOTULI O_NO_BA O_PIM_FO O_PUK_MU O_PUK_SE O_P_KAS O_P_KREA O_P_PROD O_P_SOSI O_P_TAMP O_P_UNIT O_TEM_FO O_TER_BL O_TER_DA O_TER_TH O_TGL_BE O_TGL_FO O_THN O_TIN_PO O_U_DAFT
PAJAK PAS_AD PAS_AD2 PAS_AKT PEL_1 PEL_2 PEL_3 PEL_PRO PEMBINA PEN_LAP PEN_SEL PERIODE PES_REA PIC PIC_DAR PIH_BAR PIH_LAM PIM_FOR PIUTANG PROGRAM PRO_LOG PUK_MUL PUK_SEL P_KAS P_KREASI P_PROD P_SOSIAL P_TAMPIL P_UNIT REA_KEL REA_MAS REA_SIS REG_KON REKENING REK_RES RIN_PEL RUA_LIN RUA_LOG SAL_AKH SAL_AWA SAL_BAN SAL_KAS SAL_SER SEB_UNI SEK SEL_KEL SEL_MAS SEL_SISA STE_FIN ST_1 ST_2 ST_3 SYA_TAG TAH_BAY TAH_PAK TAN TAN_PEM TAN_PER TAN_RAP TAN_SK TAN_SKT TAN_SUR TAR_MU2 TAR_MUS TEL TELEPON TEL_IND TEL_SAN TEM TEMPAT TEM_ATA TEM_FOR TER_BLN TER_DAF TER_THN
TGL_AK2 TGL_AKH_ TGL_AKT TGL_AWA_ TGL_BER TGL_FOR TGL_KEG TGL_KON TGL_LAP TGL_MUL TGL_MUL_ TGL_PIL TGL_RA2 TGL_RA3 TGL_RAP_ TGL_SEL TGL_SER TGL_SK2 TGL_SK_A TGL_SK_K TGL_SK_P THN THN_AKH_ THN_ATR THN_AWA_ THN_KEU THN_PLT TIN_LAN TIN_POK TUG_DUA TUG_SAT TUJ UKU_STE UND_KEP UTANG U_DAFTAR VER WAKTU_1 WAKTU_2 WAKTU_3 WAK_KET WAK_MUL WAK_SEL WIL_KEG
`.trim().split(/\s+/);

test('every catalog field has a human label, help, and a known group', () => {
  assert.equal(catalogKeys.length, 372);
  for (const key of catalogKeys) {
    const meta = fieldMeta(key);
    assert.ok(!meta.label.startsWith('Isian '), `Unmapped field: ${key}`);
    assert.notEqual(meta.label, key);
    assert.ok(!meta.label.includes('_'), `Code leaked in label: ${key}`);
    assert.ok(meta.help.length > 15, key);
    assert.ok(FIELD_GROUPS.includes(meta.group), key);
    assert.ok(['text', 'textarea', 'select', 'date', 'time', 'number', 'email', 'tel'].includes(meta.type), key);
  }
});

test('actual catalog has complete actionable guidance, examples and sources for every field', async () => {
  const catalog = JSON.parse(await readFile(new URL('../public/dokumen-fix/catalog.json', import.meta.url), 'utf8'));
  const fields = catalog.groups.flatMap(group => group.documents.flatMap(document => document.fields));
  const actualKeys = [...new Set(fields.map(field => field.key))].sort();
  assert.deepEqual(actualKeys, [...catalogKeys].sort(), 'Update coverage when the catalog changes');
  for (const field of fields) {
    const { guidance, help } = fieldMeta(field);
    if (!field.key.startsWith('O_')) assert.ok(hasFieldGuidance(field.key), `Missing exact family mapping: ${field.key}`);
    for (const part of ['meaning', 'howToFill', 'example', 'sourceHint']) {
      assert.equal(typeof guidance[part], 'string', `${field.key}.${part}`);
      assert.ok(guidance[part].trim().length > 5, `${field.key}.${part}`);
      assert.ok(help.includes(guidance[part]), `${field.key}.${part} absent from compatible help`);
    }
    assert.doesNotMatch(guidance.meaning, /melengkapi informasi pada kalimat dokumen/, `Generic fallback: ${field.key}`);
    assert.doesNotMatch(help, /Isi .* sesuai data atau keputusan yang digunakan pada dokumen ini/);
    assert.doesNotMatch(guidance.example, /\{\{|\}\}/, `Unrendered template token: ${field.key}`);
  }
});

test('mandate guidance identifies evidence and suggestions never invent reference facts or fill values', () => {
  const authorityKeys = ['DAS_MAN', 'DAS_KEW', 'DAS_FOR', 'DAS_SER', 'KUASA', 'KUA_MIT', 'PAS_AD', 'PAS_AD2', 'PAS_AKT', 'MANDAT', 'BAT_KUA', 'UND_KEP'];
  for (const key of authorityKeys) {
    const meta = fieldMeta(key);
    assert.equal(meta.type, 'textarea', key);
    assert.match(meta.guidance.sourceHint, /dokumen|keputusan|surat|undangan|Anggaran/i, key);
    assert.match(meta.guidance.example, /\[[^\]]+\]/, key);
    const oldValue = 'Rujukan lama 0007/A\nTanggal sesuai arsip; catatan khusus tetap disimpan.';
    assert.equal(normalizeFieldValue(key, oldValue), oldValue);
    assert.equal(normalizeFieldValue(key, ''), '');
    assert.equal(Object.hasOwn(meta, 'defaultValue'), false);
    if (meta.suggestions) {
      assert.equal(new Set(meta.suggestions).size, meta.suggestions.length);
      assert.ok(meta.suggestions.every(value => typeof value === 'string' && value.length > 5 && !/\d/.test(value)), key);
    }
  }
  const mandate = fieldMeta('DAS_MAN');
  assert.deepEqual(mandate.suggestions, ['Keputusan rapat', 'Surat keputusan', 'Surat kuasa', 'Surat penugasan']);
  assert.match(mandate.guidance.howToFill, /pemberi mandat|cakupan/);
  assert.match(mandate.guidance.sourceHint, /belum membuktikan mandat/);
  assert.match(mandate.guidance.example, /\[tugas sesuai dokumen\]/);
  mandate.suggestions.push('Nilai dari pemanggil');
  mandate.guidance.example = 'Diubah pemanggil';
  assert.equal(fieldMeta('DAS_MAN').suggestions.length, 4);
  assert.notEqual(fieldMeta('DAS_MAN').guidance.example, 'Diubah pemanggil');
});

test('source instructions isolate parent organisation, signatories and matching person rows', () => {
  for (const key of catalogKeys.filter(key => key.startsWith('O_'))) {
    const { guidance } = fieldMeta(key);
    assert.match(guidance.sourceHint, /khusus organisasi induk, bukan identitas unit sanggar/, key);
    assert.doesNotMatch(guidance.howToFill, /profil sanggar|kas sanggar|keputusan sanggar/i, key);
  }
  for (const key of ['NAM_IN2', 'TEL_IND', 'EMA_IND', 'NIB_IND', 'NPW_IND']) assert.match(fieldMeta(key).guidance.sourceHint, /organisasi induk/, key);
  assert.match(fieldMeta('PIM_FOR').guidance.howToFill, /belum tentu penandatangan/);
  assert.match(fieldMeta('NAM_PEN').guidance.howToFill, /Jangan otomatis menyamakan/);
  assert.match(fieldMeta('NAM_MIT').guidance.sourceHint, /mitra/);
  for (let n = 1; n <= 8; n++) {
    const two = String(n).padStart(2, '0');
    for (const key of [`NAM${two}`, `JAB${two}`, `NIK_I${two}`, `KON${two}`]) assert.match(fieldMeta(key).guidance.meaning, new RegExp(`peserta ${n}`), key);
    if (n <= 3) for (const key of [`PEL_${n}`, `MATERI_${n}`, `WAKTU_${n}`, `ST_${n}`]) assert.match(fieldMeta(key).guidance.meaning, new RegExp(`(?:pelatih|baris) ${n}`), key);
  }
  assert.ok(fieldMeta('JAB_FOR').options.some(option => option.value === 'Ketua Sidang'));
});

test('instructions distinguish plan, actual result, date evidence and financial units', () => {
  assert.match(fieldMeta('ANG_MAS').guidance.meaning, /direncanakan/);
  assert.match(fieldMeta('REA_MAS').guidance.meaning, /benar-benar diterima/);
  assert.match(fieldMeta('JUM_HAD').guidance.sourceHint, /bukan total anggota/);
  assert.match(fieldMeta('TGL_BER').guidance.sourceHint, /dapat berbeda/);
  assert.match(fieldMeta('TGL_BER').guidance.howToFill, /jangan menggantinya dengan hari ini/);
  assert.match(fieldMeta('NO_BA').guidance.howToFill, /nomor urut saja/);
  assert.match(fieldMeta('NOM_REK').guidance.howToFill, /nol di awal/);
  assert.match(fieldMeta('NIL').guidance.howToFill, /awalan Rp sudah/);
  for (const key of ['IUR_BLN', 'IUR_THN', 'U_DAFTAR']) {
    assert.match(fieldMeta(key).guidance.howToFill, /nominal uang saja.*terbilang/);
    assert.doesNotMatch(fieldMeta(key).guidance.example, /per /);
  }
  assert.match(fieldMeta('DUR_BAK').guidance.howToFill, /angka saja.*tahun/);
  assert.notEqual(fieldMeta('BAT_LAP').guidance.meaning, fieldMeta('BAT_SEN').guidance.meaning);
  assert.match(fieldMeta('DAF_AKU').guidance.howToFill, /Jangan menuliskan kata sandi/);
});

test('parent logo guidance describes the text field without promising the sanggar image slot', () => {
  const meta = fieldMeta('O_LOGO');
  assert.match(meta.guidance.howToFill, /Kolom ini berupa teks/);
  assert.match(meta.guidance.howToFill, /belum tersedia unggahan gambar terpisah/);
  assert.match(meta.guidance.howToFill, /Unggahan logo sanggar tidak mengisi gambar/);
  assert.doesNotMatch(meta.help, /terisi otomatis|dimasukkan ke Word\/PDF|Gunakan bagian Logo|Unggah gambar pada bagian/);
  assert.match(fieldMeta('LOGO').guidance.howToFill, /Unggah gambar pada bagian/);
});

test('choices carry no defaults and unknown or zero values remain intact', () => {
  for (const key of catalogKeys) {
    const meta = fieldMeta(key);
    assert.equal(Object.hasOwn(meta, 'defaultValue'), false);
    assert.equal(Object.hasOwn(meta, 'default'), false);
    assert.equal(normalizeFieldValue(key, ''), '');
    assert.equal(normalizeFieldValue(key, 0), '0');
    if (meta.type === 'select') {
      assert.ok(meta.options.length >= 3, key);
      assert.ok(meta.options.every(option => typeof option.value === 'string' && option.label && option.value));
      assert.equal(new Set(meta.options.map(option => option.value)).size, meta.options.length);
      assert.equal(normalizeFieldValue(key, 'Nilai khusus 2020'), 'Nilai khusus 2020');
    }
  }
});

test('example choices preserve template units and human meaning', () => {
  assert.deepEqual(fieldMeta('BLN').options[8], { value: 'IX', label: 'September (IX)' });
  assert.equal(fieldMeta('BLN').options.length, 12);
  for (const key of ['DUR_BAK', 'HAR_LPJ_', 'HAR_SER']) assert.ok(fieldMeta(key).options.every(option => /^\d+$/.test(option.value)));
  for (const key of ['BAT_TEG', 'BAT_TUN']) assert.ok(fieldMeta(key).options.every(option => / bulan$/.test(option.value)));
  for (const key of ['MAS_ARS', 'MAS_JAB']) assert.ok(fieldMeta(key).options.every(option => / tahun$/.test(option.value)));
  assert.ok(fieldMeta('KUO_MAY').options.some(option => option.value === 'lebih dari 1/2 (setengah)'));
  assert.match(fieldMeta('KUO_MAY').help, /Pilihan hanya contoh/);
  assert.equal(fieldMeta('TAN_PER').type, 'text');
  assert.equal(fieldMeta('WAKTU_1').type, 'textarea');
});

test('parent organisation fields are clearly distinct but retain matching units', () => {
  for (const key of catalogKeys.filter(key => key.startsWith('O_'))) {
    const meta = fieldMeta(key);
    assert.match(meta.label, /organisasi induk/i, key);
    assert.match(meta.help, /khusus organisasi induk/, key);
  }
  assert.equal(fieldMeta('O_HAR_LP').type, 'select');
  assert.deepEqual(fieldMeta('O_HAR_LP').options, fieldMeta('HAR_LPJ_').options);
  assert.equal(fieldMeta('O_TGL_BE').type, 'date');
  assert.equal(fieldMeta('O_PUK_MU').type, 'time');
});

test('only headings uppercase while names, identifiers, and custom spelling survive', () => {
  assert.equal(normalizeFieldValue('JUDUL', 'Surat untuk Sanggar Éka'), 'SURAT UNTUK SANGGAR ÉKA');
  assert.equal(normalizeFieldValue({ key: 'JUDUL_KEGIATAN' }, 'Pentas seni'), 'PENTAS SENI');
  assert.equal(normalizeFieldValue({ key: 'CUSTOM', isHeading: true }, 'Judul sendiri'), 'JUDUL SENDIRI');
  for (const key of ['NAM_SA2', 'NAM_SANGGAR', 'NAMA_SANGGAR', 'NAMA_KOP', 'NAM_TTD_', 'NAM_PEN', 'KETUA', 'KD', 'NO_BA', 'MED_SOS']) {
    assert.equal(normalizeFieldValue(key, 'Sanggar Éka / AbC-001'), 'Sanggar Éka / AbC-001', key);
  }
  for (const key of ['ID_KETUA', 'NIK_I01', 'NIB', 'NPW', 'NOM_REK', 'NO_BA']) {
    assert.equal(fieldMeta(key).type, 'text', key);
    assert.equal(normalizeFieldValue(key, '00102030'), '00102030', key);
  }
  assert.equal(normalizeFieldValue('EMAIL', 'Nama@Contoh.id'), 'Nama@Contoh.id');
  assert.equal(normalizeFieldValue('TELEPON', '+62 813-0000-0021'), '+62 813-0000-0021');
});

test('calendar conversion accepts explicit dates and rejects impossible or incomplete ones', () => {
  const pairs = [
    ['15 September 2026', '2026-09-15'], ['15 sep 2026', '2026-09-15'], ['15/09/2026', '2026-09-15'],
    ['15.09.2026', '2026-09-15'], ['15-09-2026', '2026-09-15'], ['2026-9-15', '2026-09-15'],
    ['29 Februari 2024', '2024-02-29'], ['29 Februari 2000', '2000-02-29'], ['1 Januari 2026', '2026-01-01'],
  ];
  for (const [text, iso] of pairs) {
    assert.equal(toDateInput(text), iso, text);
    assert.equal(toDateInput(fromDateInput(iso)), iso);
  }
  for (const text of ['', '31 April 2026', '29 Februari 2025', '29 Februari 1900', '2026-13-01', '2026-02-30', '0000-01-01', 'September 2026', '2026', '15–17 September 2026']) assert.equal(toDateInput(text), '', text);
  assert.equal(fromDateInput('2026-09-15'), '15 September 2026');
});

test('legacy date text is retained and never rewritten merely by normalization', () => {
  for (const text of ['Sekitar 1990', '15–17 September 2026', 'September 2026', '2026-02-30', '  15/9/2026  ', '']) {
    assert.equal(fromDateInput(text), text);
    assert.equal(normalizeFieldValue('TGL_BER', text), text);
  }
});

test('calendar dates are identical in Jakarta and timezones on both sides of UTC', () => {
  const url = new URL('../public/assets/native-fields-20260915.mjs', import.meta.url).href;
  const code = `import {toDateInput,fromDateInput} from ${JSON.stringify(url)};process.stdout.write(JSON.stringify([toDateInput('1 Januari 2026'),fromDateInput('2026-01-01')]));`;
  for (const TZ of ['Asia/Jakarta', 'Pacific/Honolulu', 'Pacific/Kiritimati']) {
    const output = execFileSync(process.execPath, ['--input-type=module', '-e', code], { encoding: 'utf8', env: { ...process.env, TZ } });
    assert.deepEqual(JSON.parse(output), ['2026-01-01', '1 Januari 2026'], TZ);
  }
});
