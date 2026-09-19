import test from "node:test";
import assert from "node:assert/strict";
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import {
  compactListTableSeparator,
  spaceWordPageNumber,
} from "./word-layout.mjs";
const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const parse = (body) =>
  new DOMParser().parseFromString(
    `<w:document xmlns:w="${W}"><w:body>${body}</w:body></w:document>`,
    "application/xml",
  );
const xml = (node) => new XMLSerializer().serializeToString(node);

test("Word footer keeps one preserved space before PAGE and leaves other labels/fields alone", () => {
  const footer = (label, instruction = "PAGE") =>
    `<ftr xmlns="${W}" xmlns:w="${W}"><p><r><t>${label}</t></r><fldSimple w:instr="${instruction}"><r/></fldSimple></p></ftr>`;
  const fixed = spaceWordPageNumber(footer("Halaman"));
  const doc = new DOMParser().parseFromString(fixed, "application/xml");
  const label = doc.getElementsByTagNameNS(W, "t")[0];
  assert.equal(label.textContent, "Halaman ");
  assert.equal(
    label.getAttributeNS("http://www.w3.org/XML/1998/namespace", "space"),
    "preserve",
  );
  assert.equal(
    doc.getElementsByTagNameNS(W, "fldSimple")[0].getAttributeNS(W, "instr"),
    "PAGE",
  );
  assert.equal(spaceWordPageNumber(fixed), fixed);
  for (const source of [
    footer("Halaman "),
    footer("Jumlah halaman"),
    footer("Halaman", "NUMPAGES"),
  ])
    assert.equal(spaceWordPageNumber(source), source);
});

test("document list gap matches its authored margin while preserving a table separator", () => {
  const doc = parse(
    '<w:tbl/><w:p><w:pPr><w:spacing w:after="160"/></w:pPr><w:r><w:rPr/></w:r></w:p><w:tbl/>',
  );
  assert.equal(
    compactListTableSeparator(doc.getElementsByTagNameNS(W, "tbl")[0], {
      isDocumentList: true,
      listGapPx: 2,
    }),
    true,
  );
  assert.equal(doc.getElementsByTagNameNS(W, "p").length, 1);
  const spacing = doc.getElementsByTagNameNS(W, "spacing")[0];
  assert.equal(spacing.getAttributeNS(W, "line"), "30");
  assert.equal(spacing.getAttributeNS(W, "lineRule"), "exact");
  assert.equal(spacing.getAttributeNS(W, "after"), "0");
});

test("normal table separators and paragraphs containing text or pagination are preserved byte-for-byte", () => {
  for (const following of [
    "<w:p><w:r><w:t>Body text</w:t></w:r></w:p>",
    '<w:p><w:r><w:br w:type="page"/></w:r></w:p>',
    "<w:p><w:pPr><w:pageBreakBefore/></w:pPr></w:p>",
    "<w:p><w:pPr><w:sectPr/></w:pPr></w:p>",
    "<w:p><w:r><w:drawing/></w:r></w:p>",
  ]) {
    const doc = parse("<w:tbl/>" + following);
    const before = xml(doc);
    assert.equal(
      compactListTableSeparator(doc.getElementsByTagNameNS(W, "tbl")[0], {
        isDocumentList: true,
      }),
      false,
    );
    assert.equal(xml(doc), before);
  }
  const doc = parse("<w:tbl/><w:p/>");
  const before = xml(doc);
  assert.equal(
    compactListTableSeparator(doc.getElementsByTagNameNS(W, "tbl")[0], {
      isDocumentList: false,
    }),
    false,
  );
  assert.equal(xml(doc), before);
});
