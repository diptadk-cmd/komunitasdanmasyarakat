import assert from "node:assert/strict";
import test from "node:test";

import { validateImpersonationTarget } from "./impersonation-policy";

test("Login As menerima akun non-Kurator yang aktif", () => {
  assert.deepEqual(
    validateImpersonationTarget({ role: "sanggar", status: "aktif" }),
    { ok: true },
  );
});

test("Login As menerima status akun legacy karena bukan status blokir", () => {
  assert.deepEqual(
    validateImpersonationTarget({ role: "seniman", status: "pending" }),
    { ok: true },
  );
});

test("Login As menolak akun yang tidak ditemukan", () => {
  const result = validateImpersonationTarget(null);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.status, 404);
});

test("Login As menerima akun Kurator lain", () => {
  assert.deepEqual(
    validateImpersonationTarget({ role: "kurator", status: "aktif" }),
    { ok: true },
  );
});

test("Login As menolak akun yang diblokir", () => {
  const result = validateImpersonationTarget({
    role: "sanggar",
    status: "diblokir",
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.status, 403);
});
