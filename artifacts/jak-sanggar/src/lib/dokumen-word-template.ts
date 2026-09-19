import JSZip from "jszip";
import { namaFileDokumen } from "@/lib/dokumen-export";
import {
  kunciFieldPaket,
  tokenAdalahPerBaris,
  type PaketDokumen,
} from "@/lib/dokumen-paket";

const WORD_NS =
  "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const XML_NS = "http://www.w3.org/XML/1998/namespace";
const TOKEN_RE = /\{\{[A-Z0-9_/]+\}\}/g;

interface OpsiWordTemplate {
  paketId: string;
  dokumen: PaketDokumen[];
  isian: Record<string, string>;
  fileName: string;
  dokumenId?: string;
}

interface PenggantianToken {
  mulai: number;
  akhir: number;
  nilai: string;
}

function nilaiPerKemunculan(
  dokumen: PaketDokumen[],
  isian: Record<string, string>,
): Map<string, string[]> {
  const hasil = new Map<string, string[]>();
  for (const item of dokumen) {
    const nomor = new Map<string, number>();
    for (const cocok of item.html.match(TOKEN_RE) ?? []) {
      const token = cocok.slice(2, -2);
      let nilai: string | undefined;
      if (tokenAdalahPerBaris(token)) {
        const kemunculan = (nomor.get(token) ?? 0) + 1;
        nomor.set(token, kemunculan);
        nilai = isian[kunciFieldPaket(item.id, token, kemunculan)];
        if (nilai === undefined && kemunculan === 1) nilai = isian[token];
      } else {
        nilai = isian[token];
      }
      const daftar = hasil.get(token) ?? [];
      daftar.push(nilai?.trim() ?? "");
      hasil.set(token, daftar);
    }
  }
  return hasil;
}

function aturTeks(node: Element, nilai: string): void {
  node.textContent = nilai;
  if (/^\s|\s$/.test(nilai)) {
    node.setAttributeNS(XML_NS, "xml:space", "preserve");
  } else {
    node.removeAttributeNS(XML_NS, "space");
  }
}

function sisipkanBarisBaru(node: Element, bagian: string[]): void {
  if (bagian.length <= 1) return;
  const parent = node.parentNode;
  if (!parent) return;
  const sebelum = node.nextSibling;
  for (const teks of bagian.slice(1)) {
    const br = node.ownerDocument.createElementNS(WORD_NS, "w:br");
    const t = node.ownerDocument.createElementNS(WORD_NS, "w:t");
    aturTeks(t, teks);
    parent.insertBefore(br, sebelum);
    parent.insertBefore(t, sebelum);
  }
}

function gantiRentangTeks(
  nodes: Element[],
  mulai: number,
  akhir: number,
  nilai: string,
): void {
  let posisi = 0;
  let indeksAwal = -1;
  let indeksAkhir = -1;
  let lokalAwal = 0;
  let lokalAkhir = 0;

  for (let indeks = 0; indeks < nodes.length; indeks++) {
    const panjang = nodes[indeks].textContent?.length ?? 0;
    if (indeksAwal < 0 && mulai < posisi + panjang) {
      indeksAwal = indeks;
      lokalAwal = mulai - posisi;
    }
    if (akhir <= posisi + panjang) {
      indeksAkhir = indeks;
      lokalAkhir = akhir - posisi;
      break;
    }
    posisi += panjang;
  }
  if (indeksAwal < 0 || indeksAkhir < 0) return;

  const nodeAwal = nodes[indeksAwal];
  const nodeAkhir = nodes[indeksAkhir];
  const teksAwal = nodeAwal.textContent ?? "";
  const teksAkhir = nodeAkhir.textContent ?? "";
  const prefiks = teksAwal.slice(0, lokalAwal);
  const sufiks = teksAkhir.slice(lokalAkhir);
  const bagian = nilai.replace(/\r\n?/g, "\n").split("\n");

  if (indeksAwal === indeksAkhir) {
    bagian[0] = prefiks + bagian[0];
    bagian[bagian.length - 1] += sufiks;
    aturTeks(nodeAwal, bagian[0]);
    sisipkanBarisBaru(nodeAwal, bagian);
    return;
  }

  aturTeks(nodeAwal, prefiks + bagian[0]);
  for (let indeks = indeksAwal + 1; indeks < indeksAkhir; indeks++) {
    aturTeks(nodes[indeks], "");
  }
  aturTeks(nodeAkhir, sufiks);
  sisipkanBarisBaru(nodeAwal, bagian);
}

function isiXmlWord(
  xml: string,
  nilaiToken: Map<string, string[]>,
  pemakaian: Map<string, number>,
): string {
  const dokumen = new DOMParser().parseFromString(xml, "application/xml");
  if (dokumen.querySelector("parsererror")) {
    throw new Error("Template Word mengandung XML yang tidak valid.");
  }

  const paragraf = Array.from(dokumen.getElementsByTagNameNS(WORD_NS, "p"));
  for (const p of paragraf) {
    const nodes = Array.from(p.getElementsByTagNameNS(WORD_NS, "t"));
    if (nodes.length === 0) continue;
    const gabungan = nodes.map((node) => node.textContent ?? "").join("");
    const penggantian: PenggantianToken[] = [];
    for (const cocok of gabungan.matchAll(TOKEN_RE)) {
      const token = cocok[0].slice(2, -2);
      // Petunjuk checklist ini memang harus tampil literal di dokumen akhir.
      if (token === "PLACEHOLDER") continue;
      const indeks = pemakaian.get(token) ?? 0;
      const daftar = nilaiToken.get(token);
      if (!daftar || indeks >= daftar.length) {
        throw new Error(`Nilai untuk token ${token} tidak ditemukan.`);
      }
      pemakaian.set(token, indeks + 1);
      penggantian.push({
        mulai: cocok.index,
        akhir: cocok.index + cocok[0].length,
        nilai: daftar[indeks],
      });
    }
    for (const item of penggantian.reverse()) {
      gantiRentangTeks(nodes, item.mulai, item.akhir, item.nilai);
    }
  }
  return new XMLSerializer().serializeToString(dokumen);
}

async function isiTemplateWord(
  sumber: ArrayBuffer,
  dokumen: PaketDokumen[],
  isian: Record<string, string>,
): Promise<Blob> {
  const zip = await JSZip.loadAsync(sumber);
  const nilaiToken = nilaiPerKemunculan(dokumen, isian);
  const pemakaian = new Map<string, number>();
  const bagianXml = Object.keys(zip.files).filter((nama) =>
    /^word\/(?:document|header\d+|footer\d+)\.xml$/i.test(nama),
  );
  for (const nama of bagianXml) {
    const file = zip.file(nama);
    if (!file) continue;
    const xml = await file.async("string");
    zip.file(nama, isiXmlWord(xml, nilaiToken, pemakaian));
  }

  for (const [token, daftar] of nilaiToken) {
    if ((pemakaian.get(token) ?? 0) !== daftar.length) {
      throw new Error(
        `Jumlah token ${token} pada template Word tidak cocok dengan data paket.`,
      );
    }
  }
  return zip.generateAsync({
    type: "blob",
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    compression: "DEFLATE",
  });
}

function unduhBlobWord(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const tautan = document.createElement("a");
  tautan.href = url;
  tautan.download = `${namaFileDokumen(fileName)}.docx`;
  tautan.style.display = "none";
  document.body.appendChild(tautan);
  tautan.click();
  tautan.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export async function unduhDokumenWordDariTemplate(
  opsi: OpsiWordTemplate,
): Promise<void> {
  const base = (import.meta.env.BASE_URL || "/").replace(/\/?$/, "/");
  const nama = opsi.dokumenId
    ? `${encodeURIComponent(opsi.dokumenId)}.docx`
    : "paket-lengkap.docx";
  const response = await fetch(
    `${base}dokumen-paket/word/${encodeURIComponent(opsi.paketId)}/${nama}`,
  );
  if (!response.ok) {
    throw new Error(`Template Word gagal dimuat (${response.status}).`);
  }
  const blob = await isiTemplateWord(
    await response.arrayBuffer(),
    opsi.dokumen,
    opsi.isian,
  );
  unduhBlobWord(blob, opsi.fileName);
}
