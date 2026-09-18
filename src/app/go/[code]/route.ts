import { recordClick } from "@/lib/marketing/domain";
import { transact } from "@/lib/marketing/store";
import { errorResponse } from "@/lib/marketing/http";
import { MarketingError } from "@/lib/marketing/model";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(
  _request: Request,
  context: { params: Promise<{ code: string }> },
) {
  try {
    const { code } = await context.params;
    if (!/^[a-f0-9]{24}$/.test(code))
      throw new MarketingError("ไม่พบลิงก์", 404);
    const result = await transact((state) => recordClick(state, code));
    return new Response(null, {
      status: 302,
      headers: {
        Location: result.destination,
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
