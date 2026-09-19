import assert from "node:assert/strict";
import test from "node:test";
import { juriScoringAccessError } from "../src/lib/kurasi-access.ts";

test("Juri hanya melihat pengajuan yang ditugaskan; peran/assignment lain ditolak", () => {
  const db = {
    users: [
      { id: "j", role: "juri", username: "juri" },
      { id: "s", role: "seniman", username: "seniman" },
    ],
    penugasanJuri: [{ juriId: "j", sanggarId: "sg" }],
    kurasiSubmissions: [{ sanggarId: "sg", finalized: {} }],
  };
  assert.equal(juriScoringAccessError(db, "j", "sg"), undefined);
  assert.match(juriScoringAccessError(db, "j", "lain"), /belum ditugaskan/);
  assert.match(juriScoringAccessError(db, "s", "sg"), /belum ditugaskan/);
  db.kurasiSubmissions = [];
  assert.match(juriScoringAccessError(db, "j", "sg"), /belum mengirim/);
});
test("nilai final tetap terbaca tetapi perubahan ditolak, termasuk setelah penugasan dicabut", () => {
  const db = {
    users: [{ id: "j", role: "juri", username: "juri" }],
    penugasanJuri: [{ juriId: "j", sanggarId: "sg" }],
    kurasiSubmissions: [{ sanggarId: "sg", finalized: { juri: 1 } }],
  };
  assert.equal(juriScoringAccessError(db, "j", "sg"), undefined);
  assert.match(juriScoringAccessError(db, "j", "sg", true), /terkunci/);
  db.penugasanJuri = [];
  assert.match(juriScoringAccessError(db, "j", "sg", true), /belum ditugaskan/);
});
