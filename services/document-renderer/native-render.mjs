import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import JSZip from "jszip";
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import {
  collectNativeTitleParagraphs,
  uppercaseNativeTitles,
} from "./native-titles.mjs";
import { normalizeNativeStructure } from "./native-structure.mjs";
import { embedNativeImages } from "./native-images.mjs";
const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
import {
  nativeTemplateRoot,
  loadNativeCatalog,
  templatePath,
  convertNativePdf,
  removeNativeTemp,
  badInput,
  unavailable,
} from "./runtime.mjs";
export function replaceFields(xml, values, documentId = "") {
  const doc = new DOMParser().parseFromString(
    xml.replace(/^\uFEFF/, ""),
    "application/xml",
  );
  const titles = collectNativeTitleParagraphs(doc, documentId);
  for (const p of Array.from(doc.getElementsByTagNameNS(W, "p"))) {
    const nodes = Array.from(p.getElementsByTagNameNS(W, "t"));
    const full = nodes.map((n) => n.textContent || "").join("");
    const positions = [];
    let offset = 0;
    for (const node of nodes) {
      positions.push({
        node,
        start: offset,
        end: offset + (node.textContent || "").length,
      });
      offset += (node.textContent || "").length;
    }
    for (const match of Array.from(
      full.matchAll(/\{\{([A-Z0-9_/]+)\}\}/g),
    ).reverse()) {
      const key = match[1];
      if (!Object.hasOwn(values, key) || values[key] === "") continue;
      const first = positions.findIndex((p) => p.end > match.index),
        last = positions.findIndex(
          (p) => p.end >= match.index + match[0].length,
        );
      if (first < 0 || last < first)
        throw new Error("Posisi isian tidak valid");
      const a = positions[first],
        b = positions[last];
      const prefix = a.node.textContent.slice(0, match.index - a.start),
        suffix = b.node.textContent.slice(
          match.index + match[0].length - b.start,
        );
      const value = values[key].replace(/\r\n?/g, "\n");
      a.node.textContent = prefix + value + (first === last ? suffix : "");
      a.node.setAttribute("xml:space", "preserve");
      if (first !== last) {
        for (let i = first + 1; i < last; i++)
          positions[i].node.textContent = "";
        b.node.textContent = suffix;
        b.node.setAttribute("xml:space", "preserve");
      }
    }
    for (const node of nodes) {
      if (!node.textContent.includes("\n")) continue;
      const lines = node.textContent.split("\n");
      node.textContent = lines[0];
      let previous = node;
      for (const line of lines.slice(1)) {
        const br = doc.createElementNS(W, "w:br"),
          t = doc.createElementNS(W, "w:t");
        t.setAttribute("xml:space", "preserve");
        t.textContent = line;
        node.parentNode.insertBefore(br, previous.nextSibling);
        node.parentNode.insertBefore(t, br.nextSibling);
        previous = t;
      }
    }
  }
  uppercaseNativeTitles(titles);
  return new XMLSerializer().serializeToString(doc);
}
export async function nativeRender(input) {
  if (!["word", "pdf"].includes(input?.format))
    throw badInput("Format dokumen tidak valid.");
  const root = nativeTemplateRoot();
  let catalog;
  try {
    catalog = await loadNativeCatalog(root);
  } catch {
    throw unavailable(
      "Katalog template native belum tersedia. Periksa NATIVE_TEMPLATE_ROOT.",
    );
  }
  const group = catalog.groups.find(
    (g) => g.id === input.nativeTemplate?.groupId,
  );
  const item = group?.documents.find(
    (d) => d.id === input.nativeTemplate?.documentId,
  );
  if (!item) {
    const e = new Error("Template tidak ditemukan");
    e.status = 400;
    throw e;
  }
  const raw = input.nativeTemplate.values ?? {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    const e = new Error("Isian tidak valid");
    e.status = 400;
    throw e;
  }
  const allowed = new Set(item.fields.map((f) => f.key));
  const values = Object.create(null);
  for (const [k, v] of Object.entries(raw)) {
    if (!allowed.has(k)) continue;
    if (
      typeof v !== "string" ||
      v.length > 10000 ||
      /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(v)
    ) {
      const e = new Error("Isian tidak valid atau terlalu panjang");
      e.status = 400;
      throw e;
    }
    values[k] = v;
  }
  let output = await fs.readFile(templatePath(root, item.path));
  {
    const zip = await JSZip.loadAsync(output);
    if (input.nativeTemplate.images)
      await embedNativeImages(zip, input.nativeTemplate.images);
    for (const name of Object.keys(zip.files).filter((n) =>
      /^word\/(document|header\d+|footer\d+)\.xml$/.test(n),
    )) {
      const xml = await zip.file(name).async("string");
      const normalized =
        name === "word/document.xml"
          ? normalizeNativeStructure(xml, item.id)
          : xml;
      zip.file(name, replaceFields(normalized, values, item.id));
    }
    output = await zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
    });
  }
  if (input.format === "word") return output;
  let tmp;
  try {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), "sanggar-native-"));
    const file = path.join(tmp, "document.docx");
    await fs.writeFile(file, output);
    return await convertNativePdf(tmp, file);
  } finally {
    if (tmp) await removeNativeTemp(tmp);
  }
}
