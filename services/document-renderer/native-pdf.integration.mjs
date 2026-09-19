import test from "node:test";
import assert from "node:assert/strict";
import { PDFDocument } from "pdf-lib";
import { nativeRender } from "./native-render.mjs";
import { rendererHealth } from "./runtime.mjs";

// Explicit integration command: requires LibreOffice, never starts HTTP or Chromium.
test("native health reports the complete catalog and LibreOffice capability", async () => {
  const health = await rendererHealth();
  assert.equal(health.service, "jaksanggar-document-renderer");
  assert.equal(health.nativeTemplates.documents, 202);
  assert.deepEqual(health.nativeTemplates.missing, []);
  assert.equal(health.libreOffice.available, true, health.libreOffice.error);
  assert.equal(health.capabilities.nativePdf, true);
  assert.equal(health.ok, true);
});

test(
  "real native Word template converts into a complete PDF on this platform",
  { timeout: 60_000 },
  async () => {
    const output = await nativeRender({
      format: "pdf",
      nativeTemplate: {
        groupId: "mandiri-nonbadan-hukum",
        documentId: "anggaran-dasar-sanggar",
        values: { NAM_SA2: "Sanggar Uji Renderer Lokal" },
      },
    });
    assert.equal(output.subarray(0, 5).toString(), "%PDF-");
    assert.ok(output.length > 1000);
  const document = await PDFDocument.load(output);
  assert.ok(document.getPageCount() > 0);
  for (const page of document.getPages()) {
    assert.ok(page.getWidth() > 0 && page.getHeight() > 0);
  }
    assert.match(output.subarray(-1024).toString(), /%%EOF/);
  },
);
