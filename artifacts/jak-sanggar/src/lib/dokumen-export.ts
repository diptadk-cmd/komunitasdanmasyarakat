import { asBlob } from "html-docx-js-typescript";
import JSZip from "jszip";
import { bungkusCetak } from "./dokumen-dki";
import { CSS_OUTPUT_DOKUMEN_REFERENSI } from "./dokumen-template-layout";
import { normalisasiJudulDokumen } from "./dokumen-heading";

export type FormatUnduhanDokumen = "word" | "pdf";

export interface OpsiUnduhanDokumen {
  title: string;
  bodyHtml: string;
  bodyStyle?: string;
  extraCss?: string;
  finalCss?: string;
  /** Nama dasar tanpa ekstensi. */
  fileName?: string;
  /** Opsi tata letak khusus; nilai bawaan mempertahankan format dokumen resmi. */
  pageMarginsMm?: Partial<MarginHalamanDokumenMm>;
  fontFamily?: string;
  fontSizePt?: number;
  lineHeight?: string;
  headerDistanceMm?: number;
  footer?: FooterDokumen;
}

export interface MarginHalamanDokumenMm {
  atas: number;
  kanan: number;
  bawah: number;
  kiri: number;
}

export interface FooterDokumen {
  /** Mendukung token {page} dan {pages}. */
  text: string;
  fontFamily?: string;
  fontSizePt?: number;
  italic?: boolean;
  colorHex?: string;
  distanceMm?: number;
  family?: "serif" | "sans-serif";
}

const MIME_DOCX =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const MARGIN_REFERENSI_MM = {
  atas: 40,
  kanan: 30,
  bawah: 30,
  kiri: 40,
} as const;

function marginDokumen(opts: OpsiUnduhanDokumen): MarginHalamanDokumenMm {
  return { ...MARGIN_REFERENSI_MM, ...opts.pageMarginsMm };
}

function deklarasiBody(bodyStyle?: string): string {
  const gaya = bodyStyle?.trim();
  return gaya ? `body { ${gaya} }` : "";
}

/**
 * Beri batas eksplisit pada dokumen berikutnya dan judul lampiran. Aturan ini
 * dipakai bersama oleh Word, PDF, dan pratinjau paginasi agar dua naskah tidak
 * pernah berbagi lembar yang sama.
 */
export function tandaiBatasDokumenDanLampiran(bodyHtml: string): string {
  if (typeof DOMParser === "undefined") return bodyHtml;
  const parsed = new DOMParser().parseFromString(bodyHtml, "text/html");
  // Satu batas cukup diwakili elemen isi sesudah pemisah. html2pdf menambah
  // satu lembar penuh untuk setiap forced break, termasuk jeda yang bertumpuk
  // pada pemisah, pembungkus, dan judul lampiran di posisi yang sama.
  parsed.body
    .querySelectorAll<HTMLElement>(".dokumen-template__page-break")
    .forEach((pemisah) => {
      let berikut = pemisah.nextElementSibling as HTMLElement | null;
      while (berikut?.classList.contains("dokumen-template__page-break")) {
        berikut = berikut.nextElementSibling as HTMLElement | null;
      }
      if (berikut) berikut.dataset.mulaiHalaman = "true";
      pemisah.remove();
    });
  const akarDokumen = Array.from(
    parsed.body.querySelectorAll<HTMLElement>(
      ":scope > .dokumen-template, :scope > [data-dokumen-template-root='true']",
    ),
  );
  akarDokumen.forEach((akar, index) => {
    if (index > 0) akar.dataset.dokumenBoundary = "true";
  });

  parsed.body
    .querySelectorAll<HTMLElement>("h1,h2,h3,h4,h5,h6,p,table")
    .forEach((elemen) => {
      const teks = (elemen.textContent ?? "").replace(/\s+/g, " ").trim();
      if (
        !/^lampiran\b/i.test(teks) ||
        /^lampiran\s*:/i.test(teks) ||
        teks.length > 220
      )
        return;
      const sasaran = elemen.closest("table") ?? elemen;
      if (/^lampiran\s*:/i.test((sasaran.textContent ?? "").trim())) return;
      const awalHalaman = sasaran.closest(
        ".dokumen-template__mulai-halaman, [data-mulai-halaman='true']",
      );
      (awalHalaman ?? sasaran).setAttribute("data-dokumen-lampiran", "true");
    });
  return parsed.body.innerHTML;
}

/**
 * Satu sumber HTML untuk pratinjau dan kedua format unduhan. Aturan referensi
 * ditempatkan paling akhir agar A4, margin, dan tipografinya konsisten.
 */
export function bangunHtmlUnduhanDokumen(opts: OpsiUnduhanDokumen): string {
  return bungkusCetak({
    title: opts.title,
    bodyHtml: tandaiBatasDokumenDanLampiran(normalisasiJudulDokumen(opts.bodyHtml)),
    css: [
      deklarasiBody(opts.bodyStyle),
      opts.extraCss?.trim() ?? "",
      opts.finalCss?.trim() ?? "",
      `
        .dokumen-template + .dokumen-template,
        .dokumen-template__mulai-halaman,
        [data-mulai-halaman="true"],
        [data-dokumen-boundary="true"],
        [data-dokumen-lampiran="true"] {
          break-before: page !important;
          page-break-before: always !important;
        }
        .dokumen-template {
          overflow: visible;
        }
        .dokumen-template img,
        .dokumen-template table {
          max-width: 100%;
        }
      `,
      CSS_OUTPUT_DOKUMEN_REFERENSI,
    ]
      .filter(Boolean)
      .join("\n"),
  });
}

/** Nama berkas yang aman di Windows/macOS tanpa mengubah judul tampil. */
export function namaFileDokumen(nama: string): string {
  const bersih = nama
    .normalize("NFKC")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/[. ]+$/g, "")
    .trim();
  return (bersih || "dokumen").slice(0, 120);
}

function unduhBlob(blob: Blob, nama: string): void {
  const url = URL.createObjectURL(blob);
  const tautan = document.createElement("a");
  tautan.href = url;
  tautan.download = nama;
  tautan.style.display = "none";
  document.body.appendChild(tautan);
  tautan.click();
  tautan.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

function blobWord(data: Blob | Buffer): Blob {
  if (data instanceof Blob) {
    return data.type === MIME_DOCX
      ? data
      : new Blob([data], { type: MIME_DOCX });
  }
  return new Blob([new Uint8Array(data)], { type: MIME_DOCX });
}

function siapkanHtmlWord(html: string, opts: OpsiUnduhanDokumen): string {
  const parsed = new DOMParser().parseFromString(html, "text/html");
  const fontFamily =
    opts.fontFamily?.trim() || '"Bookman Old Style", Bookman, serif';
  parsed.body.style.fontFamily = fontFamily;
  parsed.body.style.fontSize = `${opts.fontSizePt ?? 11}pt`;
  parsed.body.style.lineHeight = opts.lineHeight?.trim() || "1.15";

  parsed
    .querySelectorAll<HTMLElement>(
      ".dokumen-template, .dokumen-template p, .dokumen-template table, .dokumen-template th, .dokumen-template td, [data-dokumen-template-root='true'], [data-dokumen-template-root='true'] p, [data-dokumen-template-root='true'] table, [data-dokumen-template-root='true'] th, [data-dokumen-template-root='true'] td, [data-dokumen-template-root='true'] div, [data-dokumen-template-root='true'] span",
    )
    .forEach((elemen) => {
      elemen.style.fontFamily = fontFamily;
    });

  parsed
    .querySelectorAll<HTMLTableElement>(
      ".dokumen-template__table--grid, table.tnd-data",
    )
    .forEach((tabel) => {
      tabel.style.width = "100%";
      tabel.style.borderCollapse = "collapse";
      tabel.style.tableLayout = "fixed";
      tabel.querySelectorAll<HTMLElement>("th, td").forEach((sel) => {
        sel.style.border = "0.5pt solid #000";
        sel.style.padding = "1mm 1.4mm";
        sel.style.verticalAlign = "top";
      });
      tabel.querySelectorAll<HTMLElement>("th").forEach((sel) => {
        sel.style.backgroundColor = "#f2f2f2";
        sel.style.fontWeight = "bold";
      });
    });

  parsed
    .querySelectorAll<HTMLElement>(
      ".dokumen-template__mulai-halaman, [data-mulai-halaman='true'], [data-dokumen-boundary='true'], [data-dokumen-lampiran='true']",
    )
    .forEach((elemen) => {
      elemen.style.pageBreakBefore = "always";
    });

  return `<!DOCTYPE html>${parsed.documentElement.outerHTML}`;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function warnaWord(value?: string): string {
  const warna = value?.replace(/^#/, "").trim();
  return warna && /^[0-9a-f]{6}$/i.test(warna) ? warna.toUpperCase() : "000000";
}

function propertiRunFooter(footer: FooterDokumen): string {
  const namaFont = escapeXml(footer.fontFamily?.trim() || "Bookman Old Style");
  const ukuran = Math.max(6, footer.fontSizePt ?? 9) * 2;
  return `<w:rPr><w:rFonts w:ascii="${namaFont}" w:hAnsi="${namaFont}"/>${
    footer.italic ? "<w:i/><w:iCs/>" : ""
  }<w:color w:val="${warnaWord(footer.colorHex)}"/><w:sz w:val="${ukuran}"/><w:szCs w:val="${ukuran}"/></w:rPr>`;
}

function buatFooterWordXml(footer: FooterDokumen): string {
  const properties = propertiRunFooter(footer);
  const chunks: string[] = [];
  const pattern = /\{page\}|\{pages\}/g;
  let start = 0;
  for (const match of footer.text.matchAll(pattern)) {
    if (match.index > start) {
      chunks.push(
        `<w:r>${properties}<w:t xml:space="preserve">${escapeXml(
          footer.text.slice(start, match.index),
        )}</w:t></w:r>`,
      );
    }
    const field = match[0] === "{page}" ? "PAGE" : "NUMPAGES";
    chunks.push(
      `<w:fldSimple w:instr=" ${field} "><w:r>${properties}<w:t>1</w:t></w:r></w:fldSimple>`,
    );
    start = match.index + match[0].length;
  }
  if (start < footer.text.length) {
    chunks.push(
      `<w:r>${properties}<w:t xml:space="preserve">${escapeXml(
        footer.text.slice(start),
      )}</w:t></w:r>`,
    );
  }
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:p><w:pPr><w:jc w:val="center"/></w:pPr>${chunks.join("")}</w:p>
</w:ftr>`;
}

function mmKeTwip(mm: number): number {
  return Math.round(Math.max(0, mm) * 56.6929133858);
}

function hexKeRgb(value?: string): [number, number, number] {
  const hex = warnaWord(value);
  return [
    Number.parseInt(hex.slice(0, 2), 16) / 255,
    Number.parseInt(hex.slice(2, 4), 16) / 255,
    Number.parseInt(hex.slice(4, 6), 16) / 255,
  ];
}

function formatFooter(template: string, page: number, pages: number): string {
  return template
    .replace(/\{page\}/g, String(page))
    .replace(/\{pages\}/g, String(pages));
}

async function terapkanStrukturWord(
  blob: Blob,
  opts: OpsiUnduhanDokumen,
): Promise<Blob> {
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  const dokumenPath = "word/document.xml";
  const relasiPath = "word/_rels/document.xml.rels";
  const tipePath = "[Content_Types].xml";
  const [dokumenAwal, relasiAwal, tipeAwal] = await Promise.all([
    zip.file(dokumenPath)?.async("string"),
    zip.file(relasiPath)?.async("string"),
    zip.file(tipePath)?.async("string"),
  ]);
  if (!dokumenAwal || !relasiAwal || !tipeAwal) return blob;

  const margin = marginDokumen(opts);
  const footer: FooterDokumen = opts.footer ?? { text: "Halaman {page}" };
  let dokumen = dokumenAwal
    .replace(
      /<w:pgSz\b[^>]*\/>/,
      '<w:pgSz w:w="11906" w:h="16838" w:orient="portrait"/>',
    )
    .replace(
      /<w:pgMar\b[^>]*\/>/s,
      `<w:pgMar w:top="${mmKeTwip(margin.atas)}" w:right="${mmKeTwip(
        margin.kanan,
      )}" w:bottom="${mmKeTwip(margin.bawah)}" w:left="${mmKeTwip(
        margin.kiri,
      )}" w:header="${mmKeTwip(opts.headerDistanceMm ?? 15)}" w:footer="${mmKeTwip(
        footer.distanceMm ?? 15,
      )}" w:gutter="0"/>`,
    );
  if (!dokumen.includes('r:id="footerJakSanggar"')) {
    dokumen = dokumen.replace(
      "<w:sectPr>",
      '<w:sectPr><w:footerReference w:type="default" r:id="footerJakSanggar"/>',
    );
  }

  const relasi = relasiAwal.includes('Id="footerJakSanggar"')
    ? relasiAwal
    : relasiAwal.replace(
        "</Relationships>",
        '<Relationship Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml" Id="footerJakSanggar"/></Relationships>',
      );
  const tipe = tipeAwal.includes('PartName="/word/footer1.xml"')
    ? tipeAwal
    : tipeAwal.replace(
        "</Types>",
        '<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/></Types>',
      );

  zip.file(dokumenPath, dokumen);
  zip.file(relasiPath, relasi);
  zip.file(tipePath, tipe);
  zip.file("word/footer1.xml", buatFooterWordXml(footer));
  return zip.generateAsync({
    type: "blob",
    mimeType: MIME_DOCX,
    compression: "DEFLATE",
  });
}

/** Menghasilkan Blob DOCX OOXML yang dapat dibuka dan diedit di Office. */
export async function buatBlobDokumenWord(
  opts: OpsiUnduhanDokumen,
): Promise<Blob> {
  const html = siapkanHtmlWord(bangunHtmlUnduhanDokumen(opts), opts);
  const margin = marginDokumen(opts);
  const footer = opts.footer;
  const data = await asBlob(html, {
    orientation: "portrait",
    // html-docx-js memakai twentieths of a point (twips).
    margins: {
      top: mmKeTwip(margin.atas),
      right: mmKeTwip(margin.kanan),
      bottom: mmKeTwip(margin.bawah),
      left: mmKeTwip(margin.kiri),
      header: mmKeTwip(opts.headerDistanceMm ?? 15),
      footer: mmKeTwip(footer?.distanceMm ?? 15),
      gutter: 0,
    },
  });
  return terapkanStrukturWord(blobWord(data), opts);
}

/** Mengunduh DOCX OOXML, bukan berkas HTML yang hanya diganti ekstensi. */
export async function unduhDokumenWord(
  opts: OpsiUnduhanDokumen,
): Promise<void> {
  unduhBlob(
    await buatBlobDokumenWord(opts),
    `${namaFileDokumen(opts.fileName ?? opts.title)}.docx`,
  );
}

function tungguGambar(root: HTMLElement): Promise<void> {
  const daftar = Array.from(root.querySelectorAll("img"));
  return Promise.all(
    daftar.map(
      (gambar) =>
        new Promise<void>((resolve) => {
          if (gambar.complete) return resolve();
          gambar.addEventListener("load", () => resolve(), { once: true });
          gambar.addEventListener("error", () => resolve(), { once: true });
        }),
    ),
  ).then(() => undefined);
}

function buatHostPdf(html: string, opts: OpsiUnduhanDokumen): HTMLDivElement {
  const parsed = new DOMParser().parseFromString(html, "text/html");
  const margin = marginDokumen(opts);
  const lebarIsiMm = 210 - margin.kiri - margin.kanan;
  const fontFamily =
    opts.fontFamily?.trim() || '"Bookman Old Style", Bookman, serif';
  const host = document.createElement("div");
  host.dataset.dokumenExportPdf = "true";
  host.setAttribute("aria-hidden", "true");
  host.style.cssText = [
    "position:absolute",
    "left:0",
    "top:0",
    `width:${lebarIsiMm}mm`,
    "min-height:1px",
    "overflow:visible",
    "background:#fff",
    "color:#000",
    "z-index:-2147483648",
  ].join(";");

  for (const gaya of Array.from(parsed.head.querySelectorAll("style"))) {
    host.appendChild(gaya.cloneNode(true));
  }
  const penyesuaian = document.createElement("style");
  penyesuaian.textContent = `
    [data-dokumen-export-pdf="true"],
    [data-dokumen-export-pdf="true"] * { box-sizing: border-box; }
    [data-dokumen-export-pdf="true"] {
      width: ${lebarIsiMm}mm !important;
      font-family: ${fontFamily} !important;
      font-size: ${opts.fontSizePt ?? 11}pt !important;
      line-height: ${opts.lineHeight?.trim() || "1.15"} !important;
    }
    [data-dokumen-export-pdf="true"] .dokumen-template {
      width: ${lebarIsiMm}mm !important;
      max-width: ${lebarIsiMm}mm !important;
      min-height: 0 !important;
      margin: 0 !important;
      padding: 0 !important;
      background: #fff !important;
      box-shadow: none !important;
    }
    [data-dokumen-export-pdf="true"] .dokumen-template__page-break {
      display: none !important;
    }
    [data-dokumen-export-pdf="true"] .dokumen-template__mulai-halaman,
    [data-dokumen-export-pdf="true"] [data-mulai-halaman="true"],
    [data-dokumen-export-pdf="true"] [data-dokumen-lampiran="true"] {
      break-before: page !important;
      page-break-before: always !important;
    }
    [data-dokumen-export-pdf="true"] tr,
    [data-dokumen-export-pdf="true"] img,
    [data-dokumen-export-pdf="true"] figure,
    [data-dokumen-export-pdf="true"] h1,
    [data-dokumen-export-pdf="true"] h2,
    [data-dokumen-export-pdf="true"] h3,
    [data-dokumen-export-pdf="true"] h4 {
      break-inside: avoid !important;
      page-break-inside: avoid !important;
    }
    [data-dokumen-export-pdf="true"] thead { display: table-header-group; }
    [data-dokumen-export-pdf="true"] tfoot { display: table-footer-group; }
  `;
  host.appendChild(penyesuaian);
  const isi = document.createElement("div");
  isi.innerHTML = parsed.body.innerHTML;
  host.appendChild(isi);
  document.body.appendChild(host);
  return host;
}

function bagianUntukPdf(
  host: HTMLDivElement,
  lebarIsiMm: number,
): HTMLDivElement[] {
  const isi = host.lastElementChild as HTMLDivElement | null;
  if (!isi) return [];
  const akarTemplate = Array.from(isi.children).filter(
    (elemen): elemen is HTMLElement =>
      elemen.classList.contains("dokumen-template"),
  );
  const sumber: HTMLElement[] = akarTemplate.length > 0 ? akarTemplate : [isi];

  return sumber.map((bagian) => {
    const pembungkus = document.createElement("div");
    pembungkus.dataset.dokumenExportPdf = "true";
    pembungkus.style.cssText = `width:${lebarIsiMm}mm;min-height:1px;background:#fff;color:#000`;
    const salinan = bagian.cloneNode(true) as HTMLElement;
    // Setiap akar diproses menjadi PDF sendiri. Hapus break-before milik
    // paket supaya dokumen kedua tidak diawali halaman kosong sebelum digabung.
    salinan.removeAttribute("data-dokumen-boundary");
    salinan.style.breakBefore = "auto";
    salinan.style.pageBreakBefore = "auto";
    pembungkus.appendChild(salinan);
    host.appendChild(pembungkus);
    return pembungkus;
  });
}

/** Hanya buang sisa kanvas yang benar-benar kosong, bukan halaman pendek. */
export function bagianKanvasKosong(
  kanvas: HTMLCanvasElement,
  atas: number,
  tinggi: number,
): boolean {
  try {
    const konteks = kanvas.getContext("2d");
    if (!konteks || tinggi <= 0) return false;
    const { data } = konteks.getImageData(0, atas, kanvas.width, tinggi);
    for (let indeks = 0; indeks < data.length; indeks += 4) {
      if (
        data[indeks + 3] > 0 &&
        (data[indeks] < 250 || data[indeks + 1] < 250 || data[indeks + 2] < 250)
      )
        return false;
    }
    return true;
  } catch {
    // Gambar lintas domain dapat membatasi akses piksel. Pertahankan halaman
    // bila isinya tidak dapat diperiksa agar tidak ada naskah yang hilang.
    return false;
  }
}

/** Menghasilkan Blob PDF agar dapat dipratinjau atau diunduh dari sumber yang sama. */
export async function buatBlobDokumenPdf(
  opts: OpsiUnduhanDokumen,
): Promise<Blob> {
  const html = bangunHtmlUnduhanDokumen(opts);
  const margin = marginDokumen(opts);
  const lebarIsiMm = 210 - margin.kiri - margin.kanan;
  const host = buatHostPdf(html, opts);
  try {
    if (document.fonts?.ready) await document.fonts.ready;
    await tungguGambar(host);
    const [{ default: html2pdf }, { PDFDocument, StandardFonts, rgb }] =
      await Promise.all([import("html2pdf.js"), import("pdf-lib")]);
    const gabungan = await PDFDocument.create();
    const bagian = bagianUntukPdf(host, lebarIsiMm);

    for (const halamanBagian of bagian) {
      const pengaturan = {
        // html2pdf memakai urutan atas, kiri, bawah, kanan.
        margin: [margin.atas, margin.kiri, margin.bawah, margin.kanan] as [
          number,
          number,
          number,
          number,
        ],
        image: { type: "jpeg" as const, quality: 0.92 },
        enableLinks: true,
        html2canvas: {
          scale: 1.5,
          useCORS: true,
          backgroundColor: "#ffffff",
          logging: false,
        },
        jsPDF: {
          unit: "mm",
          format: "a4",
          orientation: "portrait" as const,
          compress: true,
        },
        pagebreak: {
          mode: ["css", "legacy"],
          before: [
            ".dokumen-template__mulai-halaman",
            '[data-mulai-halaman="true"]',
            '[data-dokumen-lampiran="true"]',
          ],
          avoid: [
            "tr",
            "h1",
            "h2",
            "h3",
            "h4",
            ".tnd-judul",
            ".dokumen-template__paragraph--judul",
            ".dokumen-template__paragraph--bab",
            ".dokumen-template__paragraph--pasal",
            ".dokumen-template__table--tanda-tangan",
            ".dokumen-template__table--tanda-tangan-ringkas",
          ],
        },
      };
      const pekerja = html2pdf().set(pengaturan).from(halamanBagian).toPdf();
      const dataBagian = await pekerja.outputPdf("arraybuffer");
      const sumber = await PDFDocument.load(dataBagian);
      const kanvas = (await pekerja.get("canvas")) as HTMLCanvasElement;
      const tinggiHalamanPiksel = Math.floor(
        kanvas.width *
          ((297 - margin.atas - margin.bawah) /
            (210 - margin.kiri - margin.kanan)),
      );
      const sisaPiksel = kanvas.height % tinggiHalamanPiksel;
      let indeksHalaman = sumber.getPageIndices();
      // Pembulatan kanvas kadang menghasilkan lembar akhir kosong. Halaman
      // pendek yang masih memuat satu baris atau tanda tangan harus tetap ada.
      if (
        indeksHalaman.length > 1 &&
        sisaPiksel > 0 &&
        sisaPiksel / tinggiHalamanPiksel < 0.03 &&
        bagianKanvasKosong(kanvas, kanvas.height - sisaPiksel, sisaPiksel)
      ) {
        indeksHalaman = indeksHalaman.slice(0, -1);
      }
      const salinan = await gabungan.copyPages(sumber, indeksHalaman);
      for (const halaman of salinan) gabungan.addPage(halaman);
    }

    // Tempel setiap halaman hasil html2pdf ke lembar PDF baru. Dengan begitu,
    // footer selalu berada di atas gambar halaman (bukan tertutup bidang putih
    // canvas pada halaman penuh seperti yang dapat terjadi bila menulis pada
    // content stream bawaan html2pdf).
    const ukuranHalaman = gabungan
      .getPages()
      .map((halaman) => halaman.getSize());
    const dataGabungan = await gabungan.save({ useObjectStreams: true });
    const hasil = await PDFDocument.create();
    const halamanTertanam = await hasil.embedPdf(
      dataGabungan,
      gabungan.getPageIndices(),
    );
    const footer: FooterDokumen = opts.footer ?? { text: "Halaman {page}" };
    const namaFontFooter =
      footer.family === "sans-serif"
        ? footer.italic
          ? StandardFonts.HelveticaOblique
          : StandardFonts.Helvetica
        : footer.italic
          ? StandardFonts.TimesRomanItalic
          : StandardFonts.TimesRoman;
    const fontFooter = await hasil.embedFont(namaFontFooter);
    const warnaFooter = hexKeRgb(footer.colorHex);
    const tinggiFooter = Math.max(24, margin.bawah * 2.834645669 - 8);
    const jumlahHalaman = halamanTertanam.length;
    halamanTertanam.forEach((halamanTersemat, index) => {
      const ukuranHalamanAktif = ukuranHalaman[index];
      const halaman = hasil.addPage([
        ukuranHalamanAktif.width,
        ukuranHalamanAktif.height,
      ]);
      halaman.drawPage(halamanTersemat, {
        x: 0,
        y: 0,
        width: ukuranHalamanAktif.width,
        height: ukuranHalamanAktif.height,
      });
      halaman.drawRectangle({
        x: 0,
        y: 0,
        width: ukuranHalamanAktif.width,
        height: tinggiFooter,
        color: rgb(1, 1, 1),
      });
      const teks = formatFooter(footer.text, index + 1, jumlahHalaman);
      const ukuran = footer.fontSizePt ?? 9;
      const lebarTeks = fontFooter.widthOfTextAtSize(teks, ukuran);
      halaman.drawText(teks, {
        x: (halaman.getWidth() - lebarTeks) / 2,
        y: Math.max(7, (tinggiFooter - ukuran) / 2),
        size: ukuran,
        font: fontFooter,
        color: rgb(warnaFooter[0], warnaFooter[1], warnaFooter[2]),
      });
    });

    hasil.setTitle(opts.title);
    hasil.setCreator("Jak Sanggar");
    const dataPdf = await hasil.save({ useObjectStreams: true });
    return new Blob([new Uint8Array(dataPdf)], {
      type: "application/pdf",
    });
  } finally {
    host.remove();
  }
}

/** Unduhan langsung dipertahankan khusus alur Tools Dokumen. */
export async function unduhDokumenPdf(opts: OpsiUnduhanDokumen): Promise<void> {
  const blob = await buatBlobDokumenPdf(opts);
  unduhBlob(blob, `${namaFileDokumen(opts.fileName ?? opts.title)}.pdf`);
}

export async function unduhDokumen(
  format: FormatUnduhanDokumen,
  opts: OpsiUnduhanDokumen,
): Promise<void> {
  // Pertahankan renderer Word/PDF yang sudah dipakai di produksi. Modul ini
  // disajikan sebagai aset publik bersama layanan /api/documents/render.
  // Vite menyisipkan ?import pada URL relatif meskipun @vite-ignore dipakai,
  // lalu menolak modul JS di public/. URL absolut tetap disajikan apa adanya.
  const alamatLayanan = new URL(
    `${import.meta.env.BASE_URL}assets/document-service-v1.js`,
    window.location.origin,
  ).href;
  const { renderDocument } = await import(/* @vite-ignore */ alamatLayanan);
  await renderDocument(format, bangunHtmlUnduhanDokumen(opts), opts);
}
