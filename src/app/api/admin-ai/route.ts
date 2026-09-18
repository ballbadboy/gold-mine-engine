import { authorizeRequest } from "@/lib/auth/server";
import { errorResponse, jsonBody } from "@/lib/marketing/http";
import { transact } from "@/lib/marketing/store";
import { applySupportCommand } from "@/lib/support/domain";
import { ownerCommand } from "@/lib/support/model";
import {
  askOwner,
  currentSupport,
  ownerView,
  seedSupport,
} from "@/lib/support/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    authorizeRequest(request);
    return Response.json(ownerView(await currentSupport()), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
export async function POST(request: Request) {
  try {
    authorizeRequest(request);
    const command = ownerCommand.parse(await jsonBody(request));
    if (command.type === "assistant.ask")
      return Response.json(await askOwner(command.question));
    const result = await transact((root) =>
      command.type === "demo.seed"
        ? seedSupport(root.support)
        : applySupportCommand(root.support, command),
    );
    return Response.json({ ok: true, ...result }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
