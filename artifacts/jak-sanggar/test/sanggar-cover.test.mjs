import assert from "node:assert/strict";
import test from "node:test";
import { sanggarCoverCandidates, selectSanggarCover } from "../src/lib/sanggar-cover.ts";

const legacy = { fotoGaleri: [{ id: "first", dataUrl: "gallery-one" }, { id: "second", dataUrl: "gallery-two" }], fotoProfileDataUrl: "profile" };

test("akun tanpa foto memakai ilustrasi", () => {
  assert.deepEqual(selectSanggarCover(sanggarCoverCandidates({}, "art")), { src: "art", kind: "illustration" });
});

test("sampul unggahan sendiri mengalahkan galeri dan foto profil", () => {
  const candidates = sanggarCoverCandidates({ ...legacy, fotoSampulDataUrl: "cover" }, "art");
  assert.deepEqual(candidates.map((item) => item.src), ["cover", "art"]);
});

test("pilihan ilustrasi tetap berlaku walau galeri dan foto profil tersedia", () => {
  assert.deepEqual(sanggarCoverCandidates({ ...legacy, fotoSampulDataUrl: "" }, "art"), [{ src: "art", kind: "illustration" }]);
});

test("akun lama memakai foto galeri pertama, lalu foto profil", () => {
  const candidates = sanggarCoverCandidates(legacy, "art");
  assert.deepEqual(candidates.map((item) => item.src), ["gallery-one", "gallery-two", "profile", "art"]);
  assert.equal(selectSanggarCover(candidates, new Set(["gallery-one"])).src, "gallery-two");
  assert.equal(selectSanggarCover(candidates, new Set(["gallery-one", "gallery-two"])).src, "profile");
});

test("gambar kosong dan duplikat diabaikan; gambar gagal tidak dicoba berulang", () => {
  const candidates = sanggarCoverCandidates({ fotoGaleri: [{ dataUrl: "  " }, { dataUrl: "photo" }, { dataUrl: "photo" }], fotoProfileDataUrl: "photo" }, "art");
  assert.deepEqual(candidates.map((item) => item.src), ["photo", "art"]);
  assert.equal(selectSanggarCover(candidates, new Set(["photo"])).kind, "illustration");
  assert.equal(selectSanggarCover(candidates, new Set(["photo", "art"])), undefined);
});
