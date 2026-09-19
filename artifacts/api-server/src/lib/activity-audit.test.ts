import assert from "node:assert/strict";
import test from "node:test";
import {
  activityAuditValues,
  clientActivityAuditEvent,
  contentAuditEvent,
  sanitizeAuditMeta,
  syncRecordAuditEvent,
} from "./activity-audit-utils";

const actor = { id: "user-1", role: "admin" } as const;

test("audit metadata recursively removes secrets", () => {
  const sanitized = sanitizeAuditMeta({
    collection: "infoBudaya",
    password: "never-store",
    nested: {
      otp: "123456",
      resetToken: "never-store",
      title: "Karya Betawi",
    },
    rows: [{ sessionCookie: "never-store", status: "pending" }],
  });

  assert.deepEqual(sanitized, {
    collection: "infoBudaya",
    nested: { title: "Karya Betawi" },
    rows: [{ status: "pending" }],
  });
});

test("client activity mirror preserves id and strips token metadata", () => {
  const event = clientActivityAuditEvent({
    actor,
    recordId: "legacy-1",
    data: {
      action: "profile-edit",
      ts: Date.parse("2026-08-18T01:00:00.000Z"),
      meta: {
        id: "profile-1",
        token: "never-store",
        source: "spoofed-client",
      },
    },
  });
  const row = activityAuditValues(event);

  assert.equal(row.id, "legacy-1");
  assert.equal(row.action, "profile-edit");
  assert.equal(row.targetId, "profile-1");
  assert.deepEqual(row.data, { source: "client-sync", id: "profile-1" });
  assert.deepEqual(row.createdAt, new Date("2026-08-18T01:00:00.000Z"));
});

test("activity values contain only bounded, sanitized metadata", () => {
  const row = activityAuditValues({
    actor,
    action: "auth.login",
    targetType: "user",
    targetId: "user-1",
    meta: { token: "secret", mode: "password" },
    at: new Date("2026-08-18T00:00:00.000Z"),
  });

  assert.equal(row.actorId, "user-1");
  assert.equal(row.action, "auth.login");
  assert.deepEqual(row.data, { mode: "password" });
});

test("content audit distinguishes create, approve, reject, and delete", () => {
  assert.equal(
    contentAuditEvent({
      actor,
      collection: "news",
      recordId: "news-1",
      operation: "create",
      after: {},
    })?.action,
    "content.create",
  );
  assert.equal(
    contentAuditEvent({
      actor,
      collection: "infoBudaya",
      recordId: "work-1",
      operation: "update",
      before: { active: false, publicationStatus: "pending" },
      after: { active: true, publicationStatus: "published" },
    })?.action,
    "content.approve",
  );
  assert.equal(
    contentAuditEvent({
      actor,
      collection: "infoBudaya",
      recordId: "work-1",
      operation: "update",
      before: { active: false, publicationStatus: "pending" },
      after: { active: false, publicationStatus: "rejected" },
    })?.action,
    "content.reject",
  );
  assert.equal(
    contentAuditEvent({
      actor,
      collection: "slider",
      recordId: "slide-1",
      operation: "delete",
      before: {},
    })?.action,
    "content.delete",
  );
  assert.equal(
    contentAuditEvent({
      actor,
      collection: "kas",
      recordId: "kas-1",
      operation: "create",
      after: {},
    }),
    null,
  );
});

test("every applied sync mutation gets a safe per-record audit event", () => {
  assert.deepEqual(
    syncRecordAuditEvent({
      actor,
      collection: "kas",
      recordId: "kas-1",
      operation: "update",
      before: { password: "never-store", nilai: 100 },
      after: { token: "never-store", nilai: 200 },
    }),
    {
      actor,
      action: "sync.update",
      targetType: "kas",
      targetId: "kas-1",
      meta: { operation: "update" },
    },
  );
});
