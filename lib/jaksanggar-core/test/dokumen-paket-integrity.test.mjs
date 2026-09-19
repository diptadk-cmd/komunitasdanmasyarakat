import assert from "node:assert/strict";
import { access, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { bungkusHtmlDokumenTemplate } from "../../../artifacts/jak-sanggar/src/lib/dokumen-template-layout.ts";

const paketRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../artifacts/jak-sanggar/public/dokumen-paket",
);
const root = path.join(paketRoot, "katalog");
const wordRoot = path.join(paketRoot, "word");
const TOKEN_RE = /\{\{([A-Z0-9_/]+)\}\}/g;
const RESIDU_CONTOH_RE =
  /(?:^|[^\p{L}\p{N}_])(?:Sekar Pandan|Nusantara|Budi|Santoso|Siti|Rahayu|Ahmad Fauzi|Fauzi|Dewi Lestari|Lestari|Mei 2023|15 Mei|Jakarta Timur|Mawar|Senin)(?=$|[^\p{L}\p{N}_])|\[(?:NOMOR|PUKUL|JUMLAH)[^\]]*\]/iu;

function jumlahTag(html, tag, penutup = false) {
  const slash = penutup ? "\\/" : "";
  return (html.match(new RegExp(`<${slash}${tag}\\b`, "gi")) ?? []).length;
}

test("seluruh paket dokumen valid, aman, dan dapat dirender lengkap", async () => {
  const files = (await readdir(root)).filter((file) => file.endsWith(".json"));
  assert.equal(files.length, 15, "katalog paket dokumen wajib tepat 15 paket");
  const paketIds = new Set();
  let jumlahDokumen = 0;
  let jumlahPageBreak = 0;
  let jumlahPaketTemplateWord = 0;

  for (const file of files) {
    const data = JSON.parse(await readFile(path.join(root, file), "utf8"));
    assert.equal(typeof data.paketId, "string", `${file}: paketId wajib ada`);
    assert.ok(!paketIds.has(data.paketId), `${file}: paketId duplikat`);
    paketIds.add(data.paketId);
    assert.ok(
      Array.isArray(data.dokumen) && data.dokumen.length > 0,
      `${file}: dokumen kosong`,
    );

    if (data.wordTemplateAvailable) {
      jumlahPaketTemplateWord += 1;
      const direktoriTemplate = path.join(wordRoot, data.paketId);
      await access(path.join(direktoriTemplate, "paket-lengkap.docx"));
      for (const dokumen of data.dokumen) {
        await access(path.join(direktoriTemplate, `${dokumen.id}.docx`));
      }
    }

    const docIds = new Set();
    for (const dokumen of data.dokumen) {
      jumlahDokumen += 1;
      assert.ok(dokumen.id?.trim(), `${file}: id dokumen wajib ada`);
      assert.ok(
        !docIds.has(dokumen.id),
        `${file}: id dokumen ${dokumen.id} duplikat`,
      );
      docIds.add(dokumen.id);
      assert.ok(
        dokumen.judul?.trim(),
        `${file}/${dokumen.id}: judul wajib ada`,
      );
      assert.ok(dokumen.html?.trim(), `${file}/${dokumen.id}: HTML wajib ada`);
      assert.ok(dokumen.layout, `${file}/${dokumen.id}: layout Word wajib ada`);
      assert.ok(
        dokumen.layout.pageWidthMm > 0 && dokumen.layout.pageHeightMm > 0,
        `${file}/${dokumen.id}: ukuran halaman tidak valid`,
      );
      for (const margin of [
        "marginTopMm",
        "marginRightMm",
        "marginBottomMm",
        "marginLeftMm",
      ]) {
        assert.ok(
          dokumen.layout[margin] >= 0,
          `${file}/${dokumen.id}: ${margin} tidak valid`,
        );
      }
      assert.doesNotMatch(
        dokumen.html,
        /<script\b|<iframe\b|\son\w+\s*=/i,
        `${file}/${dokumen.id}: elemen aktif tidak diizinkan`,
      );

      for (const tag of ["table", "tr", "td", "th"]) {
        assert.equal(
          jumlahTag(dokumen.html, tag),
          jumlahTag(dokumen.html, tag, true),
          `${file}/${dokumen.id}: tag ${tag} tidak seimbang`,
        );
      }
      assert.equal(
        jumlahTag(dokumen.html, "table"),
        (dokumen.html.match(/data-docx-source-table="true"/g) ?? []).length,
        `${file}/${dokumen.id}: metadata tabel Word tidak lengkap`,
      );
      jumlahPageBreak += (
        dokumen.html.match(/dokumen-template__page-break/g) ?? []
      ).length;

      if (data.paketId.startsWith("unit-non-bh-")) {
        assert.doesNotMatch(
          dokumen.html,
          RESIDU_CONTOH_RE,
          `${file}/${dokumen.id}: data contoh masih tersisa`,
        );
      }

      const tokens = [...dokumen.html.matchAll(TOKEN_RE)].map(
        (match) => match[1],
      );
      assert.ok(
        !tokens.includes("PLACEHOLDER"),
        `${file}/${dokumen.id}: token PLACEHOLDER tidak boleh menjadi field`,
      );
      const isian = Object.fromEntries(
        tokens.map((token) => [token, "DATA LENGKAP"]),
      );
      const hasil = dokumen.html.replace(
        TOKEN_RE,
        (match, token) => isian[token] ?? match,
      );
      assert.doesNotMatch(
        hasil,
        TOKEN_RE,
        `${file}/${dokumen.id}: token tersisa setelah render`,
      );

      const dibungkus = bungkusHtmlDokumenTemplate(hasil, {
        dokumenId: dokumen.id,
      });
      assert.match(dibungkus, /data-dokumen-template-root="true"/);
      assert.doesNotMatch(dibungkus, /\{\{[A-Z0-9_/]+\}\}/);
    }
  }

  assert.equal(jumlahDokumen, 147, "jumlah dokumen wajib tepat 147");
  assert.equal(
    jumlahPaketTemplateWord,
    13,
    "13 paket utama wajib memiliki template Word asli",
  );
  assert.equal(
    jumlahPageBreak,
    15,
    "seluruh pemisah halaman eksplisit dari Word wajib dipertahankan",
  );
});
