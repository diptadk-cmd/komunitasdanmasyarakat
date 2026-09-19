import assert from "node:assert/strict";
import test from "node:test";
class MemoryStorage {
  values = new Map();
  clear() {
    this.values.clear();
  }
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
Object.defineProperty(globalThis.navigator, "onLine", {
  configurable: true,
  value: true,
});
const store = await import("../src/store.ts");
const sync = await import("../src/sync.ts");
const response = (value) =>
  new Response(JSON.stringify(value), {
    headers: { "content-type": "application/json" },
  });

for (const role of ["pelatih", "seniman"]) {
  test(`${role}: aksi pribadi masuk antrean dan hasil server diperbarui tanpa menulis kas/jadwal`, async () => {
    sync.stopDataSync({ clearPending: true });
    localStorage.clear();
    store.resetAll();
    const actor = store
      .load()
      .users.find(
        (u) => u.role === role && u.status === "aktif" && u.sanggarId,
      );
    const owner = store.load().users.find((u) => u.id === actor.sanggarId);
    const apiActor = {
      id: `api-${role}`,
      username: actor.username,
      role,
      status: "aktif",
      profile: { ...actor, sanggarUsername: owner.username },
      createdAt: new Date().toISOString(),
    };
    const sent = [];
    const bootstrap = {
      identities: [
        apiActor,
        {
          id: "api-sanggar",
          username: owner.username,
          role: "sanggar",
          profile: { namaSanggar: owner.namaSanggar },
          createdAt: new Date().toISOString(),
        },
      ],
      records: [],
    };
    globalThis.fetch = async (url, init = {}) => {
      if (String(url).endsWith("/api/sync/bootstrap"))
        return response(bootstrap);
      if (String(url).endsWith("/api/sync/mutations")) {
        const mutations = JSON.parse(init.body).mutations;
        sent.push(...mutations);
        return response({
          results: mutations.map((item) => ({
            mutationId: item.mutationId,
            status: "applied",
            record: {
              collection: item.collection,
              id: item.id,
              data: item.data,
              revision: 1,
            },
          })),
        });
      }
      throw new Error(`Unexpected URL ${url}`);
    };
    try {
      await sync.startDataSync(apiActor);
      store.save((db) => {
        const me = db.users.find((u) => u.username === actor.username);
        const sg = db.users.find((u) => u.username === owner.username);
        me.sanggarId = sg.id;
        db.kas.push({ id: "forbidden-kas", sanggarId: sg.id, debit: 1 });
        db.latihan.push({
          id: "forbidden-jadwal",
          sanggarId: sg.id,
          pelatihId: me.id,
        });
        db.distribusi.push({
          id: "own-distribusi",
          sanggarId: sg.id,
          penerimaId: me.id,
          penerimaRole: role,
          konfirmasi: true,
        });
        db.distribusi.push({
          id: "other-distribusi",
          sanggarId: sg.id,
          penerimaId: "other",
          penerimaRole: role,
          konfirmasi: true,
        });
        if (role === "pelatih") {
          db.absensiLatihan.push({
            id: "own-attendance",
            latihanId: "sesi",
            userId: me.id,
            sanggarId: sg.id,
            role,
            hadirAt: 1,
          });
          db.pengajuanHonor.push({
            id: "own-honor",
            sanggarId: sg.id,
            pelatihId: me.id,
            latihanIds: ["sesi"],
            jumlahSesi: 1,
            honorPerSesi: 100,
            total: 100,
            status: "pending",
            createdAt: 1,
          });
        } else
          db.iuran.push({
            id: "own-iuran",
            sanggarId: sg.id,
            senimanId: me.id,
            nominal: 100,
            status: "pending",
            buktiDataUrl: "data:application/pdf;base64,JVBERg==",
          });
      });
      assert.equal(await sync.waitForServer(), true);
      assert.ok(sent.some((item) => item.id === "own-distribusi"));
      assert.ok(
        sent.some(
          (item) =>
            item.id === (role === "pelatih" ? "own-honor" : "own-iuran"),
        ),
      );
      assert.ok(
        !sent.some((item) =>
          ["forbidden-kas", "forbidden-jadwal", "other-distribusi"].includes(
            item.id,
          ),
        ),
      );
      if (role === "pelatih")
        assert.ok(
          sent.findIndex((item) => item.id === "own-attendance") <
            sent.findIndex((item) => item.id === "own-honor"),
        );
      const persisted = JSON.parse(localStorage.getItem("jaksanggar_v1"));
      assert.ok(
        persisted.distribusi.some(
          (item) => item.id === "own-distribusi" && item.konfirmasi,
        ),
      );
    } finally {
      sync.stopDataSync({ clearPending: true });
    }
  });
}
