const PROVINSI_INDONESIA = [
  "Aceh",
  "Sumatera Utara",
  "Sumatera Barat",
  "Riau",
  "Kepulauan Riau",
  "Jambi",
  "Sumatera Selatan",
  "Kepulauan Bangka Belitung",
  "Bengkulu",
  "Lampung",
  "Banten",
  "Jawa Barat",
  "Jawa Tengah",
  "Daerah Istimewa Yogyakarta",
  "Jawa Timur",
  "Bali",
  "Nusa Tenggara Barat",
  "Nusa Tenggara Timur",
  "Kalimantan Barat",
  "Kalimantan Tengah",
  "Kalimantan Selatan",
  "Kalimantan Timur",
  "Kalimantan Utara",
  "Sulawesi Utara",
  "Gorontalo",
  "Sulawesi Tengah",
  "Sulawesi Barat",
  "Sulawesi Selatan",
  "Sulawesi Tenggara",
  "Maluku",
  "Maluku Utara",
  "Papua",
  "Papua Barat",
  "Papua Selatan",
  "Papua Tengah",
  "Papua Pegunungan",
  "Papua Barat Daya",
] as const;

// Nama terpanjang harus dicocokkan lebih dulu agar "Kepulauan Riau" tidak
// terpotong menjadi "Riau" dan "Papua Barat" tidak menjadi "Papua".
const PROVINSI_UNTUK_PENCARIAN = [...PROVINSI_INDONESIA].sort(
  (left, right) => right.length - left.length,
);

function normalisasiProvinsi(value: string) {
  const cleaned = value.replace(/^provinsi\s+/i, "").trim();
  return /(?:dki|daerah khusus(?: ibukota)?)?\s*jakarta/i.test(cleaned)
    ? "Jakarta"
    : cleaned;
}

/**
 * Tempat di atas blok tanda tangan adalah provinsi, bukan alamat lengkap atau
 * kota/kabupaten. Profil terstruktur menjadi sumber utama; alamat bebas hanya
 * dipakai untuk menemukan nama provinsi ketika data terstruktur belum ada.
 */
export function tempatTandaTanganDariProvinsi(
  provinsi: string | undefined,
  ...alamat: Array<string | undefined>
) {
  if (provinsi?.trim()) return normalisasiProvinsi(provinsi);

  const gabunganAlamat = alamat.filter(Boolean).join(" ");
  if (/\bjakarta(?:\s+(?:pusat|utara|barat|selatan|timur))?\b/i.test(gabunganAlamat)) {
    return "Jakarta";
  }

  const normalizedAddress = gabunganAlamat.toLocaleLowerCase("id-ID");
  const ditemukan = PROVINSI_UNTUK_PENCARIAN.find((nama) =>
    normalizedAddress.includes(nama.toLocaleLowerCase("id-ID")),
  );
  return ditemukan ?? "Jakarta";
}
