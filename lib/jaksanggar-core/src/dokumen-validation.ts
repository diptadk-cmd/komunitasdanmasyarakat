export interface DokumenFieldWajib {
  key: string;
  label: string;
  jenis?:
    | "text"
    | "email"
    | "telepon"
    | "nik"
    | "identitas"
    | "npwp"
    | "tanggal"
    | "tahun"
    | "angka"
    | "nominal";
}

export interface DokumenFieldTidakValid extends DokumenFieldWajib {
  alasan: string;
}

export interface HasilValidasiDokumen {
  lengkap: boolean;
  terisi: number;
  total: number;
  persentase: number;
  fieldKosong: DokumenFieldWajib[];
  fieldTidakValid: DokumenFieldTidakValid[];
  fieldBermasalah: DokumenFieldTidakValid[];
}

function digit(nilai: string): string {
  return nilai.replace(/\D/g, "");
}

/** Periksa kalender; pola teks saja akan menerima tanggal 31 Februari. */
function tanggalValid(nilai: string): boolean {
  const bulan = [
    "januari",
    "februari",
    "maret",
    "april",
    "mei",
    "juni",
    "juli",
    "agustus",
    "september",
    "oktober",
    "november",
    "desember",
  ];
  const hari = ["minggu", "senin", "selasa", "rabu", "kamis", "jumat", "sabtu"];
  const cocok = nilai
    .toLowerCase()
    .match(
      /^(?:(minggu|senin|selasa|rabu|kamis|jumat|sabtu),?\s+)?(?:(\d{4})-(\d{2})-(\d{2})|(\d{1,2})[\s\-/](\d{1,2}|[a-z]+)[\s\-/](\d{4}))$/,
    );
  if (!cocok) return false;
  const tahun = Number(cocok[2] || cocok[7]);
  const nomorBulan = cocok[3]
    ? Number(cocok[3])
    : /^\d+$/.test(cocok[6])
      ? Number(cocok[6])
      : bulan.indexOf(cocok[6]) + 1;
  const tanggal = Number(cocok[4] || cocok[5]);
  const date = new Date(0);
  date.setUTCFullYear(tahun, nomorBulan - 1, tanggal);
  return (
    tahun >= 1 &&
    nomorBulan >= 1 &&
    nomorBulan <= 12 &&
    date.getUTCFullYear() === tahun &&
    date.getUTCMonth() === nomorBulan - 1 &&
    date.getUTCDate() === tanggal &&
    (!cocok[1] || date.getUTCDay() === hari.indexOf(cocok[1]))
  );
}

function alasanTidakValid(
  field: DokumenFieldWajib,
  nilaiMentah: string,
): string | null {
  const nilai = nilaiMentah.trim();
  if (nilai === "-") return "isi data sebenarnya; tanda '-' tidak diterima";

  switch (field.jenis) {
    case "email":
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nilai)
        ? null
        : "format email belum benar";
    case "telepon": {
      const nomor = digit(nilai);
      return nomor.length >= 8 && nomor.length <= 15
        ? null
        : "nomor telepon harus berisi 8-15 digit";
    }
    case "nik":
      return /^\d{16}$/.test(digit(nilai))
        ? null
        : "NIK harus berisi tepat 16 digit";
    case "identitas":
      return /^[A-Za-z0-9][A-Za-z0-9 .\-\/]{4,}$/.test(nilai)
        ? null
        : "nomor identitas minimal 5 karakter";
    case "npwp": {
      const nomor = digit(nilai);
      return nomor.length === 15 || nomor.length === 16
        ? null
        : "NPWP harus berisi 15 atau 16 digit";
    }
    case "tanggal":
      return tanggalValid(nilai)
        ? null
        : "gunakan tanggal kalender yang benar, misalnya 20 Agustus 2026; sesuaikan nama hari jika dicantumkan";
    case "tahun": {
      const tahun = Number(nilai);
      const maks = new Date().getFullYear() + 20;
      return /^\d{4}$/.test(nilai) && tahun >= 1900 && tahun <= maks
        ? null
        : `tahun harus antara 1900-${maks}`;
    }
    case "angka":
      return /^\d+(?:[.,]\d+)?$/.test(nilai) ? null : "isi dengan angka";
    case "nominal":
      return digit(nilai).length > 0 ? null : "isi dengan nominal angka";
    default:
      return null;
  }
}

/**
 * Memeriksa isian wajib dengan aturan yang sama di formulir, arsip, dan
 * tindakan cetak. Nilai berisi spasi saja diperlakukan sebagai kosong.
 */
export function validasiIsianDokumen(
  fields: readonly DokumenFieldWajib[],
  nilai: Readonly<Record<string, string | null | undefined>>,
): HasilValidasiDokumen {
  const fieldKosong = fields.filter((field) => !nilai[field.key]?.trim());
  const fieldTidakValid = fields.flatMap((field) => {
    const isi = nilai[field.key]?.trim();
    if (!isi) return [];
    const alasan = alasanTidakValid(field, isi);
    return alasan ? [{ ...field, alasan }] : [];
  });
  const fieldBermasalah: DokumenFieldTidakValid[] = [
    ...fieldKosong.map((field) => ({ ...field, alasan: "wajib diisi" })),
    ...fieldTidakValid,
  ];
  const total = fields.length;
  const terisi = total - fieldBermasalah.length;

  return {
    lengkap: fieldBermasalah.length === 0,
    terisi,
    total,
    persentase: total === 0 ? 100 : Math.round((terisi / total) * 100),
    fieldKosong,
    fieldTidakValid,
    fieldBermasalah,
  };
}

/** Ringkasan singkat untuk toast, badge, dan pesan validasi formulir. */
export function ringkasFieldKosong(
  fields: readonly DokumenFieldWajib[],
  batas = 3,
): string {
  if (fields.length === 0) return "";
  const label = fields.slice(0, Math.max(1, batas)).map((field) => field.label);
  const sisa = fields.length - label.length;
  return sisa > 0
    ? `${label.join(", ")}, dan ${sisa} lainnya`
    : label.join(", ");
}
