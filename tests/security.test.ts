import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import {
  createSession,
  validSession,
  verifyPassword,
  passwordHash,
  validWebhook,
  sameOrigin,
} from "../src/lib/auth/session";

const now = Date.parse("2026-09-18T12:00:00Z");
process.env.ADMIN_SESSION_SECRET =
  "session-key-used-only-in-unit-tests-long-enough";
process.env.ADMIN_PASSWORD_HASH = passwordHash("test-only-password-long");
process.env.MARKETING_WEBHOOK_SECRET =
  "webhook-key-used-only-in-unit-tests-long-enough";
test("password verification and tamper/expiry checks protect owner sessions", () => {
  assert.equal(verifyPassword("test-only-password-long"), true);
  assert.equal(verifyPassword("wrong"), false);
  const session = createSession(now);
  assert.equal(validSession(session, now), true);
  assert.equal(validSession(`${session}x`, now), false);
  assert.equal(validSession(session, now + 9 * 3600000), false);
  assert.equal(validSession(undefined, now), false);
  assert.equal(validSession(`fake.${session.split(".")[1]}`, now), false);
});
test("missing secret disables authentication even with a previously signed session", () => {
  const session = createSession(now),
    secret = process.env.ADMIN_SESSION_SECRET;
  delete process.env.ADMIN_SESSION_SECRET;
  assert.equal(validSession(session, now), false);
  process.env.ADMIN_SESSION_SECRET = secret;
});
test("webhook signature covers exact body and rejects replayed, altered and missing signatures", () => {
  const body = '{"eventId":"example"}',
    timestamp = String(now / 1000);
  const signature =
    "sha256=" +
    createHmac("sha256", process.env.MARKETING_WEBHOOK_SECRET!)
      .update(`${timestamp}.${body}`)
      .digest("hex");
  assert.equal(validWebhook(body, timestamp, signature, now), true);
  assert.equal(validWebhook(body + " ", timestamp, signature, now), false);
  assert.equal(validWebhook(body, timestamp, signature, now + 301000), false);
  assert.equal(validWebhook(body, timestamp, null, now), false);
});
test("state-changing owner requests must originate from the app", () => {
  assert.equal(
    sameOrigin(
      new Request("https://app.example/command", {
        headers: { origin: "https://app.example" },
      }),
    ),
    true,
  );
  assert.equal(
    sameOrigin(
      new Request("https://app.example/command", {
        headers: { origin: "https://attacker.example" },
      }),
    ),
    false,
  );
  assert.equal(sameOrigin(new Request("https://app.example/command")), false);
});
