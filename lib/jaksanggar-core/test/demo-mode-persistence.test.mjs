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
    return this.#values.has(key) ? this.#values.get(key) : null;
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

const store = await import("../src/store.ts");
const kurasi = await import("../src/kurasi-sync.ts");

const NON_KURATOR_DEMO_GROUPS = [
  ["sanggar", "betawi.merah", "sanggar", "sanggar123"],
  ["admin", "admin1", "admin", "admin123"],
  ["pelatih", "pelatih.iwan", "pelatih", "pelatih123"],
  ["seniman", "ayu.tari", "seniman", "seniman123"],
  ["juri", "juri1", "juri", "juri123"],
  ["pengrajin", "pengrajin.demo", "pengrajin", "pengrajin123"],
  ["mitra_pengrajin", "mitra.demo", "mitra", "mitra1234"],
  ["sewa", "sewa.demo", "konsumen", "sewa1234"],
];

test("mode demo menyediakan 10 akun aktif untuk setiap peran non-kurator", () => {
  localStorage.clear();
  store.setStoreDemoMode(true);
  store.resetAll();

  const db = store.load();
  for (const collection of [
    "iuran",
    "pengajuanHonor",
    "distribusi",
    "transaksi",
    "kas",
    "kerjasama",
    "chatMessages",
    "negosiasi",
    "invoices",
    "payments",
    "contracts",
    "bast",
    "ratings",
    "pemesananSewa",
    "kerjasamaMitraPengrajin",
    "pesananProdukPengrajin",
  ]) {
    assert.equal(db[collection].length, 0, `${collection} harus kosong`);
  }
  assert.equal(
    db.users
      .filter((user) => user.role === "sanggar")
      .every((user) => user.saldo === 0),
    true,
  );
  let checked = 0;
  for (const [role, primary, prefix, password] of NON_KURATOR_DEMO_GROUPS) {
    const usernames = [
      primary,
      ...Array.from(
        { length: 9 },
        (_, offset) => `${prefix}.demo${String(offset + 2).padStart(2, "0")}`,
      ),
    ];
    assert.equal(new Set(usernames).size, 10);
    for (const username of usernames) {
      const user = db.users.find(
        (candidate) =>
          candidate.username.toLowerCase() === username.toLowerCase(),
      );
      assert.ok(user, `${username} harus tersedia`);
      assert.equal(user.role, role);
      assert.equal(user.password, password);
      if (role === "pelatih" || role === "seniman") {
        assert.equal(user.status, "aktif");
      }
      checked += 1;
    }
  }
  assert.equal(checked, 80);

  store.save((draft) => {
    draft.users = draft.users.filter(
      (user) => user.username !== "konsumen.demo10",
    );
    const seniman = draft.users.find(
      (user) => user.username === "seniman.demo06",
    );
    if (seniman?.role === "seniman") {
      seniman.password = "password-lama";
      seniman.status = "pending";
    }
  });
  store.ensureLocalDemoAccounts(store.load());
  assert.equal(
    store.load().users.find((user) => user.username === "konsumen.demo10")
      ?.password,
    "sewa1234",
  );
  const repaired = store
    .load()
    .users.find((user) => user.username === "seniman.demo06");
  assert.equal(repaired?.password, "seniman123");
  assert.equal(repaired?.role === "seniman" ? repaired.status : null, "aktif");
});

test("mode demo menyimpan aksi konsol secara lokal tanpa memanggil API", async (t) => {
  const originalFetch = globalThis.fetch;
  let apiCalls = 0;
  globalThis.fetch = async () => {
    apiCalls += 1;
    throw new Error("API tidak boleh dipanggil dalam mode demo");
  };
  t.after(() => {
    store.setStoreDemoMode(false);
    globalThis.fetch = originalFetch;
  });

  localStorage.clear();
  store.resetAll();
  store.setStoreDemoMode(true);

  await store.persistSetting("honorPerSesiDefault", 375_000);
  await store.persistAppearance((appearance) => {
    appearance.highContrast = true;
  });

  const db = store.load();
  const juri = db.users.find((user) => user.role === "juri");
  const sanggar = db.users.find((user) => user.role === "sanggar");
  assert.ok(juri);
  assert.ok(sanggar);
  await kurasi.createKurasiAssignment(
    juri.username,
    sanggar.username,
    "Uji Demo",
  );

  const memberTemplate = db.users.find((user) => user.role === "pelatih");
  assert.ok(memberTemplate);
  const member = {
    ...structuredClone(memberTemplate),
    id: "anggota-mode-demo",
    username: "anggota.mode.demo",
  };
  const memberResult = await store.createMemberAccount(
    member,
    "sandi-demo-123",
  );

  const saved = store.load();
  assert.equal(saved.honorPerSesiDefault, 375_000);
  assert.equal(saved.appearance.highContrast, true);
  assert.ok(saved.penugasanJuri.some((item) => item.periode === "Uji Demo"));
  assert.equal(memberResult.server, false);
  assert.equal(
    saved.users.find((user) => user.id === member.id)?.password,
    "sandi-demo-123",
  );
  assert.equal(apiCalls, 0);
});
