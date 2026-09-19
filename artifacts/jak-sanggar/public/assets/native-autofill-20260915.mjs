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
const sameName = (a, b) => !!text(a) && text(a).replace(/\s+/g, ' ').toLocaleLowerCase('id-ID') === text(b).replace(/\s+/g, ' ').toLocaleLowerCase('id-ID');
const shortBodyName = value => text(value).replace(/^(?:yayasan|perkumpulan(?:\s+berbadan\s+hukum)?|koperasi|firma(?:\s*\(fa\))?|perseroan\s+terbatas|persekutuan\s+komanditer|pt\.?|cv\.?)\s+/i, '');

function registeredGroupMatches(p, groupId) {
  const legalGroup = {
    yayasan: 'yayasan', perkumpulan: 'perkumpulan', 'perkumpulan / perserikatan': 'perkumpulan',
    koperasi: 'koperasi', pt: 'perseroan-terbatas', 'pt.': 'perseroan-terbatas',
    'pt perorangan': 'perseroan-terbatas', 'perseroan terbatas': 'perseroan-terbatas',
    cv: 'persekutuan-komanditer', 'cv.': 'persekutuan-komanditer',
    'persekutuan komanditer': 'persekutuan-komanditer', firma: 'firma', 'firma (fa)': 'firma',
  }[text(p.legalitas).toLowerCase()];
  return legalGroup ? groupId.endsWith('-' + legalGroup) :
    (p.bentukKedudukan === 'unit-non-bh' && groupId === 'unit-nonbadan-hukum') ||
    (p.bentukKedudukan === 'mandiri-non-bh' && groupId === 'mandiri-nonbadan-hukum');
}

// These properties name the parent explicitly. Generic sanggar contact details
// and a chief's identity are never substituted for a parent's details/signatory.
function explicitParentValues(p, groupId) {
  if (!groupId.startsWith('unit-')) return {};
  const values = {};
  const name = text(p.namaInduk);
  if (name) values.NAM_IN2 = groupId === 'unit-nonbadan-hukum' ? name : shortBodyName(name);
  for (const [property, aliases] of [
    ['alamatInduk', ['O_ALAMAT', 'ALA_LEN']], ['teleponInduk', ['TEL_IND']],
    ['emailInduk', ['EMA_IND']], ['npwpInduk', ['NPW_IND']], ['nibInduk', ['NIB_IND']],
  ]) if (text(p[property])) for (const alias of aliases) values[alias] = text(p[property]);
  return values;
}

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

  // Choosing another legal form must not relabel a registered Yayasan as a CV.
  const groupMatches = registeredGroupMatches(p, groupId);
  if (groupMatches) {
    const badan = text(p.namaBadanHukum);
    if (badan) {
      const shortName = shortBodyName(badan);
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

const months = ['januari', 'februari', 'maret', 'april', 'mei', 'juni', 'juli', 'agustus', 'september', 'oktober', 'november', 'desember'];
const romanMonths = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
function exactDate(value) {
  const raw = text(value).toLocaleLowerCase('id-ID');
  let match, year, month, day;
  if ((match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw))) [, year, month, day] = match;
  else if ((match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(raw))) [, day, month, year] = match;
  else if ((match = /^(\d{1,2})\s+([a-z]+)\s+(\d{4})$/.exec(raw))) {
    [, day, month, year] = match;
    month = months.indexOf(month) + 1;
  } else return null;
  year = Number(year); month = Number(month); day = Number(day);
  if (year < 1000 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return { year: String(year), month: romanMonths[month - 1], day: days[date.getUTCDay()] };
}

// Accept explicit whole rupiah only. Do not round fractions, infer schedules,
// interpret scientific notation, or turn an ambiguous amount into a commitment.
function rupiahWords(value) {
  const raw = text(value).replace(/^Rp\.?\s*/i, '').replace(/\s+rupiah$/i, '');
  if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,00)?$/.test(raw)) return '';
  const amount = Number(raw.replace(/,00$/, '').replace(/\./g, ''));
  if (!Number.isSafeInteger(amount) || amount < 0 || amount >= 1e15) return '';
  const small = ['nol', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan', 'sepuluh', 'sebelas'];
  const words = n => {
    if (n < 12) return small[n];
    if (n < 20) return `${words(n - 10)} belas`;
    const rest = divisor => n % divisor ? ` ${words(n % divisor)}` : '';
    if (n < 100) return `${words(Math.floor(n / 10))} puluh${rest(10)}`;
    if (n < 200) return `seratus${rest(100)}`;
    if (n < 1000) return `${words(Math.floor(n / 100))} ratus${rest(100)}`;
    if (n < 2000) return `seribu${rest(1000)}`;
    for (const [limit, divisor, unit] of [[1e6, 1e3, 'ribu'], [1e9, 1e6, 'juta'], [1e12, 1e9, 'miliar'], [1e15, 1e12, 'triliun']]) {
      if (n < limit) return `${words(Math.floor(n / divisor))} ${unit}${rest(divisor)}`;
    }
    return '';
  };
  const result = `${words(amount)} rupiah`;
  return result[0].toUpperCase() + result.slice(1);
}

/**
 * Propose fills for this active template without changing profile or values.
 * A missing property is unfilled; an own property (even '') is a user's value.
 * The UI may omit its previously generated properties before calling again.
 */
export function deriveAutofill(profile = {}, values = {}, {groupId = '', fields = []} = {}) {
  const current = isRecord(values) ? values : {};
  const active = new Map((Array.isArray(fields) ? fields : []).map(field =>
    [typeof field === 'string' ? field : field?.key, field]).filter(([key]) => typeof key === 'string' && safeKey(key)));
  const proposed = {}, sources = {};
  const propose = (key, value, source) => {
    if (!active.has(key) || own(current, key) || own(proposed, key) || !text(value)) return;
    proposed[key] = cleanAutofillValue(value);
    sources[key] = source;
  };
  const registered = !profile?.role || profile.role === 'sanggar' ? profileValues(profile, String(groupId)) : {};
  const profileAllowed = !profile?.role || profile.role === 'sanggar';
  const bodyName = first(profile?.namaInduk, profile?.namaBadanHukum);
  const unchangedIdentity = keys => !!bodyName && keys.every(key =>
    !own(current, key) || sameName(shortBodyName(current[key]), shortBodyName(bodyName)));
  const blocked = new Set();
  const sameMeaning = String(groupId).startsWith('unit-') ? [...identityFamilies, ['O_ALAMAT','ALA_LEN']] : identityFamilies;
  for (const aliases of sameMeaning) {
    const present = aliases.filter(key => own(current, key));
    if (!present.length) continue;
    const choices = new Set(present.map(key => cleanAutofillValue(current[key])));
    for (const key of aliases) blocked.add(key);
    if (choices.size === 1 && [...choices][0]) for (const key of aliases) {
      propose(key, [...choices][0], 'Identitas yang sama pada isian');
    }
  }
  if (profileAllowed && registeredGroupMatches(profile || {}, String(groupId)) && unchangedIdentity(['NAM_IN2','NAM_PE3'])) {
    for (const [key, value] of Object.entries(explicitParentValues(profile || {}, String(groupId)))) {
      if (!blocked.has(key)) propose(key, value, 'Identitas induk yang tercatat pada profil');
    }
  }
  for (const [key, value] of Object.entries(registered)) if (!blocked.has(key)) propose(key, value, 'Pendaftaran / profil');
  // NPW and NPWP are equivalent only for a matching standalone legal body.
  if (profileAllowed && String(groupId).startsWith('mandiri-') && registeredGroupMatches(profile || {}, String(groupId))) {
    if ((!bodyName || unchangedIdentity(['NAM_BA2','NAM_PE3'])) && (!own(current, 'NPWP') || text(current.NPWP))) propose('NPW', own(current, 'NPWP') ? current.NPWP : registered.NPWP, 'NPWP badan pada profil / isian');
    const bank = profile?.rekening;
    const bankFields = ['BAN', 'NOM_REK', 'NAM_REK'];
    const bankValues = {BAN: text(bank?.bank), NOM_REK: text(bank?.nomor), NAM_REK: text(bank?.atasNama)};
    const contexts = bankFields.map(key => active.get(key)?.context || '').join(' ');
    const knownBodyBank = bankFields.every(key => active.has(key)) && /\{\{BAN\}\}.*\{\{NOM_REK\}\}.*\{\{NAM_REK\}\}/.test(contexts);
    if (knownBodyBank && !text(profile?.bentukKedudukan).startsWith('unit-') && !/mitra|pihak\s+(?:kedua|lain|2)|pelatih/i.test(contexts) &&
        unchangedIdentity(['NAM_BA2','NAM_PE3']) && sameName(bank?.atasNama, profile?.namaBadanHukum) && bankFields.every(key => bankValues[key] && (!own(current, key) || text(current[key]) === bankValues[key]))) {
      for (const key of bankFields) propose(key, bankValues[key], 'Rekening profil atas nama badan yang sama');
    }
  }
  const dateRules = [
    ['TGL_FOR', [['HAR_FOR', 'day'], ['BLN', 'month'], ['THN', 'year']], 'Dari tanggal forum'],
    ['TAN_RAP', [['HAR', 'day']], 'Dari tanggal rapat'],
    ['TGL_SK_A', [['BLN_ATR', 'month'], ['THN_ATR', 'year']], 'Dari tanggal keputusan atribut'],
    ['TGL_SK_K', [['BLN_KEU', 'month'], ['THN_KEU', 'year']], 'Dari tanggal keputusan keuangan'],
    ['TGL_SK_P', [['BLN_PLT', 'month'], ['THN_PLT', 'year']], 'Dari tanggal keputusan pelatih'],
    ['TGL_AWA_', [['THN_AWA_', 'year']], 'Dari tanggal mulai masa bakti'],
    ['TGL_AKH_', [['THN_AKH_', 'year']], 'Dari tanggal selesai masa bakti'],
    ['O_TGL_FO', [['O_HAR_FO', 'day'], ['O_BLN', 'month'], ['O_THN', 'year']], 'Dari tanggal forum organisasi induk'],
  ];
  // General signing dates are used only when this template actually requests
  // that date, and its numbering is not tied to the shared forum date.
  if (active.has('TAN') && !active.has('TGL_FOR') && !own(current, 'TGL_FOR')) dateRules.push(['TAN', [['BLN', 'month'], ['THN', 'year']], 'Dari tanggal penandatanganan']);
  for (const [source, targets, label] of dateRules) {
    const date = exactDate(current[source]);
    if (date) for (const [target, part] of targets) propose(target, date[part], label);
  }
  for (const [source, target, label] of [
    ['IUR_BLN', 'TER_BLN', 'iuran bulanan'], ['IUR_THN', 'TER_THN', 'iuran tahunan'], ['U_DAFTAR', 'TER_DAF', 'biaya pendaftaran'],
    ['O_IUR_BL', 'O_TER_BL', 'iuran bulanan organisasi induk'], ['O_IUR_TH', 'O_TER_TH', 'iuran tahunan organisasi induk'], ['O_U_DAFT', 'O_TER_DA', 'biaya pendaftaran organisasi induk'],
  ]) propose(target, rupiahWords(current[source]), `Terbilang dari ${label}`);
  return {values: proposed, sources};
}
