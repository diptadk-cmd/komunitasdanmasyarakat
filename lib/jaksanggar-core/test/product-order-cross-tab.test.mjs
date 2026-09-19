import assert from "node:assert/strict";
import test from "node:test";

class MemoryStorage {
  #values = new Map();

  get length() {
    return this.#values.size;
  }

  clear() {
    this.#values.clear();
  }

  getItem(key) {
    return this.#values.has(key) ? this.#values.get(key) : null;
  }

  key(index) {
    return [...this.#values.keys()][index] ?? null;
  }

  removeItem(key) {
    this.#values.delete(key);
  }

  setItem(key, value) {
    this.#values.set(String(key), String(value));
  }
}

globalThis.localStorage = new MemoryStorage();
globalThis.window = {
  addEventListener() {},
  removeEventListener() {},
};

function makeOrder(db) {
  const mitra = db.users.find((user) => user.role === "mitra_pengrajin");
  const pengrajin = db.users.find((user) => user.role === "pengrajin");
  assert.ok(mitra);
  assert.ok(pengrajin);
  return {
    id: "order-kriya-cross-tab",
    nomor: "ORDER/KRIYA/2026/0002",
    mitraId: mitra.id,
    tujuanTransaksi: "dijual_kembali",
    pengrajinId: pengrajin.id,
    items: [
      {
        produkId: "produk-test",
        nama: "Produk Uji",
        jumlah: 1,
        harga: 100_000,
        satuan: "pcs",
      },
    ],
    alamatPengiriman: "Jakarta",
    targetSelesai: "2026-09-01",
    catatan: "",
    subtotalProduk: 100_000,
    nilaiTotal: 100_000,
    pengiriman: {
      metode: "kurir_paket",
      ongkirTermasukHarga: false,
      penanggungOngkir: "pembeli",
      statusOngkir: "menunggu_penjual",
      biayaOngkir: 0,
    },
    pembayaran: {
      mekanisme: "lunas",
      pembayaranLangsung: true,
      penampungDanaJakSanggar: false,
      disepakatiPembeliAt: 100,
    },
    riwayatPembayaran: [],
    status: "menunggu_ongkir",
    ttd: [],
    createdAt: 100,
    updatedAt: 100,
  };
}

test("status ongkir tidak tertimpa tab stale dan tetap konsisten setelah reload", async () => {
  const sellerTab = await import("../src/store.ts?seller-order-tab");
  sellerTab.resetAll();
  sellerTab.save((db) => db.pesananProdukPengrajin.push(makeOrder(db)));

  const buyerTab = await import("../src/store.ts?buyer-order-tab");
  assert.equal(
    buyerTab.load().pesananProdukPengrajin[0].status,
    "menunggu_ongkir",
  );

  sellerTab.save((db) => {
    const order = db.pesananProdukPengrajin[0];
    order.pengiriman.biayaOngkir = 25_000;
    order.pengiriman.statusOngkir = "disepakati";
    order.pembayaran.disepakatiPenjualAt = 200;
    order.status = "menunggu_persetujuan_ongkir";
    order.updatedAt = 200;
  });

  // Simulasikan tab Mitra yang belum menerima event storage lalu menulis
  // perubahan lain. Save harus rebase dan tidak boleh mengembalikan status lama.
  buyerTab.save((db) => {
    db.appearance.highContrast = !db.appearance.highContrast;
  });

  const persisted = JSON.parse(localStorage.getItem("jaksanggar_v1"));
  assert.equal(
    persisted.pesananProdukPengrajin[0].status,
    "menunggu_persetujuan_ongkir",
  );
  assert.equal(persisted.pesananProdukPengrajin[0].pengiriman.biayaOngkir, 25_000);

  // Cache lama yang sudah menyimpan proposal penjual tetapi membawa status
  // utama lama diperbaiki otomatis pada reload.
  persisted.pesananProdukPengrajin[0].status = "menunggu_ongkir";
  localStorage.setItem("jaksanggar_v1", JSON.stringify(persisted));
  const reloadedTab = await import("../src/store.ts?reloaded-order-tab");
  assert.equal(
    reloadedTab.load().pesananProdukPengrajin[0].status,
    "menunggu_persetujuan_ongkir",
  );
});

test("nomor ORDER duplikat diperbaiki satu kali dan tetap unik", async () => {
  const store = await import("../src/store.ts?duplicate-order-source");
  store.resetAll();
  const db = structuredClone(store.load());
  const first = makeOrder(db);
  const second = {
    ...structuredClone(first),
    id: "order-kriya-cross-tab-later",
    createdAt: 200,
    updatedAt: 200,
  };
  db.pesananProdukPengrajin = [first, second];
  localStorage.setItem("jaksanggar_v1", JSON.stringify(db));

  const migrated = await import("../src/store.ts?duplicate-order-migrated");
  const orders = migrated.load().pesananProdukPengrajin;
  assert.equal(orders[0].nomor, "ORDER/KRIYA/2026/0002");
  assert.equal(new Set(orders.map((order) => order.nomor)).size, 2);
  assert.equal(orders[1].nomor, "ORDER/KRIYA/2026/0003");
});
