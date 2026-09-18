import { ZodError } from "zod";
import { MarketingError } from "./model";

export async function limitedText(request: Request, limit = 32_768) {
  if (Number(request.headers.get("content-length") ?? 0) > limit)
    throw new MarketingError("Request ใหญ่เกินกำหนด", 413);
  const reader = request.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > limit) {
        await reader.cancel();
        throw new MarketingError("Request ใหญ่เกินกำหนด", 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks).toString("utf8");
}
export async function jsonBody(request: Request) {
  try {
    return JSON.parse(await limitedText(request));
  } catch (error) {
    if (error instanceof MarketingError) throw error;
    throw new MarketingError("JSON ไม่ถูกต้อง");
  }
}
export function errorResponse(error: unknown) {
  if (error instanceof MarketingError)
    return Response.json({ error: error.message }, { status: error.status });
  if (error instanceof ZodError)
    return Response.json(
      {
        error: "ข้อมูลไม่ครบหรือรูปแบบไม่ถูกต้อง",
        fields: error.issues.map((issue) => issue.path.join(".")),
      },
      { status: 400 },
    );
  return Response.json(
    { error: "ระบบไม่พร้อมใช้งาน กรุณาตรวจการตั้งค่าและลองอีกครั้ง" },
    { status: 503 },
  );
}
