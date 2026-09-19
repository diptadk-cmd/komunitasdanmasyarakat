import assert from "node:assert/strict";
import test from "node:test";
import { cashOverview } from "../src/lib/cash-overview.ts";

test("cash overview keeps the same calendar day in different years separate", () => {
  const entries = [
    { tanggal: new Date(2026, 0, 2).getTime(), debit: 5000, kredit: 0 },
    { tanggal: new Date(2025, 0, 2).getTime(), debit: 1000, kredit: 0 },
  ];
  const result = cashOverview(entries);
  assert.equal(result.length, 2);
  assert.deepEqual(result.map(d => d.bersih), [1, 6]);
  assert.equal(entries[0].debit, 5000, "input is not sorted in place");
});

test("cash overview aggregates daily transactions and preserves a negative net flow", () => {
  const result = cashOverview([
    { tanggal: new Date(2026, 8, 19, 8).getTime(), debit: 1000, kredit: 0 },
    { tanggal: new Date(2026, 8, 19, 9).getTime(), debit: 0, kredit: 3500 },
    { tanggal: new Date(2026, 8, 20, 8).getTime(), debit: 500, kredit: 0 },
  ]);
  assert.equal(result.length, 2);
  assert.deepEqual(result.map(d => [d.masuk, d.keluar, d.bersih]), [[1, 3.5, -2.5], [0.5, 0, -2]]);
  assert.deepEqual(cashOverview([]), []);
});
