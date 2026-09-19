import assert from "node:assert/strict";
import test from "node:test";

import {
  hitungRingkasanPajakTransaksi,
  nilaiTagihanAwal,
  sisaPembayaran,
  totalPembayaranTerverifikasi,
  VERSI_ATURAN_PAJAK_TRANSAKSI,
} from "../src/kebijakan-transaksi.ts";

test("PKP barang non-mewah memakai PPN 12% atas DPP 11/12", () => {
  const hasil = hitungRingkasanPajakTransaksi({
    subtotal: 1_000_000,
    statusPkpPenjual: "pkp",
    objekPajak: "barang_non_mewah",
  });

  assert.equal(hasil.versiAturan, VERSI_ATURAN_PAJAK_TRANSAKSI);
  assert.equal(hasil.dppPpn, 916_667);
  assert.equal(hasil.ppn, 110_000);
  assert.equal(hasil.totalInvoice, 1_110_000);
  assert.equal(hasil.dibayarLangsungKePenjual, 1_110_000);
  assert.equal(hasil.pajakOlehMasingMasingPihak, true);
});

test("Non-PKP tidak menambahkan PPN dan ongkir pembeli masuk rekap invoice", () => {
  const hasil = hitungRingkasanPajakTransaksi({
    subtotal: 850_000,
    ongkir: 50_000,
    statusPkpPenjual: "non_pkp",
  });

  assert.equal(hasil.dppPpn, 0);
  assert.equal(hasil.ppn, 0);
  assert.equal(hasil.totalInvoice, 900_000);
});

test("DP dan saldo pembayaran hanya memakai penerimaan yang diverifikasi", () => {
  const pembayaran = { mekanisme: "dp", dpPersen: 30 };
  const rows = [
    { id: "a", tahap: "dp", nominal: 300_000, diajukanAt: 1 },
    {
      id: "b",
      tahap: "dp",
      nominal: 300_000,
      diajukanAt: 2,
      diverifikasiAt: 3,
    },
  ];

  assert.equal(nilaiTagihanAwal(pembayaran, 1_000_000), 300_000);
  assert.equal(totalPembayaranTerverifikasi(rows), 300_000);
  assert.equal(sisaPembayaran(1_000_000, rows), 700_000);
});
