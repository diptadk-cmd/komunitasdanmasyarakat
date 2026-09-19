/** Explicit synthetic-only local API for browser QA. Never a production entry. */
export {};
const configured = new URL(process.env["MARIADB_URL"] ?? "mysql://invalid");
if (configured.hostname !== "127.0.0.1" || configured.port !== "3308" || configured.pathname !== "/communications_qa") throw new Error("QA API only supports the isolated loopback communications_qa database.");
const [{ db, usersTable }, { hashPassword }, { default: app }] = await Promise.all([import("@workspace/db"), import("../lib/auth"), import("../app")]);
const passwordHash = await hashPassword("qa-only-20260915!");
const sanggarId = "10000000-0000-4000-8000-000000000001";
const fixtures = [
  { id: sanggarId, username: "qa.sanggar", role: "sanggar", profile: { namaSanggar: "Sanggar Rona Budaya", namaKetua: "Ketua Pengujian", legalitas: "Non-Badan Hukum", jenisKesenian: ["Tari", "Musik"], alamat: "Jalan Contoh, Jakarta", rekening: { bank: "DKI", nomor: "0000000000", atasNama: "Sanggar Uji" }, saldo: 2850000, editCount: 0, editPeriodStart: Date.now(), email: "sanggar@example.test" } },
  { id: "10000000-0000-4000-8000-000000000002", username: "qa.seniman", role: "seniman", profile: { nama: "Seniman Pengujian", sanggarId, jenisKesenian: "Tari", status: "aktif", usia: 25, pendidikan: "SMA", rekening: { bank: "DKI", nomor: "0000000001", atasNama: "Seniman Uji" }, email: "seniman@example.test" } },
  { id: "10000000-0000-4000-8000-000000000003", username: "qa.kurator", role: "kurator", profile: { nama: "Kurator Pengujian", email: "kurator@example.test" } },
  { id: "10000000-0000-4000-8000-000000000004", username: "qa.pelatih", role: "pelatih", profile: { nama: "Pelatih Pengujian", sanggarId, jenisKesenian: "Tari", status: "aktif", usia: 35, pendidikan: "S1", rekening: { bank: "DKI", nomor: "0000000002", atasNama: "Pelatih Uji" }, email: "pelatih@example.test" } },
];
for (const fixture of fixtures) await db.insert(usersTable).values({ ...fixture, passwordHash, status: "aktif" }).onDuplicateKeyUpdate({ set: { username: fixture.username } });
app.listen(3018, "127.0.0.1", () => process.stdout.write("Synthetic communications QA API: http://127.0.0.1:3018 (qa.sanggar, qa.seniman, qa.kurator, qa.pelatih)\n"));
