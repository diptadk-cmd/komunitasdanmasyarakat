export const WILAYAH_JAKARTA = [
  "Jakarta Selatan",
  "Jakarta Timur",
  "Jakarta Pusat",
  "Jakarta Barat",
  "Jakarta Utara",
  "Kepulauan Seribu",
] as const;

export type WilayahJakarta = (typeof WILAYAH_JAKARTA)[number];

/** Menambahkan wilayah ke alamat tanpa membuatnya terduplikasi. */
export function withWilayahJakarta(alamat: string, wilayah: string): string {
  const trimmed = alamat.trim();
  if (!wilayah) return trimmed;
  if (trimmed.toLowerCase().includes(wilayah.toLowerCase())) return trimmed;
  return trimmed ? `${trimmed}, ${wilayah}, DKI Jakarta` : `${wilayah}, DKI Jakarta`;
}
