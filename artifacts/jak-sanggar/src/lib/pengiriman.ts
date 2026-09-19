import type { MetodePengirimanProduk } from "@/lib/types";

export interface ReferensiEkspedisi {
  id: string;
  nama: string;
  metode: MetodePengirimanProduk[];
  layanan: string[];
  /** Kanal resmi penyedia untuk melihat estimasi tarif atau memulai pemesanan. */
  cekOngkirUrl?: string;
}

/**
 * Referensi awal untuk demo. Dipisahkan dari formulir agar nantinya dapat
 * diganti dengan master data API tanpa mengubah komponen transaksi.
 */
export const REFERENSI_EKSPEDISI: ReferensiEkspedisi[] = [
  {
    id: "gosend",
    nama: "GoSend (Gojek)",
    metode: ["instant", "same_day", "kurir_paket"],
    layanan: ["Instant", "Same Day", "Car"],
    cekOngkirUrl: "https://gojek.com/id-id/gosend",
  },
  {
    id: "grabexpress",
    nama: "GrabExpress",
    metode: ["instant", "same_day", "kurir_paket"],
    layanan: ["Instant Bike", "Instant Car", "Same Day", "Reguler"],
    cekOngkirUrl: "https://www.grab.com/id/express/",
  },
  {
    id: "lalamove",
    nama: "Lalamove",
    metode: ["instant", "same_day", "kurir_paket"],
    layanan: ["Motor", "Mobil", "Van", "Pickup", "Truk", "Multi-stop"],
    cekOngkirUrl: "https://www.lalamove.com/id/",
  },
  {
    id: "deliveree",
    nama: "Deliveree",
    metode: ["instant", "same_day", "kurir_paket"],
    layanan: ["Pesan Kendaraan", "Kargo", "Multi-drop"],
    cekOngkirUrl:
      "https://www.deliveree.com/id/cek-ongkir/cek-harga-ongkir-biaya-ekspedisi-deliveree/",
  },
  {
    id: "paxel",
    nama: "Paxel",
    metode: ["same_day", "kurir_paket"],
    layanan: ["Instant", "Same Day", "Next Day", "Regular", "PaxelBig"],
    cekOngkirUrl: "https://paxel.co/id",
  },
  {
    id: "jne",
    nama: "JNE",
    metode: ["kurir_paket"],
    layanan: ["SPS", "YES / Next Day", "REG", "OKE", "JTR"],
    cekOngkirUrl: "https://css.jne.co.id/landingpage/cek_ongkir",
  },
  {
    id: "jnt",
    nama: "J&T Express",
    metode: ["kurir_paket"],
    layanan: ["EZ / Regular", "J&T Super"],
    cekOngkirUrl: "https://www.jet.co.id/rates",
  },
  {
    id: "sicepat",
    nama: "SiCepat",
    metode: ["kurir_paket"],
    layanan: ["BEST / Next Day", "REG", "HALU"],
    cekOngkirUrl: "https://www.sicepat.com/",
  },
  {
    id: "anteraja",
    nama: "AnterAja",
    metode: ["kurir_paket"],
    layanan: ["Same Day", "Next Day", "Regular"],
    cekOngkirUrl: "https://anteraja.id/cek-ongkir",
  },
  {
    id: "ninja",
    nama: "Ninja Xpress",
    metode: ["kurir_paket"],
    layanan: ["Same Day", "Next Day", "Regular"],
    cekOngkirUrl: "https://www.ninjaxpress.co/id-id#price-estimate",
  },
  {
    id: "tiki",
    nama: "TIKI",
    metode: ["kurir_paket"],
    layanan: ["SDS", "ONS", "REG", "ECO", "TRC"],
    cekOngkirUrl: "https://tiki.id/id/tariff",
  },
  {
    id: "pos",
    nama: "Pos Indonesia",
    metode: ["kurir_paket"],
    layanan: ["Pos Sameday", "Pos Nextday", "Pos Reguler", "Pos Jumbo"],
    cekOngkirUrl: "https://www.posindonesia.co.id/id/check-tarif",
  },
  {
    id: "lion",
    nama: "Lion Parcel",
    metode: ["kurir_paket"],
    layanan: ["ONEPACK", "REGPACK", "JAGOPACK", "BIGPACK"],
    cekOngkirUrl: "https://lionparcel.com/ongkir",
  },
  {
    id: "toko",
    nama: "Kurir Toko",
    metode: ["kurir_toko"],
    layanan: ["Langsung", "Terjadwal", "Multi-tujuan"],
  },
];

export function ekspedisiUntukMetode(
  metode: MetodePengirimanProduk | undefined,
): ReferensiEkspedisi[] {
  if (!metode) return [];
  return REFERENSI_EKSPEDISI.filter((item) => item.metode.includes(metode));
}
