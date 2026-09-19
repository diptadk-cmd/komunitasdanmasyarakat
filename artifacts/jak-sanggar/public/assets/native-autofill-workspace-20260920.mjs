import { buildAutofill, deriveAutofill } from './native-autofill-20260915.mjs?v=guided-1';

export const GENERATED_AUTOFILL_KEY = '__autofill_generated';
const own = (value, key) => Object.hasOwn(value, key);
const safeKey = key => !key.startsWith('__') && !['constructor', 'prototype'].includes(key);

function savedGenerated(selected) {
  try {
    const value = selected?.[GENERATED_AUTOFILL_KEY];
    if (typeof value !== 'string' || value.length > 100000) return {};
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed).filter(([key, text]) => safeKey(key) && typeof text === 'string' && text.length <= 10000));
  } catch { return {}; }
}

/** Keep automatic dependencies live, including after save/reload, without
 * replacing a field the user has edited or deliberately cleared. */
export function workspaceAutofill(profile, savedValues, saveKey, relatedSources, edits, fields, groupId) {
  const base = buildAutofill(profile, savedValues, saveKey, relatedSources);
  const values = { ...base.values, ...edits }, sources = { ...base.sources };
  const selected = profile?.id && saveKey.startsWith(profile.id + ':') ? savedValues?.[saveKey] : {};
  const generated = savedGenerated(selected);
  const currentKeys = new Set(fields.map(field => typeof field === 'string' ? field : field.key));
  const derivationInput = { ...values };
  for (const [key, prior] of Object.entries(generated)) {
    if (own(edits, key) || values[key] !== prior) { delete generated[key]; continue; }
    if (currentKeys.has(key)) { delete derivationInput[key]; delete values[key]; delete sources[key]; delete generated[key]; }
  }
  const derived = deriveAutofill(profile, derivationInput, { groupId, fields });
  for (const [key, value] of Object.entries(derived.values)) {
    if (!currentKeys.has(key) || !safeKey(key) || own(edits, key)) continue;
    values[key] = value; sources[key] = derived.sources[key]; generated[key] = value;
  }
  return { values, sources, generated, baseValues: base.values };
}
