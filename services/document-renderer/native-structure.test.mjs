import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs/promises";
import path from "node:path";
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import JSZip from "jszip";
import { normalizeNativeStructure } from "./native-structure.mjs";

const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
import { nativeTemplateRoot } from "./runtime.mjs";
const root = nativeTemplateRoot();
const parse = (xml) =>
  new DOMParser().parseFromString(
    xml.replace(/^\uFEFF/, ""),
    "application/xml",
  );
const elements = (node, tag) => Array.from(node.getElementsByTagNameNS(W, tag));
const texts = (xml) =>
  elements(parse(xml), "p").map((p) =>
    elements(p, "t")
      .map((t) => t.textContent)
      .join(""),
  );
const catalog = JSON.parse(
  (await fs.readFile(path.join(root, "catalog.json"), "utf8")).replace(
    /^\uFEFF/,
    "",
  ),
);
const templates = catalog.groups.flatMap((group) =>
  group.documents.map((item) => ({ ...item, groupId: group.id })),
);
const agreementId = "perjanjian-kerja-sama-kegiatan-seni";
const agreements = [];
for (const item of templates.filter((item) => item.id === agreementId)) {
  const zip = await JSZip.loadAsync(
    await fs.readFile(path.join(root, item.path)),
  );
  agreements.push({
    ...item,
    xml: await zip.file("word/document.xml").async("string"),
  });
}

test("all 13 agreements preserve body prose and produce one continuous list with aligned text", () => {
  assert.equal(agreements.length, 13);
  for (const { xml, groupId } of agreements) {
    const result = normalizeNativeStructure(xml, agreementId);
    const before = texts(xml),
      after = texts(result);
    assert.equal(after.length, before.length, groupId);
    const numbered = elements(parse(result), "p").filter((p) =>
      /^\d+\./u.test(
        elements(p, "t")
          .map((t) => t.textContent)
          .join(""),
      ),
    );
    assert.equal(numbered.length, 10, groupId);
    numbered.forEach((paragraph, index) => {
      assert.equal(elements(paragraph, "t")[0].textContent, `${index + 1}.`);
      const indent = elements(paragraph, "ind")[0];
      assert.equal(indent.getAttributeNS(W, "left"), "480");
      assert.equal(indent.getAttributeNS(W, "hanging"), "480");
      const tabs = elements(paragraph, "tab");
      assert.equal(
        tabs.filter((t) => t.parentNode.localName === "r").length,
        1,
      );
      assert.equal(
        tabs
          .find((t) => t.parentNode.localName === "tabs")
          .getAttributeNS(W, "pos"),
        "480",
      );
    });
    assert.deepEqual(
      after.map((text) => text.replace(/^\d+\./u, "")),
      before.map((text) => text.replace(/^\s*\d+\.\s+/u, "")),
      groupId,
    );
    const beforeTables = elements(parse(xml), "tbl").map((t) =>
      new XMLSerializer().serializeToString(t),
    );
    const afterTables = elements(parse(result), "tbl").map((t) =>
      new XMLSerializer().serializeToString(t),
    );
    assert.deepEqual(afterTables, beforeTables, groupId);
    assert.equal(
      normalizeNativeStructure(result, agreementId),
      result,
      `Idempotence: ${groupId}`,
    );
  }
});

test("all 176 other available templates are byte-for-byte unchanged by structure normalization", async () => {
  const otherTemplates = templates.filter(
    (item) => item.id !== agreementId && item.id !== "pedoman-pelaksanaan",
  );
  assert.equal(otherTemplates.length, 176);
  for (const item of otherTemplates) {
    const zip = await JSZip.loadAsync(
      await fs.readFile(path.join(root, item.path)),
    );
    const xml = await zip.file("word/document.xml").async("string");
    assert.equal(normalizeNativeStructure(xml, item.id), xml, item.path);
  }
});

test("13 pedoman templates remove only indentation residue before 26 ayat bodies", async () => {
  const manuals = templates.filter((item) => item.id === "pedoman-pelaksanaan");
  assert.equal(manuals.length, 13);
  let affectedParagraphs = 0;
  for (const item of manuals) {
    const zip = await JSZip.loadAsync(
      await fs.readFile(path.join(root, item.path)),
    );
    const xml = await zip.file("word/document.xml").async("string");
    const result = normalizeNativeStructure(xml, item.id);
    const before = texts(xml),
      after = texts(result);
    assert.equal(after.length, before.length);
    before.forEach((text, index) => {
      if (text !== after[index]) {
        affectedParagraphs++;
        assert.match(text, /^\s*\n/u);
        assert.equal(after[index], text.trimStart());
      }
    });
    const beforeRuns = elements(parse(xml), "t")
      .filter((t) => t.textContent.trim() !== "")
      .map((t) => t.textContent);
    const afterRuns = elements(parse(result), "t")
      .filter((t) => t.textContent.trim() !== "")
      .map((t) => t.textContent);
    assert.deepEqual(afterRuns, beforeRuns, item.path);
    assert.equal(normalizeNativeStructure(result, item.id), result);
    assert.deepEqual(
      elements(parse(result), "br").map((n) =>
        new XMLSerializer().serializeToString(n),
      ),
      elements(parse(xml), "br").map((n) =>
        new XMLSerializer().serializeToString(n),
      ),
    );
  }
  assert.equal(affectedParagraphs, 26);
});

test("future cross-references, changed sequence, or missing continuation prevent renumbering", () => {
  const xml = agreements[0].xml;
  assert.equal(
    normalizeNativeStructure(
      xml.replace("Kegiatan:", "Sesuai butir 3, kegiatan:"),
      agreementId,
    ),
    xml.replace("Kegiatan:", "Sesuai butir 3, kegiatan:"),
  );
  assert.equal(
    normalizeNativeStructure(
      xml.replace(" 3. Nilai", " 7. Nilai"),
      agreementId,
    ),
    xml.replace(" 3. Nilai", " 7. Nilai"),
  );
  assert.equal(
    normalizeNativeStructure(
      xml.replace(
        "keduanya merupakan satu perjanjian.",
        "keduanya memiliki ruang lingkup tersendiri.",
      ),
      agreementId,
    ),
    xml.replace(
      "keduanya merupakan satu perjanjian.",
      "keduanya memiliki ruang lingkup tersendiri.",
    ),
  );
});

test("split marker runs preserve the complete body and numbering", () => {
  const xml = agreements[0].xml.replace(
    "<w:t> 1. Kegiatan:",
    "<w:t> </w:t></w:r><w:r><w:t>1.</w:t></w:r><w:r><w:t> Kegiatan:",
  );
  const result = normalizeNativeStructure(xml, agreementId);
  assert.match(texts(result).join("\n"), /1\.Kegiatan:/u);
  assert.match(texts(result).join("\n"), /10\.Perjanjian berlaku/u);
  assert.deepEqual(
    texts(result).map((text) => text.replace(/^\d+\./u, "")),
    texts(xml).map((text) => text.replace(/^\s*\d+\.\s+/u, "")),
  );
});

test("headers, footers, and unrelated document identifiers are unchanged", () => {
  const header = `<?xml version="1.0"?><w:hdr xmlns:w="${W}"><w:p><w:r><w:t>1. Header</w:t></w:r></w:p></w:hdr>`;
  assert.equal(normalizeNativeStructure(header, agreementId), header);
  assert.equal(
    normalizeNativeStructure(agreements[0].xml, "data-induk-sanggar"),
    agreements[0].xml,
  );
});
