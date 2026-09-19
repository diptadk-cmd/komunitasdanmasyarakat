import assert from "node:assert/strict";
import test from "node:test";

class MemoryStorage {
  #values = new Map();

  get length() {
    return this.#values.size;
  }

  clear() {
    this.#values.clear();
  }

  getItem(key) {
    return this.#values.get(key) ?? null;
  }

  key(index) {
    return [...this.#values.keys()][index] ?? null;
  }

  removeItem(key) {
    this.#values.delete(key);
  }

  setItem(key, value) {
    this.#values.set(String(key), String(value));
  }
}

globalThis.localStorage = new MemoryStorage();
globalThis.window = {
  addEventListener() {},
  removeEventListener() {},
};

const { sanggarServerProfile } = await import("../src/store.ts");

test("profil Sanggar mengirim logo, kop surat, dan stempel ke server", () => {
  const profile = sanggarServerProfile({
    logoDataUrl: "data:image/jpeg;base64,TE9HTw==",
    kopSuratDataUrl: "data:image/jpeg;base64,S09Q",
    stempelDataUrl: "data:image/jpeg;base64,U1RFTVBFTA==",
  });

  assert.equal(profile.logoDataUrl, "data:image/jpeg;base64,TE9HTw==");
  assert.equal(profile.kopSuratDataUrl, "data:image/jpeg;base64,S09Q");
  assert.equal(profile.stempelDataUrl, "data:image/jpeg;base64,U1RFTVBFTA==");
});

test("sampul Sanggar ikut dikirim dan pilihan ilustrasi tidak hilang dari PATCH", () => {
  assert.equal(sanggarServerProfile({ fotoSampulDataUrl: "data:image/jpeg;base64,U0FNUFVM" }).fotoSampulDataUrl, "data:image/jpeg;base64,U0FNUFVM");
  assert.equal(sanggarServerProfile({ fotoSampulDataUrl: "" }).fotoSampulDataUrl, "");
  assert.equal(Object.hasOwn(sanggarServerProfile({}), "fotoSampulDataUrl"), false);
});

test("menyimpan dan menghapus sampul menjaga foto profil dan galeri; gagal server memulihkan sampul", async (t) => {
  const store = await import("../src/store.ts");
  const { usersApi } = await import("../src/api.ts");
  const originalUpdate = usersApi.update;
  const submitted = [];
  t.after(() => { usersApi.update = originalUpdate; });
  store.setStoreDemoMode(false);
  store.save((db) => {
    db.users.push({ id: "cover-test", apiId: "api-cover-test", role: "sanggar", username: "cover-test", namaSanggar: "Sanggar Uji", fotoProfileDataUrl: "profile", fotoGaleri: [{ id: "gallery", dataUrl: "gallery", createdAt: 1 }] });
  });
  usersApi.update = async (id, body) => { submitted.push({ id, body }); return {}; };
  assert.deepEqual(await store.persistSanggarProfile("cover-test", "api-cover-test", { fotoSampulDataUrl: "new-cover" }), { server: true });
  assert.equal(submitted[0].body.profile.fotoSampulDataUrl, "new-cover");
  assert.equal(submitted[0].body.profile.fotoProfileDataUrl, "profile");
  assert.equal(submitted[0].body.profile.fotoGaleri[0].dataUrl, "gallery");
  await store.persistSanggarProfile("cover-test", "api-cover-test", { fotoSampulDataUrl: "" });
  assert.equal(submitted[1].body.profile.fotoSampulDataUrl, "");
  usersApi.update = async () => { throw new Error("offline test"); };
  await assert.rejects(store.persistSanggarProfile("cover-test", "api-cover-test", { fotoSampulDataUrl: "failed-cover" }), /offline test/);
  const saved = store.load().users.find((user) => user.id === "cover-test");
  assert.equal(saved.fotoSampulDataUrl, "");
  assert.equal(saved.fotoProfileDataUrl, "profile");
  assert.equal(saved.fotoGaleri[0].dataUrl, "gallery");
});
