import assert from "node:assert/strict";
import test from "node:test";
import { supportConfig, seedSupport } from "../src/lib/support/service";
import { emptySupport } from "../src/lib/support/model";
test("public chat and paid AI default closed; demo never calls a configured provider", () => {
  process.env.MARKETING_DEMO_MODE = "false";
  process.env.SUPPORT_PUBLIC_ENABLED = "false";
  process.env.SUPPORT_AI_ENABLED = "false";
  process.env.ANTHROPIC_API_KEY = "unit-test-not-a-real-key";
  assert.equal(supportConfig().publicEnabled, false);
  assert.equal(supportConfig().aiEnabled, false);
  assert.throws(() => seedSupport(emptySupport()), /สาธิต/);
  process.env.SUPPORT_AI_ENABLED = "true";
  process.env.MARKETING_DEMO_MODE = "true";
  assert.equal(supportConfig().publicEnabled, true);
  assert.equal(supportConfig().aiEnabled, false);
  const state = emptySupport();
  seedSupport(state);
  assert.equal(state.articles.length, 3);
  assert.throws(() => seedSupport(state), /ว่าง/);
});
test("invalid or excessive AI call caps fail closed instead of becoming unlimited", () => {
  for (const value of ["invalid", "1001", "-1", "1.5"]) {
    process.env.SUPPORT_AI_DAILY_LIMIT = value;
    assert.equal(supportConfig().dailyLimit, 0);
  }
  process.env.SUPPORT_AI_DAILY_LIMIT = "5";
  assert.equal(supportConfig().dailyLimit, 5);
});
