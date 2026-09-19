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

const store = await import("../src/store.ts");
const kerjasama = await import("../src/kerjasama.ts");
const sewaFlow =
  await import("../../../artifacts/jak-sanggar/src/lib/sewa-flow.ts");
const perdaganganPengrajin =
  await import("../../../artifacts/jak-sanggar/src/lib/perdagangan-pengrajin.ts");

function freshDb() {
  localStorage.clear();
  store.resetAll();
  return store.load();
}

function today() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 10);
}

test("kerja sama memakai data katalog terbaru dan menutup tawaran lama setelah deal", () => {
  const db = freshDb();
  const item = kerjasama.buildKatalog()[0];
  assert.ok(item, "seed harus memiliki item katalog");
  const peminjam = db.users.find(
    (user) => user.role === "sanggar" && user.id !== item.sanggarId,
  );
  assert.ok(peminjam);

  const invalid = kerjasama.createKerjasama({
    katalog: item,
    peminjamSanggarId: peminjam.id,
    actor: { id: peminjam.id, role: "sanggar" },
    tanggalMulai: "2026-08-22",
    tanggalSelesai: "2026-08-21",
    lokasi: "Jakarta",
    jumlah: 1,
    deskripsi: "Uji",
  });
  assert.equal(invalid.ok, false);

  const created = kerjasama.createKerjasama({
    katalog: { ...item, hargaSewa: 1 },
    peminjamSanggarId: peminjam.id,
    actor: { id: peminjam.id, role: "sanggar" },
    tanggalMulai: today(),
    tanggalSelesai: today(),
    lokasi: "  Jakarta  ",
    jumlah: 2,
    deskripsi: " Uji transaksi ",
  });
  assert.equal(created.ok, true, created.reason);
  assert.ok(created.kerjasama);
  assert.equal(created.kerjasama.hargaAwal, item.hargaSewa);
  assert.equal(created.kerjasama.nilaiTotal, item.hargaSewa * 2);
  assert.equal(created.kerjasama.lokasi, "Jakarta");

  const k = created.kerjasama;
  const offerFromBorrower = kerjasama.sendNegosiasi({
    kerjasamaId: k.id,
    pengirimSanggarId: k.sanggarPeminjamId,
    pengirimUserId: k.sanggarPeminjamId,
    hargaTawar: Math.max(1, item.hargaSewa - 10_000),
    catatan: "Tawaran peminjam",
    actor: { id: k.sanggarPeminjamId, role: "sanggar" },
  });
  assert.equal(offerFromBorrower.ok, true, offerFromBorrower.reason);

  const offerFromProvider = kerjasama.sendNegosiasi({
    kerjasamaId: k.id,
    pengirimSanggarId: k.sanggarPenyediaId,
    pengirimUserId: k.sanggarPenyediaId,
    hargaTawar: item.hargaSewa,
    catatan: "Tawaran penyedia",
    actor: { id: k.sanggarPenyediaId, role: "sanggar" },
  });
  assert.equal(offerFromProvider.ok, true, offerFromProvider.reason);

  const borrowerOffer = store
    .load()
    .negosiasi.find(
      (offer) =>
        offer.kerjasamaId === k.id &&
        offer.pengirimSanggarId === k.sanggarPeminjamId,
    );
  assert.ok(borrowerOffer);
  const accepted = kerjasama.applyNegosiasi(borrowerOffer.id, true, {
    id: k.sanggarPenyediaId,
    role: "sanggar",
  });
  assert.equal(accepted.ok, true, accepted.reason);
  assert.equal(
    store.load().kerjasama.find((row) => row.id === k.id)?.status,
    "diterima",
  );
  assert.equal(
    store
      .load()
      .negosiasi.find(
        (offer) =>
          offer.kerjasamaId === k.id &&
          offer.pengirimSanggarId === k.sanggarPenyediaId,
      )?.status,
    "ditolak",
  );

  const lateOffer = kerjasama.sendNegosiasi({
    kerjasamaId: k.id,
    pengirimSanggarId: k.sanggarPeminjamId,
    pengirimUserId: k.sanggarPeminjamId,
    hargaTawar: 1,
    catatan: "Terlambat",
    actor: { id: k.sanggarPeminjamId, role: "sanggar" },
  });
  assert.equal(lateOffer.ok, false);
  assert.match(lateOffer.reason ?? "", /ditutup/i);
});

test("sewa objek membuat kontrak dan wajib dikembalikan sebelum BAST", () => {
  const db = freshDb();
  const penyewa = db.users.find((user) => user.role === "sewa");
  const item = kerjasama
    .buildKatalog()
    .find(
      (candidate) =>
        candidate.sumberType === "aset" || candidate.sumberType === "sarpras",
    );
  assert.ok(penyewa);
  assert.ok(item, "seed harus memiliki aset atau sarpras yang dipublikasikan");

  const created = sewaFlow.createPemesanan({
    katalog: item,
    sewaId: penyewa.id,
    tanggalMulai: today(),
    tanggalSelesai: today(),
    lokasi: "  Balai Kota  ",
    jumlah: 1,
    catatan: " Uji sewa ",
    akomodasiPP: "termasuk",
    biayaAkomodasi: 999_999,
    actor: { id: penyewa.id, role: "sewa" },
  });
  assert.equal(created.ok, true, created.reason);
  assert.ok(created.pemesanan);
  assert.equal(created.pemesanan.biayaAkomodasi, 0);
  assert.equal(created.pemesanan.lokasi, "Balai Kota");

  const p = created.pemesanan;
  assert.equal(
    sewaFlow.terimaPemesanan({
      id: p.id,
      actor: { id: p.sanggarId, role: "sanggar" },
    }).ok,
    true,
  );
  assert.equal(
    sewaFlow.tandaTangan({ id: p.id, actor: { id: p.sewaId, role: "sewa" } })
      .ok,
    true,
  );
  const finalSignature = sewaFlow.tandaTangan({
    id: p.id,
    actor: { id: p.sanggarId, role: "sanggar" },
  });
  assert.equal(finalSignature.ok, true, finalSignature.reason);
  assert.equal(finalSignature.semuaTtd, true);
  assert.equal(
    store.load().pemesananSewa.find((row) => row.id === p.id)?.status,
    "kontrak_aktif",
  );
  assert.ok(
    store.load().contracts.some((contract) => contract.kerjasamaId === p.id),
  );

  const cancelAfterContract = sewaFlow.batalkanPemesanan(p.id, {
    id: p.sewaId,
    role: "sewa",
  });
  assert.equal(cancelAfterContract.ok, false);

  assert.equal(
    sewaFlow.terbitkanInvoice(p.id, 0, { id: p.sanggarId, role: "sanggar" }).ok,
    false,
  );
  const invoice = sewaFlow.terbitkanInvoice(p.id, 7, {
    id: p.sanggarId,
    role: "sanggar",
  });
  assert.equal(invoice.ok, true, invoice.reason);
  assert.ok(invoice.invoice);

  const invalidProof = sewaFlow.uploadBuktiBayar({
    pemesananId: p.id,
    nominal: p.nilaiTotal,
    tanggalBayar: Date.now(),
    buktiDataUrl: "data:text/html;base64,AA==",
    actor: { id: p.sewaId, role: "sewa" },
  });
  assert.equal(invalidProof.ok, false);

  const payment = sewaFlow.uploadBuktiBayar({
    pemesananId: p.id,
    nominal: p.nilaiTotal,
    tanggalBayar: Date.now(),
    buktiDataUrl: "data:image/png;base64,AA==",
    actor: { id: p.sewaId, role: "sewa" },
  });
  assert.equal(payment.ok, true, payment.reason);
  assert.ok(payment.payment);
  assert.equal(
    sewaFlow.verifikasiPembayaran({
      pemesananId: p.id,
      paymentId: payment.payment.id,
      terima: true,
      actor: { id: p.sanggarId, role: "sanggar" },
    }).ok,
    true,
  );
  assert.equal(
    sewaFlow.finalkanBast(p.id, { id: p.sanggarId, role: "sanggar" }).ok,
    false,
  );
  assert.equal(
    sewaFlow.konfirmasiPenyerahanSewa({
      pemesananId: p.id,
      catatan: "Objek diterima penyewa dalam kondisi baik.",
      actor: { id: p.sanggarId, role: "sanggar" },
    }).ok,
    true,
  );
  assert.equal(
    sewaFlow.ajukanPengembalianSewa({
      pemesananId: p.id,
      catatan: "Objek telah dikembalikan lengkap.",
      actor: { id: p.sewaId, role: "sewa" },
    }).ok,
    true,
  );
  assert.equal(
    sewaFlow.verifikasiPengembalianSewa({
      pemesananId: p.id,
      terima: true,
      kondisi: "baik",
      catatan: "Pengembalian diterima.",
      actor: { id: p.sanggarId, role: "sanggar" },
    }).ok,
    true,
  );
  assert.equal(
    sewaFlow.finalkanBast(p.id, { id: p.sanggarId, role: "sanggar" }).ok,
    true,
  );
  assert.equal(
    store.load().pemesananSewa.find((row) => row.id === p.id)?.status,
    "selesai",
  );
});

test("aksi pembatalan langsung menghapus pesanan dan menyimpan jejak aktivitas", () => {
  let db = freshDb();
  const katalogKerjasama = kerjasama.buildKatalog()[0];
  const peminjam = db.users.find(
    (user) => user.role === "sanggar" && user.id !== katalogKerjasama.sanggarId,
  );
  assert.ok(peminjam);
  const kerjaSamaBaru = kerjasama.createKerjasama({
    katalog: katalogKerjasama,
    peminjamSanggarId: peminjam.id,
    actor: { id: peminjam.id, role: "sanggar" },
    tanggalMulai: today(),
    tanggalSelesai: today(),
    lokasi: "Jakarta",
    jumlah: 1,
    deskripsi: "Uji pembatalan",
  });
  assert.equal(kerjaSamaBaru.ok, true, kerjaSamaBaru.reason);
  assert.ok(kerjaSamaBaru.kerjasama);
  assert.equal(
    kerjasama.updateKerjasamaStatus(kerjaSamaBaru.kerjasama.id, "batal", {
      id: peminjam.id,
      role: "sanggar",
    }).ok,
    true,
  );
  db = store.load();
  assert.equal(
    db.kerjasama.some((item) => item.id === kerjaSamaBaru.kerjasama.id),
    false,
  );
  assert.ok(
    db.activity.some(
      (item) =>
        item.action === "kerjasama-status" && item.meta?.status === "batal",
    ),
  );

  db = freshDb();
  const penyewa = db.users.find((user) => user.role === "sewa");
  const katalogSewa = kerjasama
    .buildKatalog()
    .find(
      (item) => item.sumberType === "aset" || item.sumberType === "sarpras",
    );
  assert.ok(penyewa);
  assert.ok(katalogSewa);
  const sewaBaru = sewaFlow.createPemesanan({
    katalog: katalogSewa,
    sewaId: penyewa.id,
    tanggalMulai: today(),
    tanggalSelesai: today(),
    lokasi: "Jakarta",
    jumlah: 1,
    catatan: "Uji pembatalan",
    akomodasiPP: "termasuk",
    biayaAkomodasi: 0,
    actor: { id: penyewa.id, role: "sewa" },
  });
  assert.equal(sewaBaru.ok, true, sewaBaru.reason);
  assert.ok(sewaBaru.pemesanan);
  assert.equal(
    sewaFlow.batalkanPemesanan(sewaBaru.pemesanan.id, {
      id: penyewa.id,
      role: "sewa",
    }).ok,
    true,
  );
  db = store.load();
  assert.equal(
    db.pemesananSewa.some((item) => item.id === sewaBaru.pemesanan.id),
    false,
  );
  assert.ok(
    db.activity.some((item) => item.action === "pemesanan-batal-hapus"),
  );

  db = freshDb();
  const mitra = db.users.find((user) => user.role === "mitra_pengrajin");
  const pengrajin = db.users.find((user) => user.role === "pengrajin");
  assert.ok(mitra);
  assert.ok(pengrajin);
  const pesananProduk = {
    id: "produk-uji-batal",
    nomor: "PRODUK/UJI/001",
    mitraId: mitra.id,
    pengrajinId: pengrajin.id,
    items: [
      {
        produkId: "produk-uji",
        nama: "Produk Uji",
        jumlah: 1,
        harga: 50_000,
        satuan: "buah",
      },
    ],
    alamatPengiriman: "Jakarta",
    targetSelesai: today(),
    catatan: "Uji pembatalan",
    nilaiTotal: 50_000,
    status: "diajukan",
    ttd: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  store.save((state) => state.pesananProdukPengrajin.unshift(pesananProduk));
  perdaganganPengrajin.batalkanPesananProduk(pesananProduk.id, mitra);
  db = store.load();
  assert.equal(
    db.pesananProdukPengrajin.some((item) => item.id === pesananProduk.id),
    false,
  );
  assert.ok(
    db.activity.some((item) => item.action === "pesanan-produk-batal-hapus"),
  );
});

test("pembelian biasa menggabungkan beberapa barang satu Pengrajin ke satu transaksi", () => {
  let db = freshDb();
  let mitra = db.users.find((user) => user.role === "mitra_pengrajin");
  let pengrajin = db.users.find(
    (user) => user.role === "pengrajin" && user.produk.length > 0,
  );
  assert.ok(mitra);
  assert.ok(pengrajin);

  const produkPertama = pengrajin.produk[0];
  const produkKedua = {
    ...structuredClone(produkPertama),
    id: `${produkPertama.id}-tambahan`,
    nama: `${produkPertama.nama} Tambahan`,
    harga: produkPertama.harga + 25_000,
  };
  store.save((state) => {
    const target = state.users.find((user) => user.id === pengrajin.id);
    assert.equal(target?.role, "pengrajin");
    target.produk.push(produkKedua);
  });

  db = store.load();
  mitra = db.users.find((user) => user.id === mitra.id);
  pengrajin = db.users.find((user) => user.id === pengrajin.id);
  assert.equal(mitra?.role, "mitra_pengrajin");
  assert.equal(pengrajin?.role, "pengrajin");

  const pesanan = perdaganganPengrajin.buatPesananProduk({
    mitra,
    pengrajin,
    items: [
      { produk: pengrajin.produk[0], jumlah: 2 },
      { produk: pengrajin.produk[1], jumlah: 3 },
    ],
    alamatPengiriman: "Jakarta",
    targetSelesai: today(),
    metodePengiriman: "kurir_paket",
  });

  const tersimpan = store.load().pesananProdukPengrajin;
  assert.equal(tersimpan.length, 1);
  assert.equal(pesanan.items.length, 2);
  assert.equal(pesanan.pengrajinId, pengrajin.id);
  assert.equal(
    pesanan.subtotalProduk,
    pengrajin.produk[0].harga * 2 + pengrajin.produk[1].harga * 3,
  );
  assert.equal(pesanan.pengiriman.metode, "kurir_paket");
  assert.equal(pesanan.nomor, tersimpan[0].nomor);

  assert.throws(
    () =>
      perdaganganPengrajin.buatPesananProduk({
        mitra,
        pengrajin,
        items: [
          {
            produk: { ...pengrajin.produk[0], id: "produk-pengrajin-lain" },
            jumlah: 1,
          },
        ],
        alamatPengiriman: "Jakarta",
        targetSelesai: today(),
      }),
    /satu Pengrajin/,
  );
});

test("checkout produk memakai harga, rekening dan nama terbaru, bukan snapshot pembeli", () => {
  const db = freshDb();
  const mitra = db.users.find((user) => user.role === "mitra_pengrajin");
  const pengrajin = structuredClone(db.users.find((user) => user.role === "pengrajin" && user.produk.length));
  const produk = structuredClone(pengrajin.produk[0]);
  store.save((draft) => {
    const current = draft.users.find((user) => user.id === pengrajin.id);
    current.produk[0].harga = 123456;
    current.produk[0].nama = "Produk diperbarui";
    current.rekening = { ...current.rekening, nomor: "000123" };
  });
  const pesanan = perdaganganPengrajin.buatPesananProduk({ mitra, pengrajin, produk: { ...produk, harga: 1 }, jumlah: 2, alamatPengiriman: " Jakarta ", targetSelesai: today() });
  assert.equal(pesanan.items[0].harga, 123456);
  assert.equal(pesanan.items[0].nama, "Produk diperbarui");
  assert.equal(pesanan.subtotalProduk, 246912);
  assert.equal(pesanan.rekeningTujuan.nomor, "000123");
  assert.equal(pesanan.alamatPengiriman, "Jakarta");
});

test("produk yang ditarik dari katalog tidak dapat dipesan lewat snapshot lama", () => {
  const db = freshDb();
  const mitra = db.users.find((user) => user.role === "mitra_pengrajin");
  const pengrajin = structuredClone(db.users.find((user) => user.role === "pengrajin" && user.produk.length));
  store.save((draft) => { draft.users.find((user) => user.id === pengrajin.id).produk[0].statusPublish = false; });
  assert.throws(() => perdaganganPengrajin.buatPesananProduk({ mitra, pengrajin, produk: pengrajin.produk[0], jumlah: 1, alamatPengiriman: "Jakarta", targetSelesai: today() }), /tidak tersedia/);
  assert.equal(store.load().pesananProdukPengrajin.length, 0);
});

test("paket memakai harga terkini dan dibatalkan utuh bila salah satu produk hilang", () => {
  const db = freshDb();
  const mitra = db.users.find((user) => user.role === "mitra_pengrajin");
  const pengrajin = db.users.find((user) => user.role === "pengrajin" && user.produk.length);
  const produk = pengrajin.produk[0];
  const paket = { id: "paket-test", items: [{ pengrajinId: pengrajin.id, produkId: produk.id, namaProduk: produk.nama, jumlah: 2, hargaDasar: 1, satuan: produk.satuan }] };
  const pesanan = perdaganganPengrajin.buatPesananDariPaket(mitra, paket, "Jakarta", today());
  assert.equal(pesanan[0].subtotalProduk, produk.harga * 2);
  paket.items.push({ ...paket.items[0], produkId: "sudah-dihapus" });
  const before = store.load().pesananProdukPengrajin.length;
  assert.throws(() => perdaganganPengrajin.buatPesananDariPaket(mitra, paket, "Jakarta", today()), /masih tersedia/);
  assert.equal(store.load().pesananProdukPengrajin.length, before);
});
