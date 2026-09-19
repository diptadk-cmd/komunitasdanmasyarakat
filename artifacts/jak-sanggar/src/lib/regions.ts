// Helper data wilayah Indonesia.
// Sumber: API publik Emsifa (https://github.com/emsifa/api-wilayah-indonesia)
// — endpoint statis di GitHub Pages, mendukung CORS, tanpa auth.
//
// Skema id (BPS):
//   province  : 2 digit  (DKI Jakarta = "31")
//   regency   : 4 digit  (kota/kabupaten)
//   district  : 7 digit  (kecamatan)
//   village   : 10 digit (kelurahan/desa)

export interface Wilayah {
  id: string;
  name: string;
}

const BASE = "https://www.emsifa.com/api-wilayah-indonesia/api";

export const DKI_PROVINCE_ID = "31";
export const DKI_PROVINCE_NAME = "DKI JAKARTA";

// Daftar 38 provinsi Indonesia (kode BPS) sebagai cadangan offline. Dipakai
// segera saat mode "all-id" agar dropdown provinsi tidak pernah kosong meski
// API wilayah tak terjangkau; bila API berhasil, hasilnya menimpa daftar ini.
export const INDONESIA_PROVINCES: Wilayah[] = [
  { id: "11", name: "ACEH" },
  { id: "12", name: "SUMATERA UTARA" },
  { id: "13", name: "SUMATERA BARAT" },
  { id: "14", name: "RIAU" },
  { id: "15", name: "JAMBI" },
  { id: "16", name: "SUMATERA SELATAN" },
  { id: "17", name: "BENGKULU" },
  { id: "18", name: "LAMPUNG" },
  { id: "19", name: "KEPULAUAN BANGKA BELITUNG" },
  { id: "21", name: "KEPULAUAN RIAU" },
  { id: "31", name: "DKI JAKARTA" },
  { id: "32", name: "JAWA BARAT" },
  { id: "33", name: "JAWA TENGAH" },
  { id: "34", name: "DAERAH ISTIMEWA YOGYAKARTA" },
  { id: "35", name: "JAWA TIMUR" },
  { id: "36", name: "BANTEN" },
  { id: "51", name: "BALI" },
  { id: "52", name: "NUSA TENGGARA BARAT" },
  { id: "53", name: "NUSA TENGGARA TIMUR" },
  { id: "61", name: "KALIMANTAN BARAT" },
  { id: "62", name: "KALIMANTAN TENGAH" },
  { id: "63", name: "KALIMANTAN SELATAN" },
  { id: "64", name: "KALIMANTAN TIMUR" },
  { id: "65", name: "KALIMANTAN UTARA" },
  { id: "71", name: "SULAWESI UTARA" },
  { id: "72", name: "SULAWESI TENGAH" },
  { id: "73", name: "SULAWESI SELATAN" },
  { id: "74", name: "SULAWESI TENGGARA" },
  { id: "75", name: "GORONTALO" },
  { id: "76", name: "SULAWESI BARAT" },
  { id: "81", name: "MALUKU" },
  { id: "82", name: "MALUKU UTARA" },
  { id: "91", name: "PAPUA" },
  { id: "92", name: "PAPUA BARAT" },
  { id: "93", name: "PAPUA SELATAN" },
  { id: "94", name: "PAPUA TENGAH" },
  { id: "95", name: "PAPUA PEGUNUNGAN" },
  { id: "96", name: "PAPUA BARAT DAYA" },
];

async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Gagal memuat wilayah (${res.status})`);
  return (await res.json()) as T;
}

export function fetchProvinces(signal?: AbortSignal): Promise<Wilayah[]> {
  // Cadangan offline: bila API gagal, kembalikan daftar bawaan agar pemilihan
  // provinsi tetap bisa dilakukan (level di bawahnya tetap butuh API).
  return fetchJson<Wilayah[]>(`${BASE}/provinces.json`, signal).catch((err) => {
    if (signal?.aborted) throw err;
    return INDONESIA_PROVINCES;
  });
}

export function fetchRegencies(
  provinceId: string,
  signal?: AbortSignal,
): Promise<Wilayah[]> {
  return fetchJson<Wilayah[]>(`${BASE}/regencies/${provinceId}.json`, signal);
}

export function fetchDistricts(
  regencyId: string,
  signal?: AbortSignal,
): Promise<Wilayah[]> {
  return fetchJson<Wilayah[]>(`${BASE}/districts/${regencyId}.json`, signal);
}

export function fetchVillages(
  districtId: string,
  signal?: AbortSignal,
): Promise<Wilayah[]> {
  return fetchJson<Wilayah[]>(`${BASE}/villages/${districtId}.json`, signal);
}

export interface AlamatWilayah {
  provinsi?: string;
  provinsiId?: string;
  kota?: string;
  kotaId?: string;
  kecamatan?: string;
  kecamatanId?: string;
  kelurahan?: string;
  kelurahanId?: string;
  kodePos?: string;
}

export function formatAlamatWilayah(
  w: AlamatWilayah | undefined,
  detail?: string,
): string {
  if (!w) return detail ?? "";
  const parts = [
    detail?.trim(),
    w.kelurahan,
    w.kecamatan,
    w.kota,
    w.provinsi,
  ].filter(Boolean);
  let hasil = parts.join(", ");
  // Kode pos diletakkan di akhir mengikuti kaidah penulisan alamat.
  if (w.kodePos?.trim()) hasil = hasil ? `${hasil} ${w.kodePos.trim()}` : w.kodePos.trim();
  return hasil;
}
