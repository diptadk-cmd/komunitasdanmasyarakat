import type {
  BentukUsahaPengrajin,
  Legalitas,
  StatusAktaNotaris,
} from "@/lib/types";

export interface LegalitasOption<T extends string = Legalitas> {
  value: T;
  label: string;
}

export const STATUS_AKTA_OPTIONS: ReadonlyArray<
  LegalitasOption<StatusAktaNotaris>
> = [
  { value: "Berakta Notaris", label: "Berakta Notaris" },
  { value: "Tidak Berakta Notaris", label: "Tidak Berakta Notaris" },
];

const BERAKTA_NOTARIS_OPTIONS: ReadonlyArray<LegalitasOption> = [
  { value: "Yayasan", label: "Yayasan" },
  {
    value: "Perkumpulan / Perserikatan",
    label: "Perkumpulan / Perserikatan Berbadan Hukum",
  },
  { value: "Koperasi", label: "Koperasi" },
  { value: "PT", label: "Perseroan Terbatas (PT)" },
  { value: "CV", label: "Persekutuan Komanditer (CV)" },
  { value: "Firma (FA)", label: "Persekutuan Firma (FA)" },
  { value: "Persekutuan Perdata", label: "Persekutuan Perdata" },
  {
    value: "Badan Hukum Lainnya",
    label: "Organisasi / Badan Usaha Lain dengan Akta Notaris",
  },
];

const TIDAK_BERAKTA_NOTARIS_OPTIONS: ReadonlyArray<LegalitasOption> = [
  {
    value: "Sanggar / Padepokan / Kelompok Seni",
    label: "Sanggar / Padepokan / Kelompok Seni",
  },
  { value: "Komunitas", label: "Komunitas" },
  { value: "Paguyuban", label: "Paguyuban" },
  {
    value: "Kelompok / Perkumpulan Informal",
    label: "Kelompok / Perkumpulan Informal",
  },
  {
    value: "Organisasi Kemasyarakatan Tidak Berbadan Hukum",
    label: "Organisasi Kemasyarakatan Tidak Berbadan Hukum",
  },
  {
    value: "Kelompok Usaha Bersama (KUBE)",
    label: "Kelompok Usaha Bersama (KUBE)",
  },
  {
    value: "PT Perorangan",
    label: "Perseroan Perorangan (PT Perorangan)",
  },
  {
    value: "BUMDes / BUMDes Bersama",
    label: "BUMDes / BUMDes Bersama",
  },
  { value: "Perum", label: "Perusahaan Umum (Perum)" },
  { value: "Perumda", label: "Perusahaan Umum Daerah (Perumda)" },
  {
    value: "Badan Layanan Umum (BLU)",
    label: "Badan Layanan Umum (BLU)",
  },
  { value: "Bentuk Usaha Tetap (BUT)", label: "Bentuk Usaha Tetap (BUT)" },
  {
    value: "Organisasi Lain Tanpa Akta Notaris",
    label: "Organisasi / Usaha Lain Tanpa Akta Notaris",
  },
];

export const LEGALITAS_OPTIONS_BY_AKTA: Readonly<
  Record<StatusAktaNotaris, ReadonlyArray<LegalitasOption>>
> = {
  "Berakta Notaris": BERAKTA_NOTARIS_OPTIONS,
  "Tidak Berakta Notaris": TIDAK_BERAKTA_NOTARIS_OPTIONS,
};

const PERORANGAN_OPTION: LegalitasOption<BentukUsahaPengrajin> = {
  value: "Perorangan",
  label: "Usaha Perorangan",
};

export function getLegalitasOptions(
  statusAktaNotaris: StatusAktaNotaris,
): ReadonlyArray<LegalitasOption> {
  return LEGALITAS_OPTIONS_BY_AKTA[statusAktaNotaris];
}

export function getBentukUsahaOptions(
  statusAktaNotaris: StatusAktaNotaris,
): ReadonlyArray<LegalitasOption<BentukUsahaPengrajin>> {
  const options = LEGALITAS_OPTIONS_BY_AKTA[statusAktaNotaris];
  return statusAktaNotaris === "Tidak Berakta Notaris"
    ? [PERORANGAN_OPTION, ...options]
    : options;
}

export function getDefaultLegalitas(
  statusAktaNotaris: StatusAktaNotaris,
): Legalitas {
  return LEGALITAS_OPTIONS_BY_AKTA[statusAktaNotaris][0].value;
}

export function getDefaultBentukUsaha(
  statusAktaNotaris: StatusAktaNotaris,
): BentukUsahaPengrajin {
  return statusAktaNotaris === "Tidak Berakta Notaris"
    ? "Perorangan"
    : getDefaultLegalitas(statusAktaNotaris);
}
