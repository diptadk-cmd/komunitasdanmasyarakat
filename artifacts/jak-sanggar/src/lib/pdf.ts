import { jsPDF } from "jspdf";
import autoTable, { type RowInput } from "jspdf-autotable";
import { bukaPratinjauPdf } from "@/lib/document-preview";

/** Kop surat resmi (hanya dirender bila pemilik profil = Organisasi). */
export interface KopSurat {
  nama: string;
  /** Baris info kontak yang sudah difilter dari nilai kosong. */
  baris: string[];
  logoDataUrl?: string;
  /** Berkas kop surat utuh yang diprioritaskan pada dokumen PDF. */
  kopDataUrl?: string;
}

/** Blok tanda tangan basah di bagian bawah dokumen. */
export interface BlokTtd {
  kota: string;
  tanggal: string;
  jabatan: string;
  nama: string;
}

export interface LockedPdfOptions {
  filename: string;
  title: string;
  subtitle?: string;
  /** Owner password — required to modify the PDF. The file itself opens without a password. */
  ownerPassword: string;
  sections?: { heading?: string; body?: string }[];
  table?: { head: string[]; rows: RowInput[] };
  /** Kop surat di bawah banner sistem (halaman pertama saja). */
  kop?: KopSurat;
  /** Blok tanda tangan setelah seluruh isi dokumen. */
  ttd?: BlokTtd;
}

function formatLogo(dataUrl: string): string | undefined {
  const m = /^data:image\/(png|jpe?g|webp)/i.exec(dataUrl);
  if (!m) return undefined;
  const t = m[1].toLowerCase();
  return t === "png" ? "PNG" : t === "webp" ? "WEBP" : "JPEG";
}

export function downloadLockedPdf(opts: LockedPdfOptions) {
  const doc = new jsPDF({
    unit: "pt",
    format: "a4",
    encryption: {
      ownerPassword: opts.ownerPassword,
      userPermissions: ["print", "copy", "annot-forms"],
    },
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;

  doc.setFillColor(20, 33, 61);
  doc.rect(0, 0, pageWidth, 64, "F");
  doc.setFillColor(212, 166, 78);
  doc.rect(0, 64, pageWidth, 3, "F");

  doc.setTextColor(245, 220, 160);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(opts.title, margin, 36);

  if (opts.subtitle) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(230, 215, 180);
    doc.text(opts.subtitle, margin, 54);
  }

  let y = 96;

  if (opts.kop) {
    const kop = opts.kop;
    const kopTop = y - 8;
    let fullKopRendered = false;
    if (kop.kopDataUrl) {
      const fmt = formatLogo(kop.kopDataUrl);
      if (fmt) {
        try {
          const image = doc.getImageProperties(kop.kopDataUrl);
          if (image.width > 0 && image.height > 0) {
            const maxWidth = pageWidth - margin * 2;
            const maxHeight = 108;
            const scale = Math.min(maxWidth / image.width, maxHeight / image.height);
            const width = image.width * scale;
            const height = image.height * scale;
            doc.addImage(kop.kopDataUrl, fmt, (pageWidth - width) / 2, kopTop, width, height);
            y = kopTop + height + 26;
            fullKopRendered = true;
          }
        } catch {
          // Berkas kop tidak valid — gunakan kop tersusun sebagai fallback.
        }
      }
    }
    if (!fullKopRendered) {
      let textX = margin;
      if (kop.logoDataUrl) {
        const fmt = formatLogo(kop.logoDataUrl);
        if (fmt) {
          try {
            doc.addImage(kop.logoDataUrl, fmt, margin, kopTop, 48, 48);
            textX = margin + 60;
          } catch {
            // Logo tidak valid — kop tetap dirender tanpa logo.
          }
        }
      }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.setTextColor(0, 90, 43);
      doc.text(kop.nama, textX, kopTop + 14);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(70, 70, 75);
      let ly = kopTop + 27;
      for (const baris of kop.baris) {
        const lines = doc.splitTextToSize(baris, pageWidth - textX - margin);
        doc.text(lines, textX, ly);
        ly += 10.5 * lines.length;
      }
      const kopBottom = Math.max(kopTop + 52, ly - 2);
      doc.setDrawColor(0, 90, 43);
      doc.setLineWidth(2);
      doc.line(margin, kopBottom, pageWidth - margin, kopBottom);
      doc.setDrawColor(255, 61, 22);
      doc.setLineWidth(0.8);
      doc.line(margin, kopBottom + 3.5, pageWidth - margin, kopBottom + 3.5);
      y = kopBottom + 26;
    }
  }

  doc.setTextColor(30, 30, 35);

  const bottomLimit = pageHeight - 40;
  const ensureSpace = (needed: number) => {
    if (y + needed > bottomLimit) {
      doc.addPage();
      y = 60;
    }
  };

  if (opts.sections) {
    opts.sections.forEach(s => {
      if (s.heading) {
        ensureSpace(16);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(30, 30, 35);
        doc.text(s.heading, margin, y);
        y += 16;
      }
      if (s.body) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(30, 30, 35);
        const lines = doc.splitTextToSize(s.body, pageWidth - margin * 2) as string[];
        for (const line of lines) {
          ensureSpace(12);
          doc.text(line, margin, y);
          y += 12;
        }
        y += 8;
      }
    });
  }

  if (opts.table) {
    ensureSpace(60);
    autoTable(doc, {
      startY: y,
      head: [opts.table.head],
      body: opts.table.rows,
      margin: { left: margin, right: margin },
      styles: { fontSize: 9, cellPadding: 5 },
      headStyles: { fillColor: [20, 33, 61], textColor: [245, 220, 160], fontStyle: "bold" },
      alternateRowStyles: { fillColor: [248, 244, 233] },
      theme: "grid",
    });
    const finalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY;
    if (typeof finalY === "number") y = finalY + 24;
  }

  if (opts.ttd) {
    const t = opts.ttd;
    const blockHeight = 110;
    doc.setPage(doc.getNumberOfPages());
    let ty = y + 16;
    if (ty + blockHeight > pageHeight - 40) {
      doc.addPage();
      ty = 80;
    }
    const cx = pageWidth - margin - 95;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(30, 30, 35);
    doc.text(`${t.kota}, ${t.tanggal}`, cx, ty, { align: "center" });
    doc.text(t.jabatan, cx, ty + 14, { align: "center" });
    // Ruang kosong untuk tanda tangan basah setelah dokumen dicetak.
    const nameY = ty + 14 + 66;
    doc.setFont("helvetica", "bold");
    doc.text(t.nama, cx, nameY, { align: "center" });
    const w = doc.getTextWidth(t.nama);
    doc.setDrawColor(30, 30, 35);
    doc.setLineWidth(0.8);
    doc.line(cx - w / 2, nameY + 3, cx + w / 2, nameY + 3);
  }

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 130);
    doc.text(
      `Dokumen Jak Sanggar · Hanya-baca tanpa password edit · Halaman ${i} dari ${pageCount}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 18,
      { align: "center" },
    );
  }

  bukaPratinjauPdf({
    title: opts.title,
    fileName: opts.filename,
    blob: doc.output("blob"),
  });
}
