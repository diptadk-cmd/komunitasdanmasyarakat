import assert from "node:assert/strict";
import test from "node:test";

import {
  memerlukanPengembalianSewa,
  stokSetelahPengembalian,
} from "../src/lib/sewa-return.ts";

test("alat, kostum, dan tempat wajib dikontrol sampai pengembalian", () => {
  assert.equal(
    memerlukanPengembalianSewa({ kategori: "alat_musik", sumberType: "aset" }),
    true,
  );
  assert.equal(
    memerlukanPengembalianSewa({ kategori: "kostum", sumberType: "aset" }),
    true,
  );
  assert.equal(
    memerlukanPengembalianSewa({
      kategori: "tempat_latihan",
      sumberType: "sarpras",
    }),
    true,
  );
  assert.equal(
    memerlukanPengembalianSewa({ kategori: "sdm", sumberType: "sdm-seniman" }),
    false,
  );
});

test("stok hanya tersedia kembali jika objek diterima dalam kondisi baik", () => {
  assert.equal(
    stokSetelahPengembalian({
      tersedia: 2,
      total: 5,
      jumlahDikembalikan: 2,
      kondisi: "baik",
    }),
    4,
  );
  assert.equal(
    stokSetelahPengembalian({
      tersedia: 2,
      total: 5,
      jumlahDikembalikan: 2,
      kondisi: "rusak_ringan",
    }),
    2,
  );
  assert.equal(
    stokSetelahPengembalian({
      tersedia: 4,
      total: 5,
      jumlahDikembalikan: 2,
      kondisi: "baik",
    }),
    5,
  );
});
