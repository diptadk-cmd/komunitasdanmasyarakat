import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { pathToFileURL } from "node:url";
import JSZip from "jszip";
import { DOMParser } from "@xmldom/xmldom";
import { nativeRender, replaceFields } from "./native-render.mjs";
import { validateRenderInput } from "./server.mjs";
import {
  nativeTemplateRoot,
  loadNativeCatalog,
  templatePath,
  officePdfArguments,
  removeNativeTemp,
} from "./runtime.mjs";

const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const nativeTemplate = {
  groupId: "mandiri-nonbadan-hukum",
  documentId: "anggaran-dasar-sanggar",
  values: { NAM_SA2: "Sanggar Citra & Rasa" },
};

test("split-run fields preserve user case in body and uppercase only document titles", () => {
  const source = `<w:document xmlns:w="${W}"><w:body><w:p><w:pPr><w:pStyle w:val="Judul1"/></w:pPr><w:r><w:t>{{NAM_</w:t></w:r><w:r><w:t>SA2}}</w:t></w:r></w:p><w:p><w:r><w:t>Nama {{NAM_SA2}}\n{{ALAMAT}}</w:t></w:r></w:p><w:p><w:r><w:t>{{KOSONG}}</w:t></w:r></w:p></w:body></w:document>`;
  const output = replaceFields(source, {
    NAM_SA2: "Sanggar Citra & Rasa",
    ALAMAT: "Jalan Seni\nJakarta",
    KOSONG: "",
  });
  const doc = new DOMParser().parseFromString(output, "application/xml");
  const paragraphs = Array.from(doc.getElementsByTagNameNS(W, "p")).map((p) =>
    Array.from(p.getElementsByTagNameNS(W, "t"))
      .map((t) => t.textContent)
      .join(""),
  );
  assert.deepEqual(paragraphs, [
    "SANGGAR CITRA & RASA",
    "Nama Sanggar Citra & RasaJalan SeniJakarta",
    "{{KOSONG}}",
  ]);
  assert.equal(doc.getElementsByTagNameNS(W, "br").length, 2);
});

test("native Word preserves authored archive parts outside editable document text", async () => {
  const catalog = await loadNativeCatalog();
  const entry = catalog.groups
    .find((g) => g.id === nativeTemplate.groupId)
    .documents.find((d) => d.id === nativeTemplate.documentId);
  const original = await JSZip.loadAsync(
    await fs.readFile(templatePath(nativeTemplateRoot(), entry.path)),
  );
  const result = await JSZip.loadAsync(
    await nativeRender({ format: "word", nativeTemplate }),
  );
  const xml = await result.file("word/document.xml").async("string");
  assert.ok(xml.includes("SANGGAR CITRA &amp; RASA"));
  assert.ok(xml.includes("Sanggar Citra &amp; Rasa"));
  for (const [name, part] of Object.entries(original.files)) {
    if (part.dir || /^word\/(document|header\d+|footer\d+)\.xml$/.test(name))
      continue;
    assert.deepEqual(
      await result.file(name).async("nodebuffer"),
      await part.async("nodebuffer"),
      name,
    );
  }
});

test("native renderer rejects unsupported formats, absent documents and invalid user values", async () => {
  await assert.rejects(nativeRender({ format: "html", nativeTemplate }), {
    status: 400,
  });
  await assert.rejects(
    nativeRender({
      format: "word",
      nativeTemplate: { ...nativeTemplate, documentId: "../../secrets" },
    }),
    { status: 400 },
  );
  for (const value of [42, "x".repeat(10_001), "bad\u0000value"]) {
    await assert.rejects(
      nativeRender({
        format: "word",
        nativeTemplate: { ...nativeTemplate, values: { NAM_SA2: value } },
      }),
      { status: 400 },
    );
  }
});

test("request contract accepts native requests without HTML and rejects malformed payloads", () => {
  assert.equal(
    validateRenderInput({ format: "pdf", nativeTemplate }).format,
    "pdf",
  );
  assert.equal(
    validateRenderInput({ format: "word", html: "<p>Isi</p>" }).format,
    "word",
  );
  for (const input of [
    null,
    [],
    {},
    { format: "pdf" },
    { format: "pdf", nativeTemplate: null },
    { format: "pdf", nativeTemplate: {} },
  ])
    assert.throws(() => validateRenderInput(input), { status: 400 });
});

test("template paths cannot leave the configured asset directory", () => {
  const root = nativeTemplateRoot();
  assert.throws(() => templatePath(root, "../outside.docx"), { status: 400 });
  assert.throws(
    () => templatePath(root, path.resolve(root, "..", "outside.docx")),
    { status: 400 },
  );
  assert.throws(() => templatePath(root, "catalog.json"), { status: 400 });
});

test("LibreOffice profile arguments use an encoded file URL for paths with spaces", () => {
  const directory = path.join(os.tmpdir(), "sanggar-native-space and #hash");
  const args = officePdfArguments(
    directory,
    path.join(directory, "document.docx"),
  );
  assert.equal(
    args[0],
    `-env:UserInstallation=${pathToFileURL(path.join(directory, "profile")).href}`,
  );
  assert.ok(args[0].includes("%20") && args[0].includes("%23"));
  assert.ok(args.includes("pdf:writer_pdf_Export"));
});

test("temporary cleanup rejects a parent directory", async () => {
  await assert.rejects(
    removeNativeTemp(path.resolve(os.tmpdir(), "..")),
    /Direktori sementara renderer tidak valid/,
  );
});
