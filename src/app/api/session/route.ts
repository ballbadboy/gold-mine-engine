import { NextResponse } from "next/server";
import {
  authConfigured,
  createSession,
  sameOrigin,
  SESSION_COOKIE,
  SESSION_SECONDS,
  verifyPassword,
} from "@/lib/auth/session";
import { limitedText, errorResponse } from "@/lib/marketing/http";
import { MarketingError } from "@/lib/marketing/model";

// Supplemental process-level throttle. Production also needs an ingress rate limit.
let failures = 0,
  windowStarted = 0;
export async function POST(request: Request) {
  try {
    if (!sameOrigin(request)) throw new MarketingError("Invalid origin", 403);
    if (!authConfigured())
      throw new MarketingError("ผู้ดูแลยังไม่ได้ตั้งค่าการเข้าสู่ระบบ", 503);
    if (Date.now() - windowStarted > 60_000) {
      failures = 0;
      windowStarted = Date.now();
    }
    if (failures >= 10)
      throw new MarketingError("ลองใหม่อีกครั้งในอีกหนึ่งนาที", 429);
    let payload: { password?: unknown };
    try {
      payload = JSON.parse(await limitedText(request, 2048));
    } catch {
      throw new MarketingError("ข้อมูลไม่ถูกต้อง");
    }
    if (
      typeof payload.password !== "string" ||
      !verifyPassword(payload.password)
    ) {
      failures++;
      throw new MarketingError("รหัสผ่านไม่ถูกต้อง", 401);
    }
    const response = NextResponse.json({ ok: true });
    response.cookies.set(SESSION_COOKIE, createSession(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: SESSION_SECONDS,
    });
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}
export async function DELETE(request: Request) {
  if (!sameOrigin(request))
    return Response.json({ error: "Invalid origin" }, { status: 403 });
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
  return response;
}
