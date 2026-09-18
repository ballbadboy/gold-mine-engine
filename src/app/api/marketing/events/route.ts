import { validWebhook } from "@/lib/auth/session";
import { receiveEvent } from "@/lib/marketing/domain";
import { demoMode, transact } from "@/lib/marketing/store";
import { errorResponse, limitedText } from "@/lib/marketing/http";
import { MarketingError } from "@/lib/marketing/model";

export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    if (demoMode())
      throw new MarketingError("Demo ไม่รับข้อมูลจากระบบจริง", 403);
    const raw = await limitedText(request, 16_384);
    if (
      !validWebhook(
        raw,
        request.headers.get("x-gm-timestamp"),
        request.headers.get("x-gm-signature"),
      )
    )
      throw new MarketingError("Invalid webhook signature", 401);
    let payload: unknown;
    try {
      payload = JSON.parse(raw);
    } catch {
      throw new MarketingError("JSON ไม่ถูกต้อง");
    }
    const secret = process.env.MARKETING_PLAYER_HASH_SECRET ?? "";
    const result = await transact((state) =>
      receiveEvent(state, payload, secret),
    );
    return Response.json({ ok: true, ...result });
  } catch (error) {
    return errorResponse(error);
  }
}
