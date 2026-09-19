import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Studio Kurator mengunduh Word/PDF dan tidak lagi menawarkan HTML", async () => {
  const source = await readFile(
    new URL("../src/pages/kurator/KuratorDokumen.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /unduh\("word"\)/);
  assert.match(source, /unduh\("pdf"\)/);
  assert.match(source, /Unduh Word/);
  assert.match(source, /Unduh PDF/);
  assert.doesNotMatch(source, /Unduh HTML|\.html`/);
  assert.match(source, /user\.role !== "kurator"/);
  assert.match(source, /kurator-office-library/);
  assert.match(source, /preview-kurator-dokumen/);
  assert.match(source, /kanvas-penyunting-scroll/);
  assert.match(source, /h-\[calc\(100dvh-250px\)\]/);
  assert.match(source, /overflow-auto/);
  assert.match(source, /overscroll-contain/);
});
