type ReferenceMap = ReadonlyMap<string, string>;

function canonicalizeUserReferences(
  value: unknown,
  byRawValue: ReferenceMap,
  referenceKeys: ReadonlySet<string>,
  parentKey?: string,
): unknown {
  if (typeof value === "string") {
    if (!parentKey || !referenceKeys.has(parentKey)) return value;
    return byRawValue.get(value) ?? value;
  }
  if (Array.isArray(value)) {
    return value.map((item) =>
      canonicalizeUserReferences(item, byRawValue, referenceKeys, parentKey),
    );
  }
  if (value === null || typeof value !== "object") return value;

  const normalized: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    // Beberapa struktur (mis. scores/finalized) memakai token user sebagai
    // object key, jadi key juga perlu dikanonisasi bila telah di-resolve.
    const normalizedKey = byRawValue.get(key) ?? key;
    normalized[normalizedKey] = canonicalizeUserReferences(
      item,
      byRawValue,
      referenceKeys,
      key,
    );
  }
  return normalized;
}

/**
 * Bandingkan snapshot JSON setelah seluruh bentuk referensi user yang telah
 * di-resolve (`username:...`, `user:<uuid>`, atau id langsung) diubah menjadi
 * id server yang sama. Field bisnis lain tetap dibandingkan secara ketat.
 */
export function sameJsonWithResolvedUserReferences(input: {
  left: unknown;
  right: unknown;
  rootKey?: string;
  byRawValue: ReferenceMap;
  referenceKeys: ReadonlySet<string>;
}): boolean {
  const left = canonicalizeUserReferences(
    input.left,
    input.byRawValue,
    input.referenceKeys,
    input.rootKey,
  );
  const right = canonicalizeUserReferences(
    input.right,
    input.byRawValue,
    input.referenceKeys,
    input.rootKey,
  );
  return JSON.stringify(left) === JSON.stringify(right);
}
