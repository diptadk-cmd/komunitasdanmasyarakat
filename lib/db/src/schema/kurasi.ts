import {
  mysqlTable,
  varchar,
  index,
  uniqueIndex,
} from "drizzle-orm/mysql-core";
import { idCol, dataCol, createdAtCol, updatedAtCol } from "./_base";

// Penugasan juri ke sanggar per periode
export const penugasanJuriTable = mysqlTable(
  "penugasan_juri",
  {
    id: idCol(),
    juriId: varchar("juri_id", { length: 36 }).notNull(),
    sanggarId: varchar("sanggar_id", { length: 36 }).notNull(),
    periode: varchar("periode", { length: 32 }),
    data: dataCol(),
    createdAt: createdAtCol(),
    updatedAt: updatedAtCol(),
  },
  (t) => ({
    byJuri: index("idx_penugasan_juri_juri").on(t.juriId),
    bySanggar: index("idx_penugasan_juri_sanggar").on(t.sanggarId),
  }),
);
export type PenugasanJuri = typeof penugasanJuriTable.$inferSelect;
export type InsertPenugasanJuri = typeof penugasanJuriTable.$inferInsert;

// Submission kurasi (skor juri per variabel)
export const kurasiSubmissionsTable = mysqlTable(
  "kurasi_submissions",
  {
    id: idCol(),
    sanggarId: varchar("sanggar_id", { length: 36 }).notNull(),
    data: dataCol(),
    createdAt: createdAtCol(),
    updatedAt: updatedAtCol(),
  },
  (t) => ({
    bySanggar: index("idx_kurasi_submissions_sanggar").on(t.sanggarId),
  }),
);
export type KurasiSubmission = typeof kurasiSubmissionsTable.$inferSelect;
export type InsertKurasiSubmission = typeof kurasiSubmissionsTable.$inferInsert;

// Registri server untuk mengunci satu akun Seniman dan satu NIK hanya pada
// satu disposisi Sanggar. NIK tidak disimpan mentah, hanya hash SHA-256.
export const kurasiParticipantDispositionsTable = mysqlTable(
  "kurasi_participant_dispositions",
  {
    id: idCol(),
    submissionId: varchar("submission_id", { length: 36 }).notNull(),
    sanggarId: varchar("sanggar_id", { length: 36 }).notNull(),
    participantUserId: varchar("participant_user_id", { length: 36 }).notNull(),
    participantUsername: varchar("participant_username", {
      length: 100,
    }).notNull(),
    nikHash: varchar("nik_hash", { length: 64 }).notNull(),
    createdAt: createdAtCol(),
    updatedAt: updatedAtCol(),
  },
  (t) => ({
    uniqueParticipant: uniqueIndex("uq_kurasi_disposition_participant").on(
      t.participantUserId,
    ),
    uniqueNik: uniqueIndex("uq_kurasi_disposition_nik").on(t.nikHash),
    bySubmission: index("idx_kurasi_disposition_submission").on(t.submissionId),
    bySanggar: index("idx_kurasi_disposition_sanggar").on(t.sanggarId),
  }),
);
export type KurasiParticipantDisposition =
  typeof kurasiParticipantDispositionsTable.$inferSelect;

// Sertifikat (kurasi / sertifikasi profesi)
export const sertifikatTable = mysqlTable(
  "sertifikat",
  {
    id: idCol(),
    pemilikId: varchar("pemilik_id", { length: 36 }).notNull(),
    sanggarId: varchar("sanggar_id", { length: 36 }),
    jenis: varchar("jenis", { length: 128 }),
    data: dataCol(),
    createdAt: createdAtCol(),
    updatedAt: updatedAtCol(),
  },
  (t) => ({
    byPemilik: index("idx_sertifikat_pemilik").on(t.pemilikId),
  }),
);
export type Sertifikat = typeof sertifikatTable.$inferSelect;
export type InsertSertifikat = typeof sertifikatTable.$inferInsert;
