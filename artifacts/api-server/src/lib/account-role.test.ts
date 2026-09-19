import assert from "node:assert/strict";
import test from "node:test";

import { normalizeLegacyAccountRole } from "./account-role";

test("role legacy kurator_manajemen dinormalisasi menjadi Juri", () => {
  assert.equal(normalizeLegacyAccountRole("kurator_manajemen"), "juri");
});

test("role resmi dipertahankan dan role asing tidak ditebak", () => {
  assert.equal(normalizeLegacyAccountRole(" Sanggar "), "sanggar");
  assert.equal(normalizeLegacyAccountRole("role_tidak_dikenal"), null);
});
