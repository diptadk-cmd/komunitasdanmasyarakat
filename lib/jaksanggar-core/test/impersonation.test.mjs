import assert from "node:assert/strict";
import test from "node:test";

import {
  createImpersonationState,
  originalImpersonationRef,
  parseImpersonationState,
  resolveImpersonationUser,
  targetImpersonationRef,
} from "../src/impersonation.ts";

test("impersonation tetap menemukan akun ketika ID lokal berbeda antaraplikasi", () => {
  const original = {
    id: "konsol-kurator-id",
    apiId: "api-kurator-1",
    username: "kurator",
  };
  const target = {
    id: "konsol-sanggar-id",
    apiId: "api-sanggar-1",
    username: "sanggar.merah",
  };
  const state = createImpersonationState(original, target);
  const mainUsers = [
    { ...original, id: "main-kurator-id" },
    { ...target, id: "main-sanggar-id" },
  ];

  assert.equal(
    resolveImpersonationUser(mainUsers, originalImpersonationRef(state))?.id,
    "main-kurator-id",
  );
  assert.equal(
    resolveImpersonationUser(mainUsers, targetImpersonationRef(state))?.id,
    "main-sanggar-id",
  );
});

test("username menjadi fallback bila ID API belum tersedia", () => {
  const users = [{ id: "baru", username: "Sanggar.Betawi" }];
  const resolved = resolveImpersonationUser(users, {
    localId: "lama",
    apiId: "api-tidak-ditemukan",
    username: "sanggar.betawi",
  });
  assert.equal(resolved?.id, "baru");
});

test("format sesi lama berbasis ID lokal tetap didukung", () => {
  const state = parseImpersonationState({
    originalUserId: "kurator-lama",
    impersonatedUserId: "target-lama",
  });
  assert.ok(state);
  assert.equal(
    resolveImpersonationUser(
      [{ id: "target-lama", username: "target" }],
      targetImpersonationRef(state),
    )?.username,
    "target",
  );
});

test("payload impersonation yang tidak lengkap ditolak", () => {
  assert.equal(parseImpersonationState({ originalUserId: "kurator" }), null);
});
