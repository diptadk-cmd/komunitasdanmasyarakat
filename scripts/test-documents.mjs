import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import assert from "node:assert/strict";
import { ensureDocumentRenderer } from "./start-document-renderer.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(new URL("../services/document-renderer/package.json", import.meta.url));
const JSZip = require("jszip");
const catalog = JSON.parse((await readFile(path.join(root, "artifacts/jak-sanggar/public/dokumen-fix/catalog.json"), "utf8")).replace(/^\uFEFF/, ""));
const out = path.join(root, "output/test-reports/documents");
await mkdir(out, { recursive: true });
await ensureDocumentRenderer();
const results = [];
for (const group of catalog.groups) {
  for (const item of group.documents) {
    // Every native template is rendered to real DOCX; each group also gets a
    // PDF conversion. No account data or production endpoint is used.
    for (const format of item === group.documents[0] ? ["word", "pdf"] : ["word"]) {
      const started = Date.now();
      try {
        const values = Object.fromEntries(item.fields.map(field => [field.key, "DATA UJI " + field.key]));
        const response = await fetch("http://127.0.0.1:3001/render", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ format, nativeTemplate: { groupId: group.id, documentId: item.id, values } }),
          signal: AbortSignal.timeout(60_000),
        });
        assert.equal(response.status, 200, await response.clone().text().then(text => text.slice(0, 160)));
        const bytes = Buffer.from(await response.arrayBuffer());
        assert.ok(bytes.length > 500, "Berkas kosong atau terlalu pendek");
        if (format === "word") {
          const zip = await JSZip.loadAsync(bytes, { checkCRC32: true });
          assert.ok(zip.file("word/document.xml"), "DOCX tidak memiliki naskah");
          assert.ok(zip.file("[Content_Types].xml"), "Paket Word tidak valid");
          const xml = await zip.file("word/document.xml").async("string");
          if (item.fields.length) assert.ok(xml.includes("DATA UJI"), "Isian uji belum masuk ke naskah");
          else assert.ok(xml.includes("<w:body"), "Template kosong tidak memiliki struktur naskah");
        } else {
          assert.equal(bytes.subarray(0, 5).toString(), "%PDF-");
          assert.ok(bytes.subarray(-1024).toString().includes("%%EOF"), "PDF terpotong");
          await writeFile(path.join(out, `${group.id}.pdf`), bytes);
        }
        results.push({ group: group.id, document: item.id, format, status: "lulus", bytes: bytes.length, milliseconds: Date.now() - started });
      } catch (error) {
        results.push({ group: group.id, document: item.id, format, status: "gagal", error: error.message });
      }
    }
  }
  console.log(`${group.id}: ${results.filter(result => result.group === group.id && result.status === "lulus").length} hasil lulus`);
}
const failed = results.filter(result => result.status === "gagal");
await writeFile(path.join(out, "summary.json"), JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2));
console.log(`# tests ${results.length}\n# pass ${results.length - failed.length}\n# fail ${failed.length}\n# skipped 0`);
for (const result of failed) console.error(`${result.group}/${result.document}/${result.format}: ${result.error}`);
process.exitCode = failed.length ? 1 : 0;
