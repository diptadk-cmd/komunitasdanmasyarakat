/** Run in the renderer browser after computed styles have been inlined. */
export function preserveDocumentTextBlocks() {
  const roots = document.querySelectorAll(
    "[data-dokumen-template-root],.dokumen-template",
  );
  const targets = new Set(
    document.querySelectorAll("div[data-dokumen-heading]"),
  );
  for (const root of roots)
    for (const block of root.querySelectorAll("div")) targets.add(block);
  let converted = 0;
  for (const block of targets) {
    if (
      !block.isConnected ||
      block.classList.contains("page-break") ||
      block.querySelector(
        "div,p,table,ul,ol,li,h1,h2,h3,h4,h5,h6,section,article,header,footer,pre,blockquote",
      ) ||
      !block.textContent.trim()
    )
      continue;
    const paragraph = document.createElement("p");
    for (const attribute of block.attributes)
      paragraph.setAttribute(attribute.name, attribute.value);
    while (block.firstChild) paragraph.appendChild(block.firstChild);
    block.replaceWith(paragraph);
    converted++;
  }
  return converted;
}

/** Keep Word's table separator but remove the converter's default full blank line. */
export function compactListTableSeparator(table, source) {
  if (!source?.isDocumentList) return false;
  const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
  let paragraph = table.nextSibling;
  while (paragraph && paragraph.nodeType !== 1)
    paragraph = paragraph.nextSibling;
  if (!paragraph || paragraph.namespaceURI !== W || paragraph.localName !== "p")
    return false;
  if (
    Array.from(paragraph.getElementsByTagNameNS(W, "t")).some((node) =>
      node.textContent?.trim(),
    )
  )
    return false;
  const protectedTags = [
    "br",
    "drawing",
    "object",
    "pict",
    "sectPr",
    "fldChar",
    "instrText",
    "tab",
    "pageBreakBefore",
  ];
  if (
    protectedTags.some(
      (name) => paragraph.getElementsByTagNameNS(W, name).length,
    )
  )
    return false;
  const children = (node, name) =>
    Array.from(node.childNodes).filter(
      (child) => child.namespaceURI === W && child.localName === name,
    );
  const doc = table.ownerDocument;
  let properties = children(paragraph, "pPr")[0];
  if (!properties) {
    properties = doc.createElementNS(W, "w:pPr");
    paragraph.insertBefore(properties, paragraph.firstChild);
  }
  for (const node of children(properties, "spacing"))
    properties.removeChild(node);
  const spacing = doc.createElementNS(W, "w:spacing");
  for (const [key, value] of Object.entries({
    before: 0,
    after: 0,
    line: Math.max(1, Math.round((source.listGapPx || 0) * 15)),
    lineRule: "exact",
  }))
    spacing.setAttributeNS(W, `w:${key}`, String(value));
  properties.appendChild(spacing);
  return true;
}

/** Restore the separator trimmed by HTMLtoDOCX before its generated PAGE field. */
export function spaceWordPageNumber(xml) {
  const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
  const doc = new DOMParser().parseFromString(
    xml.replace(/^\uFEFF/, ""),
    "application/xml",
  );
  if (
    doc.documentElement.namespaceURI !== W ||
    doc.documentElement.localName !== "ftr"
  )
    return xml;
  let changed = false;
  for (const text of Array.from(doc.getElementsByTagNameNS(W, "t"))) {
    if (text.textContent !== "Halaman" || text.parentNode.localName !== "r")
      continue;
    let next = text.parentNode.nextSibling;
    while (next && next.nodeType !== 1) next = next.nextSibling;
    if (
      next?.namespaceURI !== W ||
      next.localName !== "fldSimple" ||
      (next.getAttributeNS(W, "instr") || "").trim() !== "PAGE"
    )
      continue;
    text.textContent = "Halaman ";
    text.setAttributeNS(
      "http://www.w3.org/XML/1998/namespace",
      "xml:space",
      "preserve",
    );
    changed = true;
  }
  return changed ? new XMLSerializer().serializeToString(doc) : xml;
}
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
