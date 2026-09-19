export function dokumenPaketUrl(baseUrl: string, paketId: string): string {
  const base = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return `${base}dokumen-paket/${encodeURIComponent(paketId)}.json`;
}
