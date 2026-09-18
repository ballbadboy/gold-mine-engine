import { createHash, createHmac, randomBytes, randomUUID } from "node:crypto";
import {
  commandSchema,
  eventInput,
  MarketingError,
  type State,
  type Campaign,
  type Currency,
  type EventInput,
} from "./model";

const DAY = 86_400_000;
function audit(
  state: State,
  action: string,
  targetId: string,
  actor: "owner" | "backend",
  now: string,
) {
  state.audit.push({
    id: randomUUID(),
    action,
    targetId,
    actor,
    createdAt: now,
  });
}
export function readiness(campaign: Campaign): string[] {
  const missing: string[] = [];
  if (!campaign.landingUrl) missing.push("เว็บไซต์ปลายทาง");
  if (!campaign.minimumAge) missing.push("อายุขั้นต่ำตามตลาด");
  if (!campaign.marketReference) missing.push("หลักฐานสิทธิ์ของตลาด");
  if (
    ["meta", "google"].includes(campaign.channel) &&
    !campaign.platformReference
  )
    missing.push("หลักฐานอนุญาตของแพลตฟอร์มโฆษณา");
  if (
    ["meta", "google"].includes(campaign.channel) &&
    campaign.budgetMinor <= 0
  )
    missing.push("งบแคมเปญ");
  return missing;
}
export function applyCommand(
  state: State,
  unknownCommand: unknown,
  now = new Date().toISOString(),
) {
  const command = commandSchema.parse(unknownCommand);
  let targetId: string;
  switch (command.type) {
    case "partner.create": {
      targetId = randomUUID();
      state.partners.push({
        ...command.input,
        id: targetId,
        createdAt: now,
        active: true,
      });
      break;
    }
    case "partner.status": {
      const partner = state.partners.find((item) => item.id === command.id);
      if (!partner) throw new MarketingError("ไม่พบพาร์ตเนอร์", 404);
      partner.active = command.active;
      targetId = partner.id;
      break;
    }
    case "campaign.create": {
      targetId = randomUUID();
      state.campaigns.push({
        ...command.input,
        id: targetId,
        createdAt: now,
        status: "draft",
        approvedAt: null,
      });
      break;
    }
    case "campaign.update": {
      const campaign = state.campaigns.find((item) => item.id === command.id);
      if (!campaign) throw new MarketingError("ไม่พบแคมเปญ", 404);
      if (
        (state.links.some((link) => link.campaignId === campaign.id) ||
          state.spend.some((item) => item.campaignId === campaign.id)) &&
        command.input.currency !== campaign.currency
      )
        throw new MarketingError(
          "แคมเปญที่มีลิงก์หรือค่าใช้จ่ายแล้วเปลี่ยนสกุลเงินไม่ได้",
        );
      Object.assign(campaign, command.input, {
        status: "draft",
        approvedAt: null,
      });
      targetId = campaign.id;
      break;
    }
    case "campaign.status": {
      const campaign = state.campaigns.find((item) => item.id === command.id);
      if (!campaign) throw new MarketingError("ไม่พบแคมเปญ", 404);
      if (command.status === "approved" && readiness(campaign).length)
        throw new MarketingError(`ยังขาด: ${readiness(campaign).join(", ")}`);
      campaign.status = command.status;
      campaign.approvedAt = command.status === "approved" ? now : null;
      targetId = campaign.id;
      break;
    }
    case "link.create": {
      const campaign = state.campaigns.find(
        (item) => item.id === command.campaignId,
      );
      if (!campaign) throw new MarketingError("ไม่พบแคมเปญ", 404);
      const partner = command.partnerId
        ? state.partners.find(
            (item) => item.id === command.partnerId && item.active,
          )
        : null;
      if (command.partnerId && !partner)
        throw new MarketingError("ไม่พบพาร์ตเนอร์ที่เปิดใช้งาน");
      if (partner && partner.currency !== campaign.currency)
        throw new MarketingError("สกุลเงินพาร์ตเนอร์และแคมเปญต้องตรงกัน");
      targetId = randomUUID();
      state.links.push({
        id: targetId,
        code: randomBytes(12).toString("hex"),
        campaignId: campaign.id,
        partnerId: partner?.id ?? null,
        cpaMinor: partner?.cpaMinor ?? 0,
        createdAt: now,
      });
      break;
    }
    case "spend.set": {
      if (!state.campaigns.some((item) => item.id === command.campaignId))
        throw new MarketingError("ไม่พบแคมเปญ", 404);
      if (command.date > now.slice(0, 10))
        throw new MarketingError("ค่าใช้จ่ายจริงต้องไม่เป็นวันที่ในอนาคต");
      const existing = state.spend.find(
        (item) =>
          item.campaignId === command.campaignId && item.date === command.date,
      );
      if (existing) existing.amountMinor = command.amountMinor;
      else
        state.spend.push({
          campaignId: command.campaignId,
          date: command.date,
          amountMinor: command.amountMinor,
        });
      targetId = `${command.campaignId}:${command.date}`;
      break;
    }
  }
  audit(state, command.type, targetId, "owner", now);
  return { id: targetId };
}

export function recordClick(
  state: State,
  code: string,
  now = new Date().toISOString(),
) {
  const link = state.links.find((item) => item.code === code);
  const campaign = state.campaigns.find((item) => item.id === link?.campaignId);
  if (
    !link ||
    !campaign ||
    campaign.status !== "approved" ||
    readiness(campaign).length
  )
    throw new MarketingError("ลิงก์นี้ยังไม่เปิดใช้งาน", 404);
  if (
    link.partnerId &&
    !state.partners.some((item) => item.id === link.partnerId && item.active)
  )
    throw new MarketingError("ลิงก์นี้หยุดใช้งานแล้ว", 404);
  const clickId = randomUUID();
  const url = new URL(campaign.landingUrl);
  url.searchParams.set("gm_click_id", clickId);
  url.searchParams.set(
    "utm_source",
    link.partnerId ? "partner" : campaign.channel,
  );
  url.searchParams.set(
    "utm_medium",
    link.partnerId
      ? "affiliate"
      : campaign.channel === "organic"
        ? "organic"
        : "paid",
  );
  url.searchParams.set("utm_campaign", campaign.id);
  url.searchParams.set("utm_content", link.id);
  state.clicks.push({ id: clickId, linkId: link.id, createdAt: now });
  return { clickId, destination: url.toString() };
}

export function receiveEvent(
  state: State,
  payload: unknown,
  playerSecret: string,
  now = new Date().toISOString(),
) {
  if (playerSecret.length < 32)
    throw new MarketingError("ยังไม่ได้ตั้งค่ากุญแจสำหรับข้อมูลผู้เล่น", 503);
  const event = eventInput.parse(payload);
  const fingerprint = createHash("sha256")
    .update(JSON.stringify(event))
    .digest("hex");
  const prior = state.events.find((item) => item.id === event.eventId);
  if (prior) {
    if (prior.fingerprint !== fingerprint)
      throw new MarketingError("Event ID เดิมมีข้อมูลไม่ตรงกัน", 409);
    return { duplicate: true, id: prior.id };
  }
  if (Date.parse(event.occurredAt) > Date.parse(now) + 300_000)
    throw new MarketingError("เวลา event อยู่ในอนาคต");
  if (event.clickId) {
    const click = state.clicks.find((item) => item.id === event.clickId);
    if (!click) throw new MarketingError("ไม่พบ click ID", 422);
    const delta = Date.parse(event.occurredAt) - Date.parse(click.createdAt);
    if (delta < 0 || delta > 30 * DAY)
      throw new MarketingError("Click อยู่นอกช่วง attribution 30 วัน", 422);
    const link = state.links.find((item) => item.id === click.linkId)!;
    const campaign = state.campaigns.find(
      (item) => item.id === link.campaignId,
    )!;
    if (event.currency !== campaign.currency)
      throw new MarketingError("สกุลเงิน event ไม่ตรงกับแคมเปญ", 422);
  }
  const playerHash = createHmac("sha256", playerSecret)
    .update(event.playerId)
    .digest("hex");
  state.events.push({
    id: event.eventId,
    playerHash,
    fingerprint,
    type: event.type,
    occurredAt: event.occurredAt,
    receivedAt: now,
    clickId: event.clickId ?? null,
    currency: event.currency,
    amountMinor: event.amountMinor,
  });
  audit(state, `event.${event.type}`, event.eventId, "backend", now);
  return { duplicate: false, id: event.eventId };
}

export function summarize(
  state: State,
  from = "0000-01-01",
  to = "9999-12-31",
) {
  const inRange = (date: string) => {
    const utcDate =
      date.length === 10 ? date : new Date(date).toISOString().slice(0, 10);
    return utcDate >= from && utcDate <= to;
  };
  const links = new Map(state.links.map((link) => [link.id, link]));
  const clicks = new Map(state.clicks.map((click) => [click.id, click]));
  const events = [...state.events].sort(
    (a, b) =>
      Date.parse(a.occurredAt) - Date.parse(b.occurredAt) ||
      a.id.localeCompare(b.id),
  );
  const acquisition = new Map<string, State["links"][number]>();
  for (const event of events) {
    if (
      !["registration", "first_deposit"].includes(event.type) ||
      acquisition.has(event.playerHash) ||
      !event.clickId
    )
      continue;
    const click = clicks.get(event.clickId);
    const link = click && links.get(click.linkId);
    if (link) acquisition.set(event.playerHash, link);
  }
  const seenRegistration = new Set<string>(),
    seenDeposit = new Set<string>();
  const rows = state.campaigns.map((campaign) => ({
    campaignId: campaign.id,
    name: campaign.name,
    currency: campaign.currency,
    country: campaign.country,
    channel: campaign.channel,
    status: campaign.status,
    budgetMinor: campaign.budgetMinor,
    clicks: 0,
    registrations: 0,
    firstDepositors: 0,
    depositsMinor: 0,
    netRevenueMinor: 0,
    spendMinor: state.spend
      .filter((item) => item.campaignId === campaign.id && inRange(item.date))
      .reduce((total, item) => total + item.amountMinor, 0),
    commissionMinor: 0,
  }));
  const rowMap = new Map(rows.map((row) => [row.campaignId, row]));
  const partners = state.partners.map((partner) => ({
    id: partner.id,
    name: partner.name,
    currency: partner.currency,
    firstDepositors: 0,
    commissionMinor: 0,
  }));
  const partnerMap = new Map(partners.map((partner) => [partner.id, partner]));
  for (const click of state.clicks) {
    const link = links.get(click.linkId),
      row = link && rowMap.get(link.campaignId);
    if (row && inRange(click.createdAt)) row.clicks++;
  }
  let unattributedEvents = 0;
  for (const event of events) {
    const firstRegistration =
      event.type === "registration" && !seenRegistration.has(event.playerHash);
    const firstDeposit =
      event.type === "first_deposit" && !seenDeposit.has(event.playerHash);
    if (event.type === "registration") seenRegistration.add(event.playerHash);
    if (event.type === "first_deposit") seenDeposit.add(event.playerHash);
    if (!inRange(event.occurredAt)) continue;
    const link = acquisition.get(event.playerHash),
      row = link && rowMap.get(link.campaignId);
    if (!row || row.currency !== event.currency) {
      unattributedEvents++;
      continue;
    }
    if (firstRegistration) row.registrations++;
    if (firstDeposit) {
      row.firstDepositors++;
      row.depositsMinor += event.amountMinor;
      row.commissionMinor += link!.cpaMinor;
      const partner = link!.partnerId && partnerMap.get(link!.partnerId);
      if (partner) {
        partner.firstDepositors++;
        partner.commissionMinor += link!.cpaMinor;
      }
    }
    if (event.type === "deposit") row.depositsMinor += event.amountMinor;
    if (event.type === "net_revenue") row.netRevenueMinor += event.amountMinor;
  }
  const measured = rows.map((row) => {
    const costMinor = row.spendMinor + row.commissionMinor;
    return {
      ...row,
      costMinor,
      contributionMinor: row.netRevenueMinor - costMinor,
      costPerRegistrationMinor: row.registrations
        ? Math.round(costMinor / row.registrations)
        : null,
      costPerFirstDepositorMinor: row.firstDepositors
        ? Math.round(costMinor / row.firstDepositors)
        : null,
      roas: row.spendMinor > 0 ? row.netRevenueMinor / row.spendMinor : null,
      roi: costMinor > 0 ? (row.netRevenueMinor - costMinor) / costMinor : null,
    };
  });
  const totals: Partial<
    Record<
      Currency,
      {
        currency: Currency;
        spendMinor: number;
        netRevenueMinor: number;
        contributionMinor: number;
        firstDepositors: number;
        depositsMinor: number;
        commissionMinor: number;
      }
    >
  > = {};
  for (const row of measured) {
    const total = (totals[row.currency] ??= {
      currency: row.currency,
      spendMinor: 0,
      netRevenueMinor: 0,
      contributionMinor: 0,
      firstDepositors: 0,
      depositsMinor: 0,
      commissionMinor: 0,
    });
    total.spendMinor += row.spendMinor;
    total.netRevenueMinor += row.netRevenueMinor;
    total.depositsMinor += row.depositsMinor;
    total.contributionMinor += row.contributionMinor;
    total.firstDepositors += row.firstDepositors;
    total.commissionMinor += row.commissionMinor;
  }
  return {
    rows: measured,
    totals: Object.values(totals),
    partners,
    unattributedEvents,
    from,
    to,
    attribution: "first-tracked-acquisition-event / 30-day click window",
    timezone: "UTC",
  };
}

export function exportCampaign(campaign: Campaign) {
  return {
    format: "gold-mine-campaign-brief-v1",
    campaignId: campaign.id,
    name: campaign.name,
    channel: campaign.channel,
    country: campaign.country,
    currency: campaign.currency,
    budgetMinor: campaign.budgetMinor,
    landingUrl: campaign.landingUrl,
    minimumAge: campaign.minimumAge,
    missing: readiness(campaign),
    externalStatus: "NOT_SUBMITTED",
    note: "Planning brief only. Budget is a plan, not actual spend. Platform-specific ad set, creative and account approval are required.",
  };
}
export type Report = ReturnType<typeof summarize>;
export type BackendEvent = EventInput;
