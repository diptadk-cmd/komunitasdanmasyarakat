type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * Direktori akun hanya membutuhkan metadata profil. Blob `data:` dapat
 * berukuran beberapa megabyte per Sanggar dan membuat snapshot melebihi kuota
 * localStorage browser Kurator, jadi blob dibuang tanpa mengubah sumber DB.
 */
function withoutEmbeddedData(value: unknown): unknown {
  if (typeof value === "string") {
    return value.trimStart().toLowerCase().startsWith("data:")
      ? undefined
      : value;
  }
  if (Array.isArray(value)) {
    return value
      .map((item) => withoutEmbeddedData(item))
      .filter((item) => item !== undefined);
  }
  if (!isRecord(value)) return value;

  const result: JsonRecord = {};
  for (const [key, child] of Object.entries(value)) {
    const sanitized = withoutEmbeddedData(child);
    if (sanitized !== undefined) result[key] = sanitized;
  }
  return result;
}

export function summarizeProfileForDirectory(profile: JsonRecord): JsonRecord {
  return withoutEmbeddedData(profile) as JsonRecord;
}
