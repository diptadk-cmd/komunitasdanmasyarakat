import {
  bastTable,
  chatMessagesTable,
  contractsTable,
  db,
  distribusiHonorTable,
  invoicesTable,
  iuranTable,
  kasEntriesTable,
  kerjasamaTable,
  negosiasiTable,
  paymentsTable,
  pemesananSewaTable,
  pengajuanHonorTable,
  pool,
  ratingsTable,
  syncRecordsTable,
  transaksiManualTable,
  usersTable,
} from "@workspace/db";
import { inArray, or } from "drizzle-orm";

const TRANSACTION_COLLECTIONS = new Set([
  "iuran",
  "pengajuanHonor",
  "distribusi",
  "transaksi",
  "kas",
  "kerjasama",
  "chatMessages",
  "negosiasi",
  "invoices",
  "payments",
  "contracts",
  "bast",
  "ratings",
  "pemesananSewa",
  "kerjasamaMitraPengrajin",
  "pesananProdukPengrajin",
]);

const PRIMARY_DEMO_USERNAMES = new Set([
  "penguasa jak1",
  "admin1",
  "juri1",
  "betawi.merah",
  "kembang.setaman",
  "pelatih.iwan",
  "pelatih.nia",
  "ayu.tari",
  "budi.gambang",
  "citra.teater",
  "dewi.calon",
  "pengrajin.demo",
  "mitra.demo",
  "sewa.demo",
]);

function isDemoUsername(username: string): boolean {
  const normalized = username.trim().toLowerCase();
  return (
    PRIMARY_DEMO_USERNAMES.has(normalized) ||
    /^(kurator|admin|sanggar|pelatih|seniman|juri|pengrajin|mitra|konsumen)\.demo(?:0[2-9]|10)$/.test(
      normalized,
    )
  );
}

async function deleteByIds(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  table: typeof syncRecordsTable,
  ids: string[],
): Promise<void> {
  for (let offset = 0; offset < ids.length; offset += 500) {
    await tx
      .delete(table)
      .where(inArray(table.id, ids.slice(offset, offset + 500)));
  }
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");
  const allUsers = await db
    .select({
      id: usersTable.id,
      username: usersTable.username,
      role: usersTable.role,
      profile: usersTable.profile,
    })
    .from(usersTable);
  const demoUsers = allUsers.filter((user) => isDemoUsername(user.username));
  const demoIds = demoUsers.map((user) => user.id);
  const demoIdSet = new Set(demoIds);

  if (demoIds.length === 0) {
    console.log(JSON.stringify({ demoUsers: 0, deleted: {} }));
    return;
  }

  const summary = await db.transaction(async (tx) => {
    const syncRows = (await tx.select().from(syncRecordsTable)).filter(
      (row) =>
        TRANSACTION_COLLECTIONS.has(row.collection) &&
        (demoIdSet.has(row.ownerId) ||
          demoIdSet.has(row.createdBy) ||
          demoIdSet.has(row.updatedBy) ||
          row.participantIds.some((id) => demoIdSet.has(id))),
    );

    const iuranRows = await tx
      .select({ id: iuranTable.id })
      .from(iuranTable)
      .where(
        or(
          inArray(iuranTable.sanggarId, demoIds),
          inArray(iuranTable.senimanId, demoIds),
        ),
      );
    const honorRows = await tx
      .select({ id: pengajuanHonorTable.id })
      .from(pengajuanHonorTable)
      .where(
        or(
          inArray(pengajuanHonorTable.sanggarId, demoIds),
          inArray(pengajuanHonorTable.pelatihId, demoIds),
        ),
      );
    const distribusiRows = await tx
      .select({ id: distribusiHonorTable.id })
      .from(distribusiHonorTable)
      .where(
        or(
          inArray(distribusiHonorTable.sanggarId, demoIds),
          inArray(distribusiHonorTable.penerimaId, demoIds),
        ),
      );
    const transaksiRows = await tx
      .select({ id: transaksiManualTable.id })
      .from(transaksiManualTable)
      .where(inArray(transaksiManualTable.sanggarId, demoIds));
    const kasRows = await tx
      .select({ id: kasEntriesTable.id })
      .from(kasEntriesTable)
      .where(inArray(kasEntriesTable.sanggarId, demoIds));
    const kerjasamaRows = await tx
      .select({ id: kerjasamaTable.id })
      .from(kerjasamaTable)
      .where(
        or(
          inArray(kerjasamaTable.sanggarPenyediaId, demoIds),
          inArray(kerjasamaTable.sanggarPeminjamId, demoIds),
        ),
      );
    const kerjasamaIds = kerjasamaRows.map((row) => row.id);
    const invoiceRows =
      kerjasamaIds.length > 0
        ? await tx
            .select({ id: invoicesTable.id })
            .from(invoicesTable)
            .where(inArray(invoicesTable.kerjasamaId, kerjasamaIds))
        : [];
    const invoiceIds = invoiceRows.map((row) => row.id);
    const sewaRows = await tx
      .select({ id: pemesananSewaTable.id })
      .from(pemesananSewaTable)
      .where(
        or(
          inArray(pemesananSewaTable.sewaId, demoIds),
          inArray(pemesananSewaTable.sanggarId, demoIds),
          inArray(pemesananSewaTable.sdmUserId, demoIds),
        ),
      );

    const saldoCandidates = demoUsers.filter(
      (user) => user.role === "sanggar" && user.profile?.["saldo"] !== 0,
    );
    const planned = {
      syncRecords: syncRows.length,
      iuran: iuranRows.length,
      pengajuanHonor: honorRows.length,
      distribusiHonor: distribusiRows.length,
      transaksiManual: transaksiRows.length,
      kas: kasRows.length,
      kerjasama: kerjasamaRows.length,
      invoices: invoiceRows.length,
      pemesananSewa: sewaRows.length,
      saldoSanggar: saldoCandidates.length,
    };
    if (dryRun) return planned;

    await deleteByIds(
      tx,
      syncRecordsTable,
      syncRows.map((row) => row.id),
    );
    if (invoiceIds.length > 0) {
      await tx
        .delete(paymentsTable)
        .where(inArray(paymentsTable.invoiceId, invoiceIds));
    }
    if (kerjasamaIds.length > 0) {
      await tx
        .delete(chatMessagesTable)
        .where(inArray(chatMessagesTable.kerjasamaId, kerjasamaIds));
      await tx
        .delete(negosiasiTable)
        .where(inArray(negosiasiTable.kerjasamaId, kerjasamaIds));
      await tx
        .delete(contractsTable)
        .where(inArray(contractsTable.kerjasamaId, kerjasamaIds));
      await tx
        .delete(bastTable)
        .where(inArray(bastTable.kerjasamaId, kerjasamaIds));
      await tx
        .delete(ratingsTable)
        .where(inArray(ratingsTable.kerjasamaId, kerjasamaIds));
      await tx
        .delete(invoicesTable)
        .where(inArray(invoicesTable.kerjasamaId, kerjasamaIds));
      await tx
        .delete(kerjasamaTable)
        .where(inArray(kerjasamaTable.id, kerjasamaIds));
    }
    if (iuranRows.length > 0) {
      await tx.delete(iuranTable).where(
        inArray(
          iuranTable.id,
          iuranRows.map((row) => row.id),
        ),
      );
    }
    if (honorRows.length > 0) {
      await tx.delete(pengajuanHonorTable).where(
        inArray(
          pengajuanHonorTable.id,
          honorRows.map((row) => row.id),
        ),
      );
    }
    if (distribusiRows.length > 0) {
      await tx.delete(distribusiHonorTable).where(
        inArray(
          distribusiHonorTable.id,
          distribusiRows.map((row) => row.id),
        ),
      );
    }
    if (transaksiRows.length > 0) {
      await tx.delete(transaksiManualTable).where(
        inArray(
          transaksiManualTable.id,
          transaksiRows.map((row) => row.id),
        ),
      );
    }
    if (kasRows.length > 0) {
      await tx.delete(kasEntriesTable).where(
        inArray(
          kasEntriesTable.id,
          kasRows.map((row) => row.id),
        ),
      );
    }
    if (sewaRows.length > 0) {
      await tx.delete(pemesananSewaTable).where(
        inArray(
          pemesananSewaTable.id,
          sewaRows.map((row) => row.id),
        ),
      );
    }

    for (const user of saldoCandidates) {
      const profile = { ...(user.profile ?? {}) };
      profile["saldo"] = 0;
      await tx
        .update(usersTable)
        .set({ profile })
        .where(inArray(usersTable.id, [user.id]));
    }

    return planned;
  });

  console.log(
    JSON.stringify(
      { dryRun, demoUsers: demoUsers.length, deleted: summary },
      null,
      2,
    ),
  );
}

main()
  .catch((error: unknown) => {
    console.error("Gagal membersihkan transaksi akun demo", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
