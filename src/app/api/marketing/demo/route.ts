import { authorizeRequest } from "@/lib/auth/server";
import { exampleState } from "@/lib/marketing/demo";
import { demoMode, transact } from "@/lib/marketing/store";
import { errorResponse } from "@/lib/marketing/http";
import { MarketingError } from "@/lib/marketing/model";

export async function POST(request: Request) {
  try {
    if (!demoMode()) throw new MarketingError("Not found", 404);
    authorizeRequest(request);
    await transact((state) => {
      if (
        state.campaigns.length ||
        state.events.length ||
        state.partners.length
      )
        throw new MarketingError(
          "โหลดตัวอย่างได้เฉพาะพื้นที่สาธิตที่ว่าง",
          409,
        );
      Object.assign(state, exampleState());
    });
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
