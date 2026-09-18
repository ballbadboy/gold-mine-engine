import { authorizeRequest } from "@/lib/auth/server";
import { exportCampaign, summarize } from "@/lib/marketing/domain";
import { readState } from "@/lib/marketing/store";
import { MarketingError } from "@/lib/marketing/model";
import { errorResponse } from "@/lib/marketing/http";

export async function GET(request: Request) {
  try {
    authorizeRequest(request);
    const state = await readState(),
      campaignId = new URL(request.url).searchParams.get("campaignId");
    if (campaignId) {
      const campaign = state.campaigns.find((item) => item.id === campaignId);
      if (!campaign) throw new MarketingError("ไม่พบแคมเปญ", 404);
      return new Response(JSON.stringify(exportCampaign(campaign), null, 2), {
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="campaign-${campaign.id}.json"`,
          "Cache-Control": "no-store",
        },
      });
    }
    const cell = (value: unknown) => {
      const text = String(value ?? "");
      return `"${(/^[=+@\-\t\r]/.test(text) ? `'${text}` : text).replaceAll('"', '""')}"`;
    };
    const rows = summarize(state).rows;
    const columns = [
      "campaignId",
      "name",
      "currency",
      "clicks",
      "registrations",
      "firstDepositors",
      "depositsMinor",
      "spendMinor",
      "commissionMinor",
      "netRevenueMinor",
      "contributionMinor",
      "costPerFirstDepositorMinor",
      "roas",
      "roi",
    ] as const;
    const csv =
      "\uFEFF" +
      [
        columns.join(","),
        ...rows.map((row) => columns.map((key) => cell(row[key])).join(",")),
      ].join("\r\n");
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition":
          'attachment; filename="marketing-report-all-time.csv"',
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
