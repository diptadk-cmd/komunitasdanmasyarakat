import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildNotices } from "../src/lib/global-notices.ts";

const routes = [...readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8").matchAll(/<Route path="([^"]+)"/g)].map((match) => match[1]);

function hasRoute(href) {
  return routes.some((route) => {
    const segments = route.split("/");
    const target = href.split("/");
    return segments.length === target.length && segments.every((segment, index) => segment.startsWith(":") || segment === target[index]);
  });
}

test("notifikasi pengrajin membuka pesanan produk yang tersedia pada router", () => {
  const notices = buildNotices("pengrajin", { id: "maker" }, {
    pesananProdukPengrajin: [
      { id: "one", pengrajinId: "maker", status: "menunggu_ongkir", nomor: "001", items: [{ nama: "Kostum" }] },
      { id: "two", pengrajinId: "other", status: "diajukan", nomor: "002", items: [{ nama: "Topeng" }] },
      { id: "three", pengrajinId: "maker", status: "selesai", nomor: "003", items: [] },
    ],
  });
  assert.equal(notices.length, 1);
  assert.equal(notices[0].href, "/pengrajin/pesanan-produk");
  assert.equal(hasRoute(notices[0].href), true);
});

test("notifikasi konsumen menuju detail pembayaran dan kontrak milik pengguna", () => {
  const notices = buildNotices("sewa", { id: "buyer" }, {
    pemesananSewa: [
      { id: "pay/1", sewaId: "buyer", status: "menunggu_bayar", nomor: "001", judul: "Acara" },
      { id: "sign-1", sewaId: "buyer", status: "menunggu_ttd", nomor: "002", judul: "Latihan" },
      { id: "private", sewaId: "other", status: "menunggu_bayar", nomor: "003", judul: "Lain" },
    ],
  });
  assert.deepEqual(notices.map(({ href }) => href), ["/konsumen/pesanan/pay%2F1", "/konsumen/pesanan/sign-1"]);
  assert.deepEqual(notices.map(({ title }) => title), ["Pembayaran diperlukan", "Tanda tangan kontrak"]);
  assert.ok(notices.every((notice) => hasRoute(notice.href)));
});
