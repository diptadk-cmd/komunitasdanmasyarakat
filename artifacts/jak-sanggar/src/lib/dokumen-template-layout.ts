/**
 * Tata letak paket template Word.
 *
 * Tabel di template tidak selalu berarti tabel data. Sebagian besar dipakai
 * sebagai rangka aman untuk judul, ayat, konsiderans, dan tanda tangan.
 * Konverter rujukan menambahkan `data-docx-*` pada tabel agar informasi garis
 * dan proporsi kolom Word tetap dibedakan dari tabel tata letak tanpa garis.
 */

import { kapitalisasiIsiJudul } from "./dokumen-heading";

export type PeranTabelDokumenTemplate =
  | "kop"
  | "grid"
  | "metadata"
  | "konsiderans"
  | "ayat"
  | "tanda-tangan"
  | "layout";

type OpsiPembungkusDokumenTemplate = {
  /** Id dokumen paket, misalnya 04_AD atau 05_ART. */
  dokumenId?: string;
};

const ROW_RE = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
const CELL_RE = /<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi;
const TABLE_TAG_RE = /<\/?table\b[^>]*>/gi;
const TABLE_OPEN_RE = /<table\b([^>]*)>/gi;
const PARAGRAPH_RE = /<p\b([^>]*)>([\s\S]*?)<\/p>/gi;
const PAGE_BREAK_HR_RE =
  /<hr\b[^>]*class\s*=\s*(["'])[^"']*\bdokumen-template__page-break\b[^"']*\1[^>]*\/?\s*>/i;

const KATA_KONSIDERANS =
  /^(?:menimbang|mengingat|memperhatikan|menetapkan|kesatu|kedua|ketiga|keempat|kelima|keenam|ketujuh|kedelapan)\b/i;
const PENANDA_AYAT = /^(?:\(?\d+\)?\.?|[a-zA-Z]\.)$/;

function teksBersih(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(nbsp|#160);/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&(quot|#34);/gi, '"')
    .replace(/&#0?39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Word mengekspor pemisah halaman sebagai `<hr>` di dalam `<p>`. HTML parser
 * akan menutup paragraf secara implisit di sekitar `<hr>` dan menyisakan line
 * box kosong. Jika blok sebelumnya tepat mencapai batas halaman, line box itu
 * pindah ke lembar berikutnya lalu `break-after` membuat satu halaman kosong.
 * Ubah penanda menjadi blok mandiri tanpa line box sebelum proses anotasi.
 */
function normalisasiPemisahHalaman(html: string): string {
  return html.replace(
    /<p\b([^>]*)>\s*(<hr\b[^>]*dokumen-template__page-break[^>]*\/?\s*>)\s*([\s\S]*?)<\/p>/gi,
    (_penuh, atribut: string, hr: string, sisa: string) => {
      if (!PAGE_BREAK_HR_RE.test(hr)) return _penuh;
      const penanda =
        '<div class="dokumen-template__page-break" aria-hidden="true">&#8203;</div>';
      return sisa.trim() ? `${penanda}<p${atribut}>${sisa}</p>` : penanda;
    },
  );
}

/**
 * Dua penandatangan pada Berita Acara Unit lama tersimpan sebagai lima
 * paragraf beruntun, bahkan nama ketua menyatu dengan label pimpinan unit.
 * Bentuk ulang menjadi dua kolom supaya peran, nama, dan ruang tanda tangan
 * terbaca jelas tanpa menambah lembar khusus tanda tangan.
 */
function rapikanTandaTanganUnit(html: string): string {
  return html.replace(
    /<p>([^<]*?)<\/p><p>(KETUA [\s\S]*?)<\/p><p>([\s\S]*?) PIMPINAN UNIT KEGIATAN<\/p><p>([\s\S]*?)<\/p><p>([\s\S]*?)<\/p>(?=<p>\s*<hr\b[^>]*dokumen-template__page-break)/gi,
    (_penuh, tanggal, jabatanKetua, namaKetua, namaSanggar, namaPimpinan) =>
      `<table class="dokumen-template__table--tanda-tangan-ringkas" data-docx-source-table="true" data-docx-table-border="layout" data-docx-column-count="2"><colgroup><col style="width:50%"><col style="width:50%"></colgroup><tr><td><p>${tanggal}</p><p>${jabatanKetua}</p><p><strong>${namaKetua}</strong></p></td><td><p>PIMPINAN UNIT KEGIATAN</p><p>${namaSanggar}</p><p><strong>${namaPimpinan}</strong></p></td></tr></table>`,
  );
}

function bungkusAwalHalaman(html: string): string {
  return html.replace(
    /(<div\b[^>]*class\s*=\s*(["'])[^"']*\bdokumen-template__page-break\b[^"']*\2[^>]*>[\s\S]*?<\/div>)\s*((?:<table\b[^>]*>[\s\S]*?<\/table>)|(?:<p\b[^>]*>[\s\S]*?<\/p>))/gi,
    (_penuh, penanda: string, _kutip: string, elemen: string) =>
      `${penanda}<div class="dokumen-template__mulai-halaman">${elemen}</div>`,
  );
}

function barisTabel(html: string): string[] {
  return Array.from(html.matchAll(ROW_RE), (cocok) => cocok[1]);
}

function selBaris(html: string): string[] {
  return Array.from(html.matchAll(CELL_RE), (cocok) => teksBersih(cocok[1]));
}

function klasifikasikanIsiTabel(isi: string): {
  peran: PeranTabelDokumenTemplate;
  jumlahKolom: number;
} {
  const baris = barisTabel(isi);
  const selPertama = selBaris(baris[0] ?? "");
  const seluruhSel = baris.flatMap((barisAktif) => selBaris(barisAktif));
  const teks = teksBersih(isi);
  const jumlahKolom = Math.max(selPertama.length, 1);
  const selKolomPertama = baris
    .map((barisAktif) => selBaris(barisAktif)[0] ?? "")
    .filter(Boolean);
  const jumlahPenandaAyat = selKolomPertama.filter((sel) =>
    PENANDA_AYAT.test(sel),
  ).length;
  const kepala = selPertama.join(" ").toLowerCase();
  const punyaTitikDua = selPertama.some((sel) => sel === ":");
  const jumlahParagraf = (isi.match(/<p\b/gi) ?? []).length;
  const jumlahBarisBaru = (isi.match(/<br\s*\/?>/gi) ?? []).length;
  const punyaHeader = /<thead\b/i.test(isi);
  const isianData =
    /\bdata\b/.test(kepala) && /\b(?:isian|nilai|keterangan)\b/.test(kepala);
  const daftarBergaris =
    /^(?:no\.?|nomor)$/i.test(selPertama[0] ?? "") &&
    /\b(?:nama|jabatan|tanda tangan|status|keterangan|tanggal|jumlah|bukti)\b/i.test(
      kepala,
    );
  const kop =
    /(?:\{\{(?:LOGO|KOP_)|\[(?:LOGO|KOP\s+SURAT))/i.test(isi) &&
    baris.length <= 3;
  const konsiderans =
    KATA_KONSIDERANS.test(selPertama[0] ?? "") ||
    seluruhSel.some((sel) => KATA_KONSIDERANS.test(sel));
  const tandaTangan =
    !konsiderans &&
    !isianData &&
    !daftarBergaris &&
    jumlahKolom >= 2 &&
    baris.length <= 3 &&
    /\b(?:pimpinan\s+(?:rapat|musyawarah)|notulis|ketua(?:\s+sanggar)?|sekretaris|bendahara|mengetahui|menyetujui)\b/i.test(
      teks,
    ) &&
    (jumlahBarisBaru >= 2 || jumlahParagraf >= jumlahKolom * 2);
  const ayat =
    !konsiderans &&
    jumlahKolom >= 2 &&
    jumlahPenandaAyat >= Math.min(2, selKolomPertama.length);

  if (kop) return { peran: "kop", jumlahKolom };
  if (konsiderans) return { peran: "konsiderans", jumlahKolom };
  if (tandaTangan) return { peran: "tanda-tangan", jumlahKolom };
  if (ayat) return { peran: "ayat", jumlahKolom };
  // Mammoth memakai thead untuk baris pertama Word. Bila sumber belum punya
  // metadata garis, ini adalah petunjuk terbaik untuk grid data lama.
  if (isianData || daftarBergaris || punyaHeader)
    return { peran: "grid", jumlahKolom };
  if (punyaTitikDua && jumlahKolom >= 3)
    return { peran: "metadata", jumlahKolom };
  return { peran: "layout", jumlahKolom };
}

function adalahJudulTabel(isi: string, jumlahKolom: number): boolean {
  if (jumlahKolom !== 1) return false;
  const paragraf = Array.from(isi.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi), m => m[1]).filter(p => teksBersih(p));
  const semuaBaris = paragraf.length ? paragraf : [isi];
  const baris = semuaBaris.filter(p => !/^(?:nomor|tanggal)\s*:/i.test(teksBersih(p)));
  if (!baris.length) return false;
  // Nilai seluruh paragraf, bukan cuplikan 180 karakter. Kalimat seperti
  // "Keputusan ini mulai berlaku ..." harus tetap menjadi isi dokumen.
  return baris.every(p => {
    const teks = teksBersih(p);
    if (!teks || teks.length > 320 || /[.;]$/.test(teks)) return false;
    if (/^(?:keputusan|berita acara|surat pernyataan|formulir|anggaran dasar|anggaran rumah tangga|petunjuk penggunaan)\s+(?:ini|tersebut)\b/i.test(teks)) return false;
    if (/^(?:bab\s+[ivxlcdm]+|pasal\s+\d+[a-z]?)$/i.test(teks)) return true;
    if (/^(?:berita acara|surat pernyataan|keputusan|anggaran dasar|anggaran rumah tangga|formulir|petunjuk penggunaan)\b/i.test(teks)) return true;
    const tegas = /^\s*<(?:strong|b)\b[^>]*>[\s\S]*<\/(?:strong|b)>\s*$/i.test(p);
    return (tegas && teks.length <= 180) || (teks.length <= 120 && /[A-Z]/.test(teks) && teks === teks.toLocaleUpperCase("id-ID"));
  });
}

function gabungkanKelasAtribut(atribut: string, kelasBaru: string[]): string {
  const pencariKelas = /\sclass\s*=\s*(["'])(.*?)\1/i;
  const temuan = atribut.match(pencariKelas);
  const kelasTergabung = Array.from(
    new Set([
      ...(temuan?.[2]?.split(/\s+/).filter(Boolean) ?? []),
      ...kelasBaru,
    ]),
  ).join(" ");
  const denganKelas = temuan
    ? atribut.replace(pencariKelas, ` class="${kelasTergabung}"`)
    : `${atribut} class="${kelasTergabung}"`;
  if (/\sdata-dokumen-template-table\s*=/i.test(denganKelas)) {
    return denganKelas;
  }
  return `${denganKelas} data-dokumen-template-table="struktur"`;
}

function aturAtribut(
  atribut: string,
  nama: string,
  nilai: string | number,
): string {
  const pencari = new RegExp(`\\s${nama}\\s*=\\s*(["']).*?\\1`, "i");
  const berikut = ` ${nama}="${nilai}"`;
  return pencari.test(atribut)
    ? atribut.replace(pencari, berikut)
    : `${atribut}${berikut}`;
}

function akhirTabelPasangan(
  html: string,
  awal: number,
): RegExpExecArray | null {
  TABLE_TAG_RE.lastIndex = awal;
  let kedalaman = 0;
  let tag: RegExpExecArray | null;
  while ((tag = TABLE_TAG_RE.exec(html))) {
    if (/^<\/table/i.test(tag[0])) {
      kedalaman--;
      if (kedalaman === 0) return tag;
    } else {
      kedalaman++;
    }
  }
  return null;
}

/**
 * Tambahkan peran struktur yang aman. Bila tabel datang dari Word, informasi
 * `grid/layout` sumber selalu menang terhadap tebakan isi agar garis asli
 * tidak berubah hanya karena sebuah sel berisi tanda titik dua.
 */
function anotasiRentangTabel(html: string): string {
  let hasil = "";
  let posisi = 0;
  TABLE_OPEN_RE.lastIndex = 0;
  let pembuka: RegExpExecArray | null;

  while ((pembuka = TABLE_OPEN_RE.exec(html))) {
    hasil += html.slice(posisi, pembuka.index);
    const penutup = akhirTabelPasangan(html, pembuka.index);
    if (!penutup) return hasil + html.slice(pembuka.index);

    const mulaiIsi = pembuka.index + pembuka[0].length;
    const isiAsli = html.slice(mulaiIsi, penutup.index);
    const isi = anotasiRentangTabel(isiAsli);
    let atribut = pembuka[1];
    const dariWord = /\sdata-docx-source-table\s*=/i.test(atribut);
    const gridWord = /\sdata-docx-table-border\s*=\s*(["'])grid\1/i.test(
      atribut,
    );
    const jumlahKolomWord = Number(
      atribut.match(/\sdata-docx-column-count\s*=\s*["'](\d+)["']/i)?.[1],
    );
    const tebakan = klasifikasikanIsiTabel(isiAsli);
    const jumlahBaris = barisTabel(isiAsli).length;
    const tabelGrid = dariWord ? gridWord : tebakan.peran === "grid";
    const panjangTeks = teksBersih(isiAsli).length;
    const jumlahKolom =
      Number.isFinite(jumlahKolomWord) && jumlahKolomWord > 0
        ? jumlahKolomWord
        : tebakan.jumlahKolom;
    const kelas = ["dokumen-template__table"];
    const judulTabel = adalahJudulTabel(isiAsli, jumlahKolom);
    const tabelProsa =
      !tabelGrid &&
      jumlahKolom === 1 &&
      tebakan.peran === "layout" &&
      !judulTabel;

    if (dariWord) {
      kelas.push(`dokumen-template__table--${gridWord ? "grid" : "layout"}`);
      if (gridWord) {
        kelas.push(`dokumen-template__table--grid-${Math.min(jumlahKolom, 6)}`);
      } else if (
        tebakan.peran === "kop" ||
        tebakan.peran === "konsiderans" ||
        tebakan.peran === "ayat" ||
        tebakan.peran === "tanda-tangan"
      ) {
        kelas.push(`dokumen-template__table--${tebakan.peran}`);
      }
    } else {
      kelas.push(`dokumen-template__table--${tebakan.peran}`);
      if (tebakan.peran === "grid") {
        kelas.push(`dokumen-template__table--grid-${Math.min(jumlahKolom, 6)}`);
      }
    }
    if (tabelGrid && jumlahBaris >= 10) {
      kelas.push("dokumen-template__table--dense");
    }
    if (judulTabel) {
      kelas.push("dokumen-template__table--judul");
    }
    if (tabelProsa) kelas.push("dokumen-template__table--prose");

    // Keutuhan blok ditentukan dari peran dan panjang konten, bukan hanya
    // jumlah baris. Satu baris Word dapat berisi beberapa halaman teks; bila
    // dipaksa atomik browser akan meninggalkan ruang kosong atau meluber.
    if (!tabelGrid) {
      const peranAtomik =
        judulTabel ||
        tebakan.peran === "kop" ||
        tebakan.peran === "tanda-tangan";
      // Hanya blok yang benar-benar kecil dijaga atomik. Ambang lama (3 baris/
      // 420 karakter) terlalu agresif dan sering mendorong setengah halaman ke
      // lembar berikutnya, menyisakan halaman tanda tangan yang nyaris kosong.
      const kontenPendek = jumlahBaris <= 2 && panjangTeks <= 240;
      kelas.push(
        `dokumen-template__table--${peranAtomik || kontenPendek ? "atomic" : "flow"}`,
      );
    }

    atribut = aturAtribut(
      atribut,
      "data-dokumen-template-row-count",
      jumlahBaris,
    );
    atribut = aturAtribut(
      atribut,
      "data-dokumen-template-column-count",
      jumlahKolom,
    );

    const isiSiap = judulTabel ? isi.replace(PARAGRAPH_RE, (_p, attr: string, konten: string) => {
      const teks = teksBersih(konten);
      if (/^(?:pasal\s+\d+[a-z]?|nomor\s*:[\s\S]*|tanggal\s*:[\s\S]*)$/i.test(teks)) return _p;
      return `<p${aturAtribut(attr, "data-dokumen-heading", "title")}>${kapitalisasiIsiJudul(konten)}</p>`;
    }) : isi;
    hasil += `<table${gabungkanKelasAtribut(atribut, kelas)}>${isiSiap}</table>`;
    posisi = penutup.index + penutup[0].length;
    TABLE_OPEN_RE.lastIndex = posisi;
  }
  return hasil + html.slice(posisi);
}

function anotasiParagrafDokumen(html: string): string {
  return html.replace(PARAGRAPH_RE, (penuh, atribut: string, isi: string) => {
    if (/\sdata-dokumen-template-paragraf\s*=/i.test(atribut)) return penuh;
    const teks = teksBersih(isi);
    let peran = "";
    if (/^(?:anggaran dasar|anggaran rumah tangga)$/i.test(teks)) {
      peran = "judul";
    } else if (/^bab\s+[ivxlcdm]+$/i.test(teks)) {
      peran = "bab";
    } else if (/^pasal\s+\d+[a-z]?$/i.test(teks)) {
      peran = "pasal";
    } else if (/^(?:tentang\s*:?|nomor\s*:[\s\S]*)$/i.test(teks) ||
      (/^tentang\b/i.test(teks) && (/data-dokumen-heading\s*=/.test(atribut) || /^\s*<(?:strong|b)\b/i.test(isi)))) {
      peran = "subjudul";
    }
    if (!peran) return penuh;
    const denganKelas = gabungkanKelasAtribut(atribut, [
      "dokumen-template__paragraph",
      `dokumen-template__paragraph--${peran}`,
    ]).replace(/\sdata-dokumen-template-table\s*=\s*(["']).*?\1/i, "");
    const tentangJudul = /^tentang\s*:?$/i.test(teks) ||
      (/^tentang\b/i.test(teks) && (/data-dokumen-heading\s*=/.test(atribut) || /^\s*<(?:strong|b)\b/i.test(isi)));
    const judulKapital = peran === "judul" || peran === "bab" || tentangJudul;
    return `<p${denganKelas} data-dokumen-template-paragraf="${peran}"${judulKapital ? ' data-dokumen-heading="title"' : ""}>${judulKapital ? kapitalisasiIsiJudul(isi) : isi}</p>`;
  });
}

export function anotasiTabelDokumenTemplate(html: string): string {
  const dirapikan = rapikanTandaTanganUnit(html);
  const dinormalisasi = bungkusAwalHalaman(
    normalisasiPemisahHalaman(dirapikan),
  );
  return anotasiParagrafDokumen(anotasiRentangTabel(dinormalisasi));
}

function kelasJenisDokumen(html: string, dokumenId?: string): string {
  const id = dokumenId?.toUpperCase() ?? "";
  if (id) {
    if (id.includes("04_AD")) return "dokumen-template--ad";
    if (id.includes("05_ART")) return "dokumen-template--art";
    if (id.includes("09_BA_RAPAT_UNIT")) {
      return "dokumen-template--umum dokumen-template--ba-unit";
    }
    return "dokumen-template--umum";
  }
  const teks = teksBersih(html).slice(0, 500).toUpperCase();
  if (/\bANGGARAN DASAR\b/.test(teks)) return "dokumen-template--ad";
  if (/\bANGGARAN RUMAH TANGGA\b/.test(teks)) return "dokumen-template--art";
  return "dokumen-template--umum";
}

/** Membungkus naskah dalam root CSS yang terisolasi dari antarmuka aplikasi. */
export function bungkusHtmlDokumenTemplate(
  html: string,
  opsi: OpsiPembungkusDokumenTemplate = {},
): string {
  const siap = anotasiTabelDokumenTemplate(html);
  if (/\bdata-dokumen-template-root\s*=/.test(siap)) return siap;
  return `<div class="dokumen-template ${kelasJenisDokumen(siap, opsi.dokumenId)}" data-dokumen-template-root="true">${siap}</div>`;
}

/**
 * CSS dari dokumen rujukan Word 61 halaman: A4, margin 40/30/30/40 mm,
 * Bookman Old Style, ritme baca formal, serta tabel hitam 0,5 pt. Dipakai
 * untuk pratinjau dan unduhan agar ketiganya memperlihatkan geometri sama.
 */
export const CSS_LAYOUT_DOKUMEN_TEMPLATE = `
  @page {
    size: A4 portrait;
    margin: 40mm 30mm 30mm 40mm;
  }

  .dokumen-template,
  .dokumen-template * { box-sizing: border-box; }

  .dokumen-template {
    color: #000;
    font-family: "Bookman Old Style", Bookman, serif;
    font-size: 11pt;
    font-weight: 400;
    line-height: 1.15;
    text-rendering: optimizeLegibility;
    font-kerning: normal;
  }

  .dokumen-template--ad { font-size: 10.5pt; line-height: 1.25; }
  .dokumen-template--art { font-size: 10.5pt; line-height: 1.25; }
  .dokumen-template.dokumen-template--umum { line-height: 1.18; }
  .dokumen-template.dokumen-template--ba-unit {
    font-size: 10.5pt;
    line-height: 1.15;
  }

  .dokumen-template p {
    margin: 0;
    padding: 0;
    text-align: justify;
    white-space: pre-line;
    orphans: 3;
    widows: 3;
  }
  .dokumen-template p:empty { min-height: 1.3em; }

  .dokumen-template__paragraph--judul,
  .dokumen-template__paragraph--bab,
  .dokumen-template__paragraph--pasal,
  .dokumen-template__paragraph--subjudul {
    font-size: 12pt;
    font-weight: 700;
    line-height: 1.2;
    text-align: center !important;
    break-after: avoid-page;
    page-break-after: avoid;
  }
  .dokumen-template__paragraph--judul { margin-bottom: 1.4mm; }
  .dokumen-template__paragraph--bab { margin-top: 2.8mm; }
  .dokumen-template__paragraph--pasal { margin-top: 2.1mm; }

  .dokumen-template__table {
    width: 100%;
    max-width: 100%;
    margin: 0 0 1.4mm;
    border-collapse: separate;
    border-spacing: 0;
    table-layout: fixed;
    font: inherit;
    line-height: inherit;
    break-inside: auto;
    page-break-inside: auto;
  }
  .dokumen-template__table col { min-width: 0; }
  /* thead dari Word tidak selalu header data. Pada tabel transparan ia
     hanyalah baris pertama dan tidak boleh diulang saat pindah halaman. */
  .dokumen-template__table thead { display: table-row-group; }
  .dokumen-template__table tfoot { display: table-footer-group; }
  .dokumen-template__table tr {
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .dokumen-template__table th,
  .dokumen-template__table td {
    border: 0;
    font-weight: inherit;
    vertical-align: top;
    overflow-wrap: anywhere;
    word-break: normal;
    hyphens: auto;
  }
  .dokumen-template__table th > p,
  .dokumen-template__table td > p { margin: 0; }

  /* Grid Word: 0,5pt hitam, header abu muda, dan padding sumber. */
  .dokumen-template__table--grid {
    border: 0.5pt solid #000;
    border-collapse: collapse;
    margin: 0 0 1.8mm;
    line-height: 1.2;
  }
  .dokumen-template__table--grid th {
    background: #f2f2f2;
  }
  .dokumen-template__table--grid thead { display: table-header-group; }
  .dokumen-template__table--grid th,
  .dokumen-template__table--grid td {
    border: 0.5pt solid #000;
    padding: 0.9mm 1.6mm;
    vertical-align: middle;
  }
  .dokumen-template__table--grid th {
    background: transparent;
    font-weight: 700;
    text-align: center;
    break-after: avoid-page;
  }
  .dokumen-template__table--grid th > p { text-align: center; }
  .dokumen-template__table--grid td > p { text-align: left; }
  .dokumen-template__table--dense {
    font-size: 10pt;
    line-height: 1.1;
  }
  .dokumen-template__table--dense th,
  .dokumen-template__table--dense td { padding: 0.45mm 1.1mm; }
  .dokumen-template__table--grid-4,
  .dokumen-template__table--grid-5,
  .dokumen-template__table--grid-6 { font-size: 10pt; }
  .dokumen-template__table--grid-4 th,
  .dokumen-template__table--grid-4 td,
  .dokumen-template__table--grid-5 th,
  .dokumen-template__table--grid-5 td,
  .dokumen-template__table--grid-6 th,
  .dokumen-template__table--grid-6 td { padding: 1.2mm 1.5mm; }
  .dokumen-template__table--grid-3 td:first-child > p,
  .dokumen-template__table--grid-4 td:first-child > p,
  .dokumen-template__table--grid-5 td:first-child > p,
  .dokumen-template__table--grid-6 td:first-child > p { text-align: center; }

  /* Satu-kolom berbingkai pada BA/SK adalah blok judul, bukan paragraf biasa. */
  .dokumen-template__table--judul.dokumen-template__table--judul th > p,
  .dokumen-template__table--judul.dokumen-template__table--judul td > p {
    font-size: 12pt;
    font-weight: 700;
    text-align: center !important;
  }

  /* Tabel rangka Word tidak boleh memperoleh garis atau padding tabel data. */
  .dokumen-template__table--layout {
    border: 0;
    border-collapse: separate;
    border-spacing: 0;
    margin: 0 0 1.2mm;
    background: transparent;
    position: relative;
    isolation: isolate;
  }
  .dokumen-template__table--layout th,
  .dokumen-template__table--layout td { padding: 0; }
  .dokumen-template__table--layout th > p { text-align: center; }
  .dokumen-template__table--layout td > p { text-align: justify; }

  /* Word sering memakai tabel satu kolom sebagai wadah paragraf biasa.
     Jadikan kembali blok aliran agar paragraf panjang dapat berpaginasi secara
     alami. Selektor anak langsung menjaga tabel data bersarang tetap utuh. */
  .dokumen-template__table--prose,
  .dokumen-template__table--prose > tbody,
  .dokumen-template__table--prose > thead,
  .dokumen-template__table--prose > tbody > tr,
  .dokumen-template__table--prose > thead > tr,
  .dokumen-template__table--prose > tbody > tr > td,
  .dokumen-template__table--prose > tbody > tr > th,
  .dokumen-template__table--prose > thead > tr > td,
  .dokumen-template__table--prose > thead > tr > th {
    display: block;
    width: 100%;
  }
  .dokumen-template__table--prose > colgroup { display: none; }
  .dokumen-template__table--prose > tbody > tr,
  .dokumen-template__table--prose > thead > tr {
    break-inside: auto;
    page-break-inside: auto;
  }

  /* Blok pendek tidak boleh terbelah/menyatu dengan tabel sesudahnya. Tabel
     panjang tetap mengalir per baris agar isi tidak dipaksa keluar halaman. */
  .dokumen-template__table--atomic {
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .dokumen-template__table--flow {
    break-inside: auto;
    page-break-inside: auto;
  }
  .dokumen-template__table--flow tr {
    break-inside: auto;
    page-break-inside: auto;
  }
  .dokumen-template__table--judul {
    break-after: avoid-page;
    page-break-after: avoid;
  }

  /* Fallback template lama yang belum membawa data garis dari Word. */
  .dokumen-template__table--metadata td,
  .dokumen-template__table--metadata th { padding: 0.35mm 0; }
  .dokumen-template__table--metadata td:nth-child(2),
  .dokumen-template__table--metadata th:nth-child(2) { text-align: center; }

  .dokumen-template__table--konsiderans,
  .dokumen-template__table--ayat { margin-bottom: 0.8mm; }
  .dokumen-template__table--konsiderans td,
  .dokumen-template__table--konsiderans th,
  .dokumen-template__table--ayat td,
  .dokumen-template__table--ayat th { padding: 0; }
  .dokumen-template__table--konsiderans td:last-child > p,
  .dokumen-template__table--ayat td:not(:first-child) > p,
  .dokumen-template__table--ayat th:not(:first-child) > p { text-align: justify; }
  .dokumen-template__table--ayat td:first-child > p,
  .dokumen-template__table--ayat th:first-child > p {
    padding-right: 1.8mm;
    text-align: left;
    white-space: nowrap;
  }

  .dokumen-template__table--kop { margin-bottom: 2mm; }
  .dokumen-template__table--kop td,
  .dokumen-template__table--kop th { text-align: center; vertical-align: middle; }

  /* Ruang tangan tanda tangan hasil Word tidak boleh runtuh saat dikonversi. */
  .dokumen-template__table--tanda-tangan {
    margin-top: 2.5mm;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .dokumen-template__table--tanda-tangan td,
  .dokumen-template__table--tanda-tangan th {
    padding: 0;
    text-align: center;
    vertical-align: top;
  }
  .dokumen-template__table--tanda-tangan td > p,
  .dokumen-template__table--tanda-tangan th > p { text-align: center; }
  .dokumen-template__table--tanda-tangan td > p:nth-last-child(2),
  .dokumen-template__table--tanda-tangan th > p:nth-last-child(2) {
    margin-bottom: 12mm;
  }
  .dokumen-template__table--tanda-tangan-ringkas {
    margin-top: 1.5mm;
  }
  .dokumen-template__table--tanda-tangan-ringkas td > p:nth-last-child(2),
  .dokumen-template__table--tanda-tangan-ringkas th > p:nth-last-child(2) {
    margin-bottom: 10mm;
  }

  .dokumen-template img {
    max-width: 100%;
    height: auto;
  }

  /* Pemisah visual disembunyikan saat cetak; forced break ditempelkan pada
     elemen isi nyata sesudahnya agar konsisten di Chromium. */
  .dokumen-template__page-break {
    display: none;
  }
  .dokumen-template__mulai-halaman {
    break-before: page;
    page-break-before: always;
  }

  @media screen {
    .dokumen-template__table th,
    .dokumen-template__table td { overflow-wrap: anywhere; }

    .dokumen-template {
      width: 210mm;
      max-width: 100%;
      min-height: 297mm;
      margin: 0 auto;
      padding: 40mm 30mm 30mm 40mm;
      background: #fff;
      box-shadow: 0 1px 5px rgba(15, 23, 42, 0.22);
    }
    .dokumen-template__page-break {
      display: block;
      position: relative;
      height: 24mm;
      margin: 12mm -30mm 12mm -40mm;
      border: 0;
      background: #e5e7eb;
      box-shadow:
        inset 0 7px 10px -9px rgba(15, 23, 42, 0.75),
        inset 0 -7px 10px -9px rgba(15, 23, 42, 0.75);
    }
    .dokumen-template__page-break::before,
    .dokumen-template__page-break::after {
      content: "";
      position: absolute;
      left: 0;
      right: 0;
      height: 1px;
      background: rgba(15, 23, 42, 0.18);
    }
    .dokumen-template__page-break::before { top: 0; }
    .dokumen-template__page-break::after { bottom: 0; }
    .dokumen-template__mulai-halaman {
      position: relative;
    }
  }

  @media print {
    .dokumen-template {
      width: auto;
      max-width: none;
      min-height: 0;
      margin: 0;
      padding: 0;
      background: transparent;
      box-shadow: none;
    }
    .dokumen-template__table--grid th { background: #f2f2f2 !important; }
  }
`;

/**
 * Penimpa terakhir untuk semua hasil Tools Dokumen. Nilainya berasal dari
 * dokumen rujukan `Ketentuan Keuangan Disesuaikan`, bukan dari dialog print.
 */
export const CSS_OUTPUT_DOKUMEN_REFERENSI = `
  @page {
    size: 210mm 297mm;
    margin: 40mm 30mm 30mm 40mm;
  }
  html, body {
    color: #000;
    background: #fff;
    font-family: "Bookman Old Style", Bookman, serif;
    font-size: 11pt;
    line-height: 1.15;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  table { font-family: inherit; font-size: inherit; line-height: inherit; }
  tr, h1, h2, h3, h4, .tnd-judul {
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .dokumen-template {
    font-family: "Bookman Old Style", Bookman, serif;
    font-size: 11pt;
    line-height: 1.15;
  }
  .dokumen-template__table--grid th,
  table.tnd-data th { background: #f2f2f2 !important; }
  @media screen {
    .dokumen-template {
      width: 210mm;
      min-height: 297mm;
      padding: 40mm 30mm 30mm 40mm;
    }
  }
`;

/** Shell ringan khusus iframe agar naskah tampak sebagai lembar A4. */
export const CSS_PRATINJAU_DOKUMEN_TEMPLATE = `
  html, body { min-height: 100%; margin: 0; }
  body {
    box-sizing: border-box;
    padding: 12px;
    background: #e5e7eb;
  }
  ${CSS_LAYOUT_DOKUMEN_TEMPLATE}
`;

/** Pengaturan halaman yang boleh ditimpa kurator per template. */
export interface DokumenTemplateLayoutOverrides {
  fontFamily?: string;
  fontSizePt?: number;
  lineHeight?: number;
  pageWidthMm?: number;
  pageHeightMm?: number;
  orientation?: "portrait" | "landscape";
  marginTopMm?: number;
  marginRightMm?: number;
  marginBottomMm?: number;
  marginLeftMm?: number;
}

/**
 * Gabungkan layout baku Tata Naskah dengan pengaturan template kurator.
 * Aturan tambahan diletakkan setelah CSS baku agar pratinjau dan cetak
 * memakai nilai yang sama tanpa mengubah HTML sumber.
 */
export function cssDenganLayoutDokumenTemplate(
  layout?: DokumenTemplateLayoutOverrides,
): string {
  if (!layout)
    return `${CSS_LAYOUT_DOKUMEN_TEMPLATE}\n${CSS_OUTPUT_DOKUMEN_REFERENSI}`;
  const top = Math.max(0, layout.marginTopMm ?? 40);
  const right = Math.max(0, layout.marginRightMm ?? 30);
  const bottom = Math.max(0, layout.marginBottomMm ?? 30);
  const left = Math.max(0, layout.marginLeftMm ?? 40);
  const pageWidth = Math.max(100, Math.min(500, layout.pageWidthMm ?? 210));
  const pageHeight = Math.max(100, Math.min(500, layout.pageHeightMm ?? 297));
  const fontSize = Math.max(8, Math.min(32, layout.fontSizePt ?? 11));
  const lineHeight = Math.max(0.8, Math.min(3, layout.lineHeight ?? 1.15));
  // Pilihan font berasal dari daftar kurator; buang pemisah deklarasi agar
  // nilai tersimpan lama tidak dapat memutus aturan CSS halaman.
  const family = (
    layout.fontFamily || '"Bookman Old Style", Bookman, serif'
  ).replace(/[;{}]/g, "");
  return `${CSS_LAYOUT_DOKUMEN_TEMPLATE}
    @page {
      size: ${pageWidth}mm ${pageHeight}mm;
      margin: ${top}mm ${right}mm ${bottom}mm ${left}mm;
    }
    .dokumen-template {
      font-family: ${family};
      font-size: ${fontSize}pt;
      line-height: ${lineHeight};
    }
    @media screen {
      .dokumen-template {
        width: ${pageWidth}mm;
        min-height: ${pageHeight}mm;
        padding: ${top}mm ${right}mm ${bottom}mm ${left}mm;
      }
    }
    ${CSS_OUTPUT_DOKUMEN_REFERENSI}
  `;
}
