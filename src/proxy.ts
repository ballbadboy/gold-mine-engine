import { NextResponse, type NextRequest } from "next/server";
import {
  sameOrigin,
  sessionFromRequest,
  validSession,
} from "@/lib/auth/session";

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const demo =
    process.env.MARKETING_DEMO_MODE === "true" &&
    process.env.NODE_ENV !== "production";
  const publicRoute =
    pathname === "/login" ||
    pathname === "/api/session" ||
    pathname === "/api/marketing/events" ||
    pathname.startsWith("/go/") ||
    pathname.startsWith("/read/") ||
    pathname === "/llms.txt" ||
    pathname === "/api/cron/loop";
  if (demo) {
    const allowed =
      pathname === "/" ||
      pathname === "/marketing" ||
      pathname === "/api/marketing" ||
      pathname === "/api/marketing/export" ||
      pathname === "/api/marketing/demo" ||
      pathname.startsWith("/go/") ||
      pathname === "/login";
    if (!allowed)
      return NextResponse.json(
        { error: "Not available in demo" },
        { status: 403 },
      );
  } else if (!publicRoute && !validSession(sessionFromRequest(request))) {
    if (pathname.startsWith("/api/"))
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (
    !["GET", "HEAD", "OPTIONS"].includes(request.method) &&
    pathname !== "/api/marketing/events" &&
    !sameOrigin(request)
  ) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }
  const response = NextResponse.next();
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("X-Frame-Options", "DENY");
  if (!pathname.startsWith("/read/") && pathname !== "/llms.txt") {
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
  }
  return response;
}
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
