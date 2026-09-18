import { applyCommand, receiveEvent, recordClick } from "./domain";
import { emptyState } from "./model";

export function exampleState(now = new Date()) {
  const state = emptyState();
  const earlier = new Date(now.getTime() - 3 * 86_400_000).toISOString();
  const partnerId = applyCommand(
    state,
    {
      type: "partner.create",
      input: { name: "Sample Creator Network", currency: "USD", cpaMinor: 500 },
    },
    earlier,
  ).id;
  for (const [index, channel] of (["meta", "affiliate"] as const).entries()) {
    const campaignId = applyCommand(
      state,
      {
        type: "campaign.create",
        input: {
          name: index
            ? "Partner launch · ตัวอย่าง"
            : "Brand discovery · ตัวอย่าง",
          country: "PH",
          currency: "USD",
          channel,
          budgetMinor: 100_000,
          landingUrl: "https://example.com/game-preview",
          minimumAge: 21,
          marketReference: "DEMO_ONLY · ไม่ใช่ใบอนุญาตจริง",
          platformReference: "DEMO_ONLY · ไม่ใช่การอนุญาตจริง",
        },
      },
      earlier,
    ).id;
    applyCommand(
      state,
      { type: "campaign.status", id: campaignId, status: "approved" },
      earlier,
    );
    const linkId = applyCommand(
      state,
      { type: "link.create", campaignId, partnerId: index ? partnerId : null },
      earlier,
    ).id;
    const link = state.links.find((item) => item.id === linkId)!;
    for (let i = 0; i < 36; i++) {
      const clickedAt = new Date(
        now.getTime() - (2 - (i % 3)) * 86_400_000 - 60_000,
      ).toISOString();
      const occurredAt = new Date(Date.parse(clickedAt) + 30_000).toISOString();
      const { clickId } = recordClick(state, link.code, clickedAt);
      if (i >= 12) continue;
      const base = {
        playerId: `sample_player_${index}_${i}`,
        occurredAt,
        clickId,
        currency: "USD",
      };
      receiveEvent(
        state,
        {
          ...base,
          eventId: `registration_${index}_${i}`,
          type: "registration",
          amountMinor: 0,
        },
        "demo-player-key-with-no-real-identities",
        now.toISOString(),
      );
      if (i >= (index ? 8 : 4)) continue;
      receiveEvent(
        state,
        {
          ...base,
          eventId: `firstdeposit_${index}_${i}`,
          type: "first_deposit",
          amountMinor: 5000,
        },
        "demo-player-key-with-no-real-identities",
        now.toISOString(),
      );
      receiveEvent(
        state,
        {
          ...base,
          eventId: `netrevenue_${index}_${i}`,
          type: "net_revenue",
          amountMinor: 3500,
        },
        "demo-player-key-with-no-real-identities",
        now.toISOString(),
      );
    }
    applyCommand(
      state,
      {
        type: "spend.set",
        campaignId,
        date: now.toISOString().slice(0, 10),
        amountMinor: index ? 1500 : 18_000,
      },
      now.toISOString(),
    );
  }
  return state;
}
