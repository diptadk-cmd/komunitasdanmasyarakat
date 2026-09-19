import assert from "node:assert/strict";
import test from "node:test";
import { buildRekapan, ringkasanRekapan } from "../src/rekapan.ts";
import { hapusPesananDibatalkan } from "../src/store.ts";

function dbKosong(users) {
  return {
    users,
    news: [],
    banners: [],
    slider: [],
    latihan: [],
    iuran: [],
    pengajuanHonor: [],
    distribusi: [],
    transaksi: [],
    kas: [],
    kurasiMatrix: { indikator: [], updatedAt: 0 },
    penugasanJuri: [],
    kurasiSubmissions: [],
    sertifikat: [],
    activity: [],
    jamPembinaan: {
      pagiMax: "08:00",
      siangStart: "12:00",
      siangEnd: "13:00",
      pulangStart: "16:00",
      pulangEnd: "17:00",
    },
    absensiPembinaan: [],
    absensiLatihan: [],
    pendaftaranPembinaan: [],
    appearance: {},
    exportPassword: "",
    honorPerSesiDefault: 0,
    aset: [],
    sarpras: [],
    kerjasama: [],
    chatMessages: [],
    negosiasi: [],
    invoices: [],
    payments: [],
    contracts: [],
    bast: [],
    ratings: [],
    pemesananSewa: [],
    kerjasamaMitraPengrajin: [],
    pesananProdukPengrajin: [],
    infoBudaya: [],
    dokumenArsip: [],
    paketIsian: {},
  };
}

test("rekapan akun hanya memuat transaksi dan pencatatan yang terkait", () => {
  const sanggar = {
    id: "sanggar-a",
    role: "sanggar",
    username: "sanggar.a",
    password: "x",
    createdAt: 1,
    namaSanggar: "Sanggar A",
  };
  const sanggarLain = {
    ...sanggar,
    id: "sanggar-b",
    username: "sanggar.b",
    namaSanggar: "Sanggar B",
  };
  const kurator = {
    id: "kurator",
    role: "kurator",
    username: "kurator",
    password: "x",
    createdAt: 1,
  };
  const db = dbKosong([sanggar, sanggarLain, kurator]);
  db.kas.push(
    {
      id: "kas-a",
      sanggarId: sanggar.id,
      tanggal: 100,
      keterangan: "Pemasukan A",
      debit: 100_000,
      kredit: 0,
      saldo: 100_000,
      refType: "manual",
      refId: "a",
    },
    {
      id: "kas-b",
      sanggarId: sanggarLain.id,
      tanggal: 200,
      keterangan: "Pemasukan B",
      debit: 250_000,
      kredit: 0,
      saldo: 250_000,
      refType: "manual",
      refId: "b",
    },
  );
  db.activity.push(
    {
      id: "aktivitas-a",
      actorId: sanggar.id,
      actorRole: "sanggar",
      action: "pemesanan-batal-hapus",
      meta: { nomor: "SEWA/001", nilaiTotal: 75_000 },
      ts: 300,
    },
    {
      id: "aktivitas-b",
      actorId: sanggarLain.id,
      actorRole: "sanggar",
      action: "ubah-profil",
      ts: 400,
    },
  );

  const milikSanggar = buildRekapan(db, sanggar);
  assert.deepEqual(
    milikSanggar.map((row) => row.id),
    ["activity:aktivitas-a", "kas:kas-a"],
  );
  assert.equal(milikSanggar[0].judul, "Pemesanan Batal Hapus");

  const semua = buildRekapan(db, kurator);
  assert.equal(semua.length, 4);
  assert.ok(semua.some((row) => row.id === "kas:kas-b"));
  assert.deepEqual(ringkasanRekapan(semua), {
    totalCatatan: 4,
    totalTransaksi: 2,
    totalPencatatan: 2,
    akumulasiNominal: 350_000,
  });
});

test("pesanan berstatus batal dibersihkan dari semua koleksi pesanan", () => {
  const db = {
    kerjasama: [
      { id: "k-batal", status: "batal" },
      { id: "k-aktif", status: "berjalan" },
    ],
    pemesananSewa: [
      { id: "s-batal", status: "batal" },
      { id: "s-selesai", status: "selesai" },
    ],
    pesananProdukPengrajin: [
      { id: "p-batal", status: "batal" },
      { id: "p-tolak", status: "ditolak" },
    ],
  };

  assert.deepEqual(hapusPesananDibatalkan(db), {
    kerjasama: 1,
    pemesananSewa: 1,
    pesananProdukPengrajin: 1,
  });
  assert.deepEqual(
    db.kerjasama.map((item) => item.id),
    ["k-aktif"],
  );
  assert.deepEqual(
    db.pemesananSewa.map((item) => item.id),
    ["s-selesai"],
  );
  assert.deepEqual(
    db.pesananProdukPengrajin.map((item) => item.id),
    ["p-tolak"],
  );
});
