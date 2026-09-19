import assert from "node:assert/strict";
import test from "node:test";
import {
  memberProfileEditAccess,
  publicMemberProfile,
  selfMemberProfilePatch,
} from "./member-profile-policy";
import { memberRecordWriteError } from "./member-sync-policy";

const member = {
  id: "p",
  role: "pelatih",
  username: "pelatih",
  profile: {
    nama: "Nama awal",
    status: "aktif",
    sanggarUsername: "sanggar",
    honorPerSesi: 250000,
    rapor: ["diterbitkan-sanggar"],
  },
};
test("self patch mengabaikan status, afiliasi, tarif, rapor dan riwayat pengelola", () => {
  const incoming = {
    nama: "Nama baru",
    id: "akun-lain",
    apiId: "akun-lain",
    username: "kurator",
    role: "kurator",
    password: "dummy",
    createdAt: 0,
    status: "aktif",
    sanggarUsername: "asing",
    sanggarId: "asing",
    sanggarServerId: "asing",
    honorPerSesi: 9000000,
    rapor: ["palsu"],
    mutasiTujuanUsername: "asing",
    pemberhentianAt: 0,
    statusModerasiAkun: "aktif",
  };
  const safe = selfMemberProfilePatch("pelatih", incoming);
  assert.deepEqual(safe, { nama: "Nama baru" });
  assert.equal(incoming.honorPerSesi, 9000000, "input tidak dimutasi");
  assert.deepEqual(
    { ...member.profile, ...safe },
    { ...member.profile, nama: "Nama baru" },
  );
  assert.deepEqual(selfMemberProfilePatch("seniman", incoming), {
    nama: "Nama baru",
  });
});
test("full snapshot profil biasa tetap dapat menyimpan nama, kontak, foto dan portofolio", () => {
  const patch = {
    ...member.profile,
    nama: "Nama baru",
    email: "uji@example.invalid",
    bio: "Biografi",
    fotoProfileDataUrl: "data:image/png;base64,aGVsbG8=",
    portofolio: { karya: ["karya"] },
  };
  const merged: Record<string, unknown> = {
    ...member.profile,
    ...selfMemberProfilePatch(member.role, patch),
  };
  assert.equal(merged.nama, "Nama baru");
  assert.equal(merged.email, patch.email);
  assert.equal(merged.fotoProfileDataUrl, patch.fotoProfileDataUrl);
  assert.deepEqual(merged.portofolio, patch.portofolio);
  assert.equal(merged.honorPerSesi, 250000);
  assert.equal(merged.sanggarUsername, "sanggar");
});
test("hak edit membedakan pemilik profil, pengelola sah, dan akun lain", () => {
  const account = (id: string, role: string, username = id) => ({
    id,
    role,
    username,
    profile: {},
  });
  assert.equal(memberProfileEditAccess(member, member, {}), "self");
  assert.equal(
    memberProfileEditAccess(account("sg", "sanggar", "sanggar"), member, {}),
    "manager",
  );
  assert.equal(
    memberProfileEditAccess(account("k", "kurator"), member, {}),
    "manager",
  );
  assert.equal(
    memberProfileEditAccess(account("sg2", "sanggar", "lain"), member, {}),
    null,
  );
  assert.equal(
    memberProfileEditAccess(account("a", "admin"), member, {}),
    null,
  );
  assert.equal(
    memberProfileEditAccess(account("p2", "pelatih"), member, {}),
    null,
  );
  const unassigned = { ...member, profile: {} };
  assert.equal(
    memberProfileEditAccess(account("sg", "sanggar", "sanggar"), unassigned, {
      sanggarUsername: "sanggar",
    }),
    "manager",
  );
});
test("menyunting profil sendiri tidak dapat menaikkan tarif lalu mengajukan honor palsu", () => {
  const profile = {
    ...member.profile,
    ...selfMemberProfilePatch("pelatih", {
      honorPerSesi: 9000000,
      status: "aktif",
      sanggarUsername: "sanggar",
    }),
  };
  const input = {
    collection: "pengajuanHonor",
    actor: { ...member, profile },
    ownerUsername: "sanggar",
    eligibleSessionIds: new Set(["sesi"]),
    next: {
      pelatihId: "p",
      status: "pending",
      latihanIds: ["sesi"],
      jumlahSesi: 1,
      honorPerSesi: 9000000,
      total: 9000000,
    },
  };
  assert.match(memberRecordWriteError(input) ?? "", /tarif/);
  const pending = {
    ...profile,
    status: "pending",
    ...selfMemberProfilePatch("pelatih", { status: "aktif" }),
  };
  assert.match(
    memberRecordWriteError({
      ...input,
      actor: { ...member, profile: pending },
    }) ?? "",
    /anggota aktif/,
  );
});
test("pendaftaran anggota mempertahankan sanggar tervalidasi dan memerlukan penetapan tarif", () => {
  const profile = publicMemberProfile("pelatih", {
    nama: "Pendaftar",
    sanggarUsername: "sanggar",
    sanggarId: "raw",
    status: "aktif",
    honorPerSesi: 9000000,
    rapor: ["palsu"],
  });
  assert.deepEqual(profile, {
    nama: "Pendaftar",
    sanggarUsername: "sanggar",
    status: "pending",
    honorPerSesi: 0,
  });
});
test("filter anggota tidak mengubah field profil peran lain", () => {
  const adminProfile = { nama: "Admin", permissions: { kelolaBerita: true } };
  assert.deepEqual(selfMemberProfilePatch("admin", adminProfile), adminProfile);
});
