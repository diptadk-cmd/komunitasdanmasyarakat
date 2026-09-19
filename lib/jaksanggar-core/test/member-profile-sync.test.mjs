import assert from "node:assert/strict";
import test from "node:test";
class MemoryStorage {
  values = new Map();
  getItem(key) {
    return this.values.get(key) ?? null;
  }
  setItem(key, value) {
    this.values.set(key, String(value));
  }
  removeItem(key) {
    this.values.delete(key);
  }
}
globalThis.localStorage = new MemoryStorage();
globalThis.window = { addEventListener() {}, removeEventListener() {} };
const store = await import("../src/store.ts");

test("hasil edit profil anggota memakai kembali status/tarif otoritatif dari server", async () => {
  store.resetAll();
  const actor = store.load().users.find((user) => user.role === "pelatih");
  store.save((db) => {
    db.users.find((user) => user.id === actor.id).apiId = "api-pelatih";
  });
  const owner = store.load().users.find((user) => user.id === actor.sanggarId);
  globalThis.fetch = async (url, init) => {
    assert.equal(String(url), "/api/members/api-pelatih");
    const body = JSON.parse(init.body);
    assert.equal(body.profile.nama, "Nama tersimpan");
    return new Response(
      JSON.stringify({
        id: "api-pelatih",
        username: actor.username,
        role: "pelatih",
        status: "aktif",
        createdAt: new Date(actor.createdAt).toISOString(),
        profile: {
          ...body.profile,
          status: "aktif",
          sanggarUsername: owner.username,
          honorPerSesi: 250000,
        },
      }),
      { headers: { "content-type": "application/json" } },
    );
  };
  const result = await store.persistMember(actor.id, (member) => {
    member.nama = "Nama tersimpan";
    member.honorPerSesi = 9000000;
    member.status = "pending";
  });
  assert.equal(result.server, true);
  const saved = store.load().users.find((user) => user.id === actor.id);
  assert.equal(saved.nama, "Nama tersimpan");
  assert.equal(saved.honorPerSesi, 250000);
  assert.equal(saved.status, "aktif");
});
