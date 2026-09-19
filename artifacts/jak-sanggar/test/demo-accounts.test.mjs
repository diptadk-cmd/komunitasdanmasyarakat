import assert from "node:assert/strict";
import test from "node:test";

import { DEMO_LOGIN_ACCOUNTS } from "../src/lib/demo-accounts.ts";

test("hanya satu akun demo Kurator yang dipertahankan", () => {
  assert.equal(DEMO_LOGIN_ACCOUNTS.length, 1);
  assert.deepEqual(
    DEMO_LOGIN_ACCOUNTS.map(({ username, role }) => ({ username, role })),
    [{ username: "demo.kurator", role: "kurator" }],
  );
  assert.equal(
    DEMO_LOGIN_ACCOUNTS.some((account) => account.role !== "kurator"),
    false,
  );
});
