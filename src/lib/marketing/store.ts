import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { emptyState, MarketingError, stateSchema, type State } from "./model";

export const demoMode = () =>
  process.env.MARKETING_DEMO_MODE === "true" &&
  process.env.NODE_ENV !== "production";
export function storeMode() {
  return demoMode() ? "file" : (process.env.MARKETING_STORE ?? "supabase");
}
function storeFile() {
  if (process.env.NODE_ENV === "production" && storeMode() === "file")
    throw new MarketingError("Production ต้องใช้ Supabase", 503);
  return path.resolve(
    process.env.MARKETING_DATA_DIR ?? ".data",
    demoMode() ? "marketing-demo.json" : "marketing.json",
  );
}
function client() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key)
    throw new MarketingError("ยังไม่ได้ตั้งค่าฐานข้อมูลการตลาด", 503);
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
function validateSize(state: State) {
  // Bounded pilot workspace. Fail explicitly rather than discard historical events.
  const records =
    state.events.length +
    state.clicks.length +
    state.audit.length +
    state.spend.length;
  if (records > 20_000 || Buffer.byteLength(JSON.stringify(state)) > 8_000_000)
    throw new MarketingError(
      "พื้นที่นำร่องเต็ม ต้องย้ายประวัติไปตาราง events ก่อนรับข้อมูลเพิ่ม",
      507,
    );
}
export async function readState(): Promise<State> {
  if (storeMode() === "file") {
    try {
      return stateSchema.parse(JSON.parse(await readFile(storeFile(), "utf8")));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT")
        return emptyState();
      throw error;
    }
  }
  if (storeMode() !== "supabase")
    throw new MarketingError("MARKETING_STORE ไม่ถูกต้อง", 503);
  const { data, error } = await client()
    .from("marketing_workspaces")
    .select("state")
    .eq("id", process.env.MARKETING_WORKSPACE_ID ?? "owner")
    .maybeSingle();
  if (error)
    throw new MarketingError(
      "อ่านฐานข้อมูลไม่สำเร็จ ตรวจ migration และการเชื่อมต่อ",
      503,
    );
  return data ? stateSchema.parse(data.state) : emptyState();
}
export async function transact<T>(mutate: (state: State) => T): Promise<T> {
  if (storeMode() === "file") {
    const file = storeFile(),
      lock = `${file}.lock`;
    await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
    let locked = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      try {
        await mkdir(lock, { mode: 0o700 });
        locked = true;
        break;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
    }
    if (!locked)
      throw new MarketingError(
        "พื้นที่ข้อมูลกำลังถูกใช้งาน กรุณาลองอีกครั้ง",
        503,
      );
    const temporary = `${file}.${randomUUID()}.tmp`;
    try {
      const state = await readState();
      const result = mutate(state);
      validateSize(state);
      stateSchema.parse(state);
      await writeFile(temporary, JSON.stringify(state), { mode: 0o600 });
      await rename(temporary, file);
      return result;
    } finally {
      await rm(temporary, { force: true });
      await rm(lock, { recursive: true, force: true });
    }
  }
  if (storeMode() !== "supabase")
    throw new MarketingError("MARKETING_STORE ไม่ถูกต้อง", 503);
  const db = client(),
    workspace = process.env.MARKETING_WORKSPACE_ID ?? "owner";
  for (let attempt = 0; attempt < 8; attempt++) {
    const { data, error } = await db
      .from("marketing_workspaces")
      .select("revision,state")
      .eq("id", workspace)
      .maybeSingle();
    if (error) throw new MarketingError("อ่านฐานข้อมูลไม่สำเร็จ", 503);
    const state = data ? stateSchema.parse(data.state) : emptyState();
    const result = mutate(state);
    validateSize(state);
    stateSchema.parse(state);
    const { data: saved, error: saveError } = await db.rpc(
      "marketing_compare_and_swap",
      { p_id: workspace, p_revision: data?.revision ?? 0, p_state: state },
    );
    if (saveError) throw new MarketingError("บันทึกฐานข้อมูลไม่สำเร็จ", 503);
    if (saved === true) return result;
  }
  throw new MarketingError("มีการแก้ข้อมูลพร้อมกัน กรุณาลองอีกครั้ง", 409);
}
