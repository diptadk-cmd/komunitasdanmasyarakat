import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { bukaPratinjauPdf } from "@/lib/document-preview";
import type {
  Bast,
  Invoice,
  MitraPengrajinUser,
  Kerjasama,
  Payment,
  PelatihUser,
  PemesananSewa,
  PengrajinUser,
  PesananProdukPengrajin,
  SanggarUser,
  SewaUser,
} from "./types";
import {
  labelMetodePembayaran,
  labelMetodePengiriman,
  sisaPembayaran,
  totalPembayaranTerverifikasi,
} from "./kebijakan-transaksi";
import {
  renderDokumenTransaksiTemplate,
  type JenisDokumenTransaksi,
} from "./dokumen-transaksi-template";
import { tempatTandaTanganDariProvinsi } from "./lokasi-dokumen";

export interface PihakDokumenUsaha {
  namaUsaha: string;
  namaPenandatangan: string;
  jabatan: string;
  alamat: string;
  npwp?: string;
  nib?: string;
  logoDataUrl?: string;
  stempelDataUrl?: string;
}

function imageFormat(dataUrl?: string) {
  if (!dataUrl) return undefined;
  const match = /^data:image\/(png|jpe?g|webp)/i.exec(dataUrl);
  if (!match) return undefined;
  return match[1].toLowerCase() === "png"
    ? "PNG"
    : match[1].toLowerCase() === "webp"
      ? "WEBP"
      : "JPEG";
}

function addImage(
  doc: jsPDF,
  dataUrl: string | undefined,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const format = imageFormat(dataUrl);
  if (!format || !dataUrl) return false;
  try {
    doc.addImage(dataUrl, format, x, y, width, height);
    return true;
  } catch {
    return false;
  }
}

export function pihakDariPengrajin(user: PengrajinUser): PihakDokumenUsaha {
  return {
    namaUsaha: user.namaUsaha,
    namaPenandatangan: user.namaPemilik,
    jabatan: user.jabatanPenandatangan || "Pemilik / Penanggung Jawab",
    alamat: user.alamat,
    npwp: user.npwp,
    nib: user.nib,
    logoDataUrl: user.logoDataUrl || user.fotoProfileDataUrl,
    stempelDataUrl: user.stempelDataUrl,
  };
}

export function pihakDariMitra(user: MitraPengrajinUser): PihakDokumenUsaha {
  return {
    namaUsaha: user.namaBadanUsaha || user.namaUsaha,
    namaPenandatangan: user.namaPenanggungJawab,
    jabatan: user.jabatanPenandatangan || "Penanggung Jawab",
    alamat: user.alamat,
    npwp: user.npwp,
    nib: user.nib,
    logoDataUrl: user.logoDataUrl,
    stempelDataUrl: user.stempelDataUrl,
  };
}

export function pihakDariSanggar(user: SanggarUser): PihakDokumenUsaha {
  return {
    namaUsaha: user.namaBadanHukum || user.namaSanggar,
    namaPenandatangan: user.namaKetua,
    jabatan: "Ketua / Penanggung Jawab Sanggar",
    alamat: user.alamat,
    npwp: user.npwp,
    logoDataUrl: user.logoDataUrl || user.fotoProfileDataUrl,
    stempelDataUrl: user.stempelDataUrl,
  };
}

export function pihakDariPelatih(user: PelatihUser): PihakDokumenUsaha {
  return {
    namaUsaha: user.namaLayananPrivat || user.nama,
    namaPenandatangan: user.nama,
    jabatan: "Pelatih / Penyedia Kelas Privat",
    alamat: user.alamat || "Jakarta",
    npwp: user.npwp,
    logoDataUrl: user.fotoProfileDataUrl,
  };
}

export function pihakDariKonsumen(user: SewaUser): PihakDokumenUsaha {
  return {
    namaUsaha: user.nama,
    namaPenandatangan: user.nama,
    jabatan: user.jenisInstansi
      ? "Penanggung Jawab Konsumen / Instansi"
      : "Konsumen",
    alamat: user.alamat || "Jakarta",
    logoDataUrl: user.fotoProfileDataUrl,
  };
}

function drawPartyHeader(
  doc: jsPDF,
  party: PihakDokumenUsaha,
  x: number,
  y: number,
  width: number,
  align: "left" | "right",
) {
  const logoSize = 38;
  const logoX = align === "left" ? x : x + width - logoSize;
  const textX = align === "left" ? x + logoSize + 8 : x + width - logoSize - 8;
  const textAlign = align;
  if (!addImage(doc, party.logoDataUrl, logoX, y, logoSize, logoSize)) {
    doc.setFillColor(238, 233, 220);
    doc.roundedRect(logoX, y, logoSize, logoSize, 4, 4, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(55, 65, 60);
    doc.text(
      party.namaUsaha
        .split(/\s+/)
        .slice(0, 2)
        .map((value) => value[0])
        .join("")
        .toUpperCase(),
      logoX + logoSize / 2,
      y + 24,
      { align: "center" },
    );
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(20, 55, 45);
  doc.text(party.namaUsaha, textX, y + 11, { align: textAlign });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.2);
  doc.setTextColor(80, 80, 80);
  const lines = doc.splitTextToSize(party.alamat || "-", width - logoSize - 10);
  doc.text(lines.slice(0, 2), textX, y + 22, { align: textAlign });
}

function drawSignature(
  doc: jsPDF,
  party: PihakDokumenUsaha,
  label: string,
  x: number,
  y: number,
  width: number,
  signed: boolean,
) {
  const center = x + width / 2;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(35, 35, 35);
  doc.text(label, center, y, { align: "center" });
  doc.text(party.jabatan, center, y + 13, { align: "center" });
  if (signed) {
    addImage(doc, party.stempelDataUrl, center - 27, y + 20, 54, 54);
    doc.setFontSize(7);
    doc.setTextColor(55, 105, 70);
    doc.text("Ditandatangani secara elektronik", center, y + 81, {
      align: "center",
    });
  } else {
    doc.setFontSize(7);
    doc.setTextColor(130, 130, 130);
    doc.text("Ruang tanda tangan & stempel", center, y + 55, {
      align: "center",
    });
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(35, 35, 35);
  doc.text(party.namaPenandatangan, center, y + 99, { align: "center" });
  const lineWidth = Math.min(
    140,
    Math.max(80, doc.getTextWidth(party.namaPenandatangan) + 12),
  );
  doc.line(center - lineWidth / 2, y + 102, center + lineWidth / 2, y + 102);
}

/**
 * Dokumen perdagangan tidak memakai banner/kop Jak Sanggar.
 * Halaman pertama menampilkan logo kedua pihak; blok tanda tangan memakai
 * stempel yang tersimpan pada profil usaha masing-masing.
 */
function downloadDokumenPesananProdukLegacy(
  jenis: "kontrak" | "invoice" | "kwitansi" | "bast",
  pesanan: PesananProdukPengrajin,
  pengrajin: PengrajinUser,
  mitra: MitraPengrajinUser,
  ownerPassword = "dokumenusaha",
) {
  const snapshot = {
    kontrak: pesanan.kontrak,
    invoice: pesanan.invoice,
    kwitansi: pesanan.kwitansi,
    bast: pesanan.bast,
  }[jenis];
  if (!snapshot) throw new Error("Dokumen belum tersedia.");
  const penyedia = pihakDariPengrajin(pengrajin);
  const pembeli = pihakDariMitra(mitra);
  const title = {
    kontrak: "KONTRAK PENGADAAN PRODUK KERAJINAN",
    invoice: "INVOICE PENGADAAN PRODUK KERAJINAN",
    kwitansi: "KWITANSI PEMBAYARAN",
    bast: "BERITA ACARA SERAH TERIMA (BAST)",
  }[jenis];
  const doc = new jsPDF({
    unit: "pt",
    format: "a4",
    encryption: {
      ownerPassword,
      userPermissions: ["print", "copy", "annot-forms"],
    },
  });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 42;
  const partyWidth = (pageWidth - margin * 2 - 24) / 2;

  drawPartyHeader(doc, penyedia, margin, 34, partyWidth, "left");
  drawPartyHeader(
    doc,
    pembeli,
    margin + partyWidth + 24,
    34,
    partyWidth,
    "right",
  );
  doc.setDrawColor(35, 75, 58);
  doc.setLineWidth(1.5);
  doc.line(margin, 84, pageWidth - margin, 84);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(25, 35, 30);
  doc.text(title, pageWidth / 2, 113, { align: "center" });
  doc.setFontSize(9);
  doc.text(`Nomor: ${snapshot.nomor}`, pageWidth / 2, 128, {
    align: "center",
  });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.2);
  const tanggalDokumen = new Date(snapshot.dibuatAt).toLocaleDateString(
    "id-ID",
    { dateStyle: "long" },
  );
  const intro = {
    kontrak: `Pada ${tanggalDokumen}, ${penyedia.namaUsaha} dan ${pembeli.namaUsaha} sepakat melakukan pengadaan produk kerajinan sesuai rincian berikut.`,
    invoice: `${penyedia.namaUsaha} menerbitkan tagihan kepada ${pembeli.namaUsaha} untuk pesanan ${pesanan.nomor} sesuai rincian berikut.`,
    kwitansi: `${penyedia.namaUsaha} menerangkan telah menerima pembayaran dari ${pembeli.namaUsaha} untuk pesanan ${pesanan.nomor} sesuai rincian berikut.`,
    bast: `${penyedia.namaUsaha} menerangkan bahwa produk dalam pesanan ${pesanan.nomor} telah diserahkan kepada ${pembeli.namaUsaha} untuk diperiksa dan diterima sesuai rincian berikut.`,
  }[jenis];
  const introLines = doc.splitTextToSize(intro, pageWidth - margin * 2);
  doc.text(introLines, margin, 153);

  const pajak = pesanan.ringkasanPajak;
  const nilaiKePenjual = pajak?.dibayarLangsungKePenjual ?? pesanan.nilaiTotal;
  const dibayar = totalPembayaranTerverifikasi(pesanan.riwayatPembayaran);
  const sisa = sisaPembayaran(nilaiKePenjual, pesanan.riwayatPembayaran);
  const summaryRows = [
    [
      "",
      "",
      "Subtotal produk",
      `Rp ${(pajak?.subtotal ?? pesanan.subtotalProduk ?? pesanan.nilaiTotal).toLocaleString("id-ID")}`,
    ],
    [
      "",
      "",
      pajak?.ongkir ? "Ongkos kirim" : "Ongkos kirim",
      pajak?.ongkir
        ? `Rp ${pajak.ongkir.toLocaleString("id-ID")}`
        : pesanan.pengiriman?.ongkirTermasukHarga
          ? "Termasuk harga"
          : "Rp 0",
    ],
    ["", "", "DPP PPN", `Rp ${(pajak?.dppPpn ?? 0).toLocaleString("id-ID")}`],
    [
      "",
      "",
      `PPN (${pajak?.statusPkpPenjual === "pkp" ? "sesuai deklarasi PKP" : "tidak dipungut Non-PKP"})`,
      `Rp ${(pajak?.ppn ?? 0).toLocaleString("id-ID")}`,
    ],
    ...(pajak?.pphDipotong
      ? [
          [
            "",
            "",
            "PPh dipotong pembeli",
            `- Rp ${pajak.pphDipotong.toLocaleString("id-ID")}`,
          ],
        ]
      : []),
    [
      "",
      "",
      "Total invoice",
      `Rp ${(pajak?.totalInvoice ?? pesanan.nilaiTotal).toLocaleString("id-ID")}`,
    ],
    [
      "",
      "",
      "Dibayar langsung ke penjual",
      `Rp ${nilaiKePenjual.toLocaleString("id-ID")}`,
    ],
  ];

  autoTable(doc, {
    startY: 153 + introLines.length * 11 + 12,
    head: [["Produk", "Jumlah", "Harga", "Subtotal"]],
    body: pesanan.items.map((item) => [
      item.nama,
      `${item.jumlah} ${item.satuan}`,
      `Rp ${item.harga.toLocaleString("id-ID")}`,
      `Rp ${(item.harga * item.jumlah).toLocaleString("id-ID")}`,
    ]),
    foot: summaryRows,
    margin: { left: margin, right: margin },
    styles: { fontSize: 8.5, cellPadding: 5 },
    headStyles: { fillColor: [24, 76, 57] },
    footStyles: {
      fillColor: [237, 232, 217],
      textColor: [30, 45, 38],
      fontStyle: "bold",
    },
    theme: "grid",
  });
  const lastY =
    (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable
      ?.finalY ?? 290;
  let y = lastY + 22;
  const details = [
    `Target selesai: ${pesanan.targetSelesai}`,
    `Alamat pengiriman: ${pesanan.alamatPengiriman}`,
    `Metode pengiriman: ${labelMetodePengiriman(pesanan.pengiriman?.metode ?? "-")}. Ongkir ${pesanan.pengiriman?.ongkirTermasukHarga ? "sudah termasuk dalam harga dan ditanggung penjual" : `sebesar Rp ${(pesanan.pengiriman?.biayaOngkir ?? 0).toLocaleString("id-ID")} ditanggung pembeli`}.`,
    pesanan.pengiriman?.nomorResi
      ? `Nomor resi: ${pesanan.pengiriman.nomorResi}.`
      : pesanan.pengiriman?.liveLocationUrl
        ? `Live location: ${pesanan.pengiriman.liveLocationUrl}.`
        : "Data resi/live location dilengkapi saat pengiriman sesuai metode.",
    `Mekanisme pembayaran: ${labelMetodePembayaran(pesanan.pembayaran?.mekanisme ?? "lunas")}. Pembayaran dilakukan langsung ke rekening ${pesanan.rekeningTujuan?.bank ?? pengrajin.rekening.bank} ${pesanan.rekeningTujuan?.nomor ?? pengrajin.rekening.nomor} atas nama ${pesanan.rekeningTujuan?.atasNama ?? pengrajin.rekening.atasNama}.`,
    `Pembayaran terverifikasi penjual: Rp ${dibayar.toLocaleString("id-ID")}; sisa pembayaran: Rp ${sisa.toLocaleString("id-ID")}.`,
    `Catatan: ${pesanan.catatan || "-"}`,
    `Jak Sanggar tidak menerima, menyimpan, menahan, atau meneruskan dana transaksi. Kewajiban perpajakan, Faktur Pajak, bukti potong, penyetoran, dan pelaporan dilaksanakan masing-masing pihak sesuai status dan kewajibannya.`,
    jenis === "kontrak"
      ? `Hak dan kewajiban ${penyedia.namaUsaha} dan ${pembeli.namaUsaha} mengikuti rincian pesanan, mutu yang disepakati, jadwal penyerahan, dan ketentuan pembayaran yang disepakati langsung oleh ${penyedia.namaUsaha} dan ${pembeli.namaUsaha}.`
      : jenis === "invoice"
        ? `Status pembayaran: ${sisa === 0 ? "Lunas dan diverifikasi penjual" : dibayar > 0 ? "Dibayar sebagian; menunggu pelunasan" : "Menunggu pembayaran langsung"}.`
        : jenis === "kwitansi"
          ? `Pembayaran diterima pada ${new Date(pesanan.pembayaranAt ?? snapshot.dibuatAt).toLocaleDateString("id-ID", { dateStyle: "long" })}.`
          : `Status penerimaan: ${snapshot.finalAt ? "Final / diterima tanpa keberatan" : "Draft / menunggu pengesahan penerima"}.`,
  ];
  for (const detail of details) {
    const lines = doc.splitTextToSize(detail, pageWidth - margin * 2);
    doc.text(lines, margin, y);
    y += lines.length * 11 + 6;
  }

  const signedPengrajin =
    jenis === "invoice" || jenis === "kwitansi" || jenis === "bast"
      ? true
      : pesanan.ttd.some((signature) => signature.pihak === "pengrajin");
  const signedMitra =
    jenis === "bast"
      ? Boolean(snapshot.finalAt)
      : jenis === "kwitansi"
        ? Boolean(pesanan.pembayaranAt)
        : jenis === "invoice"
          ? false
          : pesanan.ttd.some((signature) => signature.pihak === "mitra");
  if (y > 610) {
    doc.addPage();
    y = 75;
  } else {
    y += 14;
  }
  drawSignature(
    doc,
    penyedia,
    penyedia.namaUsaha,
    margin,
    y,
    partyWidth,
    signedPengrajin,
  );
  drawSignature(
    doc,
    pembeli,
    pembeli.namaUsaha,
    margin + partyWidth + 24,
    y,
    partyWidth,
    signedMitra,
  );

  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7.5);
    doc.setTextColor(120, 120, 120);
    doc.text(
      `${penyedia.namaUsaha} dan ${pembeli.namaUsaha} - Halaman ${page}/${pageCount}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 18,
      { align: "center" },
    );
  }
  const safeNumber = snapshot.nomor.replace(/[^a-z0-9]+/gi, "-");
  const fileLabel = {
    kontrak: "Kontrak",
    invoice: "Invoice",
    kwitansi: "Kwitansi",
    bast: "BAST",
  }[jenis];
  bukaPratinjauPdf({
    title: `${fileLabel} ${snapshot.nomor}`,
    fileName: `${fileLabel}-${safeNumber}.pdf`,
    blob: doc.output("blob"),
  });
}

/** Dokumen bilateral antar-Sanggar dengan kop dan stempel masing-masing pihak. */
function downloadDokumenKerjasamaSanggarLegacy(
  jenis: "kontrak" | "bast",
  nomor: string,
  kerjasama: Kerjasama,
  penyediaUser: SanggarUser,
  peminjamUser: SanggarUser,
  statusDokumen: string,
  ownerPassword = "dokumenusaha",
) {
  const penyedia = pihakDariSanggar(penyediaUser);
  const peminjam = pihakDariSanggar(peminjamUser);
  const title =
    jenis === "kontrak"
      ? "KONTRAK KERJA SAMA"
      : "BERITA ACARA SERAH TERIMA (BAST)";
  const doc = new jsPDF({
    unit: "pt",
    format: "a4",
    encryption: {
      ownerPassword,
      userPermissions: ["print", "copy", "annot-forms"],
    },
  });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 42;
  const partyWidth = (pageWidth - margin * 2 - 24) / 2;
  drawPartyHeader(doc, penyedia, margin, 34, partyWidth, "left");
  drawPartyHeader(
    doc,
    peminjam,
    margin + partyWidth + 24,
    34,
    partyWidth,
    "right",
  );
  doc.setDrawColor(35, 75, 58);
  doc.setLineWidth(1.5);
  doc.line(margin, 84, pageWidth - margin, 84);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(25, 35, 30);
  doc.text(title, pageWidth / 2, 113, { align: "center" });
  doc.setFontSize(9);
  doc.text(`Nomor: ${nomor}`, pageWidth / 2, 128, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.2);
  const body = [
    `Nomor kerja sama: ${kerjasama.nomor}`,
    `Objek: ${kerjasama.judul}`,
    `Periode: ${new Date(kerjasama.tanggalMulai).toLocaleDateString("id-ID")} s.d. ${new Date(kerjasama.tanggalSelesai).toLocaleDateString("id-ID")}`,
    `Lokasi: ${kerjasama.lokasi}`,
    `Jumlah: ${kerjasama.jumlah} ${kerjasama.satuanHarga}`,
    `Nilai total: Rp ${kerjasama.nilaiTotal.toLocaleString("id-ID")}`,
    `Status dokumen: ${statusDokumen.toUpperCase()}`,
    `Pembayaran dilakukan langsung antar pihak sesuai rekening dan kesepakatan transaksi. Jak Sanggar tidak menerima atau menampung dana.`,
    `Kewajiban perpajakan, penyetoran, pelaporan, Faktur Pajak, dan bukti potong menjadi tanggung jawab masing-masing pihak.`,
    jenis === "kontrak"
      ? `${penyedia.namaUsaha} dan ${peminjam.namaUsaha} sepakat melaksanakan kerja sama dengan itikad baik sesuai rincian di atas. Perubahan hanya sah bila disepakati oleh ${penyedia.namaUsaha} dan ${peminjam.namaUsaha}.`
      : statusDokumen.toLowerCase() === "final"
        ? `${penyedia.namaUsaha} dan ${peminjam.namaUsaha} menyatakan pelaksanaan telah selesai dan diterima dengan baik.`
        : `Dokumen masih berupa draft dan menunggu finalisasi ${penyedia.namaUsaha} dan ${peminjam.namaUsaha}.`,
  ];
  let y = 158;
  for (const line of body) {
    const lines = doc.splitTextToSize(line, pageWidth - margin * 2);
    doc.text(lines, margin, y);
    y += lines.length * 12 + 6;
  }
  y += 18;
  const signed = jenis === "kontrak" || statusDokumen.toLowerCase() === "final";
  drawSignature(
    doc,
    penyedia,
    penyedia.namaUsaha,
    margin,
    y,
    partyWidth,
    signed,
  );
  drawSignature(
    doc,
    peminjam,
    peminjam.namaUsaha,
    margin + partyWidth + 24,
    y,
    partyWidth,
    signed,
  );
  doc.setFont("helvetica", "italic");
  doc.setFontSize(7.5);
  doc.setTextColor(120, 120, 120);
  doc.text(
    `${penyedia.namaUsaha} dan ${peminjam.namaUsaha}`,
    pageWidth / 2,
    doc.internal.pageSize.getHeight() - 18,
    { align: "center" },
  );
  bukaPratinjauPdf({
    title: `${title} ${nomor}`,
    fileName: `${jenis === "kontrak" ? "Kontrak" : "BAST"}-${nomor.replace(/[^a-z0-9]+/gi, "-")}.pdf`,
    blob: doc.output("blob"),
  });
}

function formatTanggalTemplate(value: number | string) {
  const date =
    typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? new Date(`${value}T00:00:00`)
      : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("id-ID", { dateStyle: "long" });
}

/**
 * Kontrak, invoice, kwitansi, dan BAST pengadaan produk mengikuti empat
 * templat pengguna. Kop/stempel berasal dari profil usaha, bukan Jak Sanggar,
 * dan redaksi menyebut nama yang sebenarnya tanpa label Pihak Pertama/Kedua.
 */
export function downloadDokumenPesananProduk(
  jenis: JenisDokumenTransaksi,
  pesanan: PesananProdukPengrajin,
  pengrajin: PengrajinUser,
  mitra: MitraPengrajinUser,
  ownerPassword = "dokumenusaha",
) {
  const snapshot = {
    kontrak: pesanan.kontrak,
    invoice: pesanan.invoice,
    kwitansi: pesanan.kwitansi,
    bast: pesanan.bast,
  }[jenis];
  if (!snapshot) throw new Error("Dokumen belum tersedia.");

  const pajak = pesanan.ringkasanPajak;
  const penyedia = pihakDariPengrajin(pengrajin);
  const pembeli = pihakDariMitra(mitra);
  const dibayar = totalPembayaranTerverifikasi(pesanan.riwayatPembayaran);
  const dibayarKePenyedia =
    pajak?.dibayarLangsungKePenjual ?? pesanan.nilaiTotal;
  const sisa = sisaPembayaran(dibayarKePenyedia, pesanan.riwayatPembayaran);
  const jatuhTempoHari = pesanan.pembayaran?.jatuhTempoHari ?? 7;
  const jatuhTempoLabel =
    pesanan.pembayaran?.mekanisme === "cod"
      ? "Saat serah terima / COD"
      : pesanan.pembayaran?.mekanisme === "setelah_barang_diterima"
        ? "Setelah barang diterima"
        : formatTanggalTemplate(
            snapshot.dibuatAt + jatuhTempoHari * 86_400_000,
          );
  const statusPembayaran =
    sisa === 0
      ? "Lunas dan diverifikasi penyedia"
      : dibayar > 0
        ? `Dibayar sebagian Rp ${dibayar.toLocaleString("id-ID")}; sisa Rp ${sisa.toLocaleString("id-ID")}`
        : "Menunggu pembayaran langsung kepada penyedia";

  renderDokumenTransaksiTemplate({
    jenis,
    nomorDokumen: snapshot.nomor,
    nomorKontrak: pesanan.kontrak?.nomor,
    nomorInvoice: pesanan.invoice?.nomor,
    nomorKwitansi: pesanan.kwitansi?.nomor,
    nomorBast: pesanan.bast?.nomor,
    nomorPesanan: pesanan.nomor,
    dibuatAt: snapshot.dibuatAt,
    finalAt: snapshot.finalAt,
    jatuhTempoLabel,
    tempatTandaTangan: tempatTandaTanganDariProvinsi(
      mitra.wilayah?.provinsi ?? pengrajin.wilayah.provinsi,
      pesanan.alamatPengiriman,
      mitra.alamat,
      pengrajin.alamat,
    ),
    penyedia,
    pembeli,
    judulKontrak: "PERJANJIAN PENGADAAN PRODUK KERAJINAN",
    judulBast: "BERITA ACARA SERAH TERIMA PRODUK",
    namaObjek: "Produk",
    items: pesanan.items.map((item) => ({
      nama: item.nama,
      jumlah: item.jumlah,
      satuan: item.satuan,
      harga: item.harga,
      subtotal: item.harga * item.jumlah,
    })),
    subtotal: pajak?.subtotal ?? pesanan.subtotalProduk ?? pesanan.nilaiTotal,
    ongkir: pajak?.ongkir ?? pesanan.pengiriman?.biayaOngkir ?? 0,
    dppPpn: pajak?.dppPpn ?? 0,
    ppn: pajak?.ppn ?? 0,
    pphDipotong: pajak?.pphDipotong ?? 0,
    totalInvoice: pajak?.totalInvoice ?? pesanan.nilaiTotal,
    dibayarKePenyedia,
    pembayaranTerverifikasi: dibayar,
    rekening: pesanan.rekeningTujuan ?? pengrajin.rekening,
    mekanismePembayaran: `${labelMetodePembayaran(pesanan.pembayaran?.mekanisme ?? "lunas")}; pembayaran langsung ke rekening ${penyedia.namaUsaha}`,
    metodePenyerahan: `${labelMetodePengiriman(pesanan.pengiriman?.metode ?? "-")}${pesanan.pengiriman?.ekspedisi ? ` - ${pesanan.pengiriman.ekspedisi}${pesanan.pengiriman.layanan ? ` ${pesanan.pengiriman.layanan}` : ""}` : ""}`,
    targetSelesai: formatTanggalTemplate(pesanan.targetSelesai),
    lokasiPenyerahan: pesanan.alamatPengiriman,
    catatan: snapshot.catatan || pesanan.catatan || "-",
    statusDokumen: snapshot.finalAt ? "final" : "draft",
    statusPembayaran,
    ditandatanganiPenyedia:
      jenis === "invoice" || jenis === "kwitansi" || jenis === "bast"
        ? true
        : pesanan.ttd.some((signature) => signature.pihak === "pengrajin"),
    ditandatanganiPembeli:
      jenis === "bast"
        ? Boolean(snapshot.finalAt)
        : jenis === "kwitansi" || jenis === "invoice"
          ? false
          : pesanan.ttd.some((signature) => signature.pihak === "mitra"),
    ownerPassword,
  });
}

export interface RincianDokumenKerjasamaSanggar {
  invoice?: Invoice;
  pembayaran?: Payment[];
  kontrakNomor?: string;
  bast?: Bast;
}

/** Dokumen antar-Sanggar memakai pola visual yang sama dengan templat produk. */
export function downloadDokumenKerjasamaSanggar(
  jenis: JenisDokumenTransaksi,
  nomor: string,
  kerjasama: Kerjasama,
  penyediaUser: SanggarUser,
  peminjamUser: SanggarUser,
  statusDokumen: string,
  ownerPassword = "dokumenusaha",
  rincian: RincianDokumenKerjasamaSanggar = {},
) {
  const penyedia = pihakDariSanggar(penyediaUser);
  const pembeli = pihakDariSanggar(peminjamUser);
  const pembayaranTerverifikasi = (rincian.pembayaran ?? [])
    .filter((payment) => payment.status === "disetujui")
    .reduce((sum, payment) => sum + payment.nominal, 0);
  const invoice = rincian.invoice;
  const pembayaranTerakhir = (rincian.pembayaran ?? []).find(
    (payment) => payment.status === "disetujui",
  );
  const dibuatAt =
    jenis === "invoice"
      ? (invoice?.createdAt ?? kerjasama.updatedAt)
      : jenis === "kwitansi"
        ? (pembayaranTerakhir?.tanggalBayar ?? kerjasama.updatedAt)
        : jenis === "bast"
          ? (rincian.bast?.createdAt ?? kerjasama.updatedAt)
          : kerjasama.createdAt;
  const hargaSatuan =
    kerjasama.jumlah > 0
      ? kerjasama.nilaiTotal / kerjasama.jumlah
      : kerjasama.nilaiTotal;
  const kontrakNomor =
    rincian.kontrakNomor ?? (jenis === "kontrak" ? nomor : undefined);
  const nomorBast =
    rincian.bast?.nomor ?? (jenis === "bast" ? nomor : undefined);
  const nomorInvoice =
    invoice?.nomor ?? (jenis === "invoice" ? nomor : undefined);
  const statusPembayaran =
    invoice?.status === "lunas"
      ? "Lunas dan diverifikasi penyedia"
      : pembayaranTerverifikasi > 0
        ? `Dibayar sebagian Rp ${pembayaranTerverifikasi.toLocaleString("id-ID")}`
        : "Terhutang / menunggu pembayaran langsung";

  renderDokumenTransaksiTemplate({
    jenis,
    nomorDokumen: nomor,
    nomorKontrak: kontrakNomor,
    nomorInvoice,
    nomorKwitansi: jenis === "kwitansi" ? nomor : undefined,
    nomorBast,
    nomorPesanan: kerjasama.nomor,
    dibuatAt,
    finalAt:
      rincian.bast?.finalAt ??
      (statusDokumen.toLowerCase() === "final"
        ? kerjasama.updatedAt
        : undefined),
    jatuhTempoLabel: invoice
      ? formatTanggalTemplate(invoice.batasPembayaran)
      : "Sesuai kesepakatan",
    tempatTandaTangan: tempatTandaTanganDariProvinsi(
      peminjamUser.wilayah?.provinsi ?? penyediaUser.wilayah?.provinsi,
      kerjasama.lokasi,
      peminjamUser.alamat,
      penyediaUser.alamat,
    ),
    penyedia,
    pembeli,
    judulKontrak: "PERJANJIAN SEWA JASA DAN KERJA SAMA",
    judulBast: "BERITA ACARA SERAH TERIMA LAYANAN",
    namaObjek: "Layanan",
    items: [
      {
        nama: kerjasama.judul,
        jumlah: kerjasama.jumlah,
        satuan: kerjasama.satuanHarga.replace(/^per_/, ""),
        harga: hargaSatuan,
        subtotal: kerjasama.nilaiTotal,
      },
    ],
    subtotal: kerjasama.nilaiTotal,
    ongkir: 0,
    dppPpn: 0,
    ppn: 0,
    pphDipotong: 0,
    totalInvoice: invoice?.total ?? kerjasama.nilaiTotal,
    dibayarKePenyedia: invoice?.total ?? kerjasama.nilaiTotal,
    pembayaranTerverifikasi,
    rekening: penyediaUser.rekening,
    mekanismePembayaran:
      "Pembayaran langsung antar-Sanggar sesuai invoice dan bukti yang diverifikasi penyedia",
    metodePenyerahan: "Pelaksanaan langsung sesuai jadwal dan lokasi kegiatan",
    targetSelesai: `${formatTanggalTemplate(kerjasama.tanggalMulai)} sampai ${formatTanggalTemplate(kerjasama.tanggalSelesai)}`,
    lokasiPenyerahan: kerjasama.lokasi,
    catatan: kerjasama.deskripsi || "-",
    statusDokumen,
    statusPembayaran,
    ditandatanganiPenyedia:
      jenis !== "kontrak" ||
      ["diterima", "berjalan", "selesai"].includes(kerjasama.status),
    ditandatanganiPembeli:
      jenis === "kontrak"
        ? ["diterima", "berjalan", "selesai"].includes(kerjasama.status)
        : jenis === "bast"
          ? Boolean(rincian.bast?.finalAt)
          : false,
    ownerPassword,
  });
}

export interface RincianDokumenPemesananSewa {
  invoice?: Invoice;
  pembayaran?: Payment[];
  kontrakNomor?: string;
  bast?: Bast;
}

export function nomorKwitansiPemesananSewa(invoice: Invoice) {
  return invoice.nomor.replace(/^(?:INVOICE|INV)\b/i, "KWITANSI");
}

/**
 * Empat dokumen transaksi Konsumen/Mitra dengan Sanggar atau Pelatih privat.
 * Jak Sanggar hanya menjadi fasilitator; pembayaran masuk langsung ke rekening
 * penyedia dan dokumen memakai logo/stempel milik penyedia/pemesan bila ada.
 */
export function downloadDokumenPemesananSewa(
  jenis: JenisDokumenTransaksi,
  pesanan: PemesananSewa,
  penyediaUser: SanggarUser | PelatihUser,
  pemesanUser: SewaUser | MitraPengrajinUser,
  ownerPassword = "dokumenusaha",
  rincian: RincianDokumenPemesananSewa = {},
) {
  const penyedia =
    penyediaUser.role === "pelatih"
      ? pihakDariPelatih(penyediaUser)
      : pihakDariSanggar(penyediaUser);
  const pembeli =
    pemesanUser.role === "mitra_pengrajin"
      ? pihakDariMitra(pemesanUser)
      : pihakDariKonsumen(pemesanUser);
  const pembayaran = rincian.pembayaran ?? [];
  const pembayaranTerverifikasi = pembayaran
    .filter((item) => item.status === "disetujui")
    .reduce((sum, item) => sum + item.nominal, 0);
  const pembayaranTerakhir = pembayaran
    .filter((item) => item.status === "disetujui")
    .sort((a, b) => b.tanggalBayar - a.tanggalBayar)[0];
  const invoice = rincian.invoice;
  const kontrakNomor =
    rincian.kontrakNomor || pesanan.nomor.replace(/^SEWA\b/i, "KONTRAK");
  const nomorKwitansi = invoice
    ? nomorKwitansiPemesananSewa(invoice)
    : undefined;
  const nomorDokumen =
    jenis === "kontrak"
      ? kontrakNomor
      : jenis === "invoice"
        ? invoice?.nomor
        : jenis === "kwitansi"
          ? nomorKwitansi
          : rincian.bast?.nomor;
  if (!nomorDokumen) throw new Error("Dokumen belum tersedia.");
  if (jenis === "kwitansi" && invoice?.status !== "lunas") {
    throw new Error("Kwitansi tersedia setelah pembayaran dinyatakan lunas.");
  }

  const dibuatAt =
    jenis === "invoice"
      ? (invoice?.createdAt ?? pesanan.updatedAt)
      : jenis === "kwitansi"
        ? (pembayaranTerakhir?.tanggalBayar ?? pesanan.updatedAt)
        : jenis === "bast"
          ? (rincian.bast?.createdAt ?? pesanan.updatedAt)
          : pesanan.createdAt;
  const subtotal = pesanan.hargaDasar * pesanan.jumlah;
  const biayaAkomodasi =
    pesanan.akomodasiPP === "diluar" ? pesanan.biayaAkomodasi : 0;
  const totalInvoice = invoice?.total ?? pesanan.nilaiTotal;
  const statusPembayaran =
    invoice?.status === "lunas"
      ? "Lunas dan diverifikasi penyedia"
      : pembayaranTerverifikasi > 0
        ? `Dibayar sebagian Rp ${pembayaranTerverifikasi.toLocaleString("id-ID")}`
        : "Terhutang / menunggu pembayaran langsung";
  const penyediaSudahTtd = pesanan.ttd.some(
    (signature) => signature.pihak === "sanggar",
  );
  const pemesanSudahTtd = pesanan.ttd.some(
    (signature) => signature.pihak === "sewa",
  );
  const bastFinal = rincian.bast?.status === "final";
  const objekSewaWajibKembali =
    pesanan.sumberType === "aset" ||
    pesanan.sumberType === "sarpras" ||
    ["alat_musik", "kostum", "tempat_latihan"].includes(pesanan.kategori);
  const catatanPengembalian = pesanan.pengembalianSewa
    ? [
        `Catatan penyewa saat pengembalian: ${pesanan.pengembalianSewa.catatanPenyewa}`,
        pesanan.pengembalianSewa.kondisi
          ? `Kondisi hasil pemeriksaan penyedia: ${pesanan.pengembalianSewa.kondisi.replaceAll("_", " ")}`
          : undefined,
        pesanan.pengembalianSewa.catatanPenyedia
          ? `Catatan penyedia: ${pesanan.pengembalianSewa.catatanPenyedia}`
          : undefined,
      ]
        .filter(Boolean)
        .join("; ")
    : undefined;

  renderDokumenTransaksiTemplate({
    jenis,
    nomorDokumen,
    nomorKontrak: kontrakNomor,
    nomorInvoice: invoice?.nomor,
    nomorKwitansi,
    nomorBast: rincian.bast?.nomor,
    nomorPesanan: pesanan.nomor,
    dibuatAt,
    finalAt: rincian.bast?.finalAt,
    jatuhTempoLabel: invoice
      ? formatTanggalTemplate(invoice.batasPembayaran)
      : "Sesuai kesepakatan",
    tempatTandaTangan: tempatTandaTanganDariProvinsi(
      pemesanUser.wilayah?.provinsi ?? penyediaUser.wilayah?.provinsi,
      pesanan.lokasi,
      pemesanUser.alamat,
      penyediaUser.alamat,
    ),
    penyedia,
    pembeli,
    judulKontrak:
      penyediaUser.role === "pelatih"
        ? "PERJANJIAN LAYANAN KELAS PRIVAT"
        : objekSewaWajibKembali
          ? "PERJANJIAN SEWA BARANG ATAU TEMPAT SANGGAR"
          : "PERJANJIAN SEWA JASA DAN LAYANAN SANGGAR",
    judulBast: objekSewaWajibKembali
      ? "BERITA ACARA PENGEMBALIAN OBJEK SEWA"
      : "BERITA ACARA SERAH TERIMA LAYANAN",
    namaObjek: objekSewaWajibKembali ? "Objek Sewa" : "Layanan",
    items: [
      {
        nama: pesanan.judul,
        jumlah: pesanan.jumlah,
        satuan: pesanan.satuanHarga.replace(/^per_/, ""),
        harga: pesanan.hargaDasar,
        subtotal,
      },
    ],
    subtotal,
    ongkir: biayaAkomodasi,
    dppPpn: 0,
    ppn: 0,
    pphDipotong: 0,
    totalInvoice,
    dibayarKePenyedia: totalInvoice,
    pembayaranTerverifikasi,
    rekening: penyediaUser.rekening,
    mekanismePembayaran:
      "Pembayaran langsung ke rekening penyedia sesuai invoice; Jak Sanggar tidak menerima atau menampung dana",
    metodePenyerahan: objekSewaWajibKembali
      ? "Penyerahan dan pengembalian wajib dicatat serta dikonfirmasi para pihak melalui JakSanggar"
      : "Pelaksanaan layanan langsung sesuai jadwal, lokasi, dan ruang lingkup yang disepakati",
    targetSelesai: `${formatTanggalTemplate(pesanan.tanggalMulai)} sampai ${formatTanggalTemplate(pesanan.tanggalSelesai)}`,
    lokasiPenyerahan: pesanan.lokasi,
    catatan:
      [pesanan.catatan || undefined, catatanPengembalian]
        .filter(Boolean)
        .join("; ") || "-",
    kondisiPenerimaan: pesanan.pengembalianSewa?.kondisi
      ? pesanan.pengembalianSewa.kondisi === "baik"
        ? "Baik dan lengkap"
        : pesanan.pengembalianSewa.kondisi === "rusak_ringan"
          ? "Rusak ringan — sesuai catatan pemeriksaan"
          : "Rusak berat — sesuai catatan pemeriksaan"
      : undefined,
    statusDokumen:
      jenis === "bast"
        ? (rincian.bast?.status ?? "draft")
        : jenis === "kontrak"
          ? penyediaSudahTtd && pemesanSudahTtd
            ? "final"
            : "draft"
          : jenis === "kwitansi"
            ? "final"
            : "terbit",
    statusPembayaran,
    ditandatanganiPenyedia:
      jenis === "kontrak"
        ? penyediaSudahTtd
        : jenis === "bast"
          ? bastFinal
          : true,
    ditandatanganiPembeli:
      jenis === "kontrak"
        ? pemesanSudahTtd
        : jenis === "bast"
          ? bastFinal
          : false,
    ownerPassword,
  });
}
