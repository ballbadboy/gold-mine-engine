import { randomUUID } from "node:crypto";
import { generate, listProviders, type ProviderName } from "../ai";
import { MarketingError } from "../marketing/model";
import { demoMode, readState, transact } from "../marketing/store";
import {
  applySupportCommand,
  beginMessage,
  findThread,
  finishMessage,
  maintainSupport,
  publicThread,
  reserveAI,
  RETENTION_MS,
  supportReport,
} from "./domain";
import { operationsAnswer, selectAnswer, type Complete } from "./assistant";
import type { SupportState, Thread } from "./model";

export function supportConfig() {
  const requested = process.env.SUPPORT_AI_PROVIDER;
  const provider = listProviders().find(
    (p) => p.configured && (!requested || p.name === requested),
  );
  const limit = Number(process.env.SUPPORT_AI_DAILY_LIMIT ?? "50");
  return {
    demo: demoMode(),
    publicEnabled: demoMode() || process.env.SUPPORT_PUBLIC_ENABLED === "true",
    aiEnabled:
      !demoMode() && process.env.SUPPORT_AI_ENABLED === "true" && !!provider,
    provider: provider?.name ?? null,
    dailyLimit:
      Number.isInteger(limit) && limit >= 0 && limit <= 1000 ? limit : 0,
  };
}
function completeWith(provider: ProviderName): Complete {
  return async (system, input) =>
    (
      await generate([{ role: "user", content: input }], {
        provider,
        model: process.env.SUPPORT_AI_MODEL || undefined,
        system,
        maxTokens: 160,
        temperature: 0,
        signal: AbortSignal.timeout(10_000),
        maxRetries: 0,
      })
    ).text;
}
export function needThread(
  state: SupportState,
  cookie: string | undefined,
  now = new Date(),
) {
  const thread = findThread(state, cookie, now);
  if (!thread)
    throw new MarketingError("แชตหมดอายุแล้ว กรุณาเริ่มแชตใหม่", 401);
  return thread;
}
export async function currentSupport() {
  const state = (await readState()).support;
  const now = new Date();
  if (
    state.threads.some(
      (t) =>
        Date.parse(t.createdAt) + RETENTION_MS <= now.getTime() ||
        (t.pending && Date.parse(t.pending.startedAt) + 20_000 < now.getTime()),
    )
  ) {
    return transact((root) => {
      maintainSupport(root.support, now);
      return root.support;
    });
  }
  return state;
}
export async function playerMessage(
  cookie: string | undefined,
  requestId: string,
  text: string,
) {
  const config = supportConfig();
  const prepared = await transact((root) => {
    maintainSupport(root.support);
    const thread = needThread(root.support, cookie);
    return {
      thread: publicThread(thread),
      work: beginMessage(
        root.support,
        thread,
        requestId,
        text,
        config.aiEnabled,
        config.dailyLimit,
      ),
    };
  });
  if (prepared.work.duplicate)
    return publicThread(needThread(await currentSupport(), cookie));
  const { work } = prepared;
  const decision =
    work.decision ??
    (await selectAnswer(
      work.question,
      work.candidates,
      completeWith(config.provider!),
    ));
  return transact((root) => {
    const thread = needThread(root.support, cookie);
    return finishMessage(root.support, thread, requestId, decision);
  });
}
export async function askOwner(question: string) {
  const config = supportConfig();
  // No player conversations or financial records are ever included in model input.
  const complete: Complete | undefined =
    config.aiEnabled && config.provider
      ? async (system, input) => {
          const allowed = await transact((root) =>
            reserveAI(root.support, config.dailyLimit),
          );
          if (!allowed)
            throw new MarketingError("โควตา AI วันนี้เต็มแล้ว", 429);
          return completeWith(config.provider!)(system, input);
        }
      : undefined;
  return operationsAnswer(await currentSupport(), question, complete);
}
export function ownerView(state: SupportState) {
  return {
    config: supportConfig(),
    report: supportReport(state),
    articles: state.articles,
    threads: [...state.threads]
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map((t) => ({ ...publicThread(t), reason: t.reason })),
    activity: state.activity.slice(-20).reverse(),
  };
}
export function seedSupport(state: SupportState) {
  if (!demoMode()) throw new MarketingError("ใช้ได้เฉพาะพื้นที่สาธิต", 404);
  if (state.articles.length || state.threads.length)
    throw new MarketingError(
      "โหลดตัวอย่างได้เมื่อพื้นที่แอดมินว่างเท่านั้น",
      409,
    );
  const now = new Date();
  for (const input of [
    {
      title: "เกมค้างหรือโหลดไม่ขึ้น (ตัวอย่าง)",
      keywords: ["เกมค้าง", "โหลดไม่ขึ้น", "game frozen"],
      answer:
        "ตัวอย่างคำตอบ: ลองรีเฟรชหน้าเกมและตรวจอินเทอร์เน็ต หากยังพบปัญหา แจ้งชื่ออุปกรณ์ เบราว์เซอร์ และช่วงเวลาที่เกิดเหตุ โดยไม่ส่งรหัสผ่านหรือข้อมูลส่วนตัว ทีมงานต้องปรับคำตอบนี้ให้ตรงกับเกมก่อนใช้งานจริง",
    },
    {
      title: "แจ้งข้อผิดพลาด (ตัวอย่าง)",
      keywords: ["แจ้งบั๊ก", "แจ้งข้อผิดพลาด", "report bug"],
      answer:
        "ตัวอย่างคำตอบ: บอกขั้นตอนที่ทำก่อนเกิดปัญหา ข้อความผิดพลาด และอุปกรณ์ที่ใช้ จากนั้นกดขอผู้ดูแลในแชตนี้ ระบบรับเรื่องได้ แต่ยังไม่ระบุระยะเวลาแก้ไข",
    },
    {
      title: "เกี่ยวกับศูนย์ช่วยเหลือ (ตัวอย่าง)",
      keywords: ["ศูนย์ช่วยเหลือ", "help center"],
      answer:
        "คุณกำลังคุยกับผู้ช่วยอัตโนมัติที่ตอบจากคลังคำตอบที่ผู้ดูแลเผยแพร่ไว้ หากคำถามยังไม่มีคำตอบ ระบบจะรับเรื่องเข้ากล่องผู้ดูแล คุณกลับมาอ่านคำตอบในเบราว์เซอร์เดิมได้ภายในระยะเก็บแชต 30 วัน",
    },
  ]) {
    const { id } = applySupportCommand(
      state,
      { type: "article.save", input },
      now,
    );
    applySupportCommand(
      state,
      { type: "article.publish", id, revision: 1, published: true },
      now,
    );
  }
  const earlier = new Date(now.getTime() - 26 * 3600_000).toISOString();
  const thread: Thread = {
    id: randomUUID(),
    tokenHash: "0".repeat(64),
    createdAt: earlier,
    updatedAt: earlier,
    status: "waiting",
    reason: "no_answer",
    pending: null,
    messages: [
      {
        id: randomUUID(),
        role: "player",
        text: "ตัวอย่าง: เกมรองรับแท็บเล็ตหรือยังครับ",
        createdAt: earlier,
      },
    ],
  };
  state.threads.push(thread);
  return { ok: true };
}
