import { load, save, uid, logActivity } from "./store";
import type {
  DokumenUnggahanTransaksi,
  KesepakatanPembayaranProduk,
  MetodePengirimanProduk,
  MitraPengrajinUser,
  PaketProdukMitra,
  PengrajinUser,
  PesananProdukPengrajin,
  ProdukKerajinan,
} from "./types";
import {
  hitungRingkasanPajakTransaksi,
  nilaiTagihanAwal,
  sisaPembayaran,
  totalPembayaranTerverifikasi,
} from "./kebijakan-transaksi";

export const STATUS_PESANAN_PRODUK: Record<
  PesananProdukPengrajin["status"],
  string
> = {
  menunggu_ongkir: "Menunggu Perhitungan Ongkir Penjual",
  menunggu_persetujuan_ongkir: "Menunggu Persetujuan Ongkir Pembeli",
  diajukan: "Menunggu Pengrajin",
  menunggu_ttd: "Menunggu Tanda Tangan",
  menunggu_bayar: "Menunggu Pembayaran Langsung",
  menunggu_verifikasi_bayar: "Bukti Bayar Menunggu Verifikasi Penjual",
  kontrak_aktif: "Kontrak Aktif",
  diproses: "Sedang Diproduksi",
  dikirim: "Dikirim / Menunggu BAST",
  selesai: "Selesai",
  ditolak: "Ditolak",
  batal: "Dibatalkan",
};

export interface KatalogProdukMitra {
  pengrajin: PengrajinUser;
  produk: ProdukKerajinan;
}

export function katalogProdukMitra(): KatalogProdukMitra[] {
  return load().users.flatMap((user) => {
    if (user.role !== "pengrajin" || user.tokoDipublikasikan === false)
      return [];
    return (user.produk ?? [])
      .filter(
        (produk) =>
          produk.khasJakarta === true &&
          produk.statusPublish &&
          produk.terbukaKerjasama,
      )
      .map((produk) => ({ pengrajin: user, produk }));
  });
}

export function listPesananProdukFor(
  actor: MitraPengrajinUser | PengrajinUser,
): PesananProdukPengrajin[] {
  return load()
    .pesananProdukPengrajin.filter((pesanan) =>
      actor.role === "mitra_pengrajin"
        ? pesanan.mitraId === actor.id
        : pesanan.pengrajinId === actor.id,
    )
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

function nomor(
  prefix: "ORDER" | "KONTRAK" | "INVOICE" | "KWITANSI" | "BAST",
  db = load(),
) {
  const year = new Date().getFullYear();
  const pola = new RegExp(`^${prefix}/KRIYA/${year}/(\\d+)$`);
  const urutanTerbesar = db.pesananProdukPengrajin.reduce((max, item) => {
    const nilai =
      prefix === "ORDER"
        ? item.nomor
        : prefix === "KONTRAK"
          ? item.kontrak?.nomor
          : prefix === "INVOICE"
            ? item.invoice?.nomor
            : prefix === "KWITANSI"
              ? item.kwitansi?.nomor
              : item.bast?.nomor;
    const urutan = Number(nilai?.match(pola)?.[1] ?? 0);
    return Math.max(max, Number.isFinite(urutan) ? urutan : 0);
  }, 0);
  return `${prefix}/KRIYA/${year}/${String(urutanTerbesar + 1).padStart(4, "0")}`;
}

function subtotalItems(items: PesananProdukPengrajin["items"]) {
  return items.reduce((total, item) => total + item.harga * item.jumlah, 0);
}

function buatPengirimanAwal(
  produk: ProdukKerajinan[],
  metode: MetodePengirimanProduk = "kurir_paket",
) {
  const termasuk =
    produk.length > 0 &&
    produk.every((item) => item.ongkirTermasukHarga === true);
  return {
    metode,
    ongkirTermasukHarga: termasuk,
    penanggungOngkir: termasuk ? ("penjual" as const) : ("pembeli" as const),
    statusOngkir: termasuk
      ? ("termasuk_harga" as const)
      : ("menunggu_penjual" as const),
    biayaOngkir: 0,
    cakupanOngkir: termasuk
      ? produk
          .map((item) => item.cakupanOngkir)
          .filter(Boolean)
          .join("; ") || "Sesuai keterangan harga produk"
      : undefined,
    batasOngkir: termasuk
      ? Math.max(0, ...produk.map((item) => item.batasOngkir ?? 0)) || undefined
      : undefined,
  };
}

function buatPembayaranAwal(input?: {
  mekanisme?: KesepakatanPembayaranProduk["mekanisme"];
  dpPersen?: number;
  jatuhTempoHari?: number;
}) {
  const mekanisme = input?.mekanisme ?? "lunas";
  return {
    mekanisme,
    dpPersen:
      mekanisme === "dp"
        ? Math.min(100, Math.max(1, input?.dpPersen ?? 30))
        : undefined,
    jatuhTempoHari:
      mekanisme === "setelah_barang_diterima"
        ? Math.max(0, input?.jatuhTempoHari ?? 0)
        : undefined,
    pembayaranLangsung: true as const,
    penampungDanaJakSanggar: false as const,
    disepakatiPembeliAt: Date.now(),
  };
}

function terapkanRingkasan(
  pesanan: PesananProdukPengrajin,
  pengrajin: PengrajinUser,
) {
  pesanan.subtotalProduk = subtotalItems(pesanan.items);
  pesanan.ringkasanPajak = hitungRingkasanPajakTransaksi({
    subtotal: pesanan.subtotalProduk,
    ongkir: pesanan.pengiriman?.biayaOngkir ?? 0,
    statusPkpPenjual: pengrajin.statusPkp ?? "non_pkp",
    objekPajak: "barang_non_mewah",
  });
  pesanan.nilaiTotal = pesanan.ringkasanPajak.totalInvoice;
  pesanan.rekeningTujuan = structuredClone(pengrajin.rekening);
  pesanan.riwayatPembayaran ||= [];
}

function terbitkanKontrakInvoice(pesanan: PesananProdukPengrajin) {
  const now = Date.now();
  pesanan.kontrak ||= { nomor: nomor("KONTRAK"), dibuatAt: now };
  pesanan.invoice ||= { nomor: nomor("INVOICE"), dibuatAt: now, finalAt: now };
  pesanan.status = "menunggu_ttd";
}

export function buatPesananProduk(input: {
  mitra: MitraPengrajinUser;
  pengrajin: PengrajinUser;
  /** Gunakan `items` untuk satu checkout yang berisi beberapa produk. */
  items?: Array<{ produk: ProdukKerajinan; jumlah: number }>;
  /** Kompatibilitas pemanggil lama yang masih mengirim satu produk. */
  produk?: ProdukKerajinan;
  jumlah?: number;
  alamatPengiriman: string;
  targetSelesai: string;
  catatan?: string;
  paketId?: string;
  metodePengiriman?: MetodePengirimanProduk;
  mekanismePembayaran?: KesepakatanPembayaranProduk["mekanisme"];
  dpPersen?: number;
  jatuhTempoHari?: number;
}): PesananProdukPengrajin {
  const requested =
    input.items ??
    (input.produk ? [{ produk: input.produk, jumlah: input.jumlah ?? 0 }] : []);
  const selected = requested.filter((item) => item.jumlah > 0);
  if (selected.length === 0) throw new Error("Pilih minimal satu barang.");
  if (
    selected.some(
      (item) =>
        !Number.isInteger(item.jumlah) ||
        item.jumlah < 1 ||
        !input.pengrajin.produk.some((produk) => produk.id === item.produk.id),
    )
  ) {
    throw new Error(
      "Semua barang harus berasal dari satu Pengrajin dan jumlahnya valid.",
    );
  }
  if (new Set(selected.map((item) => item.produk.id)).size !== selected.length)
    throw new Error("Barang yang sama tidak boleh dicantumkan dua kali.");
  if (!input.alamatPengiriman.trim())
    throw new Error("Alamat pengiriman wajib diisi.");
  if (!input.targetSelesai) throw new Error("Target selesai wajib diisi.");
  const now = Date.now();
  const pengiriman = buatPengirimanAwal(
    selected.map((item) => item.produk),
    input.metodePengiriman,
  );
  const pesanan: PesananProdukPengrajin = {
    id: uid(),
    nomor: "",
    mitraId: input.mitra.id,
    tujuanTransaksi: "dijual_kembali",
    pengrajinId: input.pengrajin.id,
    paketId: input.paketId,
    items: selected.map(({ produk, jumlah }) => ({
      produkId: produk.id,
      nama: produk.nama,
      jumlah,
      harga: produk.harga,
      satuan: produk.satuan,
    })),
    alamatPengiriman: input.alamatPengiriman.trim(),
    targetSelesai: input.targetSelesai,
    catatan: input.catatan?.trim() ?? "",
    subtotalProduk: selected.reduce(
      (total, item) => total + item.produk.harga * item.jumlah,
      0,
    ),
    nilaiTotal: selected.reduce(
      (total, item) => total + item.produk.harga * item.jumlah,
      0,
    ),
    pengiriman,
    pembayaran: buatPembayaranAwal({
      mekanisme: input.mekanismePembayaran,
      dpPersen: input.dpPersen,
      jatuhTempoHari: input.jatuhTempoHari,
    }),
    rekeningTujuan: structuredClone(input.pengrajin.rekening),
    riwayatPembayaran: [],
    status: pengiriman.ongkirTermasukHarga ? "diajukan" : "menunggu_ongkir",
    ttd: [],
    createdAt: now,
    updatedAt: now,
  };
  terapkanRingkasan(pesanan, input.pengrajin);
  save((db) => {
    pesanan.nomor = nomor("ORDER", db);
    db.pesananProdukPengrajin.push(pesanan);
  });
  logActivity(input.mitra.id, input.mitra.role, "order-produk-pengrajin", {
    pesananId: pesanan.id,
    pengrajinId: input.pengrajin.id,
  });
  return pesanan;
}

export function buatPesananDariPaket(
  mitra: MitraPengrajinUser,
  paket: PaketProdukMitra,
  alamatPengiriman: string,
  targetSelesai: string,
  catatan = "",
  kesepakatan?: {
    metodePengiriman?: MetodePengirimanProduk;
    mekanismePembayaran?: KesepakatanPembayaranProduk["mekanisme"];
    dpPersen?: number;
    jatuhTempoHari?: number;
  },
): PesananProdukPengrajin[] {
  const db = load();
  const groups = new Map<string, Array<PaketProdukMitra["items"][number]>>();
  for (const item of paket.items) {
    const list = groups.get(item.pengrajinId) ?? [];
    list.push(item);
    groups.set(item.pengrajinId, list);
  }
  const result: PesananProdukPengrajin[] = [];
  for (const [pengrajinId, items] of groups) {
    const pengrajin = db.users.find(
      (user): user is PengrajinUser =>
        user.role === "pengrajin" &&
        (user.id === pengrajinId ||
          user.apiId === pengrajinId ||
          user.username === pengrajinId),
    );
    if (!pengrajin) continue;
    const now = Date.now();
    const produkPesanan = items
      .map((item) => pengrajin.produk.find((p) => p.id === item.produkId))
      .filter((item): item is ProdukKerajinan => Boolean(item));
    const pengiriman = buatPengirimanAwal(
      produkPesanan,
      kesepakatan?.metodePengiriman,
    );
    const pesanan: PesananProdukPengrajin = {
      id: uid(),
      nomor: "",
      mitraId: mitra.id,
      tujuanTransaksi: "dijual_kembali",
      pengrajinId: pengrajin.id,
      paketId: paket.id,
      items: items.map((item) => ({
        produkId: item.produkId,
        nama: item.namaProduk,
        jumlah: item.jumlah,
        harga: item.hargaDasar,
        satuan: item.satuan,
      })),
      alamatPengiriman: alamatPengiriman.trim(),
      targetSelesai,
      catatan: catatan.trim(),
      subtotalProduk: items.reduce(
        (total, item) => total + item.hargaDasar * item.jumlah,
        0,
      ),
      nilaiTotal: items.reduce(
        (total, item) => total + item.hargaDasar * item.jumlah,
        0,
      ),
      pengiriman,
      pembayaran: buatPembayaranAwal({
        mekanisme: kesepakatan?.mekanismePembayaran,
        dpPersen: kesepakatan?.dpPersen,
        jatuhTempoHari: kesepakatan?.jatuhTempoHari,
      }),
      rekeningTujuan: structuredClone(pengrajin.rekening),
      riwayatPembayaran: [],
      status: pengiriman.ongkirTermasukHarga ? "diajukan" : "menunggu_ongkir",
      ttd: [],
      createdAt: now,
      updatedAt: now,
    };
    terapkanRingkasan(pesanan, pengrajin);
    result.push(pesanan);
  }
  if (result.length === 0)
    throw new Error("Pengrajin untuk paket ini tidak ditemukan.");
  save((data) => {
    for (const pesanan of result) {
      pesanan.nomor = nomor("ORDER", data);
      data.pesananProdukPengrajin.push(pesanan);
    }
  });
  logActivity(mitra.id, mitra.role, "order-paket-pengrajin", {
    paketId: paket.id,
    jumlahPesanan: result.length,
  });
  return result;
}

export function buatPesananDariKesepakatan(input: {
  mitra: MitraPengrajinUser;
  pengrajin: PengrajinUser;
  kerjasamaId: string;
  items: Array<{ produk: ProdukKerajinan; jumlah: number }>;
  alamatPengiriman: string;
  targetSelesai: string;
  catatan?: string;
  metodePengiriman?: MetodePengirimanProduk;
  mekanismePembayaran?: KesepakatanPembayaranProduk["mekanisme"];
  dpPersen?: number;
  jatuhTempoHari?: number;
}): PesananProdukPengrajin {
  const selected = input.items.filter((item) => item.jumlah > 0);
  if (selected.length === 0) throw new Error("Pilih minimal satu barang.");
  if (!input.alamatPengiriman.trim())
    throw new Error("Alamat pengiriman wajib diisi.");
  if (!input.targetSelesai) throw new Error("Target selesai wajib diisi.");
  const now = Date.now();
  const pengiriman = buatPengirimanAwal(
    selected.map((item) => item.produk),
    input.metodePengiriman,
  );
  const pesanan: PesananProdukPengrajin = {
    id: uid(),
    nomor: "",
    mitraId: input.mitra.id,
    tujuanTransaksi: "dijual_kembali",
    pengrajinId: input.pengrajin.id,
    kerjasamaId: input.kerjasamaId,
    items: selected.map(({ produk, jumlah }) => ({
      produkId: produk.id,
      nama: produk.nama,
      jumlah,
      harga: produk.harga,
      satuan: produk.satuan,
    })),
    alamatPengiriman: input.alamatPengiriman.trim(),
    targetSelesai: input.targetSelesai,
    catatan: input.catatan?.trim() ?? "",
    subtotalProduk: selected.reduce(
      (total, item) => total + item.produk.harga * item.jumlah,
      0,
    ),
    nilaiTotal: selected.reduce(
      (total, item) => total + item.produk.harga * item.jumlah,
      0,
    ),
    pengiriman,
    pembayaran: buatPembayaranAwal({
      mekanisme: input.mekanismePembayaran,
      dpPersen: input.dpPersen,
      jatuhTempoHari: input.jatuhTempoHari,
    }),
    rekeningTujuan: structuredClone(input.pengrajin.rekening),
    riwayatPembayaran: [],
    status: pengiriman.ongkirTermasukHarga ? "diajukan" : "menunggu_ongkir",
    ttd: [],
    createdAt: now,
    updatedAt: now,
  };
  terapkanRingkasan(pesanan, input.pengrajin);
  save((db) => {
    pesanan.nomor = nomor("ORDER", db);
    db.pesananProdukPengrajin.push(pesanan);
  });
  logActivity(input.mitra.id, input.mitra.role, "pembelian-hasil-kerjasama", {
    kerjasamaId: input.kerjasamaId,
    pesananId: pesanan.id,
  });
  return pesanan;
}

function mutate(
  id: string,
  updater: (pesanan: PesananProdukPengrajin) => void,
) {
  let result: PesananProdukPengrajin | undefined;
  save((db) => {
    const pesanan = db.pesananProdukPengrajin.find((item) => item.id === id);
    if (!pesanan) return;
    updater(pesanan);
    pesanan.updatedAt = Date.now();
    result = pesanan;
  });
  if (!result) throw new Error("Pesanan produk tidak ditemukan.");
  return result;
}

export function tetapkanOngkirProduk(
  id: string,
  pengrajin: PengrajinUser,
  input: {
    biayaOngkir: number;
    ekspedisi?: string;
    layanan?: string;
    estimasiTiba?: string;
  },
) {
  return mutate(id, (pesanan) => {
    if (
      pesanan.pengrajinId !== pengrajin.id ||
      pesanan.status !== "menunggu_ongkir" ||
      !pesanan.pengiriman
    )
      throw new Error("Ongkos kirim belum dapat ditetapkan.");
    if (!Number.isFinite(input.biayaOngkir) || input.biayaOngkir < 0)
      throw new Error("Nominal ongkos kirim tidak valid.");
    pesanan.pengiriman.biayaOngkir = Math.round(input.biayaOngkir);
    pesanan.pengiriman.ekspedisi = input.ekspedisi?.trim();
    pesanan.pengiriman.layanan = input.layanan?.trim();
    pesanan.pengiriman.estimasiTiba = input.estimasiTiba?.trim();
    pesanan.pengiriman.statusOngkir = "disepakati";
    if (pesanan.pembayaran) pesanan.pembayaran.disepakatiPenjualAt = Date.now();
    pesanan.status = "menunggu_persetujuan_ongkir";
    terapkanRingkasan(pesanan, pengrajin);
  });
}

export function setujuiOngkirProduk(id: string, mitra: MitraPengrajinUser) {
  return mutate(id, (pesanan) => {
    if (
      pesanan.mitraId !== mitra.id ||
      pesanan.status !== "menunggu_persetujuan_ongkir" ||
      pesanan.pengiriman?.statusOngkir !== "disepakati"
    )
      throw new Error("Ongkos kirim belum siap disetujui.");
    terbitkanKontrakInvoice(pesanan);
  });
}

export function terimaPesananProduk(
  id: string,
  pengrajin: PengrajinUser,
): PesananProdukPengrajin {
  return mutate(id, (pesanan) => {
    if (pesanan.pengrajinId !== pengrajin.id || pesanan.status !== "diajukan")
      throw new Error("Pesanan tidak dapat diterima.");
    const now = Date.now();
    pesanan.pembayaran ||= buatPembayaranAwal();
    pesanan.pembayaran.disepakatiPenjualAt = now;
    terapkanRingkasan(pesanan, pengrajin);
    terbitkanKontrakInvoice(pesanan);
    pesanan.ttd.push({
      pihak: "pengrajin",
      userId: pengrajin.id,
      nama: pengrajin.namaPemilik,
      ts: now,
    });
  });
}

export function tolakPesananProduk(
  id: string,
  pengrajin: PengrajinUser,
  alasan: string,
) {
  return mutate(id, (pesanan) => {
    if (pesanan.pengrajinId !== pengrajin.id || pesanan.status !== "diajukan")
      throw new Error("Pesanan tidak dapat ditolak.");
    pesanan.status = "ditolak";
    pesanan.alasanTolak = alasan.trim() || "Kapasitas produksi tidak tersedia.";
  });
}

export function batalkanPesananProduk(id: string, mitra: MitraPengrajinUser) {
  let dibatalkan: PesananProdukPengrajin | undefined;
  save((db) => {
    const index = db.pesananProdukPengrajin.findIndex((item) => item.id === id);
    const pesanan = index >= 0 ? db.pesananProdukPengrajin[index] : undefined;
    if (!pesanan) return;
    if (
      pesanan.mitraId !== mitra.id ||
      ![
        "menunggu_ongkir",
        "menunggu_persetujuan_ongkir",
        "diajukan",
        "menunggu_ttd",
      ].includes(pesanan.status)
    )
      throw new Error("Pesanan tidak dapat dibatalkan pada tahap ini.");
    dibatalkan = pesanan;
    db.pesananProdukPengrajin.splice(index, 1);
  });
  if (!dibatalkan) throw new Error("Pesanan produk tidak ditemukan.");
  logActivity(mitra.id, mitra.role, "pesanan-produk-batal-hapus", {
    id: dibatalkan.id,
    nomor: dibatalkan.nomor,
    judul: dibatalkan.items.map((item) => item.nama).join(", "),
    nilaiTotal: dibatalkan.nilaiTotal,
    pihakTerkait: [dibatalkan.mitraId, dibatalkan.pengrajinId],
  });
  return dibatalkan;
}

export function tandaTanganiKontrakProduk(
  id: string,
  actor: MitraPengrajinUser | PengrajinUser,
) {
  return mutate(id, (pesanan) => {
    if (pesanan.status !== "menunggu_ttd" || !pesanan.kontrak)
      throw new Error("Kontrak belum siap ditandatangani.");
    const pihak = actor.role === "mitra_pengrajin" ? "mitra" : "pengrajin";
    const expectedId =
      pihak === "mitra" ? pesanan.mitraId : pesanan.pengrajinId;
    if (actor.id !== expectedId) throw new Error("Anda bukan pihak kontrak.");
    if (!pesanan.ttd.some((ttd) => ttd.pihak === pihak)) {
      pesanan.ttd.push({
        pihak,
        userId: actor.id,
        nama:
          actor.role === "mitra_pengrajin"
            ? actor.namaPenanggungJawab
            : actor.namaPemilik,
        ts: Date.now(),
      });
    }
    if (
      pesanan.ttd.some((ttd) => ttd.pihak === "mitra") &&
      pesanan.ttd.some((ttd) => ttd.pihak === "pengrajin")
    ) {
      pesanan.kontrak.finalAt = Date.now();
      const mekanisme = pesanan.pembayaran?.mekanisme ?? "lunas";
      pesanan.status =
        mekanisme === "setelah_barang_diterima" || mekanisme === "cod"
          ? "kontrak_aktif"
          : "menunggu_bayar";
    }
  });
}

export function bayarInvoiceProduk(id: string, mitra: MitraPengrajinUser) {
  const order = load().pesananProdukPengrajin.find((item) => item.id === id);
  if (!order) throw new Error("Pesanan produk tidak ditemukan.");
  const nominal = sisaPembayaran(
    order.ringkasanPajak?.dibayarLangsungKePenjual ?? order.nilaiTotal,
    order.riwayatPembayaran,
  );
  return unggahBuktiPembayaranProduk(id, mitra, {
    nama: "Konfirmasi pembayaran lama",
    type: "text/plain",
    size: 0,
    nominal,
  });
}

export function unggahBuktiPembayaranProduk(
  id: string,
  mitra: MitraPengrajinUser,
  input: {
    nama: string;
    type: string;
    size: number;
    dataUrl?: string;
    url?: string;
    nominal?: number;
  },
) {
  return mutate(id, (pesanan) => {
    if (pesanan.mitraId !== mitra.id || !pesanan.invoice)
      throw new Error("Invoice belum siap dibayar.");
    if (pesanan.pembayaran?.mekanisme === "cod")
      throw new Error("Pembayaran COD dikonfirmasi penjual saat serah terima.");
    if (
      pesanan.pembayaran?.mekanisme === "setelah_barang_diterima" &&
      !pesanan.bast?.finalAt
    )
      throw new Error("Pembayaran dilakukan setelah barang dan BAST diterima.");
    if (pesanan.riwayatPembayaran?.some((row) => !row.diverifikasiAt))
      throw new Error("Bukti pembayaran sebelumnya masih menunggu verifikasi.");
    const total =
      pesanan.ringkasanPajak?.dibayarLangsungKePenjual ?? pesanan.nilaiTotal;
    const paid = totalPembayaranTerverifikasi(pesanan.riwayatPembayaran);
    const initial = nilaiTagihanAwal(pesanan.pembayaran, total);
    const outstanding = Math.max(0, total - paid);
    const defaultNominal =
      paid === 0 && initial > 0 ? Math.min(initial, outstanding) : outstanding;
    const nominal = Math.min(
      outstanding,
      Math.max(1, Math.round(input.nominal ?? defaultNominal)),
    );
    if (nominal <= 0) throw new Error("Tagihan sudah dipenuhi.");
    const now = Date.now();
    const tahap =
      pesanan.pembayaran?.mekanisme === "dp"
        ? paid === 0
          ? "dp"
          : "pelunasan"
        : pesanan.pembayaran?.mekanisme === "setelah_barang_diterima"
          ? "setelah_terima"
          : "lunas";
    pesanan.riwayatPembayaran ||= [];
    pesanan.riwayatPembayaran.push({
      id: uid(),
      tahap,
      nominal,
      bukti: {
        nama: input.nama,
        type: input.type,
        size: input.size,
        dataUrl: input.dataUrl,
        url: input.url,
        uploadedBy: mitra.id,
        uploadedAt: now,
      },
      diajukanAt: now,
    });
    if (
      ["menunggu_bayar", "menunggu_verifikasi_bayar"].includes(pesanan.status)
    )
      pesanan.status = "menunggu_verifikasi_bayar";
  });
}

export function verifikasiPembayaranProduk(
  id: string,
  pengrajin: PengrajinUser,
) {
  return mutate(id, (pesanan) => {
    if (pesanan.pengrajinId !== pengrajin.id)
      throw new Error("Anda bukan penerima pembayaran transaksi ini.");
    const pending = pesanan.riwayatPembayaran?.find(
      (row) => !row.diverifikasiAt,
    );
    if (!pending)
      throw new Error("Tidak ada bukti pembayaran yang menunggu verifikasi.");
    const now = Date.now();
    pending.diverifikasiAt = now;
    pending.diverifikasiOleh = pengrajin.id;
    const total =
      pesanan.ringkasanPajak?.dibayarLangsungKePenjual ?? pesanan.nilaiTotal;
    const verified = totalPembayaranTerverifikasi(pesanan.riwayatPembayaran);
    const initial = nilaiTagihanAwal(pesanan.pembayaran, total);
    const lunas = verified >= total;
    pesanan.pembayaranAt = lunas ? now : pesanan.pembayaranAt;
    pesanan.kwitansi ||= { nomor: nomor("KWITANSI"), dibuatAt: now };
    pesanan.kwitansi.catatan = lunas
      ? "Seluruh pembayaran langsung telah diterima dan diverifikasi penjual."
      : `Pembayaran sebagian sebesar Rp ${verified.toLocaleString("id-ID")} telah diterima penjual.`;
    pesanan.kwitansi.finalAt = lunas ? now : undefined;
    if (pesanan.bast?.finalAt && lunas) pesanan.status = "selesai";
    else if (
      ["menunggu_bayar", "menunggu_verifikasi_bayar"].includes(
        pesanan.status,
      ) &&
      verified >= initial
    )
      pesanan.status = "kontrak_aktif";
  });
}

export function konfirmasiCodProduk(id: string, pengrajin: PengrajinUser) {
  return mutate(id, (pesanan) => {
    if (
      pesanan.pengrajinId !== pengrajin.id ||
      pesanan.pembayaran?.mekanisme !== "cod" ||
      !pesanan.bast?.finalAt
    )
      throw new Error("COD hanya dapat dikonfirmasi setelah serah terima.");
    const total =
      pesanan.ringkasanPajak?.dibayarLangsungKePenjual ?? pesanan.nilaiTotal;
    const now = Date.now();
    pesanan.riwayatPembayaran ||= [];
    pesanan.riwayatPembayaran.push({
      id: uid(),
      tahap: "cod",
      nominal: total,
      diajukanAt: now,
      diverifikasiAt: now,
      diverifikasiOleh: pengrajin.id,
    });
    pesanan.pembayaranAt = now;
    pesanan.kwitansi = {
      nomor: nomor("KWITANSI"),
      dibuatAt: now,
      finalAt: now,
      catatan: "Pembayaran COD diterima langsung oleh penjual.",
    };
    pesanan.status = "selesai";
  });
}

export function unggahDokumenPajakProduk(
  id: string,
  actor: MitraPengrajinUser | PengrajinUser,
  jenis: "faktur_pajak" | "bukti_potong",
  input: Omit<DokumenUnggahanTransaksi, "uploadedBy" | "uploadedAt">,
) {
  return mutate(id, (pesanan) => {
    if (jenis === "faktur_pajak") {
      if (actor.role !== "pengrajin" || actor.id !== pesanan.pengrajinId)
        throw new Error("Faktur Pajak hanya dapat diunggah penjual.");
      if (!pesanan.ringkasanPajak?.ppn)
        throw new Error("Transaksi ini tidak menyatakan adanya PPN.");
    } else {
      if (actor.role !== "mitra_pengrajin" || actor.id !== pesanan.mitraId)
        throw new Error("Bukti potong hanya dapat diunggah pembeli.");
      if (!pesanan.ringkasanPajak?.pphDipotong)
        throw new Error(
          "Transaksi ini tidak menyatakan adanya pemotongan PPh.",
        );
    }
    const document = {
      ...input,
      uploadedBy: actor.id,
      uploadedAt: Date.now(),
    };
    if (jenis === "faktur_pajak") pesanan.fakturPajak = document;
    else pesanan.buktiPotongPph = document;
  });
}

export function mulaiProduksiProduk(id: string, pengrajin: PengrajinUser) {
  return mutate(id, (pesanan) => {
    if (
      pesanan.pengrajinId !== pengrajin.id ||
      pesanan.status !== "kontrak_aktif"
    )
      throw new Error("Kontrak belum aktif.");
    pesanan.status = "diproses";
  });
}

export function kirimProduk(
  id: string,
  pengrajin: PengrajinUser,
  input: {
    ekspedisi?: string;
    layanan?: string;
    estimasiTiba?: string;
    nomorResi?: string;
    buktiResi?: Omit<DokumenUnggahanTransaksi, "uploadedBy" | "uploadedAt">;
    liveLocationUrl?: string;
    namaKurir?: string;
    noHpKurir?: string;
  } = {},
) {
  return mutate(id, (pesanan) => {
    if (pesanan.pengrajinId !== pengrajin.id || pesanan.status !== "diproses")
      throw new Error("Pesanan belum siap dikirim.");
    const total =
      pesanan.ringkasanPajak?.dibayarLangsungKePenjual ?? pesanan.nilaiTotal;
    const mekanisme = pesanan.pembayaran?.mekanisme ?? "lunas";
    if (
      !["setelah_barang_diterima", "cod"].includes(mekanisme) &&
      sisaPembayaran(total, pesanan.riwayatPembayaran) > 0
    )
      throw new Error("Pelunasan harus diverifikasi sebelum barang dikirim.");
    if (!pesanan.pengiriman)
      throw new Error("Metode pengiriman tidak ditemukan.");
    if (pesanan.pengiriman.metode === "kurir_paket" && !input.nomorResi?.trim())
      throw new Error("Nomor resi wajib untuk Kurir Paket.");
    if (pesanan.pengiriman.metode === "kurir_paket" && !input.buktiResi)
      throw new Error("Foto atau PDF resi wajib untuk Kurir Paket.");
    if (
      pesanan.pengiriman.metode === "instant" &&
      !input.liveLocationUrl?.trim()
    )
      throw new Error("Tautan live location wajib untuk pengiriman Instant.");
    Object.assign(pesanan.pengiriman, {
      ekspedisi: input.ekspedisi?.trim() || pesanan.pengiriman.ekspedisi,
      layanan: input.layanan?.trim() || pesanan.pengiriman.layanan,
      estimasiTiba:
        input.estimasiTiba?.trim() || pesanan.pengiriman.estimasiTiba,
      nomorResi: input.nomorResi?.trim() || undefined,
      liveLocationUrl: input.liveLocationUrl?.trim() || undefined,
      namaKurir: input.namaKurir?.trim() || undefined,
      noHpKurir: input.noHpKurir?.trim() || undefined,
      buktiResi: input.buktiResi
        ? {
            ...input.buktiResi,
            uploadedBy: pengrajin.id,
            uploadedAt: Date.now(),
          }
        : undefined,
    });
    pesanan.status = "dikirim";
    pesanan.bast = { nomor: nomor("BAST"), dibuatAt: Date.now() };
  });
}

export function sahkanBastProduk(id: string, mitra: MitraPengrajinUser) {
  return mutate(id, (pesanan) => {
    if (
      pesanan.mitraId !== mitra.id ||
      pesanan.status !== "dikirim" ||
      !pesanan.bast
    )
      throw new Error("BAST belum dapat disahkan.");
    pesanan.bast.finalAt = Date.now();
    const total =
      pesanan.ringkasanPajak?.dibayarLangsungKePenjual ?? pesanan.nilaiTotal;
    pesanan.status =
      sisaPembayaran(total, pesanan.riwayatPembayaran) === 0
        ? "selesai"
        : "menunggu_bayar";
  });
}
