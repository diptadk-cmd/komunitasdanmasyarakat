import { readFile, writeFile } from "node:fs/promises";

import { db, pool, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const TARGET_USERNAME = "karaya art";
const TARGET_KEY = "bentukKedudukan";
const CLEAN_BACKUP =
  "C:\\ProgramData\\JakSanggar\\backups\\20260830-single-demo-account-deploy-v12\\account-directory-before.json";
const OPERATION_BACKUP =
  "C:\\ProgramData\\JakSanggar\\backups\\20260830-address-map-sync-before-v13\\profile-karaya-before-non-address-restore.json";

type BackupUser = {
  id: string;
  username: string;
  profile: Record<string, unknown>;
};

function addressSnapshot(profile: Record<string, unknown>) {
  return {
    alamat: profile["alamat"],
    wilayah: profile["wilayah"],
    lat: profile["lat"],
    lng: profile["lng"],
  };
}

async function main(): Promise<void> {
  const backupUsers = JSON.parse(
    await readFile(CLEAN_BACKUP, "utf8"),
  ) as BackupUser[];
  const baseline = backupUsers.find(
    (user) => user.username === TARGET_USERNAME,
  );
  if (!baseline) throw new Error("Akun target tidak ada di cadangan bersih.");
  if (Object.hasOwn(baseline.profile, TARGET_KEY)) {
    throw new Error(`Cadangan lama masih memiliki field ${TARGET_KEY}.`);
  }

  const result = await db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(usersTable)
      .where(eq(usersTable.username, TARGET_USERNAME))
      .limit(2);
    if (rows.length !== 1) {
      throw new Error(`Akun target tidak unik: ${rows.length}.`);
    }
    const current = rows[0];
    if (!Object.hasOwn(current.profile, TARGET_KEY)) {
      throw new Error(`Field ${TARGET_KEY} sudah tidak ada.`);
    }

    await writeFile(
      OPERATION_BACKUP,
      JSON.stringify(
        {
          id: current.id,
          username: current.username,
          profile: current.profile,
        },
        null,
        2,
      ),
      "utf8",
    );

    const beforeAddress = JSON.stringify(addressSnapshot(current.profile));
    const restoredProfile = { ...current.profile };
    delete restoredProfile[TARGET_KEY];
    await tx
      .update(usersTable)
      .set({ profile: restoredProfile })
      .where(eq(usersTable.id, current.id));

    const afterRows = await tx
      .select({ profile: usersTable.profile })
      .from(usersTable)
      .where(eq(usersTable.id, current.id))
      .limit(1);
    const after = afterRows[0]?.profile;
    if (!after || Object.hasOwn(after, TARGET_KEY)) {
      throw new Error(`Field ${TARGET_KEY} belum terhapus.`);
    }
    if (JSON.stringify(after) !== JSON.stringify(restoredProfile)) {
      throw new Error("Profil readback berbeda dari profil hasil pemulihan.");
    }
    if (JSON.stringify(addressSnapshot(after)) !== beforeAddress) {
      throw new Error("Alamat atau koordinat ikut berubah.");
    }

    return { id: current.id, addressUnchanged: true };
  });

  console.log(
    JSON.stringify({
      restored: true,
      username: TARGET_USERNAME,
      fieldRemoved: TARGET_KEY,
      ...result,
    }),
  );
}

main()
  .catch((error: unknown) => {
    console.error("Pemulihan profil non-alamat gagal", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
