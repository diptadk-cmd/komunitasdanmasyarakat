import {
  activityLogTable,
  db,
  syncRecordsTable,
  usersTable,
} from "@workspace/db";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { logger } from "./logger";
import {
  historicalDeletionForCanonicalMedia,
  shouldInitializeCanonicalCreativeMedia,
} from "./creative-media";

interface CanonicalWork {
  id: string;
  authorUsername: string;
  data: Record<string, unknown>;
}

const day = 86_400_000;
const seedTime = Date.UTC(2026, 7, 18, 0, 0, 0);

/** ID tetap mencegah browser/perangkat baru membuat salinan seed yang sama. */
export const CANONICAL_CREATIVE_MEDIA: CanonicalWork[] = [
  {
    id: "demo-info-tari-topeng-betawi-v1",
    authorUsername: "Penguasa jak1",
    data: {
      judul: "Tari Topeng Betawi",
      ringkasan:
        "Tarian topeng khas Betawi yang lahir dari tradisi keliling kampung. Memadukan tari, musik, dan teater rakyat.",
      isi: "Tari Topeng Betawi adalah seni pertunjukan rakyat yang berkembang di pinggiran Jakarta sejak abad ke-19. Penari mengenakan tiga jenis topeng — Panji, Samba, dan Jingga — yang masing-masing membawa karakter berbeda. Diiringi musik gambang kromong dan rebana, pertunjukan ini biasa hadir di pesta hajatan, khitanan, sampai panen.",
      mediaUrl: "https://www.youtube.com/watch?v=kzB-1SfD2wk",
      mediaContentType: "video/youtube",
      mediaKind: "youtube",
      imageUrl:
        "https://images.unsplash.com/photo-1583394293214-28a4b0028b1c?w=1600",
      kategori: "Tari",
      sumber: "Dinas Kebudayaan DKI Jakarta",
      publicationStatus: "published",
      active: true,
      order: 1,
      createdAt: seedTime - 5 * day,
      updatedAt: seedTime - 5 * day,
    },
  },
  {
    id: "demo-info-gambang-kromong-v1",
    authorUsername: "Penguasa jak1",
    data: {
      judul: "Gambang Kromong",
      ringkasan:
        "Orkes khas Betawi yang memadukan alat musik Tionghoa dan pribumi. Bukti hidup akulturasi panjang di Jakarta.",
      isi: "Gambang Kromong lahir dari perpaduan alat musik Tionghoa (kongahyan, tehyan, sukong) dengan alat musik pribumi (gambang, kromong, gendang). Lagu-lagunya seperti 'Jali-Jali', 'Kicir-Kicir', dan 'Surilang' jadi identitas Jakarta. Hari ini gambang kromong sering dipakai mengiringi lenong, tari cokek, hingga upacara pernikahan adat Betawi.",
      mediaUrl: "https://www.youtube.com/watch?v=6asiKnZ3WZ4",
      mediaContentType: "video/youtube",
      mediaKind: "youtube",
      imageUrl:
        "https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=1600",
      kategori: "Musik",
      sumber: "Lembaga Kebudayaan Betawi",
      publicationStatus: "published",
      active: true,
      order: 2,
      createdAt: seedTime - 4 * day,
      updatedAt: seedTime - 4 * day,
    },
  },
  {
    id: "demo-info-lenong-v1",
    authorUsername: "Penguasa jak1",
    data: {
      judul: "Lenong Denes & Lenong Preman",
      ringkasan:
        "Teater rakyat Betawi penuh humor, dialek khas, dan kritik sosial. Dua versi: Denes (kerajaan) dan Preman (rakyat).",
      isi: "Lenong adalah teater rakyat Betawi yang memadukan dialog jenaka, lagu, dan tari. Lenong Denes mengangkat cerita kerajaan dengan kostum mewah, sedangkan Lenong Preman bercerita tentang jagoan kampung dengan bahasa sehari-hari yang nyablak. Tokoh ikonik seperti Si Jampang dan Si Pitung sering jadi lakon utama.",
      imageUrl:
        "https://images.unsplash.com/photo-1503095396549-807759245b35?w=1600",
      mediaKind: "image",
      kategori: "Teater",
      sumber: "Pusat Studi Betawi UI",
      publicationStatus: "published",
      active: true,
      order: 3,
      createdAt: seedTime - 3 * day,
      updatedAt: seedTime - 3 * day,
    },
  },
  {
    id: "demo-info-kerak-telor-v1",
    authorUsername: "admin1",
    data: {
      judul: "Kerak Telor — Kuliner Identitas",
      ringkasan:
        "Hidangan ikonik Betawi yang mulai langka. Beras ketan, telur bebek, ebi, kelapa serundeng — dibakar di anglo.",
      isi: "Kerak Telor adalah penganan khas Betawi yang dulu disajikan untuk tamu kehormatan kompeni Belanda di pesta Pemerintah Hindia Belanda. Bahan utamanya beras ketan putih, telur bebek atau ayam, ebi (udang kering halus), bawang goreng, kelapa sangrai, dan bumbu rempah. Saat ini kerak telor jadi ikon Pekan Raya Jakarta dan festival budaya Betawi.",
      imageUrl:
        "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=1600",
      mediaKind: "image",
      kategori: "Kuliner",
      sumber: "Kompendium Kuliner Nusantara",
      publicationStatus: "published",
      active: true,
      order: 4,
      createdAt: seedTime - 2 * day,
      updatedAt: seedTime - 2 * day,
    },
  },
  {
    id: "demo-info-palang-pintu-v1",
    authorUsername: "admin1",
    data: {
      judul: "Palang Pintu — Tradisi Pernikahan",
      ringkasan:
        "Tradisi penyambutan rombongan pengantin pria dengan adu pantun, silat beksi, dan baca shalawat sebelum diizinkan masuk.",
      isi: "Palang Pintu adalah tradisi adat dalam pernikahan Betawi. Saat rombongan pengantin pria tiba di kediaman pengantin perempuan, jagoan dari kedua pihak akan beradu pantun dan silat beksi. Setelah saling mengalahkan secara simbolis, diakhiri dengan lantunan shalawat dan rombongan diperbolehkan masuk. Tradisi ini menggambarkan keterbukaan, kesopanan, dan keberanian khas masyarakat Betawi.",
      imageUrl:
        "https://images.unsplash.com/photo-1591604466107-ec97de577aff?w=1600",
      mediaKind: "image",
      kategori: "Upacara",
      sumber: "Lembaga Kebudayaan Betawi",
      publicationStatus: "published",
      active: true,
      order: 5,
      createdAt: seedTime - day,
      updatedAt: seedTime - day,
    },
  },
];

export async function seedCreativeMediaIfMissing(): Promise<void> {
  // Initial data hanya untuk database yang benar-benar belum pernah memiliki
  // Media Kreatif. Tombstone adalah history yang wajib menghentikan seed.
  const infoHistory = await db
    .select()
    .from(syncRecordsTable)
    .where(eq(syncRecordsTable.collection, "infoBudaya"));

  // Pulihkan maksud hapus dari versi legacy yang memakai ID seed acak. Hanya
  // canonical revision pertama dengan bukti hapus historis yang direkonsiliasi.
  const definitionById = new Map(
    CANONICAL_CREATIVE_MEDIA.map((item) => [item.id, item]),
  );
  const resurrected = infoHistory.flatMap((row) => {
    const definition = definitionById.get(row.recordId);
    if (!definition) return [];
    const evidence = historicalDeletionForCanonicalMedia(
      row,
      definition,
      infoHistory,
    );
    return evidence ? [{ row, evidence }] : [];
  });
  if (resurrected.length > 0) {
    const reconciledAt = new Date();
    let reconciled = 0;
    await db.transaction(async (tx) => {
      for (const { row, evidence } of resurrected) {
        const result = await tx
          .update(syncRecordsTable)
          .set({ revision: row.revision + 1, deletedAt: reconciledAt })
          .where(
            and(
              eq(syncRecordsTable.id, row.id),
              eq(syncRecordsTable.revision, 1),
              isNull(syncRecordsTable.deletedAt),
            ),
          );
        if (result[0].affectedRows !== 1) continue;
        await tx.insert(activityLogTable).values({
          actorRole: "system",
          action: "system.prevent-resurrection",
          targetType: "infoBudaya",
          targetId: row.recordId,
          data: {
            legacyTombstoneId: evidence.recordId,
            reason: "historical_seed_deletion",
          },
        });
        reconciled += 1;
      }
    });
    if (reconciled > 0) {
      logger.info({ reconciled }, "Kebangkitan seed Media Kreatif dicegah");
    }
  }

  if (!shouldInitializeCanonicalCreativeMedia(infoHistory)) return;

  const usernames = [
    ...new Set(CANONICAL_CREATIVE_MEDIA.map((item) => item.authorUsername)),
  ];
  const authors = await db
    .select({ id: usersTable.id, username: usersTable.username })
    .from(usersTable)
    .where(inArray(usersTable.username, usernames));
  const authorByUsername = new Map(
    authors.map((author) => [author.username, author.id]),
  );
  const rows: Array<typeof syncRecordsTable.$inferInsert> = [];

  for (const item of CANONICAL_CREATIVE_MEDIA) {
    const authorId = authorByUsername.get(item.authorUsername);
    // Jangan membuat set seed parsial. seedUsersIfEmpty dijalankan lebih dulu;
    // bila author belum tersedia, startup berikutnya dapat mencoba ulang.
    if (!authorId) return;
    rows.push({
      collection: "infoBudaya",
      recordId: item.id,
      scope: "global",
      ownerId: authorId,
      participantIds: [authorId],
      data: { ...item.data, authorId: `user:${authorId}` },
      revision: 1,
      createdBy: authorId,
      updatedBy: authorId,
    });
  }

  // Satu transaksi mencegah history setengah jadi bila proses berhenti.
  await db.transaction(async (tx) => {
    await tx.insert(syncRecordsTable).values(rows);
  });
  logger.info(
    { inserted: rows.length },
    "Seed Media Kreatif canonical selesai",
  );
}
