import type {
  KesepakatanPembayaranProduk,
  PembayaranLangsungPesananProduk,
  RingkasanPajakTransaksi,
  StatusPkpUsaha,
} from "./types";

/**
 * Parameter ini disimpan sebagai snapshot pada setiap transaksi dan tidak
 * menjadikan Jak Sanggar pemungut/pembayar pajak. Perubahan aturan berikutnya
 * tidak boleh mengubah dokumen transaksi lama secara diam-diam.
 */
export const VERSI_ATURAN_PAJAK_TRANSAKSI = "PMK-131-2024/PMK-11-2025";
export const TARIF_PPN_UMUM = 0.12;
export const FAKTOR_DPP_NON_MEWAH = 11 / 12;

function rupiah(value: number) {
  return Math.max(0, Math.round(Number.isFinite(value) ? value : 0));
}

export function hitungRingkasanPajakTransaksi(input: {
  subtotal: number;
  ongkir?: number;
  statusPkpPenjual?: StatusPkpUsaha;
  objekPajak?: RingkasanPajakTransaksi["objekPajak"];
  jenisPemotonganPph?: RingkasanPajakTransaksi["jenisPemotonganPph"];
  tarifPph?: number;
}): RingkasanPajakTransaksi {
  const subtotal = rupiah(input.subtotal);
  const ongkir = rupiah(input.ongkir ?? 0);
  const nilaiSebelumPajak = subtotal + ongkir;
  const statusPkpPenjual = input.statusPkpPenjual ?? "non_pkp";
  const objekPajak = input.objekPajak ?? "barang_non_mewah";
  const kenaPpn = statusPkpPenjual === "pkp" && objekPajak !== "tidak_dikenai";
  const faktorDpp =
    kenaPpn && objekPajak === "barang_non_mewah"
      ? FAKTOR_DPP_NON_MEWAH
      : kenaPpn
        ? 1
        : 0;
  const tarifPpn = kenaPpn ? TARIF_PPN_UMUM : 0;
  const dppPpn = rupiah(nilaiSebelumPajak * faktorDpp);
  const ppn = rupiah(dppPpn * tarifPpn);
  const tarifPph = Math.max(0, input.tarifPph ?? 0);
  const pphDipotong = input.jenisPemotonganPph
    ? rupiah(nilaiSebelumPajak * tarifPph)
    : 0;
  const totalInvoice = nilaiSebelumPajak + ppn;
  return {
    versiAturan: VERSI_ATURAN_PAJAK_TRANSAKSI,
    statusPkpPenjual,
    objekPajak,
    subtotal,
    ongkir,
    nilaiSebelumPajak,
    tarifPpn,
    faktorDpp,
    dppPpn,
    ppn,
    jenisPemotonganPph: input.jenisPemotonganPph,
    tarifPph: input.jenisPemotonganPph ? tarifPph : undefined,
    pphDipotong,
    totalInvoice,
    dibayarLangsungKePenjual: Math.max(0, totalInvoice - pphDipotong),
    pajakOlehMasingMasingPihak: true,
  };
}

export function totalPembayaranTerverifikasi(
  rows: readonly PembayaranLangsungPesananProduk[] | undefined,
) {
  return rupiah(
    (rows ?? [])
      .filter((row) => Boolean(row.diverifikasiAt))
      .reduce((total, row) => total + row.nominal, 0),
  );
}

export function nilaiTagihanAwal(
  pembayaran: KesepakatanPembayaranProduk | undefined,
  total: number,
) {
  if (!pembayaran) return rupiah(total);
  if (
    pembayaran.mekanisme === "setelah_barang_diterima" ||
    pembayaran.mekanisme === "cod"
  )
    return 0;
  if (pembayaran.mekanisme === "dp") {
    if (pembayaran.dpNominal)
      return Math.min(rupiah(total), rupiah(pembayaran.dpNominal));
    return Math.min(
      rupiah(total),
      rupiah((total * Math.max(1, pembayaran.dpPersen ?? 30)) / 100),
    );
  }
  return rupiah(total);
}

export function sisaPembayaran(
  total: number,
  rows: readonly PembayaranLangsungPesananProduk[] | undefined,
) {
  return Math.max(0, rupiah(total) - totalPembayaranTerverifikasi(rows));
}

export function labelMetodePembayaran(
  value: KesepakatanPembayaranProduk["mekanisme"],
) {
  return {
    lunas: "Bayar lunas",
    dp: "Down payment (DP)",
    setelah_barang_diterima: "Barang diterima baru bayar",
    cod: "COD saat serah terima",
  }[value];
}

export function labelMetodePengiriman(value: string) {
  return (
    {
      instant: "Instant (prioritas, hari yang sama)",
      same_day: "Same Day (multi-drop, hari yang sama)",
      kurir_paket: "Kurir Paket (Next Day–7 hari)",
      kurir_toko: "Kurir Toko",
    }[value] ?? value
  );
}
