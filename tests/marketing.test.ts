import test from "node:test";
import assert from "node:assert/strict";
import {
  applyCommand,
  receiveEvent,
  recordClick,
  summarize,
  exportCampaign,
} from "../src/lib/marketing/domain";
import {
  emptyState,
  parseMoney,
  stateSchema,
} from "../src/lib/marketing/model";
import { exampleState } from "../src/lib/marketing/demo";

const key = "test-only-player-hash-key-32-characters";
const now = "2026-09-18T12:00:00.000Z";
const input = {
  name: "Test campaign",
  country: "PH",
  currency: "USD",
  channel: "meta",
  budgetMinor: 10000,
  landingUrl: "https://example.com/game",
  minimumAge: 21,
  marketReference: "test fixture only",
  platformReference: "test fixture only",
};
function fixture() {
  const state = emptyState();
  const campaignId = applyCommand(
    state,
    { type: "campaign.create", input },
    now,
  ).id;
  applyCommand(
    state,
    { type: "campaign.status", id: campaignId, status: "approved" },
    now,
  );
  const linkId = applyCommand(
    state,
    { type: "link.create", campaignId },
    now,
  ).id;
  const link = state.links.find((item) => item.id === linkId)!;
  const click = recordClick(state, link.code, now);
  const event = {
    eventId: "event_0000001",
    playerId: "player_0000001",
    occurredAt: now,
    clickId: click.clickId,
    currency: "USD",
    type: "registration",
    amountMinor: 0,
  };
  return { state, campaignId, link, event };
}

test("example report reconciles deposits, revenue, spend and partner cost separately", () => {
  const state = exampleState(new Date(now));
  stateSchema.parse(state);
  const report = summarize(state),
    total = report.totals[0]!;
  assert.equal(total.firstDepositors, 12);
  assert.equal(total.spendMinor, 19500);
  assert.equal(total.netRevenueMinor, 42000);
  assert.equal(total.commissionMinor, 4000);
  assert.equal(total.contributionMinor, 18500);
  assert.equal(
    report.rows.reduce((sum, row) => row.depositsMinor + sum, 0),
    60000,
  );
});
test("missing market details prevent approval and click creation", () => {
  const state = emptyState();
  const id = applyCommand(
    state,
    {
      type: "campaign.create",
      input: { ...input, landingUrl: "", marketReference: "" },
    },
    now,
  ).id;
  assert.throws(
    () =>
      applyCommand(
        state,
        { type: "campaign.status", id, status: "approved" },
        now,
      ),
    /ยังขาด/,
  );
  const linkId = applyCommand(
    state,
    { type: "link.create", campaignId: id },
    now,
  ).id;
  assert.throws(() =>
    recordClick(
      state,
      state.links.find((item) => item.id === linkId)!.code,
      now,
    ),
  );
});
test("campaign export is explicitly an unsent brief", () => {
  const { state } = fixture();
  assert.equal(
    exportCampaign(state.campaigns[0]).externalStatus,
    "NOT_SUBMITTED",
  );
});
test("editing an approved campaign revokes its approval", () => {
  const { state, campaignId, link } = fixture();
  applyCommand(
    state,
    {
      type: "campaign.update",
      id: campaignId,
      input: { ...input, name: "Changed" },
    },
    now,
  );
  assert.equal(state.campaigns[0].status, "draft");
  assert.throws(() => recordClick(state, link.code, now));
});
test("unsafe destinations and unknown command fields are rejected", () => {
  for (const landingUrl of [
    "javascript:alert(1)",
    "http://example.com",
    "https://user:pass@example.com",
    "https://localhost/game",
    "https://127.0.0.1/game",
  ]) {
    assert.throws(() =>
      applyCommand(
        emptyState(),
        { type: "campaign.create", input: { ...input, landingUrl } },
        now,
      ),
    );
  }
  assert.throws(() =>
    applyCommand(
      emptyState(),
      { type: "campaign.create", input, active: true },
      now,
    ),
  );
});
test("same event ID is idempotent; altered payload is a conflict; raw player ID is not stored", () => {
  const { state, event } = fixture();
  assert.equal(receiveEvent(state, event, key, now).duplicate, false);
  assert.equal(receiveEvent(state, event, key, now).duplicate, true);
  assert.equal(state.events.length, 1);
  assert.throws(
    () =>
      receiveEvent(
        state,
        { ...event, playerId: "other_player_0001" },
        key,
        now,
      ),
    /ไม่ตรงกัน/,
  );
  assert.ok(!JSON.stringify(state).includes(event.playerId));
});
test("first depositor and registration are unique by player even with different event IDs", () => {
  const { state, event } = fixture();
  receiveEvent(state, event, key, now);
  receiveEvent(state, { ...event, eventId: "event_0000002" }, key, now);
  receiveEvent(
    state,
    {
      ...event,
      eventId: "deposit_000001",
      type: "first_deposit",
      amountMinor: 10000,
    },
    key,
    now,
  );
  receiveEvent(
    state,
    {
      ...event,
      eventId: "deposit_000002",
      type: "first_deposit",
      amountMinor: 10000,
    },
    key,
    now,
  );
  const row = summarize(state).rows[0];
  assert.equal(row.registrations, 1);
  assert.equal(row.firstDepositors, 1);
  assert.equal(row.depositsMinor, 10000);
  assert.equal(row.netRevenueMinor, 0);
});
test("global first-deposit deduplication is applied before filtering report dates", () => {
  const { state, event } = fixture();
  receiveEvent(
    state,
    { ...event, type: "first_deposit", amountMinor: 100 },
    key,
    now,
  );
  receiveEvent(
    state,
    {
      ...event,
      eventId: "later_deposit_1",
      type: "first_deposit",
      amountMinor: 200,
      occurredAt: "2026-09-19T12:00:00.000Z",
    },
    key,
    "2026-09-19T12:00:00.000Z",
  );
  assert.equal(
    summarize(state, "2026-09-19", "2026-09-19").rows[0].firstDepositors,
    0,
  );
});
test("unknown, future, expired and mixed-currency attribution is rejected", () => {
  const { state, event } = fixture();
  assert.throws(() =>
    receiveEvent(
      state,
      { ...event, clickId: "c0137efc-fd5b-4d62-938b-45d804f94d9e" },
      key,
      now,
    ),
  );
  assert.throws(() =>
    receiveEvent(state, { ...event, currency: "THB" }, key, now),
  );
  assert.throws(() =>
    receiveEvent(
      state,
      { ...event, occurredAt: "2026-09-18T11:00:00Z" },
      key,
      now,
    ),
  );
  assert.throws(() =>
    receiveEvent(
      state,
      { ...event, occurredAt: "2026-10-20T12:00:00Z" },
      key,
      "2026-10-20T12:00:00Z",
    ),
  );
  assert.throws(() =>
    receiveEvent(
      state,
      { ...event, occurredAt: "2026-09-18T13:00:00Z" },
      key,
      now,
    ),
  );
});
test("unattributed events remain visible without inventing attribution", () => {
  const { state, event } = fixture();
  receiveEvent(state, { ...event, clickId: undefined }, key, now);
  assert.equal(summarize(state).unattributedEvents, 1);
  assert.equal(summarize(state).rows[0].registrations, 0);
});
test("negative net revenue corrections and zero-denominator metrics are supported", () => {
  const { state, event } = fixture();
  receiveEvent(state, event, key, now);
  receiveEvent(
    state,
    {
      ...event,
      eventId: "revenue_positive_1",
      type: "net_revenue",
      amountMinor: 5000,
    },
    key,
    now,
  );
  receiveEvent(
    state,
    {
      ...event,
      eventId: "revenue_adjust_1",
      type: "net_revenue",
      amountMinor: -1000,
    },
    key,
    now,
  );
  const row = summarize(state).rows[0];
  assert.equal(row.netRevenueMinor, 4000);
  assert.equal(row.roas, null);
  assert.equal(row.roi, null);
  assert.equal(row.costPerFirstDepositorMinor, null);
});
test("out-of-order arrival uses acquisition event time, not arrival order", () => {
  const { state, event, campaignId } = fixture();
  const secondId = applyCommand(
    state,
    { type: "campaign.create", input: { ...input, name: "Other" } },
    now,
  ).id;
  applyCommand(
    state,
    { type: "campaign.status", id: secondId, status: "approved" },
    now,
  );
  const linkId = applyCommand(
    state,
    { type: "link.create", campaignId: secondId },
    now,
  ).id;
  const click = recordClick(
    state,
    state.links.find((item) => item.id === linkId)!.code,
    now,
  );
  receiveEvent(
    state,
    {
      ...event,
      eventId: "later_event_0001",
      clickId: click.clickId,
      occurredAt: "2026-09-18T12:02:00Z",
      type: "first_deposit",
      amountMinor: 1000,
    },
    key,
    "2026-09-18T12:03:00Z",
  );
  receiveEvent(state, event, key, "2026-09-18T12:03:00Z");
  assert.equal(
    summarize(state).rows.find((row) => row.campaignId === campaignId)!
      .firstDepositors,
    1,
  );
  assert.equal(
    summarize(state).rows.find((row) => row.campaignId === secondId)!
      .firstDepositors,
    0,
  );
});
test("daily spend replaces the same campaign/day and currencies are never summed together", () => {
  const { state, campaignId } = fixture();
  for (const amountMinor of [100, 200, 200])
    applyCommand(
      state,
      { type: "spend.set", campaignId, date: "2026-09-18", amountMinor },
      now,
    );
  const other = applyCommand(
    state,
    { type: "campaign.create", input: { ...input, currency: "THB" } },
    now,
  ).id;
  applyCommand(
    state,
    {
      type: "spend.set",
      campaignId: other,
      date: "2026-09-18",
      amountMinor: 90000,
    },
    now,
  );
  const totals = summarize(state).totals;
  assert.equal(totals.length, 2);
  assert.equal(totals.find((row) => row!.currency === "USD")!.spendMinor, 200);
  assert.throws(() =>
    applyCommand(
      state,
      { type: "spend.set", campaignId, date: "2027-09-18", amountMinor: 100 },
      now,
    ),
  );
});
test("partner pause blocks new clicks but preserves historical commissions", () => {
  const state = exampleState(new Date(now));
  const before = summarize(state).totals[0]!.commissionMinor;
  applyCommand(
    state,
    { type: "partner.status", id: state.partners[0].id, active: false },
    now,
  );
  assert.throws(() =>
    recordClick(state, state.links.find((link) => link.partnerId)!.code, now),
  );
  assert.equal(summarize(state).totals[0]!.commissionMinor, before);
});
test("minor-unit money parsing is exact and rejects over-precision and invalid dates", () => {
  assert.equal(parseMoney("10.29", "USD"), 1029);
  assert.equal(parseMoney("20000", "VND"), 20000);
  for (const amount of ["1.234", "-1", "NaN", "1e3"])
    assert.throws(() => parseMoney(amount, "USD"));
  assert.throws(() => parseMoney("1.5", "VND"));
  const { state, campaignId } = fixture();
  assert.throws(() =>
    applyCommand(
      state,
      { type: "spend.set", campaignId, date: "2026-02-30", amountMinor: 1 },
      now,
    ),
  );
});

test("repeat confirmed deposits increase deposit total without extra CPA or revenue", () => {
  const { state, event } = fixture();
  receiveEvent(
    state,
    { ...event, type: "first_deposit", amountMinor: 100 },
    key,
    now,
  );
  const repeat = {
    ...event,
    eventId: "repeat_deposit_01",
    type: "deposit",
    amountMinor: 500,
  };
  receiveEvent(state, repeat, key, now);
  receiveEvent(state, repeat, key, now);
  const row = summarize(state).rows[0];
  assert.equal(row.firstDepositors, 1);
  assert.equal(row.depositsMinor, 600);
  assert.equal(row.netRevenueMinor, 0);
  assert.equal(summarize(state).totals[0]!.depositsMinor, 600);
  assert.throws(() =>
    receiveEvent(
      state,
      { ...repeat, eventId: "repeat_deposit_02", amountMinor: -5 },
      key,
      now,
    ),
  );
});
test("date filters normalize event offsets to UTC, including day boundaries", () => {
  const { state, event } = fixture();
  receiveEvent(
    state,
    { ...event, occurredAt: "2026-09-19T01:00:00+07:00" },
    key,
    "2026-09-18T18:00:00Z",
  );
  assert.equal(
    summarize(state, "2026-09-18", "2026-09-18").rows[0].registrations,
    1,
  );
  assert.equal(
    summarize(state, "2026-09-19", "2026-09-19").rows[0].registrations,
    0,
  );
});
