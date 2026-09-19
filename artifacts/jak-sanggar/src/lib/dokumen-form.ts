import type { FieldDef } from "./dokumen-admin";
import type { SanggarUser } from "./types";
import {
  validasiIsianDokumen,
  type DokumenFieldWajib,
} from "@workspace/jaksanggar-core/dokumen-validation";

/** Jenis data ditentukan oleh isian, bukan kata yang kebetulan ada di label. */
export function fieldValidasiStandar(field: FieldDef): DokumenFieldWajib {
  const key = field.key.toLowerCase();
  const jenis: DokumenFieldWajib["jenis"] = /^(tanggal|haritanggal)/.test(key)
    ? "tanggal"
    : /^tahun/.test(key)
      ? "tahun"
      : /^jumlah/.test(key)
        ? "angka"
        : /email/.test(key)
          ? "email"
          : /telepon|nomorhp/.test(key)
            ? "telepon"
            : key === "nik"
              ? "nik"
              : key === "npwp"
                ? "npwp"
                : "text";
  return { key: field.key, label: field.label, jenis };
}

export const FIELD_PROFIL_DOKUMEN: DokumenFieldWajib[] = [
  { key: "__profil_namaSanggar", label: "Nama sanggar (profil)" },
  { key: "__profil_namaKetua", label: "Nama ketua/pemilik (profil)" },
  { key: "__profil_alamat", label: "Alamat sanggar (profil)" },
];

export function validasiFormDokumen(
  fields: FieldDef[],
  nilai: Record<string, string>,
  sg: Pick<SanggarUser, "namaSanggar" | "namaKetua" | "alamat">,
) {
  return validasiIsianDokumen(
    [
      ...fields.filter((field) => !field.opsional).map(fieldValidasiStandar),
      ...FIELD_PROFIL_DOKUMEN,
    ],
    {
      ...nilai,
      __profil_namaSanggar: sg.namaSanggar,
      __profil_namaKetua: sg.namaKetua,
      __profil_alamat: sg.alamat,
    },
  );
}

/** Tidak diubah = gunakan profil; sengaja dikosongkan = jangan cetak NIP. */
export function nipDokumen(
  nilai: Record<string, string>,
  nipProfil?: string,
): string | undefined {
  return (nilai.__nip_override ?? nipProfil)?.trim() || undefined;
}
