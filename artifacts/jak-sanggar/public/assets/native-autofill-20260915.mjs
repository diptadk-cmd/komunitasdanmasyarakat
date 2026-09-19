// Explicit identity aliases only. Generic names, signatories, member records,
// document dates/numbers and parent-organisation fields must not cross forms.
const identityFamilies = [
  ['NAM_SA2', 'NAM_SANGGAR', 'NAMA_SANGGAR', 'namaSanggar'],
  ['ALAMAT', 'ALA_LE2', 'ALAMAT_LENGKAP_SANGGAR', 'ALAMAT_SANGGAR', 'alamatSanggar'],
  ['EMAIL', 'EMA_SAN', 'EMAIL_SANGGAR', 'emailSanggar'],
  ['TELEPON', 'TEL_SAN', 'TELEPON_SANGGAR', 'WHATSAPP_SANGGAR', 'teleponSanggar'],
  ['MED_SOS', 'MEDIA_SOSIAL_SANGGAR'],
  ['KETUA', 'NAMA_KETUA_SANGGAR', 'namaKetua'],
  ['SEK', 'NAMA_SEKRETARIS_SANGGAR', 'namaSekretaris'],
  ['BEN', 'NAMA_BENDAHARA_SANGGAR', 'namaBendahara'],
  ['WAK_KET', 'NAMA_WAKIL_KETUA_SANGGAR', 'namaWakilKetua'],
  ['BID_SEN', 'TAR_MU2', 'TAR_MUS', 'BIDANG_SENI', 'TARI/MUSIK/TEATER/SASTRA/RUPA/MULTIDISIPLIN', 'TARI/MUSIK/TEATER/SASTRA/SENI_RUPA/MULTIDISIPLIN/LAINNYA'],
  ['TGL_BER', 'TANGGAL_BERDIRI_SANGGAR', 'tanggalBerdiriSanggar'],
];
// Legacy forms can contain a generic ALAMAT / NAMA / EMAIL for an individual
// table row. Only explicitly sanggar-labelled legacy tokens are safe to import.
const legacyIdentityKeys = new Set([
  'NAMA_SANGGAR', 'namaSanggar', 'ALAMAT_LENGKAP_SANGGAR', 'ALAMAT_SANGGAR', 'alamatSanggar',
  'EMAIL_SANGGAR', 'emailSanggar', 'TELEPON_SANGGAR', 'WHATSAPP_SANGGAR', 'teleponSanggar',
  'MEDIA_SOSIAL_SANGGAR', 'NAMA_KETUA_SANGGAR', 'NAMA_SEKRETARIS_SANGGAR',
  'NAMA_BENDAHARA_SANGGAR', 'NAMA_WAKIL_KETUA_SANGGAR', 'BIDANG_SENI',
  'TARI/MUSIK/TEATER/SASTRA/RUPA/MULTIDISIPLIN', 'TARI/MUSIK/TEATER/SASTRA/SENI_RUPA/MULTIDISIPLIN/LAINNYA',
  'TANGGAL_BERDIRI_SANGGAR', 'tanggalBerdiriSanggar',
]);
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const safeKey = key => !['__proto__', 'constructor', 'prototype'].includes(key) && !key.startsWith('__');

/** Keep explicit values, including 0/false and date notation; clean placeholders. */
export function cleanAutofillValue(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  if (typeof value === 'boolean') return String(value);
  if (typeof value !== 'string') return '';
  return /^[-–—\s]*$/.test(value) ? '' : value;
}
const text = value => cleanAutofillValue(value).trim();
const legacyPlaceholder = value => typeof value === 'string' && /^[-–—\s]+$/.test(value) && /[-–—]/.test(value);
const usableSaved = value => ['string', 'number', 'boolean'].includes(typeof value) && !legacyPlaceholder(value);
const first = (...values) => values.map(text).find(Boolean) || '';
const own = (record, key) => isRecord(record) && Object.hasOwn(record, key);
const nativeGroup = key => typeof key === 'string' && key.includes(':native-fix-') ? key.slice(key.indexOf(':native-fix-') + 12) : '';

function profileValues(profile, groupId) {
  const p = isRecord(profile) ? profile : {};
  const values = {};
  const setFamily = (index, value) => {
    if (text(value)) for (const key of identityFamilies[index]) values[key] = text(value);
  };
  setFamily(0, p.namaSanggar);
  setFamily(1, typeof p.alamat === 'string' ? p.alamat : first(p.alamat?.alamatLengkap, p.alamat?.jalan));
  setFamily(2, p.email);
  setFamily(3, first(p.noHp, p.telepon, p.whatsapp));
  setFamily(4, first(p.mediaSosial, [text(p.instagram), text(p.website)].filter(Boolean).join(' · ')));
  setFamily(5, p.namaKetua);
  setFamily(6, p.namaSekretaris);
  setFamily(7, p.namaBendahara);
  setFamily(8, p.namaWakilKetua);
  setFamily(9, Array.isArray(p.jenisKesenian) ? p.jenisKesenian.map(text).filter(Boolean).join('\n') : p.jenisKesenian);
  // A year alone is not a founding date. Use only an explicitly recorded date.
  setFamily(10, p.tanggalBerdiriSanggar);

  const legalitas = text(p.legalitas).toLowerCase();
  const legalGroup = {
    yayasan: 'yayasan', perkumpulan: 'perkumpulan', 'perkumpulan / perserikatan': 'perkumpulan',
    koperasi: 'koperasi', pt: 'perseroan-terbatas', 'pt.': 'perseroan-terbatas',
    'pt perorangan': 'perseroan-terbatas', 'perseroan terbatas': 'perseroan-terbatas',
    cv: 'persekutuan-komanditer', 'cv.': 'persekutuan-komanditer',
    'persekutuan komanditer': 'persekutuan-komanditer', firma: 'firma', 'firma (fa)': 'firma',
  }[legalitas];
  // Choosing another legal form must not relabel a registered Yayasan as a CV.
  const groupMatches = legalGroup ? groupId.endsWith('-' + legalGroup) :
    (p.bentukKedudukan === 'unit-non-bh' && groupId === 'unit-nonbadan-hukum') ||
    (p.bentukKedudukan === 'mandiri-non-bh' && groupId === 'mandiri-nonbadan-hukum');
  if (groupMatches) {
    const badan = text(p.namaBadanHukum);
    if (badan) {
      const shortName = badan.replace(/^(?:yayasan|perkumpulan(?:\s+berbadan\s+hukum)?|koperasi|firma(?:\s*\(fa\))?|perseroan\s+terbatas|persekutuan\s+komanditer|pt\.?|cv\.?)\s+/i, '');
      values.NAM_PE3 = badan;
      if (groupId.startsWith('unit-')) values.NAM_IN2 = groupId === 'unit-nonbadan-hukum' ? badan : shortName;
      else if (groupId !== 'mandiri-nonbadan-hukum') values.NAM_BA2 = shortName;
    }
    if (groupId.startsWith('mandiri-')) {
      if (text(p.npwp)) values.NPWP = text(p.npwp);
      if (text(p.nib)) values.NIB = text(p.nib);
    }
  }
  return values;
}

/**
 * Build values without changing source objects.
 * Priority: selected saved form (including explicit blanks), current registration
 * / profile, then consensus identity fields from the same sanggar's other forms.
 * relatedSources: [{sanggarId, values, groupId?, updatedAt?}].
 * sources maps each populated field to a short Indonesian origin label.
 */
export function buildAutofill(profile = {}, savedValues = {}, saveKey = '', relatedSources = []) {
  if (profile?.role && profile.role !== 'sanggar') return { values: {}, sources: {} };
  const sanggarId = text(profile?.id);
  const belongs = key => !!sanggarId && typeof key === 'string' && key.startsWith(sanggarId + ':');
  const candidates = [];
  if (isRecord(savedValues)) for (const [key, values] of Object.entries(savedValues)) {
    if (belongs(key) && key !== saveKey && isRecord(values)) candidates.push({values, native: !!nativeGroup(key)});
  }
  if (sanggarId && Array.isArray(relatedSources)) for (const source of relatedSources) {
    if (source?.sanggarId === sanggarId && isRecord(source.values)) candidates.push({values: source.values, native: false});
  }
  const values = {}, sources = {};
  for (const aliases of identityFamilies) {
    const choices = new Set();
    for (const candidate of candidates) for (const key of aliases) {
      if ((candidate.native || legacyIdentityKeys.has(key)) && own(candidate.values, key) && text(candidate.values[key])) choices.add(text(candidate.values[key]));
    }
    // Conflicting records need the user's choice; do not guess from ordering.
    if (choices.size === 1) for (const key of aliases) {
      values[key] = [...choices][0];
      sources[key] = 'Formulir lain';
    }
  }
  for (const [key, value] of Object.entries(profileValues(profile, nativeGroup(saveKey)))) {
    values[key] = value;
    sources[key] = 'Pendaftaran / profil';
  }
  const selected = belongs(saveKey) && own(savedValues, saveKey) && isRecord(savedValues[saveKey]) ? savedValues[saveKey] : {};
  // Keep equivalent fields consistent when only one alias has been edited.
  // When the user explicitly saved different aliases, preserve every edit.
  for (const aliases of identityFamilies) {
    const selectedAliases = aliases.filter(key => own(selected, key) && usableSaved(selected[key]));
    const choices = new Set(selectedAliases.map(key => cleanAutofillValue(selected[key])));
    if (choices.size === 1) for (const key of aliases) {
      values[key] = [...choices][0];
      if (values[key]) sources[key] = 'Formulir tersimpan';
      else delete sources[key];
    }
  }
  for (const [key, value] of Object.entries(selected)) {
    if (!safeKey(key) || !usableSaved(value)) continue;
    values[key] = cleanAutofillValue(value);
    if (values[key]) sources[key] = 'Formulir tersimpan';
    else delete sources[key];
  }
  return { values, sources };
}
