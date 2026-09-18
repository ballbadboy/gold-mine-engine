import test from "node:test";
import assert from "node:assert/strict";
import { concurrentPool } from "../src/lib/concurrent-pool";
import { aggregate } from "../src/lib/loop/metrics";
import { serializeJsonLd } from "../src/lib/content/json-ld";

test("bulk generation returns results in keyword order even when tasks finish out of order", async () => {
  let finishFirst!: (value: string) => void;
  const first = new Promise<string>((resolve) => {
    finishFirst = resolve;
  });
  const results = await concurrentPool(
    [
      () => first,
      async () => {
        finishFirst("keyword A");
        throw new Error("keyword B failed");
      },
      async () => "keyword C",
    ],
    2,
  );
  assert.deepEqual(results, [
    { ok: true, value: "keyword A" },
    { ok: false, error: "keyword B failed" },
    { ok: true, value: "keyword C" },
  ]);
});
test("loop aggregates rates with their denominators, not equal weight for each day", () => {
  const base = { date: "2026-09-18", conversions: 0, revenue: 0, position: 2 };
  const result = aggregate([
    { ...base, clicks: 1, impressions: 1, sessions: 1, ctr: 1, bounce_rate: 1 },
    {
      ...base,
      clicks: 0,
      impressions: 99,
      sessions: 99,
      ctr: 0,
      bounce_rate: 0,
    },
  ]);
  assert.equal(result.avg_ctr, 0.01);
  assert.equal(result.avg_bounce, 0.01);
  assert.equal(aggregate([]).avg_ctr, 0);
});
test("untrusted JSON-LD strings cannot terminate the script element and still round-trip", () => {
  const value = {
    name: "</script><script>alert(1)</script>",
    description: "ไทย & < >",
  };
  const json = serializeJsonLd(value);
  assert.ok(!json.includes("<"));
  assert.deepEqual(JSON.parse(json), value);
});
