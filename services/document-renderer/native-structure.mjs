import { DOMParser, XMLSerializer } from "@xmldom/xmldom";

const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const AGREEMENT_ID = "perjanjian-kerja-sama-kegiatan-seni";
const CONTINUATION =
  "Ketentuan lanjutan dan tanda tangan berada pada halaman berikutnya; keduanya merupakan satu perjanjian.";
const MAIN_TITLE = "PERJANJIAN KERJA SAMA KEGIATAN SENI";
const NEXT_TITLE = "PERJANJIAN KERJA SAMA KETENTUAN LANJUTAN";
const TEXT_START = 480;
const PROPERTY_ORDER = [
  "pStyle",
  "keepNext",
  "keepLines",
  "pageBreakBefore",
  "framePr",
  "widowControl",
  "numPr",
  "suppressLineNumbers",
  "pBdr",
  "shd",
  "tabs",
  "suppressAutoHyphens",
  "kinsoku",
  "wordWrap",
  "overflowPunct",
  "topLinePunct",
  "autoSpaceDE",
  "autoSpaceDN",
  "bidi",
  "adjustRightInd",
  "snapToGrid",
  "spacing",
  "ind",
  "contextualSpacing",
  "mirrorIndents",
  "suppressOverlap",
  "jc",
  "textDirection",
  "textAlignment",
  "textboxTightWrap",
  "outlineLvl",
  "divId",
  "cnfStyle",
  "rPr",
  "sectPr",
  "pPrChange",
];

const children = (node) =>
  Array.from(node.childNodes).filter((child) => child.nodeType === 1);
const child = (node, name) =>
  children(node).find(
    (item) => item.namespaceURI === W && item.localName === name,
  );
const textNodes = (node) => Array.from(node.getElementsByTagNameNS(W, "t"));
const paragraphText = (node) =>
  textNodes(node)
    .map((item) => item.textContent || "")
    .join("");

function setProperty(properties, name, attributes) {
  const doc = properties.ownerDocument;
  let property = child(properties, name);
  if (!property) {
    property = doc.createElementNS(W, `w:${name}`);
    const following = children(properties).find(
      (item) =>
        PROPERTY_ORDER.indexOf(item.localName) > PROPERTY_ORDER.indexOf(name),
    );
    properties.insertBefore(property, following || null);
  }
  for (const [key, value] of Object.entries(attributes))
    property.setAttributeNS(W, `w:${key}`, String(value));
  return property;
}

function alignNumberedParagraph(paragraph, prefixLength, number) {
  const doc = paragraph.ownerDocument;
  const nodes = textNodes(paragraph);
  const firstRun = nodes[0].parentNode;
  let properties = child(paragraph, "pPr");
  if (!properties) {
    properties = doc.createElementNS(W, "w:pPr");
    paragraph.insertBefore(properties, paragraph.firstChild);
  }
  const indent = setProperty(properties, "ind", {
    left: TEXT_START,
    hanging: TEXT_START,
  });
  for (const attribute of [
    "firstLine",
    "firstLineChars",
    "hangingChars",
    "leftChars",
    "start",
    "startChars",
  ]) {
    indent.removeAttributeNS(W, attribute);
  }
  const tabs = setProperty(properties, "tabs", {});
  for (const tab of children(tabs)) {
    if (
      tab.localName === "tab" &&
      Number(tab.getAttributeNS(W, "pos")) <= TEXT_START
    )
      tabs.removeChild(tab);
  }
  const tabStop = doc.createElementNS(W, "w:tab");
  tabStop.setAttributeNS(W, "w:val", "left");
  tabStop.setAttributeNS(W, "w:pos", String(TEXT_START));
  tabs.insertBefore(tabStop, tabs.firstChild);

  // Keep the original runs and body text; move only the marker into its own run.
  const markerRun = doc.createElementNS(W, "w:r");
  const runProperties = child(firstRun, "rPr");
  if (runProperties) markerRun.appendChild(runProperties.cloneNode(true));
  const markerText = doc.createElementNS(W, "w:t");
  markerText.textContent = `${number}.`;
  markerRun.appendChild(markerText);
  markerRun.appendChild(doc.createElementNS(W, "w:tab"));
  paragraph.insertBefore(markerRun, firstRun);
  let remaining = prefixLength;
  for (const node of nodes) {
    const value = node.textContent || "";
    const consumed = Math.min(remaining, value.length);
    if (consumed) {
      node.textContent = value.slice(consumed);
      node.setAttribute("xml:space", "preserve");
      remaining -= consumed;
    }
    if (remaining === 0) break;
  }
}

function removeListIndentationResidue(doc) {
  let changed = false;
  for (const row of Array.from(doc.getElementsByTagNameNS(W, "tr"))) {
    const cells = children(row).filter(
      (item) => item.namespaceURI === W && item.localName === "tc",
    );
    if (
      cells.length !== 2 ||
      !/^\(\d+\)$/u.test(paragraphText(cells[0]).trim())
    )
      continue;
    const paragraph = child(cells[1], "p");
    if (!paragraph) continue;
    for (const node of textNodes(paragraph)) {
      const value = node.textContent || "";
      if (value.trim() !== "") break;
      // Source indentation accidentally stored as visible text must not become
      // line breaks when replaceFields subsequently handles user-entered newlines.
      if (/[\r\n]/u.test(value)) {
        node.parentNode.removeChild(node);
        changed = true;
      }
    }
  }
  return changed;
}

/** Normalize the audited agreement list without changing other template structures. */
export function normalizeNativeStructure(xml, documentId) {
  if (documentId !== AGREEMENT_ID && documentId !== "pedoman-pelaksanaan")
    return xml;
  const doc = new DOMParser().parseFromString(
    xml.replace(/^\uFEFF/, ""),
    "application/xml",
  );
  if (documentId === "pedoman-pelaksanaan") {
    return removeListIndentationResidue(doc)
      ? new XMLSerializer().serializeToString(doc)
      : xml;
  }
  const body = doc.getElementsByTagNameNS(W, "body")[0];
  if (!body) return xml;
  const paragraphs = children(body).filter(
    (item) => item.namespaceURI === W && item.localName === "p",
  );
  const texts = paragraphs.map(paragraphText);
  const main = texts.indexOf(MAIN_TITLE),
    next = texts.indexOf(NEXT_TITLE),
    continuation = texts.indexOf(CONTINUATION);
  if (main < 0 || continuation <= main || next <= continuation) return xml;

  // A future template with numbered cross-references requires an explicit review.
  if (
    texts.some((text) =>
      /\b(?:butir|angka|pasal|ayat|nomor)\s*[:(]?\s*\d+/iu.test(text),
    )
  )
    return xml;
  const numbered = paragraphs
    .map((paragraph, index) => ({
      paragraph,
      index,
      match: /^\s*(\d+)\.\s+/u.exec(texts[index]),
    }))
    .filter((item) => item.match);
  if (numbered.length !== 10) return xml;
  const sequence = numbered.map((item) => Number(item.match[1])).join(",");
  if (sequence !== "1,2,3,4,5,1,2,3,4,5" && sequence !== "1,2,3,4,5,6,7,8,9,10")
    return xml;
  if (
    numbered
      .slice(0, 5)
      .some((item) => item.index <= main || item.index >= continuation) ||
    numbered.slice(5).some((item) => item.index <= next)
  )
    return xml;
  // All audited marker runs are direct paragraph children. Preserve unfamiliar structures.
  if (
    numbered.some(({ paragraph }) => {
      const firstRun = textNodes(paragraph)[0]?.parentNode;
      return (
        !firstRun ||
        firstRun.localName !== "r" ||
        firstRun.parentNode !== paragraph
      );
    })
  )
    return xml;
  numbered.forEach(({ paragraph, match }, index) =>
    alignNumberedParagraph(paragraph, match[0].length, index + 1),
  );
  return new XMLSerializer().serializeToString(doc);
}
