import assert from "node:assert/strict";
import test from "node:test";
import {
  catatKehadiran,
  sesiHonorTersedia,
  ajukanHonorLatihan,
} from "../src/lib/latihan-anggota.ts";

function fixture() {
  return {
    users: [
      {
        id: "pelatih",
        role: "pelatih",
        status: "aktif",
        sanggarId: "sg",
        honorPerSesi: 250000,
      },
      { id: "seniman", role: "seniman", status: "aktif", sanggarId: "sg" },
    ],
    latihan: [
      {
        id: "sesi",
        sanggarId: "sg",
        pelatihId: "pelatih",
        laporan: { timestamp: 100 },
      },
    ],
    absensiLatihan: [],
    pengajuanHonor: [],
    activity: [],
  };
}
test("penugasan bukan kehadiran; absen tidak mengganti pelatih dan klik ulang tidak menggandakan", () => {
  const db = fixture();
  assert.equal(sesiHonorTersedia(db, db.users[0]).length, 0);
  for (const userId of ["pelatih", "seniman", "pelatih"])
    catatKehadiran(db, {
      userId,
      latihanId: "sesi",
      id: `hadir-${userId}`,
      now: 101,
    });
  assert.equal(db.latihan[0].pelatihId, "pelatih");
  assert.equal(db.absensiLatihan.length, 2);
  assert.equal(db.activity.length, 2);
  assert.equal(sesiHonorTersedia(db, db.users[0]).length, 1);
});
test("anggota pending dan jadwal sanggar lain tidak dapat dicatat", () => {
  const db = fixture();
  db.users[0].status = "pending";
  assert.throws(
    () =>
      catatKehadiran(db, {
        userId: "pelatih",
        latihanId: "sesi",
        id: "x",
        now: 101,
      }),
    /aktif/,
  );
  db.users[0].status = "aktif";
  db.latihan[0].sanggarId = "lain";
  assert.throws(
    () =>
      catatKehadiran(db, {
        userId: "pelatih",
        latihanId: "sesi",
        id: "x",
        now: 101,
      }),
    /sanggar/,
  );
  assert.equal(db.absensiLatihan.length, 0);
});
test("honor menyimpan ID sesi dan total; sesi pending/lunas tidak dapat diajukan berulang", () => {
  const db = fixture();
  catatKehadiran(db, {
    userId: "pelatih",
    latihanId: "sesi",
    id: "hadir",
    now: 101,
  });
  const request = ajukanHonorLatihan(db, {
    userId: "pelatih",
    id: "honor",
    now: 102,
  });
  assert.deepEqual(request.latihanIds, ["sesi"]);
  assert.equal(request.total, 250000);
  for (const status of ["pending", "disetujui"]) {
    request.status = status;
    assert.throws(
      () =>
        ajukanHonorLatihan(db, {
          userId: "pelatih",
          id: "duplicate",
          now: 103,
        }),
      /belum diajukan/,
    );
  }
  assert.equal(db.pengajuanHonor.length, 1);
  request.status = "ditolak";
  assert.equal(sesiHonorTersedia(db, db.users[0]).length, 1);
});
test("klaim lama melindungi laporan lama dan tarif nonfinite ditolak", () => {
  const db = fixture();
  catatKehadiran(db, {
    userId: "pelatih",
    latihanId: "sesi",
    id: "hadir",
    now: 101,
  });
  db.pengajuanHonor.push({
    id: "legacy",
    pelatihId: "pelatih",
    sanggarId: "sg",
    status: "disetujui",
    createdAt: 101,
  });
  assert.equal(sesiHonorTersedia(db, db.users[0]).length, 0);
  db.pengajuanHonor = [];
  db.users[0].honorPerSesi = Infinity;
  assert.throws(
    () => ajukanHonorLatihan(db, { userId: "pelatih", id: "x", now: 103 }),
    /per sesi/,
  );
});
