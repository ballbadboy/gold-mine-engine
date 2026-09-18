import {
  createHash,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import { MarketingError } from "../marketing/model";
import {
  articleInput,
  ownerCommand,
  type Article,
  type Decision,
  type PublicThread,
  type SupportState,
  type Thread,
} from "./model";

export const RETENTION_MS = 30 * 86400_000;
export const SESSION_COOKIE = "gm_support_session";
const normalize = (text: string) =>
  text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\u200b-\u200f\ufeff]/g, "")
    .replace(/\s+/g, " ")
    .trim();
export function redact(text: string) {
  return text
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[อีเมล]")
    .replace(
      /((?:password|passwd|รหัสผ่าน|otp|โค้ดยืนยัน)\s*[:=]?\s*)\S+/gi,
      "$1[ปกปิด]",
    )
    .replace(/(?:\+?\d[\s().-]*){5,}/g, "[หมายเลข]")
    .trim();
}
export function requiresHuman(text: string) {
  return /เจ้าหน้าที่|แอดมิน|คุยกับคน|ขอคน|human|agent|refund|chargeback|withdraw|deposit|payment|password|\botp\b|hacked|delete.*account|คืนเงิน|ถอนเงิน|ฝากเงิน|ยอดเงิน|เติมเงิน|บัตรเครดิต|รหัสผ่าน|แฮก|แฮ็ค|ลบบัญชี|ปิดบัญชี|ทำร้ายตัวเอง|ฆ่าตัวตาย/i.test(
    normalize(text),
  );
}
export function publicThread(thread: Thread): PublicThread {
  return {
    id: thread.id,
    status: thread.status,
    createdAt: thread.createdAt,
    updatedAt: thread.updatedAt,
    messages: thread.messages,
    pending: !!thread.pending,
  };
}
export function findThread(
  state: SupportState,
  cookie: string | undefined,
  now = new Date(),
): Thread | null {
  if (!cookie || !/^[a-f0-9-]{36}\.[a-f0-9]{64}$/.test(cookie)) return null;
  const [id, token] = cookie.split(".");
  const thread = state.threads.find((t) => t.id === id);
  if (!thread || Date.parse(thread.createdAt) + RETENTION_MS <= now.getTime())
    return null;
  const hash = createHash("sha256").update(token).digest();
  return timingSafeEqual(hash, Buffer.from(thread.tokenHash, "hex"))
    ? thread
    : null;
}
export function usageToday(state: SupportState, now = new Date()) {
  const date = now.toISOString().slice(0, 10);
  let usage = state.usage.find((u) => u.date === date);
  if (!usage) {
    usage = { date, starts: 0, messages: 0, aiCalls: 0 };
    state.usage.push(usage);
    state.usage = state.usage.filter(
      (u) =>
        u.date >=
        new Date(now.getTime() - 7 * 86400_000).toISOString().slice(0, 10),
    );
  }
  return usage;
}
export function reserveAI(
  state: SupportState,
  limit: number,
  now = new Date(),
) {
  const usage = usageToday(state, now);
  if (usage.aiCalls >= limit) return false;
  usage.aiCalls++;
  return true;
}
function append(
  thread: Thread,
  text: string,
  role: "assistant" | "owner",
  now: Date,
  extra: Partial<Thread["messages"][number]> = {},
) {
  if (thread.messages.length >= 100)
    throw new MarketingError("บทสนทนานี้เต็มแล้ว", 429);
  thread.messages.push({
    id: randomUUID(),
    role,
    text,
    createdAt: now.toISOString(),
    ...extra,
  });
  thread.updatedAt = now.toISOString();
}
function handoff(thread: Thread, reason: string, now: Date, replyTo?: string) {
  thread.status = "waiting";
  thread.reason = reason;
  thread.pending = null;
  append(
    thread,
    "รับเรื่องไว้ในกล่องผู้ดูแลแล้วครับ กลับมาตรวจคำตอบในแชตนี้ได้ ยังไม่สามารถระบุเวลาตอบได้ กรุณาอย่าส่งรหัสผ่าน OTP หรือข้อมูลการเงิน",
    "assistant",
    now,
    { replyTo },
  );
}
export function maintainSupport(state: SupportState, now = new Date()) {
  state.threads = state.threads.filter(
    (t) => Date.parse(t.createdAt) + RETENTION_MS > now.getTime(),
  );
  for (const thread of state.threads) {
    if (
      thread.pending &&
      Date.parse(thread.pending.startedAt) + 20_000 < now.getTime()
    ) {
      handoff(thread, "interrupted", now, thread.pending.requestId);
    }
  }
}
export function startThread(state: SupportState, now = new Date()) {
  maintainSupport(state, now);
  const usage = usageToday(state, now);
  if (usage.starts >= 100 || state.threads.length >= 500)
    throw new MarketingError(
      "วันนี้ศูนย์ช่วยเหลือรับเรื่องเต็มแล้ว กรุณาลองใหม่ภายหลัง",
      429,
    );
  usage.starts++;
  const token = randomBytes(32).toString("hex");
  const thread: Thread = {
    id: randomUUID(),
    tokenHash: createHash("sha256").update(token).digest("hex"),
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    status: "bot",
    reason: "",
    pending: null,
    messages: [],
  };
  state.threads.push(thread);
  return { thread, cookie: `${thread.id}.${token}` };
}
export function matchArticle(
  articles: Article[],
  question: string,
): Article | null {
  const q = normalize(question);
  // Only a single explicit title/phrase match can bypass semantic classification.
  const matches = articles.filter(
    (a) =>
      a.status === "published" &&
      [a.title, ...a.keywords].some((k) => {
        const phrase = normalize(k);
        return phrase.length >= 4 && q.includes(phrase);
      }),
  );
  return matches.length === 1 ? matches[0] : null;
}
export function beginMessage(
  state: SupportState,
  thread: Thread,
  requestId: string,
  rawText: string,
  useAI: boolean,
  limit: number,
  now = new Date(),
) {
  const text = redact(rawText);
  const existing = thread.messages.find((m) => m.id === requestId);
  if (existing) {
    if (existing.role !== "player" || existing.text !== text)
      throw new MarketingError("รหัสข้อความถูกใช้กับข้อมูลอื่นแล้ว", 409);
    return { duplicate: true as const };
  }
  if (thread.pending) throw new MarketingError("กำลังตอบข้อความก่อนหน้า", 409);
  const last = thread.messages.filter((m) => m.role === "player").at(-1);
  if (last && now.getTime() - Date.parse(last.createdAt) < 2000)
    throw new MarketingError("กรุณาเว้นช่วงก่อนส่งข้อความถัดไป", 429);
  if (
    thread.messages.length > 94 ||
    thread.messages.filter((m) => m.role === "player").length >= 30
  )
    throw new MarketingError("ถึงจำนวนข้อความสูงสุดของบทสนทนานี้แล้ว", 429);
  const usage = usageToday(state, now);
  if (usage.messages >= 1000)
    throw new MarketingError("วันนี้ศูนย์ช่วยเหลือรับข้อความเต็มแล้ว", 429);
  usage.messages++;
  thread.messages.push({
    id: requestId,
    role: "player",
    text,
    createdAt: now.toISOString(),
  });
  thread.updatedAt = now.toISOString();
  thread.pending = { requestId, startedAt: now.toISOString() };
  let decision: Decision | undefined;
  if (
    requiresHuman(rawText) ||
    thread.status === "waiting" ||
    thread.status === "human" ||
    thread.messages.some((m) => m.role === "owner")
  )
    decision = { handoff: "human_required" };
  const article = !decision ? matchArticle(state.articles, text) : null;
  if (article)
    decision = {
      articleId: article.id,
      revision: article.revision,
      mode: "knowledge",
    };
  const candidates = state.articles.filter((a) => a.status === "published");
  if (
    !decision &&
    (!useAI || !candidates.length || !reserveAI(state, limit, now))
  )
    decision = { handoff: "no_answer" };
  return { duplicate: false as const, question: text, candidates, decision };
}
export function finishMessage(
  state: SupportState,
  thread: Thread,
  requestId: string,
  decision: Decision,
  now = new Date(),
) {
  // A staff reply/takeover or timeout recovery always wins a race with the model.
  if (thread.pending?.requestId !== requestId) return publicThread(thread);
  if ("articleId" in decision) {
    const article = state.articles.find(
      (a) =>
        a.id === decision.articleId &&
        a.revision === decision.revision &&
        a.status === "published",
    );
    if (article) {
      thread.pending = null;
      thread.status = "bot";
      thread.reason = decision.mode;
      append(thread, article.answer, "assistant", now, {
        replyTo: requestId,
        sourceId: article.id,
        sourceTitle: article.title,
        sourceRevision: article.revision,
      });
      return publicThread(thread);
    }
  }
  handoff(
    thread,
    "handoff" in decision ? decision.handoff : "knowledge_changed",
    now,
    requestId,
  );
  return publicThread(thread);
}
export function requestHandoff(thread: Thread, now = new Date()) {
  if (thread.status !== "waiting" && thread.status !== "human")
    handoff(thread, "player_requested", now, thread.pending?.requestId);
}
function log(state: SupportState, action: string, targetId: string, now: Date) {
  state.activity.push({
    id: randomUUID(),
    action,
    targetId,
    at: now.toISOString(),
  });
  state.activity = state.activity.slice(-200);
}
export function applySupportCommand(
  state: SupportState,
  raw: unknown,
  now = new Date(),
) {
  const command = ownerCommand.parse(raw);
  maintainSupport(state, now);
  if (command.type === "article.save") {
    const input = articleInput.parse(command.input);
    let article = command.id
      ? state.articles.find((a) => a.id === command.id)
      : undefined;
    if (command.id && !article) throw new MarketingError("ไม่พบคำตอบ", 404);
    if (article && article.revision !== command.revision)
      throw new MarketingError("คำตอบมีการแก้ไขแล้ว กรุณาโหลดใหม่", 409);
    if (article)
      Object.assign(article, input, {
        status: "draft",
        revision: article.revision + 1,
        updatedAt: now.toISOString(),
      });
    else {
      if (state.articles.length >= 50)
        throw new MarketingError("คลังคำตอบเต็ม (50 เรื่อง)", 429);
      article = {
        ...input,
        id: randomUUID(),
        revision: 1,
        status: "draft",
        updatedAt: now.toISOString(),
      };
      state.articles.push(article);
    }
    log(state, command.type, article.id, now);
    return { id: article.id };
  }
  if (command.type === "article.publish") {
    const article = state.articles.find((a) => a.id === command.id);
    if (!article) throw new MarketingError("ไม่พบคำตอบ", 404);
    if (article.revision !== command.revision)
      throw new MarketingError("คำตอบมีการแก้ไขแล้ว กรุณาโหลดใหม่", 409);
    article.status = command.published ? "published" : "draft";
    article.revision++;
    article.updatedAt = now.toISOString();
    log(
      state,
      command.published ? "article.published" : "article.unpublished",
      article.id,
      now,
    );
    return { id: article.id };
  }
  if (command.type === "ticket.reply" || command.type === "ticket.status") {
    const thread = state.threads.find((t) => t.id === command.id);
    if (!thread) throw new MarketingError("ไม่พบเรื่องหรือหมดอายุแล้ว", 404);
    if (command.type === "ticket.reply") {
      const text = redact(command.text);
      const existing = thread.messages.find((m) => m.id === command.requestId);
      if (existing) {
        if (existing.role !== "owner" || existing.text !== text)
          throw new MarketingError("รหัสข้อความซ้ำ", 409);
        return { id: thread.id };
      }
      append(thread, text, "owner", now, { id: command.requestId });
      thread.status = "human";
    } else {
      thread.status = command.status;
      thread.updatedAt = now.toISOString();
    }
    thread.pending = null;
    thread.reason = "owner";
    log(state, command.type, thread.id, now);
    return { id: thread.id };
  }
  throw new MarketingError("คำสั่งไม่ถูกต้อง");
}
export function supportReport(state: SupportState, now = new Date()) {
  const waiting = state.threads.filter((t) => t.status === "waiting");
  const human = state.threads.filter((t) => t.status === "human");
  const overdue = [...waiting, ...human].filter(
    (t) => Date.parse(t.updatedAt) < now.getTime() - 86400_000,
  );
  const published = state.articles.filter(
    (a) => a.status === "published",
  ).length;
  const gaps = waiting.filter((t) =>
    [
      "no_answer",
      "model_unavailable",
      "knowledge_changed",
      "interrupted",
    ].includes(t.reason),
  );
  return {
    total: state.threads.length,
    waiting: waiting.length,
    human: human.length,
    resolved: state.threads.filter((t) => t.status === "resolved").length,
    overdue: overdue.length,
    published,
    drafts: state.articles.length - published,
    gaps: gaps.length,
    aiCallsToday:
      state.usage.find((u) => u.date === now.toISOString().slice(0, 10))
        ?.aiCalls ?? 0,
    tasks: [
      ...(overdue.length
        ? [`ติดตาม ${overdue.length} เรื่องที่ไม่มีความคืบหน้าเกิน 24 ชั่วโมง`]
        : []),
      ...(waiting.length
        ? [`รับช่วงตอบผู้เล่น ${waiting.length} เรื่องที่รอผู้ดูแล`]
        : []),
      ...(gaps.length
        ? [`ตรวจ ${gaps.length} เรื่องที่ระบบยังตอบไม่ได้ เพื่อปรับคลังคำตอบ`]
        : []),
      ...(state.articles.length - published
        ? [
            `ตรวจฉบับร่าง ${state.articles.length - published} เรื่องก่อนเผยแพร่`,
          ]
        : []),
      ...(!published
        ? ["เพิ่มคำตอบที่ตรวจสอบแล้วก่อนเปิดให้ผู้เล่นใช้งาน"]
        : []),
    ],
  };
}
