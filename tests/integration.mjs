/** Runs HTTP checks against a disposable local server. No ad / payment API is called. */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHmac, randomBytes, scryptSync } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const dataDir = await mkdtemp(path.join(tmpdir(), "gold-mine-http-"));
const socket = createServer();
await new Promise((resolve) => socket.listen(0, "127.0.0.1", resolve));
const port = socket.address().port;
await new Promise((resolve) => socket.close(resolve));
const origin = `http://127.0.0.1:${port}`;
const password = randomBytes(24).toString("hex"),
  salt = randomBytes(16).toString("hex");
const webhookSecret = randomBytes(32).toString("hex");
const env = {
  ...process.env,
  NODE_ENV: "development",
  NEXT_TELEMETRY_DISABLED: "1",
  APP_ORIGIN: origin,
  MARKETING_DEMO_MODE: "false",
  MARKETING_STORE: "file",
  MARKETING_DATA_DIR: dataDir,
  ADMIN_PASSWORD_HASH: `scrypt:${salt}:${scryptSync(password, salt, 64).toString("hex")}`,
  ADMIN_SESSION_SECRET: randomBytes(32).toString("hex"),
  MARKETING_WEBHOOK_SECRET: webhookSecret,
  MARKETING_PLAYER_HASH_SECRET: randomBytes(32).toString("hex"),
  CRON_SECRET: "",
  PUBLIC_CONTENT_WEBSITE_ID: "",
  NEXT_PUBLIC_SUPABASE_URL: "",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
  SUPABASE_SERVICE_ROLE_KEY: "",
  ANTHROPIC_API_KEY: "",
  GEMINI_API_KEY: "",
  OPENROUTER_API_KEY: "",
};
const child = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "dev",
    "--hostname",
    "127.0.0.1",
    "--port",
    String(port),
  ],
  {
    env,
    stdio: ["ignore", "pipe", "pipe"],
    detached: process.platform !== "win32",
  },
);
let logs = "",
  cookie = "",
  passed = 0;
child.stdout.on("data", (chunk) => {
  logs = (logs + chunk).slice(-12000);
});
child.stderr.on("data", (chunk) => {
  logs = (logs + chunk).slice(-12000);
});
async function check(name, run) {
  await run();
  passed++;
  console.log(`ok ${passed} - ${name}`);
}
async function request(
  url,
  { method = "GET", body, auth = true, source = origin, headers = {} } = {},
) {
  return fetch(`${origin}${url}`, {
    method,
    redirect: "manual",
    headers: {
      ...(auth && cookie ? { cookie } : {}),
      ...(method !== "GET"
        ? { origin: source, "content-type": "application/json" }
        : {}),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(30000),
  });
}
async function command(body, status = 201) {
  const response = await request("/api/marketing", { method: "POST", body });
  const result = await response.json();
  assert.equal(response.status, status, JSON.stringify(result));
  return result;
}
async function event(body, expected = 200, signatureOverride) {
  const raw = JSON.stringify(body),
    timestamp = String(Math.floor(Date.now() / 1000));
  const signature =
    signatureOverride ??
    `sha256=${createHmac("sha256", webhookSecret).update(`${timestamp}.${raw}`).digest("hex")}`;
  const response = await request("/api/marketing/events", {
    method: "POST",
    auth: false,
    source: "https://backend.example",
    body,
    headers: { "x-gm-timestamp": timestamp, "x-gm-signature": signature },
  });
  const result = await response.json();
  assert.equal(response.status, expected, JSON.stringify(result));
  return result;
}
try {
  let ready = false;
  for (let attempt = 0; attempt < 120; attempt++) {
    if (child.exitCode !== null) throw new Error(`Server stopped: ${logs}`);
    try {
      const response = await fetch(`${origin}/login`, {
        signal: AbortSignal.timeout(1000),
      });
      if (response.ok) {
        ready = true;
        break;
      }
    } catch {}
    await delay(500);
  }
  assert.ok(ready, `Server did not start: ${logs}`);
  await check(
    "unauthenticated marketing and legacy APIs are closed",
    async () => {
      for (const route of [
        "/api/marketing",
        "/api/marketing/export",
        "/api/websites",
        "/api/loop/run",
      ])
        assert.equal((await request(route, { auth: false })).status, 401);
      assert.equal((await request("/marketing", { auth: false })).status, 307);
    },
  );
  await check(
    "legacy cron cannot run without a configured bearer secret",
    async () => {
      assert.equal(
        (
          await request("/api/cron/loop", {
            auth: false,
            headers: { "x-vercel-cron": "1" },
          })
        ).status,
        401,
      );
    },
  );
  await check(
    "public content is closed without the intended website scope",
    async () => {
      assert.equal(
        (await request("/read/not-public", { auth: false })).status,
        404,
      );
      assert.equal((await request("/llms.txt", { auth: false })).status, 404);
    },
  );
  await check(
    "login requires the intended origin and valid password",
    async () => {
      assert.equal(
        (
          await request("/api/session", {
            method: "POST",
            source: "https://foreign.example",
            body: { password },
          })
        ).status,
        403,
      );
      assert.equal(
        (
          await request("/api/session", {
            method: "POST",
            body: { password: "incorrect-password" },
          })
        ).status,
        401,
      );
      const response = await request("/api/session", {
        method: "POST",
        body: { password },
      });
      assert.equal(response.status, 200);
      const setCookie = response.headers.get("set-cookie");
      assert.match(setCookie, /HttpOnly/i);
      assert.match(setCookie, /SameSite=strict/i);
      cookie = setCookie.split(";")[0];
    },
  );
  await check(
    "authenticated owner sees workspace and cannot seed live data",
    async () => {
      assert.equal((await request("/marketing")).status, 200);
      assert.equal(
        (await request("/api/loop/seed", { method: "POST", body: {} })).status,
        410,
      );
      assert.equal(
        (await request("/api/marketing/demo", { method: "POST", body: {} }))
          .status,
        404,
      );
      assert.equal(
        (
          await request("/api/marketing", {
            method: "POST",
            source: "https://foreign.example",
            body: {},
          })
        ).status,
        403,
      );
    },
  );
  const campaignInput = {
    name: "=HTTP campaign",
    country: "PH",
    currency: "USD",
    channel: "meta",
    budgetMinor: 10000,
    landingUrl: "",
  };
  let campaignId, partnerId, code, clickId;
  await check(
    "create draft, partner and link; reject premature approval",
    async () => {
      campaignId = (
        await command({ type: "campaign.create", input: campaignInput })
      ).id;
      partnerId = (
        await command({
          type: "partner.create",
          input: { name: "HTTP partner", currency: "USD", cpaMinor: 500 },
        })
      ).id;
      await command({ type: "link.create", campaignId, partnerId });
      const state = await (await request("/api/marketing")).json();
      code = state.links[0].code;
      assert.equal((await request(`/go/${code}`, { auth: false })).status, 404);
      await command(
        { type: "campaign.status", id: campaignId, status: "approved" },
        400,
      );
    },
  );
  await check(
    "approved tracking link redirects to configured destination with click ID",
    async () => {
      await command({
        type: "campaign.update",
        id: campaignId,
        input: {
          ...campaignInput,
          landingUrl: "https://example.com/game?source=test",
          minimumAge: 21,
          marketReference: "TEST ONLY",
          platformReference: "TEST ONLY",
        },
      });
      await command({
        type: "campaign.status",
        id: campaignId,
        status: "approved",
      });
      const response = await request(
        `/go/${code}?url=https://attacker.example`,
        { auth: false },
      );
      assert.equal(response.status, 302);
      const destination = new URL(response.headers.get("location"));
      assert.equal(destination.hostname, "example.com");
      assert.equal(destination.searchParams.get("source"), "test");
      assert.equal(destination.searchParams.get("utm_medium"), "affiliate");
      clickId = destination.searchParams.get("gm_click_id");
      assert.ok(clickId);
      assert.equal(response.headers.get("cache-control"), "no-store");
    },
  );
  const base = {
    eventId: "http_registration_1",
    playerId: "opaque_player_test_1",
    type: "registration",
    occurredAt: new Date().toISOString(),
    currency: "USD",
    amountMinor: 0,
  };
  await check(
    "exact-body signed webhook accepts, deduplicates and rejects tampering",
    async () => {
      base.clickId = clickId;
      await event(base, 401, "sha256=bad");
      assert.equal((await event(base)).duplicate, false);
      assert.equal((await event(base)).duplicate, true);
      await event({ ...base, playerId: "different_opaque_player" }, 409);
      await event(
        { ...base, eventId: "http_bad_currency", currency: "THB" },
        422,
      );
    },
  );
  await check(
    "first deposit, repeat deposit and net revenue reconcile against cost and CPA",
    async () => {
      await event({
        ...base,
        eventId: "http_first_deposit",
        type: "first_deposit",
        amountMinor: 10000,
      });
      await event({
        ...base,
        eventId: "http_repeat_deposit",
        type: "deposit",
        amountMinor: 20000,
      });
      await event({
        ...base,
        eventId: "http_net_revenue",
        type: "net_revenue",
        amountMinor: 4000,
      });
      for (const amountMinor of [1000, 1500, 1500])
        await command({
          type: "spend.set",
          campaignId,
          date: new Date().toISOString().slice(0, 10),
          amountMinor,
        });
      const state = await (await request("/api/marketing")).json(),
        row = state.report.rows[0];
      assert.equal(state.eventCount, 4);
      assert.equal(row.registrations, 1);
      assert.equal(row.firstDepositors, 1);
      assert.equal(row.depositsMinor, 30000);
      assert.equal(state.report.totals[0].depositsMinor, 30000);
      assert.equal(row.netRevenueMinor, 4000);
      assert.equal(row.spendMinor, 1500);
      assert.equal(row.commissionMinor, 500);
      assert.equal(row.contributionMinor, 2000);
      assert.equal(row.roi, 1);
      const stored = await readFile(
        path.join(dataDir, "marketing.json"),
        "utf8",
      );
      assert.ok(!stored.includes(base.playerId));
    },
  );
  await check(
    "exports are owner-only, formula-safe and never claim ad submission",
    async () => {
      const response = await request(
          `/api/marketing/export?campaignId=${campaignId}`,
        ),
        brief = await response.json();
      assert.equal(brief.externalStatus, "NOT_SUBMITTED");
      const csv = await (await request("/api/marketing/export")).text();
      assert.match(csv, /'=HTTP campaign/);
      assert.equal(
        (await request("/api/marketing?from=2026-02-30")).status,
        400,
      );
      assert.equal(
        (await request("/api/marketing?from=2026-09-19&to=2026-09-18")).status,
        400,
      );
    },
  );
  await check(
    "pause prevents new clicks without erasing historical results",
    async () => {
      await command({ type: "partner.status", id: partnerId, active: false });
      assert.equal((await request(`/go/${code}`, { auth: false })).status, 404);
      const state = await (await request("/api/marketing")).json();
      assert.equal(state.report.partners[0].commissionMinor, 500);
    },
  );
  await check("logout clears the owner cookie", async () => {
    const response = await request("/api/session", { method: "DELETE" });
    assert.equal(response.status, 200);
    assert.match(response.headers.get("set-cookie"), /Max-Age=0/i);
  });
  console.log(
    `Passed ${passed} HTTP integration checks. No external service was contacted.`,
  );
} catch (error) {
  console.error(logs);
  throw error;
} finally {
  if (child.exitCode === null) {
    try {
      process.kill(
        process.platform === "win32" ? child.pid : -child.pid,
        "SIGTERM",
      );
    } catch {}
    await Promise.race([
      new Promise((resolve) => child.once("exit", resolve)),
      delay(5000),
    ]);
    if (child.exitCode === null) {
      try {
        process.kill(
          process.platform === "win32" ? child.pid : -child.pid,
          "SIGKILL",
        );
      } catch {}
    }
  }
  await rm(dataDir, { recursive: true, force: true });
}
