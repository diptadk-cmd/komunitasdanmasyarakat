import {
  unduhDokumen,
  type FormatUnduhanDokumen,
  type OpsiUnduhanDokumen,
} from "./dokumen-export";

export interface BarisProfilDokumen {
  label: string;
  value?: string | number | null;
}

export interface BagianProfilDokumen {
  heading: string;
  rows?: BarisProfilDokumen[];
  paragraphs?: Array<string | null | undefined>;
}

export interface DataProfilDokumen {
  fileName: string;
  title: string;
  namaUtama: string;
  labelLogo?: string;
  logoDataUrl?: string;
  alamat?: string;
  telepon?: string;
  email?: string;
  mediaSosial?: string;
  bidang?: string;
  pembuka?: string;
  sections: BagianProfilDokumen[];
  kotaTanggal?: string;
  jabatanTandaTangan: string;
  namaTandaTangan: string;
}

const FOOTER_PROFIL =
  "Dokumen Jak Sanggar · Hanya-baca tanpa password edit · Halaman {page} dari {pages}";

const CSS_PROFIL_DOKUMEN = `
  .profil-dokumen,
  .profil-dokumen * {
    box-sizing: border-box;
  }
  .profil-dokumen {
    width: 100%;
    color: #111111;
    font-family: Arial, Helvetica, sans-serif;
    font-size: 10.5pt;
    line-height: 1.16;
  }
  .profil-dokumen table {
    width: 100%;
    border-collapse: collapse;
    border-spacing: 0;
    table-layout: fixed;
  }
  .profil-dokumen p {
    margin: 0;
  }
  .profil-dokumen__header {
    margin: 0 0 6.5mm;
  }
  .profil-dokumen__header td {
    border: 0;
    padding: 0;
    vertical-align: middle;
  }
  .profil-dokumen__header td:first-child {
    width: 44mm;
    height: 27mm;
    border: 1pt dashed #808080;
    padding: 0;
    text-align: center;
    vertical-align: middle;
  }
  .profil-dokumen__logo {
    width: 42mm;
    height: 25mm;
    margin: 0;
    text-align: center;
    color: #111111;
    font-size: 12pt;
    font-weight: 700;
    line-height: 25mm;
  }
  .profil-dokumen__logo img {
    display: block;
    width: 100%;
    height: 25mm;
    object-fit: contain;
  }
  .profil-dokumen__identitas {
    padding-left: 2mm !important;
  }
  .profil-dokumen__nama {
    margin-bottom: 0.7mm !important;
    font-size: 12pt;
    font-weight: 700;
  }
  .profil-dokumen__kontak {
    margin: 0 0 0.35mm !important;
    overflow-wrap: anywhere;
  }
  .profil-dokumen__rules {
    width: calc(100% - 3mm) !important;
    margin: 0 1.5mm 5.2mm;
    border-collapse: collapse;
  }
  .profil-dokumen__rule-green {
    height: 2.4pt;
    padding: 0 !important;
    border-top: 1.6pt solid #006b4f !important;
    font-size: 1pt;
    line-height: 1pt;
  }
  .profil-dokumen__rule-red {
    height: 1.6pt;
    padding: 0 !important;
    border-top: 0.8pt solid #e3413b !important;
    font-size: 1pt;
    line-height: 1pt;
  }
  .profil-dokumen__intro {
    margin: 0 2mm 4.8mm !important;
    text-align: justify;
  }
  .profil-dokumen__section {
    margin: 0 2mm 4.3mm;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .profil-dokumen__section--flow {
    break-inside: auto;
    page-break-inside: auto;
  }
  .profil-dokumen__heading {
    margin: 0 0 0.8mm !important;
    font-family: Arial, Helvetica, sans-serif;
    font-size: 11pt;
    font-weight: 700;
    line-height: 1.1;
  }
  .profil-dokumen__data td {
    border: 0;
    padding: 0 0 0.35mm;
    vertical-align: top;
    font-family: Arial, Helvetica, sans-serif;
    font-size: 10.5pt;
    line-height: 1.08;
  }
  .profil-dokumen__data td:nth-child(1) {
    width: 35mm;
  }
  .profil-dokumen__data td:nth-child(2) {
    width: 5mm;
    text-align: center;
  }
  .profil-dokumen__value {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
  .profil-dokumen__cell-text {
    margin: 0 !important;
    padding: 0 !important;
    font-family: Arial, Helvetica, sans-serif;
    font-size: 10.5pt;
    line-height: 1.08;
  }
  .profil-dokumen__paragraph {
    margin: 0 0 1.2mm !important;
    white-space: pre-wrap;
    text-align: justify;
    overflow-wrap: anywhere;
  }
  .profil-dokumen__signature {
    margin-top: 5mm;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .profil-dokumen__signature td {
    border: 0;
    padding: 0;
    vertical-align: top;
  }
  .profil-dokumen__signature td:first-child {
    width: 61%;
  }
  .profil-dokumen__signature td:last-child {
    width: 39%;
    text-align: center;
  }
  .profil-dokumen__signature-space {
    height: 14mm;
    margin: 0 !important;
    padding: 0 !important;
    font-size: 1pt;
    line-height: 14mm;
  }
  .profil-dokumen__signature-name {
    display: inline-block;
    min-width: 42mm;
    padding: 0.5mm 2mm 0;
    line-height: 1.05;
    font-weight: 700;
  }
  .profil-dokumen__signature-line {
    width: 42mm;
    height: 3mm;
    margin: 0 auto !important;
    padding: 0 !important;
    border-bottom: 0.8pt solid #111111;
    font-size: 1pt;
    line-height: 3mm;
  }
  @media print {
    .profil-dokumen__section,
    .profil-dokumen__signature,
    .profil-dokumen__header,
    .profil-dokumen__data tr {
      break-inside: avoid;
      page-break-inside: avoid;
    }
  }
`;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function nilai(value?: string | number | null): string {
  const text = String(value ?? "").trim();
  return text || "-";
}

function teksDenganBaris(value?: string | number | null): string {
  return escapeHtml(nilai(value)).replace(/\r?\n/g, "<br />");
}

function gambarProfil(dataUrl?: string): string | undefined {
  const value = dataUrl?.trim();
  return value && /^data:image\/(?:png|jpe?g|gif|webp);base64,/i.test(value)
    ? value
    : undefined;
}

function renderHeader(data: DataProfilDokumen): string {
  const gambar = gambarProfil(data.logoDataUrl);
  const kontak = [
    `Alamat: ${nilai(data.alamat)}`,
    `Telp: ${nilai(data.telepon)} · Email: ${nilai(data.email)}`,
    `Instagram/Media Sosial: ${nilai(data.mediaSosial)}`,
  ];
  return `
    <table class="profil-dokumen__header" role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%">
      <colgroup><col width="22%" style="width:22%" /><col width="78%" style="width:78%" /></colgroup>
      <tbody><tr height="102" style="height:27mm">
        <td width="22%" height="102" align="center" valign="middle" style="width:22%;height:27mm;border:1pt dashed #808080;padding:0;text-align:center;vertical-align:middle">
          <p class="profil-dokumen__logo" style="margin:0;text-align:center;line-height:25mm">
            ${
              gambar
                ? `<img src="${escapeHtml(gambar)}" alt="Logo ${escapeHtml(data.namaUtama)}" />`
                : escapeHtml(data.labelLogo ?? "LOGO")
            }
          </p>
        </td>
        <td width="78%" valign="middle" class="profil-dokumen__identitas" style="width:78%;padding-left:2mm;vertical-align:middle">
          <p class="profil-dokumen__nama">${escapeHtml(data.namaUtama)}</p>
          ${kontak
            .map(
              (item) =>
                `<p class="profil-dokumen__kontak">${escapeHtml(item)}</p>`,
            )
            .join("")}
        </td>
      </tr></tbody>
    </table>
    <table class="profil-dokumen__rules" role="presentation" aria-hidden="true" cellpadding="0" cellspacing="0">
      <tbody>
        <tr><td class="profil-dokumen__rule-green">&nbsp;</td></tr>
        <tr><td class="profil-dokumen__rule-red">&nbsp;</td></tr>
      </tbody>
    </table>`;
}

function renderSection(section: BagianProfilDokumen): string {
  const rows = (section.rows ?? [])
    .map(
      (row) => `<tr>
        <td style="width:35mm"><p class="profil-dokumen__cell-text">${escapeHtml(row.label)}</p></td>
        <td style="width:5mm;text-align:center"><p class="profil-dokumen__cell-text">:</p></td>
        <td class="profil-dokumen__value"><p class="profil-dokumen__cell-text">${teksDenganBaris(row.value)}</p></td>
      </tr>`,
    )
    .join("");
  const paragraphs = (section.paragraphs ?? [])
    .filter((paragraph): paragraph is string => Boolean(paragraph?.trim()))
    .map(
      (paragraph) =>
        `<p class="profil-dokumen__paragraph">${teksDenganBaris(paragraph)}</p>`,
    )
    .join("");
  const flow = paragraphs.length > 650 ? " profil-dokumen__section--flow" : "";
  return `<section class="profil-dokumen__section${flow}">
    <h2 class="profil-dokumen__heading">${escapeHtml(section.heading)}</h2>
    ${rows ? `<table class="profil-dokumen__data" cellpadding="0" cellspacing="0"><colgroup><col style="width:35mm" /><col style="width:5mm" /><col /></colgroup><tbody>${rows}</tbody></table>` : ""}
    ${paragraphs}
  </section>`;
}

export function buatHtmlProfilDokumen(data: DataProfilDokumen): string {
  const intro =
    data.pembuka?.trim() ||
    `Profil ini disusun untuk memberikan gambaran singkat mengenai identitas, kegiatan, rekam jejak, serta informasi administrasi ${data.namaUtama}${
      data.bidang ? ` yang bergerak di bidang ${data.bidang}` : ""
    }.`;
  return `<article class="profil-dokumen" data-dokumen-template-root="true">
    ${renderHeader(data)}
    <p class="profil-dokumen__intro">${teksDenganBaris(intro)}</p>
    ${data.sections.map(renderSection).join("")}
    <table class="profil-dokumen__signature" role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%">
      <colgroup><col width="61%" style="width:61%" /><col width="39%" style="width:39%" /></colgroup>
      <tbody><tr>
        <td width="61%" style="width:61%"></td>
        <td width="39%" align="center" style="width:39%;text-align:center">
          <p>${escapeHtml(data.kotaTanggal ?? formatTanggalProfil())}</p>
          <p>${escapeHtml(data.jabatanTandaTangan)}</p>
          <p class="profil-dokumen__signature-space">&nbsp;</p>
          <p><span class="profil-dokumen__signature-name">${escapeHtml(
            data.namaTandaTangan,
          )}</span></p>
          <p class="profil-dokumen__signature-line" style="width:42mm;height:3mm;margin:0 auto;padding:0;border-bottom:0.8pt solid #111111;font-size:1pt;line-height:3mm">&nbsp;</p>
        </td>
      </tr></tbody>
    </table>
  </article>`;
}

export function formatTanggalProfil(date = new Date()): string {
  return `Jakarta, ${new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date)}`;
}

export function opsiUnduhanProfil(
  data: DataProfilDokumen,
): OpsiUnduhanDokumen {
  return {
    title: data.title,
    fileName: data.fileName,
    bodyHtml: buatHtmlProfilDokumen(data),
    bodyStyle:
      'font-family: Arial, Helvetica, sans-serif; font-size: 10.5pt; line-height: 1.16; color: #111111; background: #ffffff;',
    extraCss: CSS_PROFIL_DOKUMEN,
    pageMarginsMm: { atas: 8, kanan: 12.5, bawah: 16, kiri: 12.5 },
    headerDistanceMm: 0,
    fontFamily: "Arial, Helvetica, sans-serif",
    fontSizePt: 10.5,
    lineHeight: "1.16",
    footer: {
      text: FOOTER_PROFIL,
      fontFamily: "Arial",
      fontSizePt: 8,
      italic: true,
      colorHex: "#787882",
      distanceMm: 5.4,
      family: "sans-serif",
    },
  };
}

export function unduhProfilDokumen(
  format: FormatUnduhanDokumen,
  data: DataProfilDokumen,
): Promise<void> {
  return unduhDokumen(format, opsiUnduhanProfil(data));
}
