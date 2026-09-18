import { authorizeRequest } from "@/lib/auth/server";
import { applyCommand, summarize } from "@/lib/marketing/domain";
import { dateSchema, MarketingError } from "@/lib/marketing/model";
import {
  demoMode,
  readState,
  storeMode,
  transact,
} from "@/lib/marketing/store";
import { errorResponse, jsonBody } from "@/lib/marketing/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    authorizeRequest(request);
    const url = new URL(request.url);
    const from = url.searchParams.get("from")
      ? dateSchema.parse(url.searchParams.get("from"))
      : undefined;
    const to = url.searchParams.get("to")
      ? dateSchema.parse(url.searchParams.get("to"))
      : undefined;
    if (from && to && from > to)
      throw new MarketingError("ช่วงวันที่ไม่ถูกต้อง");
    const state = await readState();
    return Response.json(
      {
        demo: demoMode(),
        storage: storeMode(),
        campaigns: state.campaigns,
        partners: state.partners,
        links: state.links,
        report: summarize(state, from, to),
        recentAudit: state.audit.slice(-12).reverse(),
        eventCount: state.events.length,
        integrations: {
          backend:
            !demoMode() &&
            (process.env.MARKETING_WEBHOOK_SECRET?.length ?? 0) >= 32,
          ads: "brief-export-only",
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
export async function POST(request: Request) {
  try {
    authorizeRequest(request);
    const command = await jsonBody(request);
    const result = await transact((state) => applyCommand(state, command));
    return Response.json({ ok: true, ...result }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
