import assert from "node:assert/strict";
import test from "node:test";

import { publicSanggarFromAccount, publicSanggarDirectoryFromAccount } from "./public-sanggar";

test("peta Sanggar memakai alamat dan koordinat profil akun", () => {
  const item = publicSanggarFromAccount({
    id: "sanggar-1",
    profile: {
      namaSanggar: "Sanggar Betawi",
      alamat: "Jl. Condet Raya, Jakarta Timur",
      lat: -6.2855,
      lng: 106.8587,
    },
  });
  assert.deepEqual(item && {
    id: item.id,
    alamat: item.alamat,
    lat: item.lat,
    lng: item.lng,
  }, {
    id: "sanggar-1",
    alamat: "Jl. Condet Raya, Jakarta Timur",
    lat: -6.2855,
    lng: 106.8587,
  });
});

test("peta Sanggar meneruskan logo publik dari profil akun", () => {
  const item = publicSanggarFromAccount({
    id: "sanggar-logo",
    profile: {
      namaSanggar: "Sanggar Berlogo",
      alamat: "Jl. Raya Jakarta No. 10",
      lat: -6.2855,
      lng: 106.8587,
      logoDataUrl: "data:image/jpeg;base64,TE9HTw==",
    },
  });

  assert.equal(item?.logoDataUrl, "data:image/jpeg;base64,TE9HTw==");
});

test("peta tidak membuat marker palsu untuk akun tanpa alamat atau titik", () => {
  assert.equal(
    publicSanggarFromAccount({
      id: "tanpa-titik",
      profile: { namaSanggar: "Sanggar Tanpa Titik" },
    }),
    null,
  );
});

test("peta menolak koordinat placeholder pusat Jakarta", () => {
  assert.equal(
    publicSanggarFromAccount({
      id: "titik-placeholder",
      profile: {
        namaSanggar: "Sanggar Belum Di-geocode",
        alamat: "Alamat akun yang belum memiliki titik nyata",
        lat: -6.2,
        lng: 106.8,
      },
    }),
    null,
  );
});

test("alamat dapat dirangkai dari field wilayah akun", () => {
  const item = publicSanggarFromAccount({
    id: "sanggar-2",
    profile: {
      namaSanggar: "Sanggar Wilayah",
      kelurahan: "Srengseng Sawah",
      kecamatan: "Jagakarsa",
      kota: "Jakarta Selatan",
      provinsi: "DKI Jakarta",
      kodePos: "12640",
      lat: "-6.3402",
      lng: "106.8218",
    },
  });
  assert.equal(
    item?.alamat,
    "Srengseng Sawah, Jagakarsa, Jakarta Selatan, DKI Jakarta, 12640",
  );
});

test("direktori menampilkan pendaftaran Sanggar tanpa alamat atau koordinat", () => {
  const source = { id: "registered-without-map", role: "sanggar", status: "aktif", profile: { namaSanggar: "Sanggar Baru", jenisKesenian: [" Musik ", "Tari", "Musik", null], wilayah: { kota: "Jakarta Timur", provinsi: "DKI Jakarta" } } };
  assert.equal(publicSanggarFromAccount(source), null);
  assert.deepEqual(publicSanggarDirectoryFromAccount(source), { id: source.id, namaSanggar: "Sanggar Baru", jenisKesenian: ["Musik", "Tari"], kota: "Jakarta Timur", provinsi: "DKI Jakarta" });
});

test("direktori hanya memproyeksikan identitas sanggar dan wilayah publik", () => {
  const result = publicSanggarDirectoryFromAccount({ id: "private-fields", role: "sanggar", status: "aktif", profile: {
    namaSanggar: "Sanggar Uji", jenisKesenian: ["Tari"], kelurahan: "Kelurahan Uji", kecamatan: "Kecamatan Uji", kota: "Jakarta Selatan", provinsi: "DKI Jakarta",
    username: "private", email: "private@example.test", noHp: "private", namaKetua: "private", alamat: "Private street address", lat: -6.31, lng: 106.8,
    rekening: { nomor: "private" }, saldo: 999, members: ["private"], dokumen: ["private"], deskripsi: "private", npwp: "private", wilayah: { kodePos: "private", kecamatanId: "private" },
  } });
  assert.deepEqual(Object.keys(result!).sort(), ["id", "namaSanggar", "jenisKesenian", "kelurahan", "kecamatan", "kota", "provinsi"].sort());
  assert.ok(!JSON.stringify(result).includes("private@example.test"));
  assert.ok(!JSON.stringify(result).includes("Private street address"));
  assert.equal((result as any).alamat, undefined); assert.equal((result as any).lat, undefined); assert.equal((result as any).namaKetua, undefined);
});

test("direktori mengecualikan akun diblokir dan peran selain sanggar", () => {
  const source = { id: "excluded", role: "sanggar", status: "diblokir", profile: { namaSanggar: "Tidak Ditampilkan" } };
  assert.equal(publicSanggarDirectoryFromAccount(source), null);
  assert.equal(publicSanggarDirectoryFromAccount({ ...source, status: " DIBLOKIR " }), null);
  assert.equal(publicSanggarDirectoryFromAccount({ ...source, role: "seniman", status: "aktif" }), null);
});

test("nama kosong tidak diklaim terverifikasi dan wilayah bersarang diprioritaskan", () => {
  const result = publicSanggarDirectoryFromAccount({ id: "unnamed", role: "sanggar", status: "aktif", profile: { namaSanggar: " ", kota: "Kota Lama", wilayah: { kota: "Jakarta Barat", kecamatan: "Kecamatan Uji" } } });
  assert.equal(result?.namaSanggar, "Sanggar belum bernama"); assert.equal(result?.kota, "Jakarta Barat"); assert.equal(result?.kecamatan, "Kecamatan Uji");
});

test("direktori memilih satu gambar publik dan tidak meneruskan URL gambar sembarang", () => {
  const source = { id: "images", role: "sanggar", status: "aktif", profile: { namaSanggar: "Sanggar Gambar", logoDataUrl: "data:image/png;base64,AAAA", fotoProfileDataUrl: "data:image/jpeg;base64,BBBB" } };
  const result = publicSanggarDirectoryFromAccount(source); assert.equal(result?.logoDataUrl, source.profile.logoDataUrl); assert.equal(result?.fotoProfileDataUrl, undefined);
  const fallback = publicSanggarDirectoryFromAccount({ ...source, profile: { ...source.profile, logoDataUrl: "javascript:alert(1)" } }); assert.equal(fallback?.logoDataUrl, undefined); assert.equal(fallback?.fotoProfileDataUrl, source.profile.fotoProfileDataUrl);
  const remote = publicSanggarDirectoryFromAccount({ ...source, profile: { logoDataUrl: "https://example.invalid/tracker", fotoProfileDataUrl: "data:image/svg+xml;base64,AAAA" } }); assert.equal(remote?.logoDataUrl, undefined); assert.equal(remote?.fotoProfileDataUrl, undefined);
});
