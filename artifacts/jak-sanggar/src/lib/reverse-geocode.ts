import type { AlamatWilayah } from "./regions";

type UnknownRecord = Record<string, unknown>;

export interface HasilReverseGeocode {
  wilayah: AlamatWilayah;
  alamatDetail?: string;
  alamatTampilan?: string;
}

function asRecord(value: unknown): UnknownRecord | undefined {
  return value !== null && typeof value === "object"
    ? (value as UnknownRecord)
    : undefined;
}

function pick(record: UnknownRecord, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

function namaDasar(value?: string): string {
  return (value ?? "")
    .replace(
      /^(DAERAH KHUSUS IBUKOTA|KOTA ADMINISTRASI|KABUPATEN|KOTA|KECAMATAN|KELURAHAN|DESA|PROVINSI)\s+/i,
      "",
    )
    .replace(/[^A-Z0-9]+/gi, " ")
    .trim()
    .toUpperCase();
}

function namaSama(left?: string, right?: string): boolean {
  const a = namaDasar(left);
  const b = namaDasar(right);
  return Boolean(a && b && (a === b || a.includes(b) || b.includes(a)));
}

function bagianTampilan(value?: string): string[] {
  return (value ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function cariBagian(parts: string[], value?: string): number {
  if (!value) return -1;
  return parts.findIndex((part) => namaSama(part, value));
}

function bukanBagianAlamatAdministratif(
  part: string,
  values: Array<string | undefined>,
): boolean {
  if (/^(RT|RW)\s*\d+/i.test(part)) return false;
  if (/^\d{5}$/.test(part)) return false;
  return !values.some((value) => namaSama(part, value));
}

/**
 * Menormalkan hasil reverse-geocoding Nominatim menjadi struktur formulir.
 * Beberapa objek OSM tidak memberi label kecamatan/kelurahan secara lengkap;
 * untuk kasus itu hierarki pada display_name dipakai sebagai cadangan.
 */
export function normalizeAlamatFromReverse(data: unknown): HasilReverseGeocode {
  const root = asRecord(data) ?? {};
  const address = asRecord(root.address) ?? root;
  const alamatTampilan = pick(root, "display_name");
  const parts = bagianTampilan(alamatTampilan);

  const state = pick(address, "state", "region", "province");
  const jakarta = [
    state,
    pick(address, "city"),
    pick(address, "city_district"),
    alamatTampilan,
  ].some((value) => /JAKARTA/i.test(value ?? ""));

  const provinsi = jakarta ? "DKI JAKARTA" : state;
  let kota = pick(
    address,
    "city",
    "municipality",
    "county",
    "regency",
    "town",
    "state_district",
  );

  if (jakarta && (!kota || !/JAKARTA/i.test(kota))) {
    kota =
      parts.find((part) => /JAKARTA\s+(PUSAT|UTARA|BARAT|SELATAN|TIMUR)/i.test(part)) ??
      pick(address, "city_district") ??
      kota;
  }

  let kecamatan = pick(address, "district", "suburb", "borough");
  const cityDistrict = pick(address, "city_district");
  if (!kecamatan && cityDistrict && !namaSama(cityDistrict, kota)) {
    kecamatan = cityDistrict;
  }

  let kelurahan = pick(
    address,
    "village",
    "quarter",
    "hamlet",
    "residential",
    "locality",
    "neighbourhood",
  );

  const road = pick(
    address,
    "road",
    "pedestrian",
    "footway",
    "path",
    "cycleway",
  );
  const houseNumber = pick(address, "house_number");
  const cityBlock = pick(address, "city_block");
  const name = pick(root, "name");
  const country = pick(address, "country");
  const kodePos = pick(address, "postcode", "postal_code");

  const cityIndex = cariBagian(parts, kota);
  const villageIndex = cariBagian(parts, kelurahan);
  const ignored = [
    road,
    houseNumber,
    cityBlock,
    name,
    kelurahan,
    kota,
    provinsi,
    country,
    kodePos,
  ];

  if (!kecamatan && cityIndex > 0) {
    const start = villageIndex >= 0 ? villageIndex + 1 : 0;
    const candidates = parts
      .slice(start, cityIndex)
      .filter((part) => bukanBagianAlamatAdministratif(part, ignored));
    kecamatan = candidates.at(-1);
  }

  if (!kelurahan && cityIndex > 0) {
    const districtIndex = cariBagian(parts, kecamatan);
    const end = districtIndex > 0 ? districtIndex : cityIndex;
    const candidates = parts
      .slice(0, end)
      .filter((part) =>
        bukanBagianAlamatAdministratif(part, [
          road,
          houseNumber,
          cityBlock,
          name,
          kecamatan,
          kota,
          provinsi,
          country,
          kodePos,
        ]),
      );
    kelurahan = candidates.at(-1);
  }

  const nomor = houseNumber
    ? /^(NO\.?\s*)/i.test(houseNumber)
      ? houseNumber
      : `No. ${houseNumber}`
    : undefined;
  const jalan = [road, nomor].filter(Boolean).join(" ");
  const rtRw = [pick(address, "neighbourhood"), cityBlock]
    .filter((value): value is string => Boolean(value && /^(RT|RW)\s*\d+/i.test(value)))
    .filter((value, index, values) => values.indexOf(value) === index);
  const alamatDetail = [jalan || undefined, ...rtRw].filter(Boolean).join(", ") || undefined;

  return {
    wilayah: {
      provinsi,
      kota,
      kecamatan,
      kelurahan,
      kodePos,
    },
    alamatDetail,
    alamatTampilan,
  };
}

export function normalizeWilayahFromReverse(data: unknown): AlamatWilayah {
  return normalizeAlamatFromReverse(data).wilayah;
}
