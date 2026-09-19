import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  orderNativeCatalog,
  orderNativeDocuments,
} from "../public/assets/native-document-order-20260919.mjs";

const catalog = JSON.parse(
  await readFile(
    new URL("../public/dokumen-fix/catalog.json", import.meta.url),
    "utf8",
  ),
);

test("semua 14 kelompok memulai urutan dari berita acara pembentukan atau forum penetapan", () => {
  assert.equal(catalog.groups.length, 14);
  for (const group of orderNativeCatalog(catalog).groups) {
    const formation = group.documents.find((document) =>
      /^berita-acara-pembentukan-/.test(document.id),
    );
    const expected =
      formation ??
      group.documents.find(
        (document) => document.id === "berita-acara-forum-penetapan",
      );
    assert.ok(expected, `Berita acara pendirian tidak ditemukan: ${group.id}`);
    assert.equal(group.documents[0].id, expected.id, group.id);
    const ids = group.documents.map((document) => document.id);
    const decisionIndex = ids.findIndex((id) =>
      /^keputusan-pembentukan-/.test(id),
    );
    assert.ok(
      decisionIndex > 0,
      `Keputusan harus sesudah berita acara: ${group.id}`,
    );
    for (const id of ids.filter((id) =>
      /^anggaran-dasar-|^anggaran-rumah-tangga-|^pedoman-(dasar|pelaksanaan)$/.test(
        id,
      ),
    )) {
      assert.ok(
        ids.indexOf(id) > decisionIndex,
        `Aturan dasar harus sesudah keputusan: ${group.id}/${id}`,
      );
    }
    const constitution = ids.findIndex((id) => /^anggaran-dasar-/.test(id));
    const bylaws = ids.findIndex((id) => /^anggaran-rumah-tangga-/.test(id));
    if (constitution !== -1 && bylaws !== -1)
      assert.ok(constitution < bylaws, `AD harus sebelum ART: ${group.id}`);
    if (bylaws !== -1 && ids.includes("pedoman-dasar"))
      assert.ok(
        bylaws < ids.indexOf("pedoman-dasar"),
        `Pedoman unit mengikuti AD/ART organisasi induk: ${group.id}`,
      );
  }
});

test("202 dokumen beserta field, path, hash, dan urutan kelompok tetap utuh", () => {
  const before = JSON.stringify(catalog);
  const ordered = orderNativeCatalog(catalog);
  assert.equal(
    JSON.stringify(catalog),
    before,
    "katalog sumber tidak boleh dimutasi",
  );
  assert.deepEqual(
    ordered.groups.map((group) => group.id),
    catalog.groups.map((group) => group.id),
  );
  assert.equal(
    ordered.groups.reduce((count, group) => count + group.documents.length, 0),
    202,
  );
  for (const [index, group] of ordered.groups.entries()) {
    const original = catalog.groups[index];
    assert.deepEqual(
      group.documents.map((document) => document.id).sort(),
      original.documents.map((document) => document.id).sort(),
    );
    for (const document of group.documents)
      assert.equal(
        document,
        original.documents.find((candidate) => candidate.id === document.id),
      );
  }
});

test("urutan prioritas sama dan dokumen baru tetap stabil tanpa mengubah array asal", () => {
  const input = [
    { id: "baru-z" },
    { id: "data-induk-sanggar" },
    { id: "baru-a" },
    { id: "formulir-data-induk-dan-unit-sanggar" },
    { id: "berita-acara-pembentukan-sanggar" },
  ];
  const snapshot = [...input];
  assert.deepEqual(
    orderNativeDocuments(input).map((document) => document.id),
    [
      "berita-acara-pembentukan-sanggar",
      "data-induk-sanggar",
      "formulir-data-induk-dan-unit-sanggar",
      "baru-z",
      "baru-a",
    ],
  );
  assert.deepEqual(input, snapshot);
});
