import assert from "node:assert/strict";
import test from "node:test";

import {
  isBlockedAccountStatus,
  normalizeAccountStatus,
} from "./account-status";

test("status legacy keanggotaan dinormalisasi menjadi akun aktif", () => {
  for (const status of [undefined, "", "nonaktif", "pending", "ditolak", "keluar"]) {
    assert.equal(normalizeAccountStatus(status), "aktif");
  }
});

test("hanya status diblokir yang menonaktifkan akun", () => {
  assert.equal(normalizeAccountStatus("diblokir"), "diblokir");
  assert.equal(normalizeAccountStatus(" DIBLOKIR "), "diblokir");
  assert.equal(isBlockedAccountStatus("diblokir"), true);
  assert.equal(isBlockedAccountStatus("nonaktif"), false);
});
