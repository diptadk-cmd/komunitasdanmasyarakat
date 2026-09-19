/**
 * Mengimpor ulang paket Sanggar Mandiri Non Badan Hukum dari dokumen Word
 * rujukan. Berbeda dengan konverter umum, berkas ini mempertahankan metadata
 * tabel yang penting untuk tata letak: garis tabel dan proporsi kolom.
 *
 * Jalankan:
 *   pnpm --filter @workspace/scripts run convert:mandiri-reference [folder-sumber] [berkas-keluaran]
 *
 * Folder sumber bawaan menunjuk pada paket Word yang dibagikan untuk proyek
 * ini. Argumen pertama dan kedua disediakan agar proses ini tetap dapat
 * diulang dengan salinan rujukan yang disimpan di lokasi lain.
 */
import { createRequire } from "node:module";
import * as fs from "node:fs";
import * as path from "node:path";
import mammoth from "mammoth";

const require = createRequire(import.meta.url);
const { openZip } = require("mammoth/lib/unzip") as {
  openZip: (options: { path: string }) => Promise<{
    read: (name: string, encoding?: string) => Promise<string>;
  }>;
};

const DEFAULT_SOURCE = path.join(
  process.env.USERPROFILE ?? "C:\\Users\\dipta",
  "Documents",
  "Codex",
  "2026-07-31",
  "dokumen-organisasi-rapih",
  "outputs",
  "extracted",
  "Paket_Sanggar_Rapi_Final",
  "Paket_Sanggar",
  "01 Mandiri Non Badan Hukum",
);

const SOURCE = path.resolve(process.argv[2] ?? DEFAULT_SOURCE);
const OUT = path.resolve(
  process.argv[3] ??
    path.join(
      import.meta.dirname,
      "../../artifacts/jak-sanggar/public/dokumen-paket/katalog/mandiri-non-bh.json",
    ),
);

const DOKUMEN = [
  { file: "01 Formulir Data.docx", id: "01_Form_Data", judul: "Formulir Data Induk" },
  { file: "02 Berita Acara Musyawarah.docx", id: "02_BA_Musyawarah", judul: "Berita Acara Musyawarah Pembentukan" },
  { file: "03 Surat Pernyataan Kedudukan Mandiri.docx", id: "03_Pernyataan_Mandiri", judul: "Surat Pernyataan Kedudukan Mandiri" },
  { file: "04 Anggaran Dasar.docx", id: "04_AD", judul: "Anggaran Dasar" },
  { file: "05 Anggaran Rumah Tangga.docx", id: "05_ART", judul: "Anggaran Rumah Tangga" },
  { file: "06 SK Pembentukan dan Pengesahan.docx", id: "06_SK_Pembentukan", judul: "Keputusan Pembentukan dan Pengesahan" },
  { file: "07 SK Penetapan Atribut dan Identitas.docx", id: "07_SK_Atribut", judul: "Keputusan Atribut dan Identitas" },
  { file: "08 SK Penugasan Pelatih dan Instruktur.docx", id: "08_SK_Pelatih", judul: "Keputusan Penugasan Pelatih/Instruktur" },
  { file: "09 SK Iuran Honorarium dan Pembagian Penghasilan.docx", id: "09_SK_Keuangan", judul: "Keputusan Iuran, Honorarium, dan Pembagian Penghasilan" },
] as const;

const TOKEN_RE = /\{\{[A-Z0-9_/]+\}\}/g;

type TabelWord = {
  bergaris: boolean;
  lebarKolom: number[];
};

function repairSplitTokens(html: string): string {
  return html.replace(
    /\{(?:<[^>]*>)*\{((?:[A-Z0-9_/]|<[^>]*>)+?)\}(?:<[^>]*>)*\}/g,
    (_match, inner: string) => `{{${inner.replace(/<[^>]*>/g, "")}}}`,
  );
}

function tokenMultiset(text: string): Map<string, number> {
  const hasil = new Map<string, number>();
  for (const token of text.match(TOKEN_RE) ?? []) {
    hasil.set(token, (hasil.get(token) ?? 0) + 1);
  }
  return hasil;
}

function multisetSama(kiri: Map<string, number>, kanan: Map<string, number>) {
  if (kiri.size !== kanan.size) return false;
  return [...kiri].every(([token, jumlah]) => kanan.get(token) === jumlah);
}

/** Cari semua <w:tbl> secara bertumpuk agar tabel bersarang tetap berurutan. */
function rentangTabelWord(xml: string): string[] {
  const tag = /<\/?w:tbl(?:\s[^>]*)?>/gi;
  const terbuka: number[] = [];
  const rentang: Array<{ mulai: number; akhir: number }> = [];
  let cocok: RegExpExecArray | null;
  while ((cocok = tag.exec(xml))) {
    if (cocok[0].startsWith("</")) {
      const mulai = terbuka.pop();
      if (mulai !== undefined) {
        rentang.push({ mulai, akhir: tag.lastIndex });
      }
    } else {
      terbuka.push(cocok.index);
    }
  }
  return rentang
    .sort((a, b) => a.mulai - b.mulai)
    .map(({ mulai, akhir }) => xml.slice(mulai, akhir));
}

function tabelWord(xml: string): TabelWord[] {
  return rentangTabelWord(xml).map((tabel) => {
    // Properti tabel langsung berada sebelum baris pertama. Pembatas ini
    // mencegah properti tabel anak memengaruhi klasifikasi tabel induknya.
    const properti = tabel.slice(0, tabel.search(/<w:tr\b/i));
    const blokGaris = properti.match(/<w:tblBorders\b[^>]*>[\s\S]*?<\/w:tblBorders>/i)?.[0] ?? "";
    const bergaris = /\bw:val\s*=\s*["'](?!nil["']|none["'])[^"']+["']/i.test(blokGaris);
    const grid = properti.match(/<w:tblGrid\b[^>]*>([\s\S]*?)<\/w:tblGrid>/i)?.[1] ?? "";
    const lebarKolom = Array.from(
      grid.matchAll(/<w:gridCol\b[^>]*\bw:w\s*=\s*["'](\d+)["'][^>]*\/?\s*>/gi),
      (cocok) => Number(cocok[1]),
    ).filter((lebar) => Number.isFinite(lebar) && lebar > 0);
    return { bergaris, lebarKolom };
  });
}

function kelasTabel(atribut: string, kelas: string): string {
  const cocok = atribut.match(/\sclass\s*=\s*(["'])(.*?)\1/i);
  if (!cocok) return `${atribut} class="${kelas}"`;
  const gabungan = Array.from(
    new Set([...cocok[2].split(/\s+/).filter(Boolean), ...kelas.split(" ")]),
  ).join(" ");
  return atribut.replace(cocok[0], ` class="${gabungan}"`);
}

function colgroup(lebarKolom: number[]): string {
  const total = lebarKolom.reduce((jumlah, lebar) => jumlah + lebar, 0);
  if (!total) return "";
  return `<colgroup>${lebarKolom
    .map((lebar) => `<col style="width:${((lebar / total) * 100).toFixed(4)}%">`)
    .join("")}</colgroup>`;
}

/**
 * Mammoth memelihara urutan tabel Word. Tambahkan penanda presentasi tanpa
 * mengubah isi atau urutan HTML, sehingga editor masih dapat mengunci tabel.
 */
function terapkanTataLetakTabel(html: string, tabel: TabelWord[]): string {
  let indeks = 0;
  const hasil = html.replace(/<table\b([^>]*)>/gi, (penuh, atribut: string) => {
    const info = tabel[indeks++];
    if (!info) return penuh;
    const jenis = info.bergaris ? "grid" : "layout";
    const attrs = kelasTabel(
      atribut,
      `dokumen-template__table dokumen-template__table--${jenis} docx-source-table docx-source-table--${jenis}`,
    );
    return `<table${attrs} data-docx-source-table="true" data-docx-table-border="${jenis}" data-docx-column-count="${info.lebarKolom.length || 1}">${colgroup(info.lebarKolom)}`;
  });
  if (indeks !== tabel.length) {
    throw new Error(
      `Jumlah tabel berbeda: HTML ${indeks}, Word ${tabel.length}. Keluaran tidak ditulis agar struktur tidak bergeser.`,
    );
  }
  return hasil;
}

async function bacaXmlDokumen(docxPath: string): Promise<string> {
  const zip = await openZip({ path: docxPath });
  return zip.read("word/document.xml", "utf-8");
}

async function main() {
  if (!fs.existsSync(SOURCE)) {
    throw new Error(`Folder sumber tidak ditemukan: ${SOURCE}`);
  }

  const dokumen: Array<{ id: string; judul: string; html: string }> = [];
  for (const info of DOKUMEN) {
    const sumber = path.join(SOURCE, info.file);
    if (!fs.existsSync(sumber)) throw new Error(`Dokumen sumber tidak ditemukan: ${sumber}`);

    const [konversi, xml] = await Promise.all([
      mammoth.convertToHtml({ path: sumber }),
      bacaXmlDokumen(sumber),
    ]);
    const html = terapkanTataLetakTabel(repairSplitTokens(konversi.value), tabelWord(xml));
    const tokenWord = tokenMultiset(xml.replace(/<[^>]+>/g, ""));
    const tokenHtml = tokenMultiset(html);
    if (!multisetSama(tokenWord, tokenHtml)) {
      throw new Error(`Token berbeda pada ${info.file}; keluaran tidak ditulis.`);
    }
    dokumen.push({ id: info.id, judul: info.judul, html });
    console.log(`OK ${info.id}: ${tabelWord(xml).length} tabel dipertahankan.`);
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(
    OUT,
    JSON.stringify({
      paketId: "mandiri-non-bh",
      bentukId: "mandiri-non-bh",
      variantId: null,
      label: "Sanggar Mandiri Tidak Berbadan Hukum",
      dokumen,
    }),
  );
  console.log(`Selesai: ${OUT}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
