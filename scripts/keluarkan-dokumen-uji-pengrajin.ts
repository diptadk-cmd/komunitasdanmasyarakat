import sharp from "sharp";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  downloadDokumenPemesananSewa,
  downloadDokumenPesananProduk,
} from "../artifacts/jak-sanggar/src/lib/dokumen-perdagangan";
import { hitungRingkasanPajakTransaksi } from "../lib/jaksanggar-core/src/kebijakan-transaksi";
import type {
  MitraPengrajinUser,
  PemesananSewa,
  PengrajinUser,
  PesananProdukPengrajin,
  SanggarUser,
  SewaUser,
} from "../lib/jaksanggar-core/src/types";

async function pngDataUrl(svg: string) {
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  return `data:image/png;base64,${png.toString("base64")}`;
}

function logoSvg(initials: string, background: string, foreground: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320">
    <rect width="320" height="320" rx="44" fill="${background}"/>
    <circle cx="160" cy="160" r="112" fill="none" stroke="${foreground}" stroke-width="18"/>
    <text x="160" y="181" text-anchor="middle" font-family="Arial" font-size="76" font-weight="700" fill="${foreground}">${initials}</text>
  </svg>`;
}

function stampSvg(label: string, color: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="420">
    <rect width="420" height="420" fill="white" fill-opacity="0"/>
    <circle cx="210" cy="210" r="166" fill="none" stroke="${color}" stroke-width="18"/>
    <circle cx="210" cy="210" r="126" fill="none" stroke="${color}" stroke-width="7"/>
    <text x="210" y="188" text-anchor="middle" font-family="Arial" font-size="42" font-weight="700" fill="${color}">${label}</text>
    <text x="210" y="246" text-anchor="middle" font-family="Arial" font-size="34" font-weight="700" fill="${color}">JAKARTA</text>
    <text x="210" y="302" text-anchor="middle" font-family="Arial" font-size="23" fill="${color}">RESMI</text>
  </svg>`;
}

async function main() {
  const outputDir = fileURLToPath(new URL("../output/pdf/", import.meta.url));
  mkdirSync(outputDir, { recursive: true });
  process.chdir(outputDir);
  const createdAt = new Date("2026-08-22T09:00:00+07:00").getTime();
  const finalAt = new Date("2026-08-22T15:30:00+07:00").getTime();
  const pengrajinLogo = await pngDataUrl(logoSvg("RKB", "#f4ead3", "#184c39"));
  const mitraLogo = await pngDataUrl(logoSvg("MKJ", "#e8eef8", "#243f72"));
  const pengrajinStamp = await pngDataUrl(stampSvg("RUMAH KRIYA", "#a01f2f"));
  const mitraStamp = await pngDataUrl(stampSvg("MITRA KRIYA", "#503b86"));

  const pengrajin = {
    id: "pengrajin-demo",
    role: "pengrajin",
    namaUsaha: "Rumah Kriya Betawi",
    namaPemilik: "Raka Saputra",
    jabatanPenandatangan: "Pemilik / Penanggung Jawab",
    alamat: "Jl. Setu Babakan No. 8, Jakarta Selatan",
    npwp: "12.345.678.9-012.000",
    nib: "1234567890123",
    statusPkp: "pkp",
    rekening: {
      bank: "DKI",
      nomor: "7012345678",
      atasNama: "Raka Saputra",
    },
    logoDataUrl: pengrajinLogo,
    stempelDataUrl: pengrajinStamp,
  } as PengrajinUser;

  const mitra = {
    id: "mitra-demo",
    role: "mitra_pengrajin",
    namaUsaha: "Mitra Kriya Jakarta",
    namaBadanUsaha: "PT Mitra Kriya Jakarta",
    namaPenanggungJawab: "Nadia Prameswari",
    jabatanPenandatangan: "Direktur",
    alamat: "Jl. Kebon Sirih No. 18, Jakarta Pusat",
    npwp: "98.765.432.1-071.000",
    nib: "9876543210987",
    logoDataUrl: mitraLogo,
    stempelDataUrl: mitraStamp,
  } as MitraPengrajinUser;

  const subtotalProduk = 10 * 175_000;
  const biayaOngkir = 75_000;
  const ringkasanPajak = hitungRingkasanPajakTransaksi({
    subtotal: subtotalProduk,
    ongkir: biayaOngkir,
    statusPkpPenjual: "pkp",
    objekPajak: "barang_non_mewah",
  });

  const pesanan: PesananProdukPengrajin = {
    id: "pesanan-uji-0001",
    nomor: "ORDER/KRIYA/2026/0001",
    mitraId: mitra.id,
    pengrajinId: pengrajin.id,
    items: [
      {
        produkId: "produk-ondel-ondel",
        nama: "Miniatur Ondel-ondel Betawi",
        jumlah: 10,
        harga: 175_000,
        satuan: "buah",
      },
    ],
    alamatPengiriman: mitra.alamat,
    targetSelesai: "2026-09-05",
    catatan: "Warna dan mutu mengikuti contoh produk yang telah disetujui.",
    subtotalProduk,
    nilaiTotal: ringkasanPajak.totalInvoice,
    pengiriman: {
      metode: "kurir_paket",
      ongkirTermasukHarga: false,
      penanggungOngkir: "pembeli",
      statusOngkir: "disepakati",
      biayaOngkir,
      ekspedisi: "JNE",
      layanan: "REG",
      estimasiTiba: "2 hari",
      nomorResi: "JNE-UJI-2026-0001",
      dikirimAt: finalAt - 3_600_000,
    },
    pembayaran: {
      mekanisme: "lunas",
      pembayaranLangsung: true,
      penampungDanaJakSanggar: false,
      disepakatiPembeliAt: createdAt,
      disepakatiPenjualAt: createdAt,
    },
    ringkasanPajak,
    rekeningTujuan: structuredClone(pengrajin.rekening),
    riwayatPembayaran: [
      {
        id: "bayar-uji-0001",
        tahap: "lunas",
        nominal: ringkasanPajak.dibayarLangsungKePenjual,
        bukti: {
          nama: "Bukti-Transfer-Uji.pdf",
          type: "application/pdf",
          size: 128_000,
          uploadedBy: mitra.id,
          uploadedAt: finalAt - 7_200_000,
        },
        diajukanAt: finalAt - 7_200_000,
        diverifikasiAt: finalAt - 6_000_000,
        diverifikasiOleh: pengrajin.id,
      },
    ],
    status: "selesai",
    ttd: [
      {
        pihak: "pengrajin",
        userId: pengrajin.id,
        nama: pengrajin.namaPemilik,
        ts: createdAt,
      },
      {
        pihak: "mitra",
        userId: mitra.id,
        nama: mitra.namaPenanggungJawab,
        ts: createdAt,
      },
    ],
    kontrak: {
      nomor: "KONTRAK/KRIYA/2026/0001",
      dibuatAt: createdAt,
      finalAt: createdAt,
    },
    invoice: {
      nomor: "INVOICE/KRIYA/2026/0001",
      dibuatAt: createdAt,
      finalAt: createdAt,
    },
    kwitansi: {
      nomor: "KWITANSI/KRIYA/2026/0001",
      dibuatAt: finalAt - 6_000_000,
      finalAt: finalAt - 6_000_000,
      catatan: "Pembayaran langsung telah diterima dan diverifikasi Pengrajin.",
    },
    bast: {
      nomor: "BAST/KRIYA/2026/0001",
      dibuatAt: finalAt,
      finalAt,
      catatan: "Barang diterima lengkap dan dalam kondisi baik.",
    },
    pembayaranAt: finalAt - 6_000_000,
    createdAt,
    updatedAt: finalAt,
  };

  downloadDokumenPesananProduk("kontrak", pesanan, pengrajin, mitra);
  downloadDokumenPesananProduk("invoice", pesanan, pengrajin, mitra);
  downloadDokumenPesananProduk("kwitansi", pesanan, pengrajin, mitra);
  downloadDokumenPesananProduk("bast", pesanan, pengrajin, mitra);

  const sanggarLogo = await pngDataUrl(logoSvg("SKS", "#f8ead1", "#6f1f2c"));
  const sanggarStamp = await pngDataUrl(stampSvg("SANGGAR KEMBANG", "#6f1f2c"));
  const konsumenLogo = await pngDataUrl(logoSvg("KP", "#edf2f7", "#29445e"));
  const sanggar = {
    id: "sanggar-uji",
    role: "sanggar",
    namaSanggar: "Sanggar Kembang Setaman",
    namaKetua: "Hendra Wijaya",
    alamat: "Jl. Kebon Jeruk Raya No. 88, Jakarta Barat",
    npwp: "11.222.333.4-055.000",
    rekening: {
      bank: "DKI",
      nomor: "7011223344",
      atasNama: "Sanggar Kembang Setaman",
    },
    logoDataUrl: sanggarLogo,
    stempelDataUrl: sanggarStamp,
  } as SanggarUser;
  const konsumen = {
    id: "konsumen-uji",
    role: "sewa",
    nama: "Komunitas Pecinta Budaya Jakarta",
    alamat: "Jl. Cikini Raya No. 20, Jakarta Pusat",
    fotoProfileDataUrl: konsumenLogo,
  } as SewaUser;
  const sewa: PemesananSewa = {
    id: "sewa-uji-0001",
    nomor: "SEWA/2026/0001",
    katalogItemId: "sarpras-studio-uji",
    sumberType: "sarpras",
    sumberId: "studio-uji",
    sewaId: konsumen.id,
    pemesanRole: "sewa",
    tujuanTransaksi: "penggunaan_sendiri",
    sanggarId: sanggar.id,
    penyediaRole: "sanggar",
    judul: "Sewa Studio Latihan dan Perangkat Musik Betawi",
    kategori: "Tempat",
    tanggalMulai: "2026-09-10",
    tanggalSelesai: "2026-09-10",
    lokasi: "Sanggar Kembang Setaman, Jakarta Barat",
    jumlah: 4,
    satuanHarga: "per_jam",
    catatan: "Ruangan, perangkat, dan jadwal telah diperiksa dan disepakati.",
    hargaDasar: 450_000,
    akomodasiPP: "diluar",
    biayaAkomodasi: 100_000,
    nilaiTotal: 1_900_000,
    status: "selesai",
    ttd: [
      {
        pihak: "sanggar",
        userId: sanggar.id,
        nama: sanggar.namaKetua,
        ts: createdAt,
      },
      {
        pihak: "sewa",
        userId: konsumen.id,
        nama: konsumen.nama,
        ts: createdAt,
      },
    ],
    invoiceId: "invoice-sewa-uji",
    bastId: "bast-sewa-uji",
    createdAt,
    updatedAt: finalAt,
  };
  const invoiceSewa = {
    id: "invoice-sewa-uji",
    kerjasamaId: sewa.id,
    nomor: "INVOICE/SEWA/2026/0001",
    total: sewa.nilaiTotal,
    status: "lunas" as const,
    batasPembayaran: createdAt + 7 * 86_400_000,
    createdAt,
  };
  const pembayaranSewa = [{
    id: "bayar-sewa-uji",
    invoiceId: invoiceSewa.id,
    nominal: invoiceSewa.total,
    tanggalBayar: finalAt - 7_200_000,
    status: "disetujui" as const,
    createdAt: finalAt - 7_200_000,
  }];
  const bastSewa = {
    id: "bast-sewa-uji",
    kerjasamaId: sewa.id,
    nomor: "BAST/SEWA/2026/0001",
    status: "final" as const,
    createdAt: finalAt,
    finalAt,
  };
  const rincianSewa = {
    invoice: invoiceSewa,
    pembayaran: pembayaranSewa,
    kontrakNomor: "KONTRAK/SEWA/2026/0001",
    bast: bastSewa,
  };
  downloadDokumenPemesananSewa("kontrak", sewa, sanggar, konsumen, "dokumenusaha", rincianSewa);
  downloadDokumenPemesananSewa("invoice", sewa, sanggar, konsumen, "dokumenusaha", rincianSewa);
  downloadDokumenPemesananSewa("kwitansi", sewa, sanggar, konsumen, "dokumenusaha", rincianSewa);
  downloadDokumenPemesananSewa("bast", sewa, sanggar, konsumen, "dokumenusaha", rincianSewa);
}

void main();
