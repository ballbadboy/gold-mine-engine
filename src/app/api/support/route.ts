import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { sameOrigin } from "@/lib/auth/session";
import { errorResponse, jsonBody } from "@/lib/marketing/http";
import { MarketingError } from "@/lib/marketing/model";
import { transact } from "@/lib/marketing/store";
import {
  findThread,
  maintainSupport,
  publicThread,
  requestHandoff,
  SESSION_COOKIE,
  startThread,
} from "@/lib/support/domain";
import { publicCommand } from "@/lib/support/model";
import {
  currentSupport,
  needThread,
  playerMessage,
  supportConfig,
} from "@/lib/support/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
function requireEnabled() {
  if (!supportConfig().publicEnabled)
    throw new MarketingError("ศูนย์ช่วยเหลือยังไม่เปิดใช้งาน", 404);
}
export async function GET() {
  try {
    requireEnabled();
    const state = await currentSupport();
    const thread = findThread(
      state,
      (await cookies()).get(SESSION_COOKIE)?.value,
    );
    return Response.json(
      {
        demo: supportConfig().demo,
        aiEnabled: supportConfig().aiEnabled,
        topics: state.articles
          .filter((a) => a.status === "published")
          .map((a) => ({ id: a.id, title: a.title })),
        thread: thread ? publicThread(thread) : null,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
export async function POST(request: Request) {
  try {
    requireEnabled();
    if (!sameOrigin(request))
      throw new MarketingError("Origin ไม่ถูกต้อง", 403);
    const command = publicCommand.parse(await jsonBody(request));
    const cookie = (await cookies()).get(SESSION_COOKIE)?.value;
    if (command.type === "start") {
      const result = await transact((root) => {
        maintainSupport(root.support);
        const existing = findThread(root.support, cookie);
        return existing
          ? { thread: existing, cookie: cookie! }
          : startThread(root.support);
      });
      const response = NextResponse.json(
        { thread: publicThread(result.thread) },
        { status: 201 },
      );
      // The bearer secret stays in an HttpOnly cookie, never in URLs or JavaScript storage.
      response.cookies.set(SESSION_COOKIE, result.cookie, {
        httpOnly: true,
        sameSite: "strict",
        secure:
          process.env.NODE_ENV === "production" ||
          new URL(request.url).protocol === "https:",
        path: "/api/support",
        maxAge: Math.max(
          0,
          Math.floor(
            (Date.parse(result.thread.createdAt) +
              30 * 86400_000 -
              Date.now()) /
              1000,
          ),
        ),
      });
      return response;
    }
    if (command.type === "handoff") {
      const thread = await transact((root) => {
        const thread = needThread(root.support, cookie);
        requestHandoff(thread);
        return publicThread(thread);
      });
      return Response.json({ thread });
    }
    return Response.json({
      thread: await playerMessage(cookie, command.requestId, command.text),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
