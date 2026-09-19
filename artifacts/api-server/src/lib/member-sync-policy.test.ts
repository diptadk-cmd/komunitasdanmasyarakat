import assert from "node:assert/strict";
import test from "node:test";
import { memberRecordWriteError } from "./member-sync-policy";
const pelatih = {
  id: "p",
  role: "pelatih",
  profile: {
    status: "aktif",
    sanggarUsername: "sanggar",
    honorPerSesi: 250000,
  },
};
const seniman = {
  id: "s",
  role: "seniman",
  profile: { status: "aktif", sanggarUsername: "sanggar" },
};
const proof = "data:application/pdf;base64,JVBERi0xLjQKJSVFT0Y=";
const honor = {
  pelatihId: "p",
  status: "pending",
  latihanIds: ["latihan"],
  jumlahSesi: 1,
  honorPerSesi: 250000,
  total: 250000,
};
test("pengajuan honor hanya milik pelatih aktif dengan sesi hadir/terlapor dan tarif benar", () => {
  const input = {
    collection: "pengajuanHonor",
    actor: pelatih,
    ownerUsername: "SANGGAR",
    next: honor,
    eligibleSessionIds: new Set(["latihan"]),
    claimedSessionIds: new Set<string>(),
  };
  assert.equal(memberRecordWriteError(input), undefined);
  for (const patch of [
    { total: 1 },
    { pelatihId: "lain" },
    { latihanIds: ["latihan", "latihan"], jumlahSesi: 2 },
    { status: "disetujui" },
    { paidAt: 1 },
  ])
    assert.ok(
      memberRecordWriteError({ ...input, next: { ...honor, ...patch } }),
    );
  assert.ok(
    memberRecordWriteError({
      ...input,
      claimedSessionIds: new Set(["latihan"]),
    }),
  );
  assert.ok(
    memberRecordWriteError({ ...input, eligibleSessionIds: new Set() }),
  );
  assert.ok(
    memberRecordWriteError({ ...input, ownerUsername: "sanggar-lain" }),
  );
  assert.ok(memberRecordWriteError({ ...input, before: honor }));
  assert.ok(
    memberRecordWriteError({
      ...input,
      actor: { ...pelatih, profile: { ...pelatih.profile, status: "pending" } },
    }),
  );
});
test("bukti iuran boleh dikirim tanpa membuka hak mengubah nominal atau melunasi sendiri", () => {
  const before = { senimanId: "s", nominal: 75000, status: "ditolak" };
  const next = { ...before, status: "pending", buktiDataUrl: proof };
  const input = {
    collection: "iuran",
    actor: seniman,
    ownerUsername: "sanggar",
    before,
    next,
  };
  assert.equal(memberRecordWriteError(input), undefined);
  for (const patch of [
    { nominal: 1 },
    { status: "lunas" },
    { senimanId: "lain" },
    { buktiDataUrl: "transfer.pdf" },
  ])
    assert.ok(
      memberRecordWriteError({ ...input, next: { ...next, ...patch } }),
    );
  assert.ok(
    memberRecordWriteError({
      ...input,
      before: { ...before, status: "lunas" },
    }),
  );
  assert.ok(memberRecordWriteError({ ...input, before: undefined }));
});
test("konfirmasi distribusi hanya mengubah tanda terima pemilik", () => {
  const before = {
    penerimaId: "p",
    penerimaRole: "pelatih",
    nominal: 100000,
    konfirmasi: false,
  };
  const input = {
    collection: "distribusi",
    actor: pelatih,
    ownerUsername: "sanggar",
    before,
    next: { ...before, konfirmasi: true },
  };
  assert.equal(memberRecordWriteError(input), undefined);
  assert.ok(
    memberRecordWriteError({ ...input, next: { ...input.next, nominal: 1 } }),
  );
  assert.ok(memberRecordWriteError({ ...input, actor: seniman }));
  assert.ok(
    memberRecordWriteError({
      ...input,
      before: { ...before, konfirmasi: true },
    }),
  );
});
