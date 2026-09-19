import assert from "node:assert/strict";
import test from "node:test";
import { CURATOR_DEMO_ACCOUNT } from "../src/lib/demo-accounts.ts";

test("tombol demo kurator memakai akun skenario yang tersedia tanpa mengaktifkan akun dasar", async () => {
  const values = new Map();
  globalThis.localStorage = {
    get length() { return values.size; },
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(String(key), String(value)); },
    removeItem(key) { values.delete(key); },
    key(index) { return [...values.keys()][index] ?? null; },
    clear() { values.clear(); },
  };
  globalThis.window = { addEventListener() {}, removeEventListener() {}, location: { hostname: "localhost" } };
  const store = await import("../../../lib/jaksanggar-core/src/store.ts");
  store.setStoreDemoMode(true);
  store.resetAll();
  const db = store.load();
  const account = db.users.find((user) => user.username === CURATOR_DEMO_ACCOUNT.username);
  assert.ok(account);
  assert.equal(account.role, "kurator");
  assert.equal(account.password, CURATOR_DEMO_ACCOUNT.password);
  assert.equal(store.LOCAL_DEMO_USERNAMES.has(account.username), true);
  assert.equal(db.users.find((user) => user.username === "demo.kurator").password, "DEMO_DISABLED");
});
