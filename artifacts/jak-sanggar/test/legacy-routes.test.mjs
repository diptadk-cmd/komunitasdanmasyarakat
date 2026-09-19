import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { matchRoute } from "wouter";
import {
  LEGACY_CONSUMER_ROUTE,
  LEGACY_CURATOR_ROUTE,
  LEGACY_PARTNER_ROUTE,
  legacyConsumerPath,
  legacyPartnerPath,
} from "../src/lib/legacy-routes.ts";

const require = createRequire(import.meta.url);
const { parse } = createRequire(require.resolve("wouter"))("regexparam");

test("alias konsumen menerima akar, trailing slash, dan detail pesanan bertingkat", () => {
  for (const [path, expected] of [
    ["/sewa", "/konsumen"],
    ["/sewa/", "/konsumen"],
    ["/sewa/pesanan", "/konsumen/pesanan"],
    ["/sewa/pesanan/order-123", "/konsumen/pesanan/order-123"],
    ["/sewa/item/item-1", "/konsumen/item/item-1"],
    ["/sewa/katalog/alat%20musik", "/konsumen/katalog/alat%20musik"],
  ]) {
    const [matched, params] = matchRoute(parse, LEGACY_CONSUMER_ROUTE, path);
    assert.equal(matched, true, path);
    assert.equal(legacyConsumerPath(params["*"]), expected);
  }
  assert.equal(matchRoute(parse, LEGACY_CONSUMER_ROUTE, "/sewaan")[0], false);
});

test("alias kurator menerima akar dan tautan lama bertingkat tanpa menangkap peran lain", () => {
  for (const path of [
    "/kurator",
    "/kurator/",
    "/kurator/akun",
    "/kurator/dokumen/template-1",
  ]) {
    assert.equal(matchRoute(parse, LEGACY_CURATOR_ROUTE, path)[0], true, path);
  }
  for (const path of ["/kurator-lain", "/admin", "/sewa"]) {
    assert.equal(matchRoute(parse, LEGACY_CURATOR_ROUTE, path)[0], false, path);
  }
});

test("alias mitra menerima akar, profil, dan pesanan layanan bertingkat", () => {
  for (const [path, expected] of [
    ["/mitra-pengrajin", "/mitra"],
    ["/mitra-pengrajin/", "/mitra"],
    ["/mitra-pengrajin/profil", "/mitra/profil"],
    [
      "/mitra-pengrajin/layanan/pesanan/order-123",
      "/mitra/layanan/pesanan/order-123",
    ],
  ]) {
    const [matched, params] = matchRoute(parse, LEGACY_PARTNER_ROUTE, path);
    assert.equal(matched, true, path);
    assert.equal(legacyPartnerPath(params["*"]), expected);
  }
  assert.equal(
    matchRoute(parse, LEGACY_PARTNER_ROUTE, "/mitra-pengrajin-lain/profil")[0],
    false,
  );
});
