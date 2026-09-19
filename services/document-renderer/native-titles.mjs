const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
// Exact authored headings audited across the native catalog; no signature or reference fields.
const LEGAL_TITLES = new Set([
  "ADMINISTRASI, KERJA SAMA, DAN PELAPORAN",
  "ASAS, SIFAT, MAKSUD, TUJUAN, DAN KEGIATAN",
  "ATRIBUT DAN IDENTITAS",
  "ATRIBUT DAN IDENTITAS ORGANISASI INDUK",
  "ATRIBUT DAN IDENTITAS SANGGAR",
  "BAGAN STRUKTUR PENGELOLA {{NAM_SA2}}",
  "BAGAN STRUKTUR PENGURUS {{NAM_SA2}}",
  "CONTOH PENEMPATAN LOGO PADA KEPUTUSAN",
  "DAFTAR PELATIH/INSTRUKTUR",
  "DAN PEMBAGIAN HASIL BERSIH KEGIATAN",
  "DAN PENGGUNAAN HASIL KEGIATAN",
  "DENGAN RAHMAT TUHAN YANG MAHA ESA",
  "FORUM ELEKTRONIK, UNIT KEGIATAN, DAN PROGRAM KERJA",
  "FORUM, RAPAT, DAN MEKANISME PEMILIHAN PIMPINAN FORUM",
  "FORUM, RAPAT, DAN PIMPINAN FORUM",
  "KEANGGOTAAN",
  "KELAYAKAN PENGELOLA, DELEGASI, DAN SERAH TERIMA",
  "KELAYAKAN PENGURUS, DELEGASI, DAN SERAH TERIMA",
  "KEPENGURUSAN",
  "KEPESERTAAN",
  "KETENTUAN PENUTUP",
  "KETENTUAN UMUM",
  "KETUA {{NAM_SA2}},",
  "KEUANGAN DAN ASET",
  "KEUANGAN, IURAN, HONORARIUM, DAN PEMBAGIAN HASIL BERSIH KEGIATAN",
  "KEUANGAN, IURAN, HONORARIUM, DAN PENGGUNAAN HASIL KEGIATAN",
  "KOMPONEN IURAN, HONORARIUM, DAN BIAYA KEGIATAN",
  "KOP SURAT DAN PENEMPATAN LOGO PADA KEPUTUSAN",
  "LATIHAN, PELATIH, PRODUKSI, DAN KEGIATAN",
  "LOGO {{NAM_SA2}}",
  "MASA BAKTI {{DUR_BAK}} TAHUN ({{TGL_AWA_}}\u2013{{TGL_AKH_}})",
  "MEKANISME PEMBAGIAN HASIL BERSIH KEGIATAN",
  "MEKANISME PENGGUNAAN HASIL KEGIATAN",
  "MEMUTUSKAN:",
  "MUSYAWARAH MUFAKAT {{NAM_SA2}},",
  "MUSYAWARAH, RAPAT, DAN MEKANISME PEMILIHAN PIMPINAN FORUM",
  "MUSYAWARAH, RAPAT, DAN PIMPINAN FORUM",
  "NAMA, TEMPAT KEDUDUKAN, DAN WAKTU PENDIRIAN",
  "PEDOMAN PENGGUNAAN ATRIBUT",
  "PELAKSANAAN IURAN, HONORARIUM,",
  "PEMILIHAN, PEMBERHENTIAN, DAN TUGAS PENGELOLA",
  "PEMILIHAN, PEMBERHENTIAN, DAN TUGAS PENGURUS",
  "PENETAPAN ATRIBUT DAN IDENTITAS",
  "PENETAPAN {{JEN_PRO}} {{NAM_SA2}}",
  "PENGELOLA {{NAM_SA2}}",
  "PENGELOLAAN",
  "PENGENDALIAN KEUANGAN, ASET, DATA, KERJA SAMA, DAN PENGADUAN",
  "PENGURUS {{NAM_SA2}}",
  "PENUGASAN PELATIH/INSTRUKTUR",
  "PERLINDUNGAN PESERTA, KESELAMATAN, DAN KARYA",
  "PERUBAHAN, STATUS KELEMBAGAAN, DAN PEMBUBARAN",
  "STEMPEL {{NAM_SA2}}",
  "TENTANG",
  "TUGAS DAN FUNGSI PENGELOLA",
  "TUGAS DAN FUNGSI PENGURUS",
  "{{JAB_PEN}},",
  "{{JEN_PRO}} {{NAM_SA2}}",
  "{{NAM_IN2}}",
  "{{NAM_SA2}}",
  "{{ORG_PEN}},",
  "{{O_JEN_PR}} {{NAM_IN2}}",
]);
const children = (node, name) =>
  Array.from(node?.childNodes ?? []).filter(
    (child) => child.namespaceURI === W && child.localName === name,
  );
const textOf = (paragraph) =>
  Array.from(paragraph.getElementsByTagNameNS(W, "t"))
    .map((node) => node.textContent || "")
    .join("");

/**
 * Select authored title paragraphs before inserting user values.
 * The selectors were audited against the 203 native templates. In particular,
 * LegalSubheading is also used on signature dates, and Judul3 is used on Pasal.
 * Neither is a blanket request to uppercase the paragraph.
 */
export function collectNativeTitleParagraphs(doc, documentId = "") {
  const body = doc.getElementsByTagNameNS(W, "body")[0];
  if (!body) return [];
  const paragraphs = children(body, "p");
  const isForm =
    /^formulir-data-/.test(documentId) ||
    documentId === "buku-administrasi-operasional";
  return paragraphs.filter((paragraph, index) => {
    const original = textOf(paragraph).trim();
    if (!original || original === "{{LOGO}}") return false;
    const properties = children(paragraph, "pPr")[0];
    const style =
      children(properties, "pStyle")[0]?.getAttributeNS(W, "val") || "";
    const alignment =
      children(properties, "jc")[0]?.getAttributeNS(W, "val") || "";
    if (style === "Judul1" || style === "Judul2") return true;
    if (
      style === "LegalSubheading" &&
      LEGAL_TITLES.has(original.toLocaleUpperCase("id-ID"))
    )
      return true;
    if (
      isForm &&
      /^[A-Z]\.\s+\S/.test(original) &&
      children(properties, "keepNext").length
    )
      return true;
    if (alignment !== "center") return false;
    if (
      /^(?:DATA INDUK|STATUS DAN TANGGUNG JAWAB|PENETAPAN PENGELOLA MASA BAKTI|SUSUNAN PENGELOLA MASA BAKTI)\b/.test(
        original,
      )
    )
      return true;
    // This unstyled continuation exists in the standalone status declaration.
    if (
      documentId === "pernyataan-kedudukan-mandiri" &&
      original === "{{NAM_SA2}}"
    )
      return true;
    // Authority lines belong to the opening heading, never the signature table.
    if (
      index > 0 &&
      textOf(paragraphs[index - 1]).trim() ===
        "DENGAN RAHMAT TUHAN YANG MAHA ESA" &&
      /^(?:\{\{ORG_PEN\}\}|MUSYAWARAH ANGGOTA \{\{(?:NAM_SA2|NAM_IN2)\}\}),$/.test(
        original,
      )
    )
      return true;
    return false;
  });
}

export function uppercaseNativeTitles(paragraphs) {
  for (const paragraph of paragraphs) {
    for (const node of Array.from(paragraph.getElementsByTagNameNS(W, "t"))) {
      node.textContent = (node.textContent || "").toLocaleUpperCase("id-ID");
    }
  }
}
