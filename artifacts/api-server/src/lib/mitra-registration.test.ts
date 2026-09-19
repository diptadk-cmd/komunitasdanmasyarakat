import assert from "node:assert/strict";
import test from "node:test";
import { validasiDanNormalisasiTokoOfflineMitra } from "./mitra-registration";

test("pendaftaran Mitra ditolak tanpa toko offline", () => {
  assert.deepEqual(
    validasiDanNormalisasiTokoOfflineMitra("mitra_pengrajin", {
      memilikiTokoOffline: false,
      namaTokoOffline: "",
      alamatTokoOffline: "",
    }),
    {
      ok: false,
      error:
        "Mitra wajib mempunyai toko offline, memilih wilayah lengkap DKI Jakarta, dan menandai titik tokonya di peta.",
    },
  );
});

test("pendaftaran Mitra menerima dan merapikan data toko offline", () => {
  const profile: Record<string, unknown> = {
    memilikiTokoOffline: true,
    namaTokoOffline: "  Toko Betawi  ",
    alamatTokoOffline: "  Jalan Melati, Jakarta Selatan  ",
    wilayahTokoOffline: {
      provinsiId: "31",
      kotaId: "3174",
      kecamatanId: "3174010",
      kelurahanId: "3174010001",
    },
    latTokoOffline: -6.24,
    lngTokoOffline: 106.82,
    tanggalTerbitNib: "2026-02-23",
    statusVerifikasiTokoOffline: "terverifikasi",
  };
  assert.deepEqual(
    validasiDanNormalisasiTokoOfflineMitra(
      "mitra_pengrajin",
      profile,
      new Date("2026-08-23T08:00:00.000Z"),
    ),
    { ok: true },
  );
  assert.equal(profile["namaTokoOffline"], "Toko Betawi");
  assert.equal(profile["alamatTokoOffline"], "Jalan Melati, Jakarta Selatan");
  assert.equal(profile["tanggalPermohonanMitra"], "2026-08-23");
  assert.equal(profile["statusVerifikasiTokoOffline"], "belum_lengkap");
});

test("pendaftaran Mitra menolak NIB yang lebih lama dari enam bulan", () => {
  const profile: Record<string, unknown> = {
    memilikiTokoOffline: true,
    namaTokoOffline: "Toko Betawi",
    alamatTokoOffline: "Jalan Melati, Jakarta Selatan",
    wilayahTokoOffline: {
      provinsiId: "31",
      kotaId: "3174",
      kecamatanId: "3174010",
      kelurahanId: "3174010001",
    },
    latTokoOffline: -6.24,
    lngTokoOffline: 106.82,
    tanggalTerbitNib: "2026-02-22",
  };
  assert.deepEqual(
    validasiDanNormalisasiTokoOfflineMitra(
      "mitra_pengrajin",
      profile,
      new Date("2026-08-23T08:00:00.000Z"),
    ),
    {
      ok: false,
      error:
        "Tanggal terbit NIB wajib diisi dan tidak boleh lebih lama dari 6 bulan pada tanggal permohonan.",
    },
  );
});

test("syarat toko offline tidak diterapkan pada peran lain", () => {
  assert.deepEqual(validasiDanNormalisasiTokoOfflineMitra("pengrajin", {}), {
    ok: true,
  });
});
