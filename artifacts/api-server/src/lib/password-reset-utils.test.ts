import assert from "node:assert/strict";
import test from "node:test";
import {
  createOtp,
  createResetToken,
  digestResetToken,
  MIN_ACCOUNT_PASSWORD_LENGTH,
  normalizeEmail,
  normalizePhone,
  passwordMeetsPolicy,
  resetTokenMatches,
} from "./password-reset-utils";

test("normalizeEmail trims and canonicalizes email casing", () => {
  assert.equal(
    normalizeEmail("  User.Name+Karya@Example.COM  "),
    "user.name+karya@example.com",
  );
});

test("normalizeEmail rejects malformed and unsafe addresses", () => {
  assert.equal(normalizeEmail("bukan-email"), null);
  assert.equal(normalizeEmail("user@@example.com"), null);
  assert.equal(normalizeEmail("user name@example.com"), null);
  assert.equal(normalizeEmail(".user@example.com"), null);
  assert.equal(normalizeEmail("user..name@example.com"), null);
  assert.equal(normalizeEmail("user@-example.com"), null);
  assert.equal(normalizeEmail("user@example"), null);
  assert.equal(normalizeEmail(`${"a".repeat(65)}@example.com`), null);
});

test("normalizePhone converts Indonesian local formats", () => {
  assert.equal(normalizePhone("0812-3456-7890"), "6281234567890");
  assert.equal(normalizePhone("812 3456 7890"), "6281234567890");
  assert.equal(normalizePhone("+62 812 3456 7890"), "6281234567890");
});

test("normalizePhone rejects values outside international phone length", () => {
  assert.equal(normalizePhone("123"), null);
  assert.equal(normalizePhone("+62 812 3456 7890 1234"), null);
});

test("createOtp always produces a six digit code", () => {
  for (let index = 0; index < 100; index += 1) {
    assert.match(createOtp(), /^\d{6}$/);
  }
});

test("reset tokens are random-length hex values and compared by digest", () => {
  const token = createResetToken();
  const anotherToken = createResetToken();
  const digest = digestResetToken(token);

  assert.match(token, /^[a-f0-9]{64}$/);
  assert.match(digest, /^[a-f0-9]{64}$/);
  assert.notEqual(token, anotherToken);
  assert.equal(resetTokenMatches(token, digest), true);
  assert.equal(resetTokenMatches(anotherToken, digest), false);
  assert.equal(resetTokenMatches(token, "not-a-digest"), false);
});

test("account password policy enforces the shared minimum", () => {
  assert.equal(MIN_ACCOUNT_PASSWORD_LENGTH, 8);
  assert.equal(passwordMeetsPolicy("1234567"), false);
  assert.equal(passwordMeetsPolicy("12345678"), true);
});
