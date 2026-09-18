import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { MarketingError } from "@/lib/marketing/model";
import { demoMode } from "@/lib/marketing/store";
import {
  validSession,
  SESSION_COOKIE,
  sessionFromRequest,
  sameOrigin,
} from "./session";

export async function requireOwner() {
  if (demoMode()) return;
  if (!validSession((await cookies()).get(SESSION_COOKIE)?.value))
    redirect("/login");
}
export function authorizeRequest(request: Request) {
  if (!demoMode() && !validSession(sessionFromRequest(request)))
    throw new MarketingError("กรุณาเข้าสู่ระบบ", 401);
  if (!["GET", "HEAD"].includes(request.method) && !sameOrigin(request))
    throw new MarketingError("Origin ไม่ถูกต้อง", 403);
}
