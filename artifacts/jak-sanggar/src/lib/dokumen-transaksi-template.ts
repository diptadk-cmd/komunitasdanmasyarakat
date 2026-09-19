import { jsPDF } from "jspdf";
import autoTable, { type RowInput } from "jspdf-autotable";
import { bukaPratinjauPdf } from "@/lib/document-preview";

export type JenisDokumenTransaksi = "kontrak" | "invoice" | "kwitansi" | "bast";

export interface PihakTemplateTransaksi {
  namaUsaha: string;
  namaPenandatangan: string;
  jabatan: string;
  alamat: string;
  npwp?: string;
  nib?: string;
  logoDataUrl?: string;
  stempelDataUrl?: string;
}

export interface ItemTemplateTransaksi {
  nama: string;
  jumlah: number;
  satuan: string;
  harga: number;
  subtotal: number;
}

export interface DataTemplateTransaksi {
  jenis: JenisDokumenTransaksi;
  nomorDokumen: string;
  nomorKontrak?: string;
  nomorInvoice?: string;
  nomorKwitansi?: string;
  nomorBast?: string;
  nomorPesanan: string;
  dibuatAt: number;
  finalAt?: number;
  jatuhTempoLabel: string;
  tempatTandaTangan: string;
  penyedia: PihakTemplateTransaksi;
  pembeli: PihakTemplateTransaksi;
  judulKontrak: string;
  judulBast: string;
  namaObjek: "Produk" | "Layanan" | "Objek Sewa";
  items: ItemTemplateTransaksi[];
  subtotal: number;
  ongkir: number;
  dppPpn: number;
  ppn: number;
  pphDipotong: number;
  totalInvoice: number;
  dibayarKePenyedia: number;
  pembayaranTerverifikasi: number;
  rekening: { bank: string; nomor: string; atasNama: string };
  mekanismePembayaran: string;
  metodePenyerahan: string;
  targetSelesai: string;
  lokasiPenyerahan: string;
  catatan: string;
  kondisiPenerimaan?: string;
  statusDokumen: string;
  statusPembayaran: string;
  ditandatanganiPenyedia: boolean;
  ditandatanganiPembeli: boolean;
  ownerPassword: string;
}

const MARGIN = 63;
const PAGE_BOTTOM = 804;
const NOTICE_TITLE = "PEMBERITAHUAN TRANSAKSI JAKSANGGAR";
const NOTICE_TEXT =
  "Transaksi ini merupakan hubungan hukum dan komitmen langsung antara penyedia dan pembeli/pengguna. JakSanggar hanya menyediakan sarana informasi dan fasilitasi komunikasi serta bukan pihak dalam transaksi, kecuali dinyatakan lain secara tertulis. Masing-masing nama yang tercantum bertanggung jawab atas kebenaran data, pembayaran, mutu, penyerahan, dan pemenuhan kewajibannya. JakSanggar tidak menerima, menyimpan, menahan, atau meneruskan dana transaksi serta tidak memungut, menyetor, atau melaporkan pajak transaksi untuk pengguna. Kewajiban perpajakan dijalankan sendiri oleh masing-masing pihak sesuai status dan ketentuan yang berlaku. Perselisihan diselesaikan terlebih dahulu melalui musyawarah dan, bila tidak tercapai kesepakatan, melalui jalur hukum sesuai peraturan Republik Indonesia.";

function imageFormat(dataUrl?: string) {
  if (!dataUrl) return undefined;
  const match = /^data:image\/(png|jpe?g|webp)/i.exec(dataUrl);
  if (!match) return undefined;
  if (match[1].toLowerCase() === "png") return "PNG";
  if (match[1].toLowerCase() === "webp") return "WEBP";
  return "JPEG";
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

function initials(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

function drawParty(
  doc: jsPDF,
  party: PihakTemplateTransaksi,
  x: number,
  y: number,
  width: number,
  align: "left" | "right",
  font: "times" | "helvetica",
) {
  const logoSize = 54;
  const logoX = align === "left" ? x : x + width - logoSize;
  if (!addImage(doc, party.logoDataUrl, logoX, y, logoSize, logoSize)) {
    doc.setFillColor(242, 242, 242);
    doc.setDrawColor(210, 210, 210);
    doc.rect(logoX, y, logoSize, logoSize, "FD");
    doc.setFont(font, "bold");
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    doc.text(initials(party.namaUsaha), logoX + logoSize / 2, y + 31, {
      align: "center",
    });
  }
  const textX = align === "left" ? logoX + logoSize + 7 : logoX - 7;
  const textWidth = Math.max(70, width - logoSize - 9);
  doc.setFont(font, "bold");
  doc.setFontSize(font === "times" ? 11.5 : 12.5);
  doc.setTextColor(0, 0, 0);
  const names = (
    doc.splitTextToSize(party.namaUsaha, textWidth) as string[]
  ).slice(0, 2);
  doc.text(names, textX, y + 18, { align });
  doc.setFont(font, "normal");
  doc.setFontSize(7.5);
  const addresses = (
    doc.splitTextToSize(party.alamat || "-", textWidth) as string[]
  ).slice(0, 2);
  doc.text(addresses, textX, y + 30 + Math.max(0, names.length - 1) * 10, {
    align,
  });
}

function drawLetterhead(
  doc: jsPDF,
  penyedia: PihakTemplateTransaksi,
  pembeli?: PihakTemplateTransaksi,
  font: "times" | "helvetica" = "times",
) {
  const pageWidth = doc.internal.pageSize.getWidth();
  if (pembeli) {
    const gap = 18;
    const width = (pageWidth - MARGIN * 2 - gap) / 2;
    drawParty(doc, penyedia, MARGIN, 9, width, "left", font);
    drawParty(doc, pembeli, MARGIN + width + gap, 9, width, "right", font);
    doc.setDrawColor(225, 225, 225);
    doc.setLineWidth(0.5);
    doc.line(pageWidth / 2, 13, pageWidth / 2, 68);
  } else {
    drawParty(doc, penyedia, MARGIN, 9, pageWidth - MARGIN * 2, "left", font);
  }
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(2.6);
  doc.line(MARGIN, 73, pageWidth - MARGIN, 73);
}

function formatRupiah(value: number) {
  return `Rp ${Math.max(0, Math.round(value)).toLocaleString("id-ID")}`;
}

function parseDate(value: number | string) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T00:00:00`)
    : new Date(value);
}

function formatTanggal(value: number | string) {
  const date = parseDate(value);
  return Number.isNaN(date.getTime())
    ? "-"
    : date.toLocaleDateString("id-ID", { dateStyle: "long" });
}

function formatHari(value: number | string) {
  const date = parseDate(value);
  return Number.isNaN(date.getTime())
    ? "-"
    : date.toLocaleDateString("id-ID", { weekday: "long" });
}

function ejaAngka(value: number): string {
  const angka = [
    "",
    "satu",
    "dua",
    "tiga",
    "empat",
    "lima",
    "enam",
    "tujuh",
    "delapan",
    "sembilan",
    "sepuluh",
    "sebelas",
  ];
  const n = Math.floor(Math.abs(value));
  if (n < 12) return angka[n];
  if (n < 20) return `${ejaAngka(n - 10)} belas`;
  if (n < 100)
    return `${ejaAngka(Math.floor(n / 10))} puluh ${ejaAngka(n % 10)}`.trim();
  if (n < 200) return `seratus ${ejaAngka(n - 100)}`.trim();
  if (n < 1_000)
    return `${ejaAngka(Math.floor(n / 100))} ratus ${ejaAngka(n % 100)}`.trim();
  if (n < 2_000) return `seribu ${ejaAngka(n - 1_000)}`.trim();
  if (n < 1_000_000)
    return `${ejaAngka(Math.floor(n / 1_000))} ribu ${ejaAngka(n % 1_000)}`.trim();
  if (n < 1_000_000_000)
    return `${ejaAngka(Math.floor(n / 1_000_000))} juta ${ejaAngka(n % 1_000_000)}`.trim();
  if (n < 1_000_000_000_000)
    return `${ejaAngka(Math.floor(n / 1_000_000_000))} miliar ${ejaAngka(n % 1_000_000_000)}`.trim();
  if (n < 1_000_000_000_000_000)
    return `${ejaAngka(Math.floor(n / 1_000_000_000_000))} triliun ${ejaAngka(n % 1_000_000_000_000)}`.trim();
  return n.toLocaleString("id-ID");
}

function terbilangRupiah(value: number) {
  const text = `${ejaAngka(Math.round(value)).replace(/\s+/g, " ").trim()} rupiah`;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function identitas(party: PihakTemplateTransaksi) {
  const values = [
    party.nib ? `NIB ${party.nib}` : "",
    party.npwp ? `NPWP ${party.npwp}` : "",
  ].filter(Boolean);
  return values.length ? values.join(" dan ") : "identitas sesuai profil usaha";
}

function lastTableY(doc: jsPDF, fallback: number) {
  return (
    (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable
      ?.finalY ?? fallback
  );
}

function ensureSpace(doc: jsPDF, y: number, needed: number, nextTop = 48) {
  if (y + needed <= PAGE_BOTTOM) return y;
  doc.addPage();
  return nextTop;
}

function writeText(
  doc: jsPDF,
  text: string,
  y: number,
  options: {
    x?: number;
    width?: number;
    font?: "times" | "helvetica";
    style?: "normal" | "bold" | "italic";
    size?: number;
    lineHeight?: number;
    align?: "left" | "center" | "right";
  } = {},
) {
  const x = options.x ?? MARGIN;
  const width = options.width ?? doc.internal.pageSize.getWidth() - MARGIN * 2;
  const font = options.font ?? "times";
  const style = options.style ?? "normal";
  const size = options.size ?? 10.5;
  const lineHeight = options.lineHeight ?? size * 1.32;
  doc.setFont(font, style);
  doc.setFontSize(size);
  doc.setTextColor(0, 0, 0);
  const lines = doc.splitTextToSize(text, width) as string[];
  doc.text(lines, x, y, { align: options.align ?? "left" });
  return y + lines.length * lineHeight;
}

function heading(doc: jsPDF, pasal: string, title: string, y: number) {
  // Judul pasal harus tetap bersama setidaknya satu ayat pertama.
  y = ensureSpace(doc, y, 82);
  const center = doc.internal.pageSize.getWidth() / 2;
  doc.setFont("times", "bold");
  doc.setFontSize(11.5);
  doc.setTextColor(0, 0, 0);
  doc.text(pasal, center, y, { align: "center" });
  doc.text(title, center, y + 15, { align: "center" });
  return y + 33;
}

function numbered(doc: jsPDF, number: number, text: string, y: number) {
  const contentX = MARGIN + 26;
  const width = doc.internal.pageSize.getWidth() - MARGIN - contentX;
  doc.setFont("times", "normal");
  doc.setFontSize(10.5);
  const lines = doc.splitTextToSize(text, width) as string[];
  y = ensureSpace(doc, y, Math.max(18, lines.length * 13.5 + 5));
  doc.text(`(${number})`, MARGIN + 5, y);
  doc.text(lines, contentX, y);
  return y + lines.length * 13.5 + 5;
}

function signature(
  doc: jsPDF,
  party: PihakTemplateTransaksi,
  x: number,
  y: number,
  width: number,
  signed: boolean,
  font: "times" | "helvetica" = "times",
) {
  const center = x + width / 2;
  doc.setTextColor(0, 0, 0);
  doc.setFont(font, "bold");
  doc.setFontSize(9.5);
  const business = (
    doc.splitTextToSize(party.namaUsaha, width - 8) as string[]
  ).slice(0, 2);
  doc.text(business, center, y, { align: "center" });
  doc.setFont(font, "normal");
  doc.setFontSize(8.5);
  const jobY = y + Math.max(1, business.length) * 11 + 2;
  doc.text(party.jabatan, center, jobY, { align: "center" });
  if (signed) {
    const stamped = addImage(
      doc,
      party.stempelDataUrl,
      center - 27,
      jobY + 7,
      54,
      54,
    );
    if (!stamped) {
      doc.setFontSize(6.8);
      doc.setTextColor(95, 95, 95);
      doc.text("Ditandatangani secara elektronik", center, jobY + 43, {
        align: "center",
      });
    }
  } else {
    doc.setFontSize(6.8);
    doc.setTextColor(120, 120, 120);
    doc.text("Ruang tanda tangan dan stempel", center, jobY + 43, {
      align: "center",
    });
  }
  doc.setFont(font, "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(0, 0, 0);
  const nameY = jobY + 76;
  doc.text(party.namaPenandatangan, center, nameY, { align: "center" });
  const lineWidth = Math.min(
    width - 20,
    Math.max(86, doc.getTextWidth(party.namaPenandatangan) + 10),
  );
  doc.setLineWidth(0.6);
  doc.line(
    center - lineWidth / 2,
    nameY + 3,
    center + lineWidth / 2,
    nameY + 3,
  );
}

function twoSignatures(doc: jsPDF, data: DataTemplateTransaksi, y: number) {
  y = ensureSpace(doc, y, 123, 66);
  const pageWidth = doc.internal.pageSize.getWidth();
  const gap = 28;
  const width = (pageWidth - MARGIN * 2 - gap) / 2;
  signature(doc, data.penyedia, MARGIN, y, width, data.ditandatanganiPenyedia);
  signature(
    doc,
    data.pembeli,
    MARGIN + width + gap,
    y,
    width,
    data.ditandatanganiPembeli,
  );
  return y + 116;
}

function notice(doc: jsPDF, y: number, fontSize = 7.2) {
  const width = doc.internal.pageSize.getWidth() - MARGIN * 2;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(fontSize);
  const lines = doc.splitTextToSize(NOTICE_TEXT, width - 14) as string[];
  const height = 28 + lines.length * (fontSize + 1.35);
  y = ensureSpace(doc, y, height + 4, 55);
  doc.setFillColor(250, 250, 250);
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.8);
  doc.rect(MARGIN, y, width, height, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(fontSize + 1.1);
  doc.setTextColor(190, 0, 0);
  doc.text(NOTICE_TITLE, MARGIN + 7, y + 12);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(fontSize);
  doc.text(lines, MARGIN + 7, y + 23);
  doc.setTextColor(0, 0, 0);
  return y + height;
}

function footers(
  doc: jsPDF,
  label: string,
  nomor: string,
  font: "times" | "helvetica",
) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const count = doc.getNumberOfPages();
  for (let page = 1; page <= count; page += 1) {
    doc.setPage(page);
    doc.setFont(font, "italic");
    doc.setFontSize(7.5);
    doc.setTextColor(70, 70, 70);
    doc.text(
      `${label} | ${nomor} | Halaman ${page} dari ${count}`,
      pageWidth / 2,
      pageHeight - 16,
      { align: "center" },
    );
  }
}

function itemRows(data: DataTemplateTransaksi): RowInput[] {
  return data.items.map((item, index) => [
    String(index + 1),
    item.nama,
    `${item.jumlah.toLocaleString("id-ID")} ${item.satuan}`,
    formatRupiah(item.harga),
    formatRupiah(item.subtotal),
  ]);
}

function productTable(
  doc: jsPDF,
  data: DataTemplateTransaksi,
  startY: number,
  withTotal = false,
) {
  const rows = itemRows(data);
  if (withTotal) {
    rows.push([
      {
        content: "NILAI KONTRAK",
        colSpan: 4,
        styles: {
          halign: "right",
          fontStyle: "bold",
          fillColor: [242, 242, 242],
        },
      },
      {
        content: formatRupiah(data.totalInvoice),
        styles: { fontStyle: "bold", fillColor: [242, 242, 242] },
      },
    ]);
  }
  autoTable(doc, {
    startY,
    head: [["No.", data.namaObjek, "Jumlah", "Harga Satuan", "Subtotal"]],
    body: rows,
    margin: { left: MARGIN, right: MARGIN, top: 48, bottom: 38 },
    styles: {
      font: "times",
      fontSize: 8.8,
      cellPadding: 4.5,
      lineColor: [0, 0, 0],
      lineWidth: 0.5,
      textColor: [0, 0, 0],
      valign: "middle",
    },
    headStyles: {
      fillColor: [215, 215, 215],
      textColor: [0, 0, 0],
      fontStyle: "bold",
      halign: "center",
    },
    columnStyles: {
      0: { cellWidth: 28, halign: "center" },
      1: { cellWidth: 164 },
      2: { cellWidth: 78, halign: "center" },
      3: { cellWidth: 98, halign: "right" },
      4: { cellWidth: 100, halign: "right" },
    },
    theme: "grid",
  });
  return lastTableY(doc, startY + 60);
}

function renderContract(doc: jsPDF, data: DataTemplateTransaksi) {
  drawLetterhead(doc, data.penyedia, data.pembeli, "times");
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFont("times", "bold");
  doc.setFontSize(14);
  doc.setTextColor(0, 0, 0);
  doc.text(data.judulKontrak, pageWidth / 2, 96, { align: "center" });
  doc.setFontSize(10.5);
  doc.text(`Nomor: ${data.nomorDokumen}`, pageWidth / 2, 112, {
    align: "center",
  });

  let y = 136;
  y = writeText(
    doc,
    `Pada hari ${formatHari(data.dibuatAt)}, tanggal ${formatTanggal(data.dibuatAt)}, bertempat di ${data.tempatTandaTangan}, dibuat dan disepakati perjanjian ini oleh dan antara:`,
    y,
  );
  y = writeText(
    doc,
    `1. ${data.penyedia.namaPenandatangan}, dengan ${identitas(data.penyedia)}, dalam kedudukannya sebagai ${data.penyedia.jabatan} dan bertindak untuk serta atas nama ${data.penyedia.namaUsaha}, beralamat di ${data.penyedia.alamat}; dan`,
    y + 5,
  );
  y = writeText(
    doc,
    `2. ${data.pembeli.namaPenandatangan}, dengan ${identitas(data.pembeli)}, dalam kedudukannya sebagai ${data.pembeli.jabatan} dan bertindak untuk serta atas nama ${data.pembeli.namaUsaha}, beralamat di ${data.pembeli.alamat}.`,
    y + 5,
  );
  y = writeText(
    doc,
    `${data.penyedia.namaUsaha} memiliki kemampuan menyediakan ${data.namaObjek.toLowerCase()} yang disepakati, sedangkan ${data.pembeli.namaUsaha} bermaksud memperoleh ${data.namaObjek.toLowerCase()} tersebut. ${data.penyedia.namaUsaha} dan ${data.pembeli.namaUsaha} sepakat mengikatkan diri dengan itikad baik berdasarkan ketentuan berikut.`,
    y + 7,
  );

  y = heading(doc, "PASAL 1", "OBJEK DAN RUANG LINGKUP", y + 8);
  y = numbered(
    doc,
    1,
    `${data.penyedia.namaUsaha} wajib menyediakan, menyiapkan, dan menyerahkan ${data.namaObjek} kepada ${data.pembeli.namaUsaha}; ${data.pembeli.namaUsaha} wajib memeriksa, menerima, dan membayar ${data.namaObjek} yang memenuhi perjanjian.`,
    y,
  );
  y = ensureSpace(doc, y, 85);
  y = productTable(doc, data, y, true) + 10;
  y = numbered(
    doc,
    2,
    `Rincian mutu, bentuk pelaksanaan, kemasan atau perlengkapan, dan acuan lain tercantum pada Lampiran I serta catatan pesanan yang menjadi bagian tidak terpisahkan dari perjanjian.`,
    y,
  );
  y = numbered(
    doc,
    3,
    `Perubahan jumlah, desain, mutu, spesifikasi, atau ruang lingkup hanya berlaku setelah disepakati tertulis oleh ${data.penyedia.namaUsaha} dan ${data.pembeli.namaUsaha}, termasuk penyesuaian harga dan jadwal.`,
    y,
  );

  y = heading(doc, "PASAL 2", "NILAI KONTRAK DAN PEMBAYARAN", y + 7);
  y = numbered(
    doc,
    1,
    `Nilai perjanjian adalah ${formatRupiah(data.totalInvoice)} (${terbilangRupiah(data.totalInvoice)}), termasuk komponen yang tercantum pada invoice.`,
    y,
  );
  y = numbered(
    doc,
    2,
    `Subtotal ${data.namaObjek.toLowerCase()} ${formatRupiah(data.subtotal)}, ongkos pengiriman/akomodasi ${formatRupiah(data.ongkir)}, DPP PPN ${formatRupiah(data.dppPpn)}, PPN ${formatRupiah(data.ppn)}, dan PPh yang dipotong pembeli bila berlaku ${formatRupiah(data.pphDipotong)}.`,
    y,
  );
  y = numbered(
    doc,
    3,
    `Mekanisme pembayaran: ${data.mekanismePembayaran}. Nilai yang dibayarkan langsung kepada ${data.penyedia.namaUsaha} adalah ${formatRupiah(data.dibayarKePenyedia)} melalui rekening pada invoice.`,
    y,
  );
  y = numbered(
    doc,
    4,
    `JakSanggar tidak menerima atau menampung dana. Pembayaran sah setelah dana efektif diterima dan diverifikasi ${data.penyedia.namaUsaha}.`,
    y,
  );
  y = numbered(
    doc,
    5,
    `${data.penyedia.namaUsaha} dan ${data.pembeli.namaUsaha} menjalankan kewajiban perpajakan masing-masing, termasuk Faktur Pajak, bukti potong, penyetoran, dan pelaporan sesuai status serta ketentuan yang berlaku.`,
    y,
  );

  y = heading(doc, "PASAL 3", "JANGKA WAKTU DAN PENYERAHAN", y + 7);
  y = numbered(
    doc,
    1,
    `Perjanjian berlaku sejak ditandatangani sampai seluruh hak dan kewajiban ${data.penyedia.namaUsaha} dan ${data.pembeli.namaUsaha} dipenuhi.`,
    y,
  );
  y = numbered(
    doc,
    2,
    `${data.namaObjek} wajib selesai atau dilaksanakan paling lambat pada ${data.targetSelesai}.`,
    y,
  );
  y = numbered(
    doc,
    3,
    `Penyerahan/pelaksanaan dilakukan di ${data.lokasiPenyerahan} melalui ${data.metodePenyerahan}, atau lokasi lain yang disepakati tertulis.`,
    y,
  );
  y = numbered(
    doc,
    4,
    `${data.penyedia.namaUsaha} wajib segera memberitahukan potensi keterlambatan kepada ${data.pembeli.namaUsaha}, beserta alasan dan usulan jadwal baru.`,
    y,
  );

  y = heading(
    doc,
    "PASAL 4",
    "PEMERIKSAAN DAN BERITA ACARA SERAH TERIMA",
    y + 7,
  );
  y = numbered(
    doc,
    1,
    `${data.pembeli.namaUsaha} memeriksa jumlah, spesifikasi, mutu, kondisi, dan kelengkapan ${data.namaObjek} secara wajar setelah diterima atau dilaksanakan.`,
    y,
  );
  y = numbered(
    doc,
    2,
    `Apabila sesuai, ${data.penyedia.namaUsaha} dan ${data.pembeli.namaUsaha} mengesahkan Berita Acara Serah Terima (BAST) sebagai dokumen tersendiri.`,
    y,
  );
  y = numbered(
    doc,
    3,
    `Ketidaksesuaian dicatat dalam BAST. ${data.penyedia.namaUsaha} wajib memperbaiki, mengganti, atau menyelesaikan kekurangan dalam waktu yang disepakati tertulis.`,
    y,
  );

  y = heading(doc, "PASAL 5", "MUTU DAN JAMINAN", y + 7);
  y = numbered(
    doc,
    1,
    `${data.penyedia.namaUsaha} menjamin ${data.namaObjek} sesuai Lampiran I dan catatan pesanan, layak, serta bebas dari cacat bahan, pengerjaan, atau pelaksanaan yang menjadi tanggung jawabnya.`,
    y,
  );
  y = numbered(
    doc,
    2,
    `Masa pemeriksaan dan pengajuan catatan berlaku 7 (tujuh) Hari Kalender sejak BAST disahkan, kecuali disepakati lain secara tertulis.`,
    y,
  );
  y = numbered(
    doc,
    3,
    `Jaminan tidak berlaku terhadap kerusakan atau kekurangan akibat penggunaan tidak semestinya, perubahan oleh pihak lain, atau keadaan di luar kendali wajar ${data.penyedia.namaUsaha}.`,
    y,
  );

  y = heading(doc, "PASAL 6", "HAK DAN KEWAJIBAN", y + 7);
  y = numbered(
    doc,
    1,
    `${data.penyedia.namaUsaha} berhak menerima pembayaran dan memperoleh informasi kebutuhan yang lengkap dari ${data.pembeli.namaUsaha}.`,
    y,
  );
  y = numbered(
    doc,
    2,
    `${data.penyedia.namaUsaha} wajib memenuhi jumlah, mutu, spesifikasi, jadwal, serta kewajiban perbaikan atau penggantian yang disepakati.`,
    y,
  );
  y = numbered(
    doc,
    3,
    `${data.pembeli.namaUsaha} berhak menerima ${data.namaObjek} sesuai perjanjian dan menyampaikan hasil pemeriksaan yang dapat dipertanggungjawabkan.`,
    y,
  );
  y = numbered(
    doc,
    4,
    `${data.pembeli.namaUsaha} wajib memberikan informasi, menyediakan akses penyerahan/pelaksanaan, melakukan pemeriksaan, dan membayar sesuai perjanjian.`,
    y,
  );

  y = heading(doc, "PASAL 7", "PERUBAHAN, WANPRESTASI, DAN PENGAKHIRAN", y + 7);
  y = numbered(
    doc,
    1,
    `Perubahan perjanjian hanya sah apabila disepakati tertulis oleh ${data.penyedia.namaUsaha} dan ${data.pembeli.namaUsaha}.`,
    y,
  );
  y = numbered(
    doc,
    2,
    `${data.penyedia.namaUsaha} atau ${data.pembeli.namaUsaha} dianggap wanprestasi apabila tidak memenuhi kewajiban material setelah pemberitahuan tertulis dan tidak memperbaikinya dalam 3 (tiga) Hari Kerja.`,
    y,
  );
  y = numbered(
    doc,
    3,
    `${data.pembeli.namaUsaha} dapat mengakhiri perjanjian apabila keterlambatan ${data.penyedia.namaUsaha} melebihi 5 (lima) Hari Kalender tanpa keadaan kahar atau jadwal baru.`,
    y,
  );
  y = numbered(
    doc,
    4,
    `${data.penyedia.namaUsaha} dapat menangguhkan kewajiban atau mengakhiri perjanjian apabila pembayaran jatuh tempo belum dilakukan lebih dari 5 (lima) Hari Kerja setelah pemberitahuan.`,
    y,
  );
  y = numbered(
    doc,
    5,
    `Pengakhiran tidak menghapus hak dan kewajiban yang telah timbul sebelum tanggal pengakhiran.`,
    y,
  );

  y = heading(doc, "PASAL 8", "KEADAAN KAHAR", y + 7);
  y = numbered(
    doc,
    1,
    `Keadaan kahar adalah peristiwa di luar kendali wajar yang langsung menghambat perjanjian, termasuk bencana alam, kebakaran besar, wabah, perang, kerusuhan, gangguan transportasi luas, atau kebijakan pemerintah.`,
    y,
  );
  y = numbered(
    doc,
    2,
    `${data.penyedia.namaUsaha} atau ${data.pembeli.namaUsaha} yang terdampak wajib memberitahukan nama lainnya paling lambat 3 (tiga) Hari Kalender sejak mengetahui peristiwa tersebut, disertai penjelasan dan bukti yang wajar.`,
    y,
  );
  y = numbered(
    doc,
    3,
    `Apabila keadaan kahar berlangsung lebih dari 14 (empat belas) Hari Kalender, ${data.penyedia.namaUsaha} dan ${data.pembeli.namaUsaha} bermusyawarah untuk menyesuaikan jadwal, ruang lingkup, atau mengakhiri perjanjian.`,
    y,
  );

  y = heading(
    doc,
    "PASAL 9",
    "PERAN JAKSANGGAR DAN BATASAN TANGGUNG JAWAB",
    y + 7,
  );
  y = numbered(
    doc,
    1,
    `Transaksi ini merupakan hubungan hukum dan komitmen langsung antara ${data.penyedia.namaUsaha} dan ${data.pembeli.namaUsaha}.`,
    y,
  );
  y = numbered(
    doc,
    2,
    `JakSanggar hanya menyediakan sarana informasi, publikasi, dan fasilitasi komunikasi serta bukan pihak dalam transaksi.`,
    y,
  );
  y = numbered(
    doc,
    3,
    `${data.penyedia.namaUsaha} dan ${data.pembeli.namaUsaha} bertanggung jawab atas kebenaran data, mutu, pembayaran, penyerahan, komunikasi, legalitas, rekening, dan seluruh kewajibannya.`,
    y,
  );
  y = numbered(
    doc,
    4,
    `JakSanggar tidak menerima dana dan tidak menjalankan kewajiban perpajakan transaksi. Ketentuan ini tidak menghapus tanggung jawab JakSanggar atas kerugian yang terbukti timbul langsung akibat pelanggaran kewajiban hukumnya sendiri.`,
    y,
  );

  y = heading(
    doc,
    "PASAL 10",
    "PENYELESAIAN PERSELISIHAN DAN HUKUM YANG BERLAKU",
    y + 7,
  );
  y = numbered(
    doc,
    1,
    `Perjanjian ditafsirkan dan dilaksanakan berdasarkan hukum Republik Indonesia.`,
    y,
  );
  y = numbered(
    doc,
    2,
    `${data.penyedia.namaUsaha} dan ${data.pembeli.namaUsaha} terlebih dahulu menyelesaikan perselisihan melalui musyawarah paling lama 30 (tiga puluh) Hari Kalender sejak pemberitahuan tertulis.`,
    y,
  );
  y = numbered(
    doc,
    3,
    `Apabila musyawarah tidak mencapai kesepakatan, sengketa dapat diajukan ke lembaga penyelesaian sengketa yang berwenang dan/atau pengadilan sesuai peraturan Republik Indonesia.`,
    y,
  );
  y = numbered(
    doc,
    4,
    `Dugaan penipuan, penggelapan, pemalsuan, atau tindak pidana lainnya dapat dilaporkan oleh nama yang dirugikan kepada aparat penegak hukum.`,
    y,
  );

  // Sisakan ruang untuk seluruh pasal penutup dan blok tanda tangan agar tidak
  // menghasilkan halaman yang hanya berisi tanda tangan.
  y = ensureSpace(doc, y + 7, 300);
  y = heading(doc, "PASAL 11", "TANDA TANGAN, METERAI, DAN PENUTUP", y);
  y = numbered(
    doc,
    1,
    `Perjanjian dapat ditandatangani secara manual atau elektronik sesuai ketentuan peraturan perundang-undangan.`,
    y,
  );
  y = numbered(
    doc,
    2,
    `Pembubuhan meterai atau meterai elektronik dilakukan sesuai ketentuan yang berlaku.`,
    y,
  );
  y = numbered(
    doc,
    3,
    `Lampiran dan perubahan tertulis yang disepakati ${data.penyedia.namaUsaha} dan ${data.pembeli.namaUsaha} merupakan bagian tidak terpisahkan dari perjanjian.`,
    y,
  );
  y = numbered(
    doc,
    4,
    `Perjanjian dibuat dalam 2 (dua) rangkap atau 2 (dua) salinan elektronik yang mempunyai kekuatan pembuktian yang sama.`,
    y,
  );
  y = writeText(
    doc,
    `Demikian perjanjian ini dibuat, dibaca, dipahami, dan disetujui oleh ${data.penyedia.namaUsaha} dan ${data.pembeli.namaUsaha} tanpa paksaan, kekhilafan, atau penipuan.`,
    y + 3,
  );
  twoSignatures(doc, data, y + 12);

  doc.addPage();
  doc.setFont("times", "bold");
  doc.setFontSize(13);
  doc.setTextColor(0, 0, 0);
  doc.text("LAMPIRAN I", pageWidth / 2, 55, { align: "center" });
  doc.text(
    `RINCIAN DAN SPESIFIKASI ${data.namaObjek.toUpperCase()}`,
    pageWidth / 2,
    72,
    { align: "center" },
  );
  doc.setFontSize(10);
  doc.text(`Perjanjian Nomor: ${data.nomorDokumen}`, pageWidth / 2, 88, {
    align: "center",
  });
  autoTable(doc, {
    startY: 99,
    body: [
      ["Nomor Pesanan", data.nomorPesanan],
      [
        "Rincian",
        data.items
          .map((item) => `${item.nama} - ${item.jumlah} ${item.satuan}`)
          .join("; "),
      ],
      ["Target Selesai", data.targetSelesai],
      ["Lokasi Penyerahan/Pelaksanaan", data.lokasiPenyerahan],
      ["Metode Penyerahan", data.metodePenyerahan],
      ["Mekanisme Pembayaran", data.mekanismePembayaran],
      ["Catatan dan Acuan", data.catatan || "-"],
    ],
    margin: { left: MARGIN, right: MARGIN, bottom: 38 },
    styles: {
      font: "times",
      fontSize: 9.5,
      cellPadding: 6,
      lineColor: [0, 0, 0],
      lineWidth: 0.5,
      textColor: [0, 0, 0],
      valign: "middle",
    },
    columnStyles: {
      0: { cellWidth: 178, fontStyle: "bold", fillColor: [242, 242, 242] },
      1: { cellWidth: 291 },
    },
    theme: "grid",
  });
  y = lastTableY(doc, 260) + 13;
  y = writeText(
    doc,
    `${data.penyedia.namaUsaha} dan ${data.pembeli.namaUsaha} menyatakan rincian di atas telah diperiksa dan disetujui. Setiap perubahan hanya berlaku apabila disepakati tertulis, termasuk penyesuaian harga dan jadwal bila diperlukan.`,
    y,
    { size: 10 },
  );
  twoSignatures(doc, data, y + 14);
  footers(doc, "Kontrak", data.nomorDokumen, "times");
}

function invoiceSummary(data: DataTemplateTransaksi): RowInput[] {
  const rows: RowInput[] = [
    ["Subtotal", formatRupiah(data.subtotal)],
    ["Biaya Pengiriman/Akomodasi", formatRupiah(data.ongkir)],
  ];
  if (data.dppPpn || data.ppn || data.pphDipotong) {
    rows.push(
      ["DPP PPN", formatRupiah(data.dppPpn)],
      ["PPN", formatRupiah(data.ppn)],
    );
    if (data.pphDipotong)
      rows.push([
        "PPh Dipotong Pembeli",
        `- ${formatRupiah(data.pphDipotong)}`,
      ]);
  }
  rows.push(["TOTAL TAGIHAN", formatRupiah(data.totalInvoice)]);
  if (data.dibayarKePenyedia !== data.totalInvoice)
    rows.push([
      "DIBAYAR LANGSUNG KE PENYEDIA",
      formatRupiah(data.dibayarKePenyedia),
    ]);
  return rows;
}

function renderInvoice(doc: jsPDF, data: DataTemplateTransaksi) {
  drawLetterhead(doc, data.penyedia, undefined, "helvetica");
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(0, 0, 0);
  doc.text("INVOICE", pageWidth / 2, 99, { align: "center" });
  autoTable(doc, {
    startY: 110,
    body: [
      [
        "Nomor Invoice",
        data.nomorDokumen,
        "Tanggal",
        formatTanggal(data.dibuatAt),
      ],
      [
        "Jatuh Tempo",
        data.jatuhTempoLabel,
        "Nomor Kontrak",
        data.nomorKontrak || "-",
      ],
      ["Nomor BAST", data.nomorBast || "-", "Nomor Pesanan", data.nomorPesanan],
    ],
    margin: { left: MARGIN, right: MARGIN },
    styles: {
      font: "helvetica",
      fontSize: 8.3,
      cellPadding: 4,
      lineColor: [0, 0, 0],
      lineWidth: 0.5,
      textColor: [0, 0, 0],
    },
    columnStyles: {
      0: { cellWidth: 108, fontStyle: "bold", fillColor: [242, 242, 242] },
      1: { cellWidth: 126 },
      2: { cellWidth: 108, fontStyle: "bold", fillColor: [242, 242, 242] },
      3: { cellWidth: 127 },
    },
    theme: "grid",
  });
  let y = lastTableY(doc, 167) + 15;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.text("DITAGIHKAN KEPADA", MARGIN, y);
  autoTable(doc, {
    startY: y + 6,
    body: [
      ["Nama", data.pembeli.namaUsaha],
      ["Alamat", data.pembeli.alamat],
    ],
    margin: { left: MARGIN, right: MARGIN },
    styles: {
      font: "helvetica",
      fontSize: 8.5,
      cellPadding: 4,
      lineColor: [0, 0, 0],
      lineWidth: 0.5,
      textColor: [0, 0, 0],
    },
    columnStyles: {
      0: { cellWidth: 132, fontStyle: "bold", fillColor: [242, 242, 242] },
      1: { cellWidth: 337 },
    },
    theme: "grid",
  });
  y = lastTableY(doc, y + 44) + 15;
  doc.setFontSize(9.5);
  doc.text("RINCIAN TAGIHAN", MARGIN, y);
  y = productTable(doc, data, y + 6) + 4;
  autoTable(doc, {
    startY: y,
    body: invoiceSummary(data),
    margin: { left: MARGIN, right: MARGIN },
    styles: {
      font: "helvetica",
      fontSize: 8.2,
      cellPadding: 3.5,
      lineColor: [0, 0, 0],
      lineWidth: 0.5,
      textColor: [0, 0, 0],
    },
    columnStyles: {
      0: { cellWidth: 330, halign: "right", fontStyle: "bold" },
      1: { cellWidth: 139, halign: "right", fontStyle: "bold" },
    },
    didParseCell: (hook) => {
      const label = String((hook.row.raw as unknown[])?.[0] ?? "");
      if (label.includes("TOTAL") || label.includes("DIBAYAR"))
        hook.cell.styles.fillColor = [235, 235, 235];
    },
    theme: "grid",
  });
  y = lastTableY(doc, y + 60) + 13;
  y = writeText(doc, `Terbilang: ${terbilangRupiah(data.totalInvoice)}.`, y, {
    font: "helvetica",
    style: "bold",
    size: 9.2,
    lineHeight: 11,
  });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.text("INFORMASI PEMBAYARAN", MARGIN, y + 4);
  autoTable(doc, {
    startY: y + 10,
    body: [
      ["Nama Bank", data.rekening.bank],
      ["Nomor Rekening", data.rekening.nomor],
      ["Atas Nama", data.rekening.atasNama],
    ],
    margin: { left: MARGIN, right: MARGIN },
    styles: {
      font: "helvetica",
      fontSize: 8.3,
      cellPadding: 3.7,
      lineColor: [0, 0, 0],
      lineWidth: 0.5,
      textColor: [0, 0, 0],
    },
    columnStyles: {
      0: { cellWidth: 132, fontStyle: "bold", fillColor: [242, 242, 242] },
      1: { cellWidth: 337 },
    },
    theme: "grid",
  });
  y = lastTableY(doc, y + 62) + 11;
  y = writeText(
    doc,
    `Mohon mencantumkan nomor invoice pada keterangan transfer dan menyampaikan bukti pembayaran langsung kepada ${data.penyedia.namaUsaha}. Status: ${data.statusPembayaran}.`,
    y,
    { font: "helvetica", size: 8.2, lineHeight: 10 },
  );
  y = notice(doc, y + 8, 6.6) + 11;
  y = ensureSpace(doc, y, 113, 64);
  signature(
    doc,
    data.penyedia,
    pageWidth - MARGIN - 190,
    y,
    190,
    true,
    "helvetica",
  );
  footers(doc, "Invoice", data.nomorDokumen, "helvetica");
}

function renderReceipt(doc: jsPDF, data: DataTemplateTransaksi) {
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(0, 0, 0);
  doc.text("KWITANSI", pageWidth / 2, 25, { align: "center" });
  doc.setFontSize(12.5);
  doc.text("BUKTI PENERIMAAN PEMBAYARAN", pageWidth / 2, 49, {
    align: "center",
  });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.text(`Nomor: ${data.nomorDokumen}`, pageWidth - MARGIN, 68, {
    align: "right",
  });
  const amount = data.pembayaranTerverifikasi || data.dibayarKePenyedia;
  autoTable(doc, {
    startY: 74,
    body: [
      ["Sudah terima dari", data.pembeli.namaUsaha],
      ["Uang sejumlah", terbilangRupiah(amount)],
      [
        "Untuk pembayaran",
        `${data.items.map((item) => item.nama).join(", ")}, berdasarkan Perjanjian Nomor ${data.nomorKontrak || "-"}, Invoice Nomor ${data.nomorInvoice || "-"}, dan BAST Nomor ${data.nomorBast || "-"}.`,
      ],
    ],
    margin: { left: MARGIN, right: MARGIN },
    styles: {
      font: "helvetica",
      fontSize: 9,
      cellPadding: 6,
      lineColor: [0, 0, 0],
      lineWidth: 0.6,
      textColor: [0, 0, 0],
      valign: "top",
    },
    columnStyles: {
      0: { cellWidth: 143, fontStyle: "bold", fillColor: [242, 242, 242] },
      1: { cellWidth: 326 },
    },
    theme: "grid",
  });
  let y = lastTableY(doc, 164) + 14;
  autoTable(doc, {
    startY: y,
    body: [["Jumlah", formatRupiah(amount)]],
    margin: { left: MARGIN, right: MARGIN },
    styles: {
      font: "helvetica",
      fontSize: 11,
      cellPadding: 8,
      lineColor: [0, 0, 0],
      lineWidth: 0.8,
      textColor: [0, 0, 0],
      fontStyle: "bold",
    },
    columnStyles: {
      0: { cellWidth: 143, halign: "center", fillColor: [220, 220, 220] },
      1: { cellWidth: 326, halign: "right", fillColor: [242, 242, 242] },
    },
    theme: "grid",
  });
  y = notice(doc, lastTableY(doc, y + 40) + 18, 7.1) + 23;
  y = ensureSpace(doc, y, 140, 72);
  doc.setFillColor(245, 245, 245);
  doc.rect(MARGIN + 29, y, pageWidth - MARGIN * 2 - 58, 14, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.text(
    `${data.tempatTandaTangan}, ${formatTanggal(data.finalAt ?? data.dibuatAt)}`,
    pageWidth - MARGIN - 20,
    y + 11,
    { align: "right" },
  );
  signature(
    doc,
    data.penyedia,
    pageWidth - MARGIN - 210,
    y + 75,
    210,
    true,
    "helvetica",
  );
  footers(doc, "Kwitansi", data.nomorDokumen, "helvetica");
}

function renderBast(doc: jsPDF, data: DataTemplateTransaksi) {
  drawLetterhead(doc, data.penyedia, data.pembeli, "times");
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFont("times", "bold");
  doc.setFontSize(13);
  doc.setTextColor(0, 0, 0);
  doc.text(data.judulBast, pageWidth / 2, 95, { align: "center" });
  doc.setFontSize(10.5);
  doc.text(`Nomor: ${data.nomorDokumen}`, pageWidth / 2, 111, {
    align: "center",
  });
  const isRentalReturn = data.namaObjek === "Objek Sewa";
  const handoverStatement = isRentalReturn
    ? `${data.pembeli.namaUsaha} telah mengembalikan dan ${data.penyedia.namaUsaha} telah menerima serta memeriksa ${data.namaObjek}`
    : `${data.penyedia.namaUsaha} telah menyerahkan dan ${data.pembeli.namaUsaha} telah menerima serta memeriksa ${data.namaObjek}`;
  let y = writeText(
    doc,
    `Pada hari ${formatHari(data.finalAt ?? data.dibuatAt)}, tanggal ${formatTanggal(data.finalAt ?? data.dibuatAt)}, bertempat di ${data.lokasiPenyerahan}, ${handoverStatement} berdasarkan Perjanjian Nomor ${data.nomorKontrak || "-"} dan Pesanan Nomor ${data.nomorPesanan}, dengan rincian berikut:`,
    132,
    { size: 10 },
  );
  y = productTable(doc, data, y + 7, true) + 14;
  autoTable(doc, {
    startY: y,
    body: [
      [
        `Jumlah ${data.namaObjek}`,
        data.finalAt ? "Sesuai" : "Menunggu pemeriksaan",
      ],
      [
        "Spesifikasi dan Mutu",
        data.finalAt ? "Sesuai catatan" : "Menunggu pemeriksaan",
      ],
      [
        "Kondisi Fisik/Pelaksanaan",
        data.finalAt
          ? (data.kondisiPenerimaan ?? "Baik")
          : "Menunggu pemeriksaan",
      ],
      [
        "Kemasan/Kelengkapan",
        data.finalAt ? "Sesuai catatan" : "Menunggu pemeriksaan",
      ],
      [
        "Status Penerimaan",
        data.finalAt ? "Diterima sesuai catatan" : "Draft / belum disahkan",
      ],
    ],
    margin: { left: MARGIN, right: MARGIN, bottom: 38 },
    styles: {
      font: "times",
      fontSize: 9,
      cellPadding: 4.5,
      lineColor: [0, 0, 0],
      lineWidth: 0.5,
      textColor: [0, 0, 0],
      valign: "middle",
    },
    columnStyles: {
      0: { cellWidth: 233, fontStyle: "bold", fillColor: [242, 242, 242] },
      1: { cellWidth: 236 },
    },
    theme: "grid",
  });
  y = lastTableY(doc, y + 95) + 13;
  y = writeText(doc, `Catatan hasil pemeriksaan: ${data.catatan || "-"}`, y, {
    style: "bold",
    size: 10,
    lineHeight: 12,
  });
  y = writeText(
    doc,
    `Batas waktu perbaikan atau penggantian (apabila ada): ${data.finalAt ? "Tidak ada, kecuali ditemukan cacat tersembunyi dalam masa jaminan." : "Diisi saat pemeriksaan."}`,
    y + 5,
    { size: 9.5, lineHeight: 12 },
  );
  y = writeText(
    doc,
    isRentalReturn
      ? `BAST ini merupakan bukti pengembalian dan pemeriksaan ${data.namaObjek}. Catatan kerusakan, kekurangan, atau kewajiban tindak lanjut tetap mengikat para pihak sesuai perjanjian.`
      : `BAST ini merupakan bukti serah terima ${data.namaObjek}. Pengesahan BAST tidak menghapus tanggung jawab ${data.penyedia.namaUsaha} atas cacat tersembunyi atau kekurangan yang menjadi tanggung jawabnya selama masa jaminan.`,
    y + 5,
    { size: 9.5, lineHeight: 12 },
  );
  y = notice(doc, y + 9, 6.6) + 16;
  y = ensureSpace(doc, y, 145, 65);
  doc.setFont("times", "bold");
  doc.setFontSize(9.5);
  doc.text(
    `${data.tempatTandaTangan}, ${formatTanggal(data.finalAt ?? data.dibuatAt)}`,
    pageWidth - MARGIN,
    y,
    { align: "right" },
  );
  twoSignatures(doc, data, y + 18);
  footers(doc, "Berita Acara Serah Terima", data.nomorDokumen, "times");
}

export function renderDokumenTransaksiTemplate(data: DataTemplateTransaksi) {
  const doc = new jsPDF({
    unit: "pt",
    format: "a4",
    encryption: {
      ownerPassword: data.ownerPassword,
      userPermissions: ["print", "copy", "annot-forms"],
    },
  });
  if (data.jenis === "kontrak") renderContract(doc, data);
  if (data.jenis === "invoice") renderInvoice(doc, data);
  if (data.jenis === "kwitansi") renderReceipt(doc, data);
  if (data.jenis === "bast") renderBast(doc, data);
  const label = {
    kontrak: "Kontrak",
    invoice: "Invoice",
    kwitansi: "Kwitansi",
    bast: "BAST",
  }[data.jenis];
  bukaPratinjauPdf({
    title: `${label} ${data.nomorDokumen}`,
    fileName: `${label}-${data.nomorDokumen.replace(/[^a-z0-9]+/gi, "-")}.pdf`,
    blob: doc.output("blob"),
  });
}
