import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs/promises";
import JSZip from "jszip";
import { DOMParser } from "@xmldom/xmldom";
import { validateImages, embedNativeImages } from "./native-images.mjs";
const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const asset = async (name) =>
  "data:image/png;base64," +
  (
    await fs.readFile(
      new URL("./test-assets/" + name + ".png", import.meta.url),
    )
  ).toString("base64");
test("image validation rejects remote paths, incorrect types and damaged data", async () => {
  for (const logo of [
    "https://example.test/logo.png",
    "/etc/passwd",
    "data:image/jpeg;base64,aGVsbG8=",
    "data:image/png;base64,aGVsbG8=",
  ])
    assert.throws(() => validateImages({ logo }), { status: 400 });
  const png = await asset("logo");
  assert.equal(validateImages({ logo: png }).logo.width, 400);
  const malformed = Buffer.from(png.split(",")[1], "base64");
  malformed.writeUInt32BE(20000, 16);
  assert.throws(
    () =>
      validateImages({
        logo: "data:image/png;base64," + malformed.toString("base64"),
      }),
    { status: 400 },
  );
});
test("embedding preserves aspect, unrelated parent logo and original text", async () => {
  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>',
  );
  zip.file(
    "word/document.xml",
    `<w:document xmlns:w="${W}"><w:body><w:p><w:r><w:t>Logo {{LO</w:t></w:r><w:r><w:t>GO}}</w:t></w:r></w:p><w:p><w:r><w:t>{{O_LOGO}}</w:t></w:r></w:p><w:p><w:r><w:t>{{NAM_PEN}}</w:t></w:r></w:p><w:sectPr/></w:body></w:document>`,
  );
  await embedNativeImages(zip, {
    logo: await asset("logo"),
    stamp: await asset("stamp"),
    letterhead: await asset("letterhead"),
  });
  const xml = await zip.file("word/document.xml").async("string");
  assert.ok(xml.includes("{{O_LOGO}}"));
  assert.ok(xml.includes("{{NAM_PEN}}"));
  assert.ok(!xml.includes("{{LOGO}}"));
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  const extents = Array.from(
    doc.getElementsByTagNameNS(
      "http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing",
      "extent",
    ),
  );
  assert.equal(extents.length, 3);
  assert.equal(
    Number(extents[0].getAttribute("cx")) /
      Number(extents[0].getAttribute("cy")),
    5,
  );
  const ids = Array.from(
    doc.getElementsByTagNameNS(
      "http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing",
      "docPr",
    ),
  ).map((n) => n.getAttribute("id"));
  assert.equal(new Set(ids).size, 3);
  assert.equal(
    Object.keys(zip.files).filter((n) => /word\/media\/.*\.png/.test(n)).length,
    3,
  );
});
test("empty image selection leaves document bytes unchanged", async () => {
  const zip = new JSZip();
  zip.file("word/document.xml", "unchanged");
  await embedNativeImages(zip, {});
  assert.equal(
    await zip.file("word/document.xml").async("string"),
    "unchanged",
  );
});
test("real template embeds assets and removed document cannot render", async () => {
  const { nativeRender } = await import("./native-render.mjs");
  const output = await nativeRender({
    format: "word",
    nativeTemplate: {
      groupId: "mandiri-nonbadan-hukum",
      documentId: "anggaran-dasar-sanggar",
      values: { NAM_SA2: "Sanggar Uji" },
      images: {
        logo: await asset("logo"),
        stamp: await asset("stamp"),
        letterhead: await asset("letterhead"),
      },
    },
  });
  const zip = await JSZip.loadAsync(output),
    xml = await zip.file("word/document.xml").async("string");
  assert.ok(xml.includes("SANGGAR UJI"));
  assert.ok(xml.includes("Stempel sanggar"));
  assert.ok(xml.includes("Kop surat sanggar"));
  await assert.rejects(
    nativeRender({
      format: "word",
      nativeTemplate: {
        groupId: "mandiri-nonbadan-hukum",
        documentId: "pernyataan-kedudukan-mandiri",
        values: {},
      },
    }),
    { status: 400 },
  );
});
