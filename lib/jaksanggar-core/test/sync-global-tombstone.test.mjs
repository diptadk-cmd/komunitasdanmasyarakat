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

const windowListeners = new Map();
globalThis.localStorage = new MemoryStorage();
globalThis.window = {
  addEventListener(type, listener) {
    const listeners = windowListeners.get(type) ?? new Set();
    listeners.add(listener);
    windowListeners.set(type, listeners);
  },
  removeEventListener(type, listener) {
    windowListeners.get(type)?.delete(listener);
  },
};

function emitStorage(key, newValue) {
  for (const listener of windowListeners.get("storage") ?? []) {
    listener({ key, newValue });
  }
}

const jsonResponse = (value) =>
  new Response(JSON.stringify(value), {
    status: 200,
    headers: { "content-type": "application/json" },
  });

test("perubahan store dari tab Konsol langsung diperbarui di tab aplikasi", async () => {
  const store = await import("../src/store.ts");
  store.resetAll();
  const incoming = structuredClone(store.load());
  incoming.appearance.brand.appName = "Identitas dari Konsol";
  const raw = JSON.stringify(incoming);

  localStorage.setItem("jaksanggar_v1", raw);
  emitStorage("jaksanggar_v1", raw);

  assert.equal(store.load().appearance.brand.appName, "Identitas dari Konsol");
});

test("direktori lengkap Kurator mengikuti pengguna database dan membuang seed lokal", async () => {
  const store = await import("../src/store.ts");
  const sync = await import("../src/sync.ts");
  sync.stopDataSync({ clearPending: true });
  localStorage.clear();
  store.resetAll();

  const seededKurator = store
    .load()
    .users.find((user) => user.role === "kurator");
  assert.ok(seededKurator);
  const createdAt = new Date().toISOString();
  const identities = [
    {
      id: "api-kurator-directory",
      username: seededKurator.username,
      role: "kurator",
      profile: {},
      createdAt,
    },
    {
      id: "api-sanggar-production",
      username: "sanggar.production",
      role: "sanggar",
      profile: {
        namaSanggar: "Sanggar Produksi",
        namaKetua: "Ketua Produksi",
        alamat: "Jakarta",
      },
      createdAt,
    },
  ];

  let bootstrapRequestInit;
  globalThis.fetch = async (input, init) => {
    const path = String(input);
    if (path.endsWith("/api/sync/bootstrap")) {
      bootstrapRequestInit = init;
      return jsonResponse({
        directoryComplete: true,
        identities,
        records: [],
      });
    }
    throw new Error(`URL tidak diharapkan: ${path}`);
  };

  await sync.startDataSync({
    id: "api-kurator-directory",
    username: seededKurator.username,
    role: "kurator",
  });

  assert.equal(bootstrapRequestInit?.cache, "no-store");

  const users = store.load().users;
  assert.deepEqual(
    users.map((user) => user.username).sort(),
    [seededKurator.username, "sanggar.production"].sort(),
  );
  assert.equal(
    users.find((user) => user.username === "sanggar.production")?.apiId,
    "api-sanggar-production",
  );
  assert.equal(
    users.find((user) => user.role === "sanggar")?.namaSanggar,
    "Sanggar Produksi",
  );

  sync.stopDataSync({ clearPending: true });
});

test("bootstrap global tidak mengunggah seed/cache lama dan memulihkan snapshot server", async () => {
  const store = await import("../src/store.ts");
  const initial = store.load();
  assert.deepEqual(initial.news, []);
  assert.deepEqual(initial.banners, []);
  assert.deepEqual(initial.slider, []);
  assert.deepEqual(initial.infoBudaya, []);

  const now = Date.now();
  store.save((db) => {
    db.news.push({
      id: "seed-news-pembinaan-2026",
      judul: "Berita seed lama",
      isi: "Tidak boleh naik lagi",
      kategori: "Berita",
      createdAt: now,
      authorId: db.users[0].id,
    });
    db.banners.push({
      id: "banner-random-lama",
      teks: "Periode kurasi sanggar 2026 akan dimulai 1 Mei 2026.",
      start: now,
      end: now + 1_000,
      active: true,
    });
    db.slider.push({
      id: "slider-random-lama",
      imageUrl:
        "https://images.unsplash.com/photo-1583294131-9c11d4d4b4e3?w=1200",
      caption: "Seed lama",
    });
    db.infoBudaya.push({
      id: "demo-info-tari-topeng-betawi-v1",
      judul: "Tari Topeng Betawi",
      ringkasan: "Seed lama",
      isi: "Tidak boleh naik lagi",
      kategori: "Tari",
      sumber: "Dinas Kebudayaan DKI Jakarta",
      active: true,
      publicationStatus: "published",
      order: 1,
      createdAt: now,
      updatedAt: now,
      authorId: db.users[0].id,
    });
  });

  const actor = { id: "api-admin", username: "admin1", role: "admin" };
  localStorage.setItem(
    `${"jaksanggar_sync_outbox_v1"}:${actor.id}`,
    JSON.stringify([
      {
        key: "infoBudaya::demo-info-tari-topeng-betawi-v1",
        mutationId: "legacy-auto-scan",
        collection: "infoBudaya",
        id: "demo-info-tari-topeng-betawi-v1",
        op: "upsert",
        data: { judul: "Tari Topeng Betawi" },
      },
    ]),
  );

  let bootstrapPayload = { identities: [], records: [] };
  const requests = [];
  globalThis.fetch = async (input, init = {}) => {
    const path = String(input);
    requests.push({ path, method: init.method ?? "GET", body: init.body });
    if (path.endsWith("/api/sync/bootstrap")) {
      return jsonResponse(bootstrapPayload);
    }
    if (path.endsWith("/api/sync/mutations")) {
      const mutations = JSON.parse(init.body).mutations;
      return jsonResponse({
        results: mutations.map((mutation) => ({
          mutationId: mutation.mutationId,
          status: "applied",
          record: {
            collection: mutation.collection,
            id: mutation.id,
            data: mutation.data ?? {},
            revision: 1,
            ...(mutation.op === "delete"
              ? { deletedAt: new Date().toISOString() }
              : {}),
          },
        })),
      });
    }
    throw new Error(`URL tidak diharapkan: ${path}`);
  };

  const sync = await import("../src/sync.ts");
  await sync.startDataSync(actor);
  await new Promise((resolve) => setTimeout(resolve, 700));

  assert.deepEqual(store.load().news, []);
  assert.deepEqual(store.load().banners, []);
  assert.deepEqual(store.load().slider, []);
  assert.deepEqual(store.load().infoBudaya, []);
  assert.equal(
    requests.filter((request) => request.path.endsWith("/mutations")).length,
    0,
    "cache lokal tanpa revision tidak boleh dipromosikan menjadi mutasi",
  );
  assert.deepEqual(
    JSON.parse(
      localStorage.getItem(`jaksanggar_sync_outbox_v1:${actor.id}`) ?? "[]",
    ),
    [],
    "outbox hasil auto-scan versi lama harus dibersihkan",
  );

  sync.stopDataSync({ clearPending: true });
  bootstrapPayload = {
    identities: [],
    records: [
      {
        collection: "news",
        id: "server-news",
        revision: 2,
        data: {
          judul: "Berita server",
          isi: "Permanen",
          kategori: "Berita",
          createdAt: now,
          authorId: "user:api-admin",
        },
      },
      {
        collection: "banners",
        id: "server-banner",
        revision: 1,
        data: {
          teks: "Banner server",
          start: now,
          end: now + 1_000,
          active: true,
        },
      },
      {
        collection: "slider",
        id: "server-slider",
        revision: 1,
        data: { imageUrl: "https://example.test/slide.jpg", caption: "Server" },
      },
      {
        collection: "infoBudaya",
        id: "server-media",
        revision: 3,
        data: {
          judul: "Karya server",
          ringkasan: "Permanen",
          isi: "Permanen",
          kategori: "Musik",
          sumber: "Sanggar",
          active: true,
          publicationStatus: "published",
          order: 1,
          createdAt: now,
          updatedAt: now,
          authorId: "user:api-admin",
        },
      },
    ],
  };
  await sync.startDataSync(actor);
  assert.deepEqual(
    store.load().news.map((item) => item.id),
    ["server-news"],
  );
  assert.deepEqual(
    store.load().banners.map((item) => item.id),
    ["server-banner"],
  );
  assert.deepEqual(
    store.load().slider.map((item) => item.id),
    ["server-slider"],
  );
  assert.deepEqual(
    store.load().infoBudaya.map((item) => item.id),
    ["server-media"],
  );
  sync.stopDataSync({ clearPending: true });
});

test("dokumen dan pembayaran sewa ikut disinkronkan sebagai anak pemesanan sewa", async () => {
  const store = await import("../src/store.ts");
  const sync = await import("../src/sync.ts");
  sync.stopDataSync({ clearPending: true });
  localStorage.clear();
  store.resetAll();

  const initial = store.load();
  const sewa = initial.users.find((user) => user.role === "sewa");
  const sanggar = initial.users.find((user) => user.role === "sanggar");
  assert.ok(sewa);
  assert.ok(sanggar);

  const identities = [
    {
      id: "api-sewa",
      username: sewa.username,
      role: "sewa",
      profile: { nama: sewa.nama },
      createdAt: new Date(sewa.createdAt).toISOString(),
    },
    {
      id: "api-sanggar",
      username: sanggar.username,
      role: "sanggar",
      profile: { namaSanggar: sanggar.namaSanggar },
      createdAt: new Date(sanggar.createdAt).toISOString(),
    },
  ];
  const batches = [];
  globalThis.fetch = async (input, init = {}) => {
    const path = String(input);
    if (path.endsWith("/api/sync/bootstrap")) {
      return jsonResponse({ identities, records: [] });
    }
    if (path.endsWith("/api/sync/mutations")) {
      const mutations = JSON.parse(init.body).mutations;
      batches.push(mutations);
      return jsonResponse({
        results: mutations.map((mutation) => ({
          mutationId: mutation.mutationId,
          status: "applied",
          record: {
            collection: mutation.collection,
            id: mutation.id,
            data: mutation.data,
            revision: 1,
          },
        })),
      });
    }
    throw new Error(`URL tidak diharapkan: ${path}`);
  };

  await sync.startDataSync({
    id: "api-sewa",
    username: sewa.username,
    role: "sewa",
  });
  const now = Date.now();
  store.save((db) => {
    db.pemesananSewa.push({
      id: "sewa-sync-parent",
      nomor: "SEWA/TEST/001",
      katalogItemId: "aset-test",
      sumberType: "aset",
      sumberId: "aset-test",
      sewaId: sewa.id,
      sanggarId: sanggar.id,
      judul: "Sewa uji sinkronisasi",
      kategori: "alat_musik",
      tanggalMulai: "2026-08-21",
      tanggalSelesai: "2026-08-21",
      lokasi: "Jakarta",
      jumlah: 1,
      satuanHarga: "per_event",
      catatan: "",
      hargaDasar: 100_000,
      akomodasiPP: "termasuk",
      biayaAkomodasi: 0,
      nilaiTotal: 100_000,
      status: "selesai",
      ttd: [],
      invoiceId: "sewa-sync-invoice",
      bastId: "sewa-sync-bast",
      createdAt: now,
      updatedAt: now,
    });
    db.invoices.push({
      id: "sewa-sync-invoice",
      kerjasamaId: "sewa-sync-parent",
      nomor: "INV/TEST/001",
      total: 100_000,
      status: "lunas",
      batasPembayaran: now,
      createdAt: now,
    });
    db.contracts.push({
      id: "sewa-sync-contract",
      kerjasamaId: "sewa-sync-parent",
      nomor: "KTR/TEST/001",
      createdAt: now,
    });
    db.bast.push({
      id: "sewa-sync-bast",
      kerjasamaId: "sewa-sync-parent",
      nomor: "BAST/TEST/001",
      status: "final",
      createdAt: now,
      finalAt: now,
    });
    db.payments.push({
      id: "sewa-sync-payment",
      invoiceId: "sewa-sync-invoice",
      nominal: 100_000,
      tanggalBayar: now,
      status: "disetujui",
      createdAt: now,
    });
  });

  await new Promise((resolve) => setTimeout(resolve, 800));
  const collections = new Set(
    batches.flat().map((mutation) => mutation.collection),
  );
  for (const collection of [
    "pemesananSewa",
    "invoices",
    "contracts",
    "bast",
    "payments",
  ]) {
    assert.equal(
      collections.has(collection),
      true,
      `${collection} harus ikut antre sinkronisasi`,
    );
  }
  const ordered = batches.flat().map((mutation) => mutation.collection);
  const parentIndex = ordered.indexOf("pemesananSewa");
  for (const child of ["invoices", "contracts", "bast", "payments"]) {
    assert.ok(
      parentIndex < ordered.indexOf(child),
      `parent harus dikirim sebelum ${child}`,
    );
  }
  sync.stopDataSync({ clearPending: true });
});

test("tombstone Media Kreatif bertahan pada save stale, reload, dan event tab lain", async () => {
  const store = await import("../src/store.ts");
  const deletedId = "media-sudah-dihapus";
  const item = {
    id: deletedId,
    judul: "Karya terhapus",
    ringkasan: "",
    isi: "",
    kategori: "Musik",
    sumber: "Sanggar",
    active: false,
    publicationStatus: "pending",
    order: 1,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    authorId: store.load().users[0].id,
  };

  store.rememberInfoBudayaTombstones([deletedId]);
  store.save((db) => db.infoBudaya.push({ ...item }));
  assert.equal(
    store.load().infoBudaya.some((entry) => entry.id === deletedId),
    false,
  );

  const staleDb = structuredClone(store.load());
  staleDb.infoBudaya.push({ ...item });
  localStorage.setItem("jaksanggar_v1", JSON.stringify(staleDb));
  const reloadedStore = await import("../src/store.ts?reload-tombstone");
  assert.equal(
    reloadedStore.load().infoBudaya.some((entry) => entry.id === deletedId),
    false,
    "reload harus menyaring record yang sudah memiliki tombstone",
  );

  const otherTabDeletedId = "media-dihapus-tab-lain";
  reloadedStore.save((db) =>
    db.infoBudaya.push({ ...item, id: otherTabDeletedId }),
  );
  const tombstoneRaw = JSON.stringify({
    version: 1,
    ids: [deletedId, otherTabDeletedId],
  });
  localStorage.setItem(store.INFO_BUDAYA_TOMBSTONES_KEY, tombstoneRaw);
  emitStorage(store.INFO_BUDAYA_TOMBSTONES_KEY, tombstoneRaw);
  assert.equal(
    reloadedStore
      .load()
      .infoBudaya.some((entry) => entry.id === otherTabDeletedId),
    false,
    "event storage dari tab lain harus langsung menyaring cache in-memory",
  );
});

test("transisi moderasi menjaga publicationStatus dan active tetap konsisten", async () => {
  const store = await import("../src/store.ts");
  const item = {
    id: "media-moderasi",
    judul: "Karya untuk moderasi",
    ringkasan: "",
    isi: "",
    kategori: "Musik",
    sumber: "Sanggar",
    active: false,
    publicationStatus: "pending",
    order: 1,
    createdAt: 100,
    updatedAt: 100,
    authorId: "user:sanggar",
  };

  store.applyInfoBudayaModeration(item, "published", { updatedAt: 101 });
  assert.equal(item.publicationStatus, "published");
  assert.equal(item.active, true);
  assert.equal(item.reviewNote, undefined);
  assert.equal(item.updatedAt, 101);

  store.applyInfoBudayaModeration(item, "pending", { updatedAt: 102 });
  assert.equal(item.publicationStatus, "pending");
  assert.equal(item.active, false);
  assert.equal(item.reviewNote, undefined);
  assert.equal(item.updatedAt, 102);

  store.applyInfoBudayaModeration(item, "rejected", {
    note: "Perbaiki media",
    updatedAt: 103,
  });
  assert.equal(item.publicationStatus, "rejected");
  assert.equal(item.active, false);
  assert.equal(item.reviewNote, "Perbaiki media");
  assert.equal(item.updatedAt, 103);
});

test("mutasi transaksi yang ditolak dipulihkan dari server dan dilaporkan ke UI", async () => {
  const store = await import("../src/store.ts");
  const sync = await import("../src/sync.ts");
  sync.stopDataSync({ clearPending: true });
  localStorage.clear();
  store.resetAll();

  const initial = store.load();
  const pengrajin = initial.users.find((user) => user.role === "pengrajin");
  const mitra = initial.users.find(
    (user) => user.role === "mitra_pengrajin",
  );
  assert.ok(pengrajin);
  assert.ok(mitra);

  const now = Date.now();
  const serverOrder = {
    id: "order-rejected-rollback",
    nomor: "ORDER/KRIYA/TEST/REJECTED",
    mitraId: "user:api-mitra-rejected",
    tujuanTransaksi: "dijual_kembali",
    pengrajinId: `username:${encodeURIComponent(pengrajin.username)}`,
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
      disepakatiPembeliAt: now,
    },
    riwayatPembayaran: [],
    status: "menunggu_ongkir",
    ttd: [],
    createdAt: now,
    updatedAt: now,
  };
  const bootstrapPayload = {
    identities: [
      {
        id: "api-pengrajin-rejected",
        username: pengrajin.username,
        role: "pengrajin",
        profile: { namaUsaha: pengrajin.namaUsaha },
        createdAt: new Date(pengrajin.createdAt).toISOString(),
      },
      {
        id: "api-mitra-rejected",
        username: mitra.username,
        role: "mitra_pengrajin",
        profile: { namaUsaha: mitra.namaUsaha },
        createdAt: new Date(mitra.createdAt).toISOString(),
      },
    ],
    records: [
      {
        collection: "pesananProdukPengrajin",
        id: serverOrder.id,
        data: serverOrder,
        revision: 1,
      },
    ],
  };
  let bootstrapCount = 0;
  globalThis.fetch = async (input, init = {}) => {
    const path = String(input);
    if (path.endsWith("/api/sync/bootstrap")) {
      bootstrapCount += 1;
      return jsonResponse(bootstrapPayload);
    }
    if (path.endsWith("/api/sync/mutations")) {
      const mutations = JSON.parse(init.body).mutations;
      return jsonResponse({
        results: mutations.map((mutation) => ({
          mutationId: mutation.mutationId,
          status: "rejected",
          error: "Penolakan uji dari server.",
        })),
      });
    }
    throw new Error(`URL tidak diharapkan: ${path}`);
  };

  const issues = [];
  const unsubscribe = sync.subscribeDataSyncRejections((issue) =>
    issues.push(issue),
  );
  await sync.startDataSync({
    id: "api-pengrajin-rejected",
    username: pengrajin.username,
    role: "pengrajin",
  });
  store.save((db) => {
    const order = db.pesananProdukPengrajin.find(
      (item) => item.id === serverOrder.id,
    );
    assert.ok(order?.pengiriman);
    order.status = "menunggu_persetujuan_ongkir";
    order.pengiriman.statusOngkir = "disepakati";
    order.pengiriman.biayaOngkir = 25_000;
    order.updatedAt = now + 1;
  });

  await new Promise((resolve) => setTimeout(resolve, 900));

  const restored = store
    .load()
    .pesananProdukPengrajin.find((item) => item.id === serverOrder.id);
  assert.equal(bootstrapCount, 2, "snapshot server harus dimuat ulang");
  assert.equal(restored?.status, "menunggu_ongkir");
  assert.equal(restored?.pengiriman?.biayaOngkir, 0);
  assert.deepEqual(issues, [
    {
      collection: "pesananProdukPengrajin",
      id: serverOrder.id,
      error: "Penolakan uji dari server.",
    },
  ]);

  bootstrapPayload.records[0] = {
    ...bootstrapPayload.records[0],
    revision: 2,
    data: {
      ...serverOrder,
      status: "menunggu_ttd",
      nilaiTotal: 125_000,
      pengiriman: {
        ...serverOrder.pengiriman,
        statusOngkir: "disepakati",
        biayaOngkir: 25_000,
      },
      updatedAt: now + 2,
    },
  };
  await sync.refreshDataSync();

  const refreshed = store
    .load()
    .pesananProdukPengrajin.find((item) => item.id === serverOrder.id);
  assert.equal(bootstrapCount, 3, "tab aktif harus menarik snapshot terbaru");
  assert.equal(refreshed?.status, "menunggu_ttd");
  assert.equal(refreshed?.pengiriman?.biayaOngkir, 25_000);

  unsubscribe();
  sync.stopDataSync({ clearPending: true });
});
