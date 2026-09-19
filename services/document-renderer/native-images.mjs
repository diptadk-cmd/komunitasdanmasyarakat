import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const WP =
  "http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing";
const REL = "http://schemas.openxmlformats.org/package/2006/relationships";
const TYPES = "http://schemas.openxmlformats.org/package/2006/content-types";
const parser = new DOMParser(),
  serializer = new XMLSerializer();
const parse = (xml) =>
  parser.parseFromString(xml.replace(/^\uFEFF/, ""), "application/xml");
const text = (p) =>
  Array.from(p.getElementsByTagNameNS(W, "t"))
    .map((n) => n.textContent || "")
    .join("");
const bad = (message) => Object.assign(new Error(message), { status: 400 });

export function validateImages(raw = {}) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    throw bad("Gambar dokumen tidak valid.");
  const images = {};
  for (const kind of ["logo", "stamp", "letterhead"]) {
    if (raw[kind] === undefined || raw[kind] === "") continue;
    const value = raw[kind];
    if (
      typeof value !== "string" ||
      value.length > 1400000 ||
      !/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(value)
    )
      throw bad(
        "Gambar harus berupa PNG yang valid, maksimal 1 MB per gambar.",
      );
    const encoded = value.slice(value.indexOf(",") + 1),
      data = Buffer.from(encoded, "base64");
    if (
      data.toString("base64") !== encoded ||
      data.length < 45 ||
      data.length > 1024 * 1024 ||
      !data
        .subarray(0, 8)
        .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ||
      data.toString("ascii", 12, 16) !== "IHDR"
    )
      throw bad("Berkas gambar PNG tidak valid.");
    const width = data.readUInt32BE(16),
      height = data.readUInt32BE(20);
    if (
      !width ||
      !height ||
      width > 4096 ||
      height > 4096 ||
      width * height > 16000000
    )
      throw bad("Resolusi gambar terlalu besar.");
    let offset = 8,
      hasData = false,
      ended = false;
    while (offset + 12 <= data.length) {
      const size = data.readUInt32BE(offset),
        end = offset + size + 12;
      if (end > data.length) throw bad("Berkas gambar PNG terpotong.");
      const tag = data.toString("ascii", offset + 4, offset + 8);
      if (tag === "IDAT") hasData = true;
      if (tag === "IEND") {
        ended = size === 0 && end === data.length;
        break;
      }
      offset = end;
    }
    if (!hasData || !ended) throw bad("Berkas gambar PNG tidak lengkap.");
    images[kind] = { data, width, height };
  }
  return images;
}
function drawing(doc, id, rid, kind, image, maxWidth) {
  const box =
    kind === "letterhead"
      ? [Math.min(maxWidth, 5760000), 1080000]
      : kind === "stamp"
        ? [1008000, 1008000]
        : [1080000, 1080000];
  const scale = Math.min(box[0] / image.width, box[1] / image.height),
    cx = Math.round(image.width * scale),
    cy = Math.round(image.height * scale);
  const name = {
    logo: "Logo sanggar",
    stamp: "Stempel sanggar",
    letterhead: "Kop surat sanggar",
  }[kind];
  const xml = `<w:r xmlns:w="${W}"><w:drawing><wp:inline xmlns:wp="${WP}" distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${id}" name="${name}" descr="${name}"/><wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="0" name="${name}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
  return doc.importNode(parse(xml).documentElement, true);
}
function paragraph(doc, align = "center") {
  const p = doc.createElementNS(W, "w:p"),
    pr = doc.createElementNS(W, "w:pPr");
  const jc = doc.createElementNS(W, "w:jc");
  jc.setAttributeNS(W, "w:val", align);
  const keep = doc.createElementNS(W, "w:keepNext");
  pr.appendChild(keep);
  pr.appendChild(jc);
  p.appendChild(pr);
  return p;
}
function eraseToken(p, token) {
  const full = text(p);
  let index = full.indexOf(token);
  if (index < 0) return false;
  // Descending ranges keep offsets stable for tokens split across styled runs.
  const matches = Array.from(
    full.matchAll(new RegExp(token.replace(/[{}]/g, "\\$&"), "g")),
  ).reverse();
  for (const match of matches) {
    let pos = 0;
    for (const node of Array.from(p.getElementsByTagNameNS(W, "t"))) {
      const value = node.textContent || "",
        end = pos + value.length;
      const startCut = Math.max(0, match.index - pos),
        endCut = Math.min(value.length, match.index + token.length - pos);
      if (endCut > startCut)
        node.textContent = value.slice(0, startCut) + value.slice(endCut);
      pos = end;
    }
  }
  return true;
}

// Embed only supplied bytes: no filesystem paths or remote image requests.
export async function embedNativeImages(zip, raw) {
  const images = validateImages(raw);
  if (!Object.keys(images).length) return;
  const doc = parse(await zip.file("word/document.xml").async("string"));
  const body = doc.getElementsByTagNameNS(W, "body")[0];
  const relPath = "word/_rels/document.xml.rels";
  const rels = parse(
    zip.file(relPath)
      ? await zip.file(relPath).async("string")
      : `<Relationships xmlns="${REL}"/>`,
  );
  const types = parse(await zip.file("[Content_Types].xml").async("string"));
  if (
    !Array.from(types.getElementsByTagNameNS(TYPES, "Default")).some(
      (n) => n.getAttribute("Extension") === "png",
    )
  ) {
    const node = types.createElementNS(TYPES, "Default");
    node.setAttribute("Extension", "png");
    node.setAttribute("ContentType", "image/png");
    types.documentElement.appendChild(node);
  }
  const page = doc.getElementsByTagNameNS(W, "pgSz")[0],
    margins = doc.getElementsByTagNameNS(W, "pgMar")[0];
  const available =
    (Number(page?.getAttributeNS(W, "w")) || 11906) -
    (Number(margins?.getAttributeNS(W, "left")) || 1701) -
    (Number(margins?.getAttributeNS(W, "right")) || 1134);
  const maxWidth = Math.max(720000, available * 635);
  let nextId =
    Math.max(
      0,
      ...Array.from(doc.getElementsByTagNameNS(WP, "docPr")).map(
        (n) => Number(n.getAttribute("id")) || 0,
      ),
    ) + 1;
  for (const kind of ["logo", "stamp", "letterhead"]) {
    if (!images[kind]) continue;
    let file = `native-${kind}.png`,
      n = 0;
    while (zip.file("word/media/" + file)) file = `native-${kind}-${++n}.png`;
    zip.file("word/media/" + file, images[kind].data);
    let rid = "rIdNative" + kind,
      nr = 0;
    const existing = Array.from(
      rels.getElementsByTagNameNS(REL, "Relationship"),
    ).map((n) => n.getAttribute("Id"));
    while (existing.includes(rid)) rid = "rIdNative" + kind + ++nr;
    const relation = rels.createElementNS(REL, "Relationship");
    relation.setAttribute("Id", rid);
    relation.setAttribute(
      "Type",
      "http://schemas.openxmlformats.org/officeDocument/2006/relationships/image",
    );
    relation.setAttribute("Target", "media/" + file);
    rels.documentElement.appendChild(relation);
    const make = () =>
      drawing(doc, nextId++, rid, kind, images[kind], maxWidth);
    const ps = Array.from(doc.getElementsByTagNameNS(W, "p"));
    let placed = false;
    const tokens =
      kind === "logo"
        ? ["{{LOGO}}", "{{LOG_FIN}}"]
        : kind === "stamp"
          ? ["{{STE_FIN}}"]
          : [];
    for (const p of ps) {
      let match = false;
      for (const token of tokens) if (eraseToken(p, token)) match = true;
      if (match) {
        p.appendChild(make());
        placed = true;
      }
    }
    if (
      kind === "letterhead" ||
      (kind === "logo" && !placed && !images.letterhead)
    ) {
      const p = paragraph(doc);
      p.appendChild(make());
      body.insertBefore(p, body.firstChild);
    } else if (kind === "stamp" && !placed) {
      const signature = ps
        .filter((p) =>
          /^\s*\{\{(?:NAM_PEN|NAM_TTD_|PIM_FOR|KETUA|NAM_PI2|NAM_PIM|NAM|PIH_BAR)\}\}\s*$/.test(
            text(p),
          ),
        )
        .at(-1);
      if (signature) {
        const p = paragraph(
          doc,
          signature
            .getElementsByTagNameNS(W, "jc")[0]
            ?.getAttributeNS(W, "val") || "left",
        );
        p.appendChild(make());
        signature.parentNode.insertBefore(p, signature);
        // Reuse the blank signing space when available, instead of adding a page.
        let previous = p.previousSibling;
        let removed = 0;
        while (
          previous &&
          previous.localName === "p" &&
          !text(previous).trim() &&
          !["drawing", "pict", "br", "pageBreakBefore", "sectPr"].some(
            (tag) => previous.getElementsByTagNameNS(W, tag).length,
          ) &&
          removed < 2
        ) {
          const before = previous.previousSibling;
          previous.parentNode.removeChild(previous);
          previous = before;
          removed++;
        }
      } else {
        const p = paragraph(doc, "left");
        p.firstChild.removeChild(p.firstChild.firstChild);
        const r = doc.createElementNS(W, "w:r"),
          t = doc.createElementNS(W, "w:t");
        t.textContent = "Stempel sanggar";
        r.appendChild(t);
        r.appendChild(doc.createElementNS(W, "w:br"));
        p.appendChild(r);
        p.appendChild(make());
        const sect = Array.from(body.childNodes).find(
          (n) => n.localName === "sectPr",
        );
        body.insertBefore(p, sect || null);
      }
    }
  }
  zip.file("word/document.xml", serializer.serializeToString(doc));
  zip.file(relPath, serializer.serializeToString(rels));
  zip.file("[Content_Types].xml", serializer.serializeToString(types));
}
