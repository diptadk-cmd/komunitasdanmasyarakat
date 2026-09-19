import assert from "node:assert/strict";
import test from "node:test";
import {
  dedupeCreativeMediaItems,
  historicalDeletionForCanonicalMedia,
  inferCreativeMediaKind,
  isPublishedCreativeMedia,
  normalizeCreativeMediaFields,
  normalizeCreativeMediaModerationWorkflow,
  preserveCreativeMediaAuthorship,
  publicMediaUploadId,
  shouldInitializeCanonicalCreativeMedia,
  uploadMediaKind,
} from "./creative-media";

test("overseer moderation normalizes legacy active-only workflow changes", () => {
  const pending = { active: true, publicationStatus: "pending", judul: "A" };
  assert.deepEqual(normalizeCreativeMediaModerationWorkflow(pending, true), {
    active: true,
    publicationStatus: "published",
    judul: "A",
  });
  assert.deepEqual(pending, {
    active: true,
    publicationStatus: "pending",
    judul: "A",
  });

  assert.deepEqual(
    normalizeCreativeMediaModerationWorkflow(
      { active: false, publicationStatus: "published" },
      true,
    ),
    { active: false, publicationStatus: "pending" },
  );
  assert.deepEqual(
    normalizeCreativeMediaModerationWorkflow(
      { active: false, publicationStatus: "rejected" },
      true,
    ),
    { active: false, publicationStatus: "rejected" },
  );
});

test("Sanggar workflow is not rewritten by moderation compatibility", () => {
  const submission = { active: true, publicationStatus: "pending" };
  assert.equal(
    normalizeCreativeMediaModerationWorkflow(submission, false),
    submission,
  );
});

test("moderator approval preserves Sanggar author and self-heals owner", () => {
  assert.deepEqual(
    preserveCreativeMediaAuthorship({
      existingData: { authorId: "username:betawi.merah" },
      incomingData: {
        authorId: "user:sanggar-1",
        active: true,
        publicationStatus: "published",
      },
      existingOwnerId: "legacy-kurator-owner",
      existingAuthorId: "sanggar-1",
      incomingAuthorId: "sanggar-1",
    }),
    {
      ok: true,
      data: {
        authorId: "username:betawi.merah",
        active: true,
        publicationStatus: "published",
      },
      ownerId: "sanggar-1",
    },
  );
});

test("moderator payload cannot replace an existing creative-media author", () => {
  assert.deepEqual(
    preserveCreativeMediaAuthorship({
      existingData: { authorId: "user:sanggar-1" },
      incomingData: {
        authorId: "user:kurator-1",
        active: true,
        publicationStatus: "published",
      },
      existingOwnerId: "sanggar-1",
      existingAuthorId: "sanggar-1",
      incomingAuthorId: "kurator-1",
    }),
    { ok: false },
  );
});

test("isPublishedCreativeMedia keeps legacy compatibility without exposing pending work", () => {
  assert.equal(isPublishedCreativeMedia({ active: true }), true);
  assert.equal(
    isPublishedCreativeMedia({ active: true, publicationStatus: "published" }),
    true,
  );
  assert.equal(
    isPublishedCreativeMedia({ active: true, publicationStatus: "pending" }),
    false,
  );
  assert.equal(
    isPublishedCreativeMedia({ active: false, publicationStatus: "published" }),
    false,
  );
});

test("canonical media is initialized only on a database with no media history", () => {
  assert.equal(shouldInitializeCanonicalCreativeMedia([]), true);
  assert.equal(
    shouldInitializeCanonicalCreativeMedia([
      { recordId: "live-user-work", deletedAt: null },
    ]),
    false,
  );
  assert.equal(
    shouldInitializeCanonicalCreativeMedia([
      { recordId: "deleted-canonical", deletedAt: new Date() },
    ]),
    false,
  );
  assert.equal(
    shouldInitializeCanonicalCreativeMedia([
      { recordId: "legacy-cleanup-tombstone", deletedAt: new Date() },
    ]),
    false,
  );
});

test("historical tombstone reconciles a resurrected canonical but same-run cleanup does not", () => {
  const definition = {
    id: "demo-info-example-v1",
    data: { judul: "Karya Demo", isi: "Isi karya demo" },
  };
  const canonical = {
    recordId: definition.id,
    data: { ...definition.data, publicationStatus: "published" },
    revision: 1,
    createdAt: "2026-08-18T10:55:17.000Z",
    deletedAt: null,
  };
  const historical = {
    recordId: "legacy-deleted",
    data: { ...definition.data, active: true },
    revision: 2,
    createdAt: "2026-08-04T00:00:00.000Z",
    deletedAt: "2026-08-05T01:29:20.000Z",
  };
  const sameStartup = {
    ...historical,
    recordId: "legacy-cleanup",
    deletedAt: "2026-08-18T03:55:17.000Z",
  };

  assert.equal(
    historicalDeletionForCanonicalMedia(canonical, definition, [
      canonical,
      sameStartup,
    ]),
    undefined,
  );
  assert.equal(
    historicalDeletionForCanonicalMedia(canonical, definition, [
      canonical,
      sameStartup,
      historical,
    ])?.recordId,
    historical.recordId,
  );
  assert.equal(
    historicalDeletionForCanonicalMedia(
      { ...canonical, revision: 2 },
      definition,
      [historical],
    ),
    undefined,
  );
});

test("uploadMediaKind classifies uploaded audio and video MIME types", () => {
  assert.equal(uploadMediaKind("audio/mpeg"), "audio");
  assert.equal(uploadMediaKind("video/mp4"), "video");
  assert.equal(uploadMediaKind("image/webp"), "image");
  assert.equal(uploadMediaKind("application/pdf"), "document");
});

test("inferCreativeMediaKind recognizes hosted uploads and supported embeds", () => {
  assert.equal(
    inferCreativeMediaKind(
      "/api/public/media/123e4567-e89b-12d3-a456-426614174000",
      "audio/mpeg",
    ),
    "audio",
  );
  assert.equal(
    inferCreativeMediaKind("https://youtu.be/kzB-1SfD2wk"),
    "youtube",
  );
  assert.equal(
    publicMediaUploadId(
      "/api/public/media/123e4567-e89b-12d3-a456-426614174000",
    ),
    "123e4567-e89b-12d3-a456-426614174000",
  );
});

test("normalizeCreativeMediaFields trusts persisted upload content type", () => {
  assert.deepEqual(
    normalizeCreativeMediaFields(
      {
        mediaUrl: "/api/public/media/123e4567-e89b-12d3-a456-426614174000",
        mediaKind: "video",
        mediaContentType: "video/mp4",
      },
      { contentType: "audio/mpeg" },
    ),
    {
      mediaUrl: "/api/public/media/123e4567-e89b-12d3-a456-426614174000",
      mediaKind: "audio",
      mediaContentType: "audio/mpeg",
    },
  );
});

test("dedupeCreativeMediaItems only merges legacy copies and never truncates modern works", () => {
  const unique = Array.from({ length: 75 }, (_, index) => ({
    id: `item-${index}`,
    judul: `Karya ${index}`,
    isi: `Isi ${index}`,
    publicationStatus: "published",
    active: true,
    order: index,
    createdAt: index,
    updatedAt: index,
  }));
  const validModernCopy = {
    ...unique[10],
    id: "copy-of-ten",
    updatedAt: 999,
  };
  const legacyCopyA = {
    id: "legacy-a",
    judul: "Seed Lama",
    isi: "Isi seed lama",
    active: true,
    updatedAt: 1,
  };
  const legacyCopyB = {
    ...legacyCopyA,
    id: "legacy-b",
    updatedAt: 2,
  };
  const result = dedupeCreativeMediaItems([
    ...unique,
    validModernCopy,
    legacyCopyA,
    legacyCopyB,
  ]);

  assert.equal(result.length, 77);
  assert.deepEqual(
    result
      .filter((item) => item["judul"] === "Karya 10")
      .map((item) => item["id"])
      .sort(),
    ["copy-of-ten", "item-10"],
  );
  assert.equal(
    result.find((item) => item["judul"] === "Seed Lama")?.["id"],
    "legacy-b",
  );
});
