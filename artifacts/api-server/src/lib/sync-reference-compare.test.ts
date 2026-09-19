import assert from "node:assert/strict";
import test from "node:test";
import { sameJsonWithResolvedUserReferences } from "./sync-reference-compare";

const referenceKeys = new Set(["mitraId", "pengrajinId", "userId"]);
const byRawValue = new Map([
  ["username:pengrajin.demo02", "pengrajin-api-id"],
  ["user:pengrajin-api-id", "pengrajin-api-id"],
  ["user:mitra-api-id", "mitra-api-id"],
]);

test("alias username dan user id dibandingkan sebagai akun yang sama", () => {
  assert.equal(
    sameJsonWithResolvedUserReferences({
      left: "username:pengrajin.demo02",
      right: "user:pengrajin-api-id",
      rootKey: "pengrajinId",
      byRawValue,
      referenceKeys,
    }),
    true,
  );
});

test("perubahan rincian bisnis tetap terdeteksi", () => {
  assert.equal(
    sameJsonWithResolvedUserReferences({
      left: {
        pengrajinId: "username:pengrajin.demo02",
        items: [{ nama: "Produk A", jumlah: 1 }],
      },
      right: {
        pengrajinId: "user:pengrajin-api-id",
        items: [{ nama: "Produk A", jumlah: 2 }],
      },
      byRawValue,
      referenceKeys,
    }),
    false,
  );
});

test("referensi user bersarang dan object key ikut dikanonisasi", () => {
  assert.equal(
    sameJsonWithResolvedUserReferences({
      left: {
        ttd: [{ userId: "username:pengrajin.demo02" }],
        finalized: { "username:pengrajin.demo02": true },
      },
      right: {
        ttd: [{ userId: "user:pengrajin-api-id" }],
        finalized: { "user:pengrajin-api-id": true },
      },
      byRawValue,
      referenceKeys,
    }),
    true,
  );
});
