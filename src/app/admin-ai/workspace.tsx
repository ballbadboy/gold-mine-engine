"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  ArrowUpRight,
  BookOpen,
  Check,
  Inbox,
  MessageCircle,
  Plus,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import type { Article, OwnerCommand, PublicThread } from "@/lib/support/model";
import type { supportReport } from "@/lib/support/domain";
import { SupportMessages, threadLabels } from "@/components/support-messages";

type Data = {
  config: {
    demo: boolean;
    publicEnabled: boolean;
    aiEnabled: boolean;
    provider: string | null;
    dailyLimit: number;
  };
  report: ReturnType<typeof supportReport>;
  articles: Article[];
  threads: (PublicThread & { reason: string })[];
};
type AssistantResult = { answer: string; asOf: string };
const quickQuestions = [
  "วันนี้มีอะไรต้องทำ",
  "มีเรื่องค้างเท่าไร",
  "คลังคำตอบพร้อมไหม",
  "โควตา AI วันนี้",
];
async function api(command?: OwnerCommand) {
  const response = await fetch(
    "/api/admin-ai",
    command
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(command),
        }
      : { cache: "no-store" },
  );
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? "โหลดข้อมูลไม่สำเร็จ");
  return result;
}
export function AdminWorkspace() {
  const [data, setData] = useState<Data | null>(null);
  const [tab, setTab] = useState<"inbox" | "knowledge" | "assistant">("inbox");
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [reply, setReply] = useState("");
  const replyRequest = useRef<{
    text: string;
    thread: string;
    id: string;
  } | null>(null);
  const [editing, setEditing] = useState<Article | "new" | null>(null);
  const titleInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (editing) titleInput.current?.focus();
  }, [editing]);
  const [title, setTitle] = useState(""),
    [answer, setAnswer] = useState(""),
    [keywords, setKeywords] = useState("");
  const [question, setQuestion] = useState("");
  const [assistant, setAssistant] = useState<AssistantResult | null>(null);
  const refresh = useCallback(async () => {
    setData(await api());
  }, []);
  useEffect(() => {
    let active = true;
    api()
      .then((result) => {
        if (active) setData(result);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, []);
  async function run(command: OwnerCommand, message: string) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await api(command);
      await refresh();
      setNotice(message);
      return result;
    } catch (e) {
      setError(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
      return null;
    } finally {
      setBusy(false);
    }
  }
  const thread = data?.threads.find((t) => t.id === selected) ?? null;
  const filtered =
    data?.threads.filter((t) => filter === "all" || t.status === filter) ?? [];
  function edit(article: Article | "new") {
    setEditing(article);
    setTitle(article === "new" ? "" : article.title);
    setAnswer(article === "new" ? "" : article.answer);
    setKeywords(article === "new" ? "" : article.keywords.join(", "));
  }
  async function saveArticle(event: FormEvent) {
    event.preventDefault();
    const result = await run(
      {
        type: "article.save",
        ...(editing && editing !== "new"
          ? { id: editing.id, revision: editing.revision }
          : {}),
        input: {
          title,
          answer,
          keywords: keywords
            .split(",")
            .map((k) => k.trim())
            .filter(Boolean),
        },
      },
      "บันทึกฉบับร่างแล้ว ตรวจคำตอบและกดเผยแพร่เมื่อพร้อม",
    );
    if (result) setEditing(null);
  }
  async function sendReply(event: FormEvent) {
    event.preventDefault();
    if (!thread || !reply.trim()) return;
    if (
      replyRequest.current?.text !== reply ||
      replyRequest.current?.thread !== thread.id
    )
      replyRequest.current = {
        text: reply,
        thread: thread.id,
        id: crypto.randomUUID(),
      };
    const result = await run(
      {
        type: "ticket.reply",
        id: thread.id,
        requestId: replyRequest.current.id,
        text: reply,
      },
      "บันทึกคำตอบแล้ว ผู้เล่นอ่านได้ในแชตเดิม",
    );
    if (result) {
      setReply("");
      replyRequest.current = null;
    }
  }
  async function ask(text: string) {
    if (!text.trim()) return;
    const result = await run({ type: "assistant.ask", question: text }, "");
    if (result) {
      setAssistant(result);
      setQuestion("");
    }
  }
  return (
    <div className="sa-shell" lang="th">
      <header className="sa-header">
        <a className="sa-brand" href="/marketing">
          <span>G</span>GOLD MINE <small>AI ADMIN</small>
        </a>
        <nav aria-label="พื้นที่ทำงาน">
          <a href="/marketing">การตลาด</a>
          <a href="/admin-ai" aria-current="page">
            AI แอดมิน
          </a>
          <a href="/help">
            หน้าแชตผู้เล่น <ArrowUpRight size={15} />
          </a>
        </nav>
      </header>
      <main className="sa-main">
        <div className="sa-heading">
          <div>
            <p className="sa-eyebrow">PLAYER CARE WORKSPACE</p>
            <h1>ดูแลผู้เล่น มีผู้ช่วยอยู่ข้างคุณ</h1>
            <p className="sa-muted">
              ตอบคำถาม รับช่วงดูแล และเห็นงานที่ต้องทำในที่เดียว
            </p>
          </div>
          <button
            className="sa-button sa-light"
            aria-label="รีเฟรชข้อมูล"
            disabled={busy}
            onClick={() =>
              refresh()
                .then(() => setError(""))
                .catch((e) => setError(e.message))
            }
          >
            <RefreshCw size={16} />
            รีเฟรช
          </button>
        </div>
        {error && (
          <p className="sa-alert" role="alert">
            {error}
          </p>
        )}
        {notice && (
          <p className="sa-notice" role="status">
            <Check size={16} />
            {notice}
          </p>
        )}
        {!data ? (
          <p role="status">กำลังโหลดพื้นที่ผู้ดูแล…</p>
        ) : (
          <>
            <div className="sa-mode">
              <span className="sa-dot" />
              <strong>
                {data.config.demo
                  ? "พื้นที่สาธิต · ใช้คำตอบตัวอย่าง"
                  : data.config.aiEnabled
                    ? "AI ช่วยเลือกคำตอบ"
                    : "ตอบด้วยคลังคำตอบ"}
              </strong>
              <span>
                {data.config.publicEnabled
                  ? "หน้าแชตพร้อมรับคำถาม"
                  : "หน้าแชตยังไม่เปิดให้ผู้เล่น"}
              </span>
            </div>
            {data.config.demo &&
              !data.articles.length &&
              !data.threads.length && (
                <div className="sa-callout">
                  <div>
                    <strong>ลองดูแลผู้เล่นจำลอง</strong>
                    <p>
                      โหลดคลังคำตอบ 3 เรื่องและตัวอย่างงานค้าง
                      ทดลองได้โดยไม่เรียก AI ภายนอก
                    </p>
                  </div>
                  <button
                    className="sa-button"
                    disabled={busy}
                    onClick={() =>
                      run(
                        { type: "demo.seed" },
                        "โหลดตัวอย่างแล้ว เปิดหน้าแชตเพื่อทดลองถามได้",
                      )
                    }
                  >
                    โหลดข้อมูลแอดมินตัวอย่าง
                  </button>
                </div>
              )}
            <div className="sa-stats">
              {[
                ["รอผู้ดูแล", data.report.waiting, "เรื่อง"],
                ["กำลังดูแล", data.report.human, "เรื่อง"],
                ["คำตอบพร้อมใช้", data.report.published, "เรื่อง"],
                [
                  "เรียก AI วันนี้",
                  data.report.aiCallsToday,
                  `/ ${data.config.dailyLimit} ครั้ง`,
                ],
              ].map(([label, value, unit]) => (
                <div key={label}>
                  <p>{label}</p>
                  <strong>{value}</strong>
                  <small>{unit}</small>
                </div>
              ))}
            </div>
            <nav className="sa-tabs" aria-label="ส่วนงานแอดมิน">
              {(
                [
                  { id: "inbox", name: "กล่องรับเรื่อง", Icon: Inbox },
                  { id: "knowledge", name: "คลังคำตอบ", Icon: BookOpen },
                  { id: "assistant", name: "ผู้ช่วยหลังบ้าน", Icon: Sparkles },
                ] as const
              ).map(({ id, name, Icon }) => (
                <button
                  key={id}
                  aria-current={tab === id ? "page" : undefined}
                  onClick={() => {
                    setTab(id);
                    setNotice("");
                  }}
                >
                  <Icon size={17} />
                  {name}
                </button>
              ))}
            </nav>
            {tab === "inbox" && (
              <section className="sa-inbox">
                <div className="sa-panel sa-ticket-list">
                  <div className="sa-panel-top">
                    <h2>บทสนทนา</h2>
                    <label>
                      <span className="sa-sr">กรองสถานะ</span>
                      <select
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                      >
                        <option value="all">ทั้งหมด</option>
                        <option value="waiting">รอผู้ดูแล</option>
                        <option value="human">กำลังดูแล</option>
                        <option value="bot">ผู้ช่วยอัตโนมัติ</option>
                        <option value="resolved">ปิดเรื่องแล้ว</option>
                      </select>
                    </label>
                  </div>
                  {!filtered.length && (
                    <p className="sa-empty">
                      ยังไม่มีเรื่องในสถานะนี้
                      <br />
                      ผู้เล่นเริ่มคำถามได้จากหน้าแชต
                    </p>
                  )}
                  {filtered.map((t) => (
                    <button
                      className="sa-ticket"
                      aria-pressed={selected === t.id}
                      key={t.id}
                      onClick={() => {
                        setSelected(t.id);
                        setReply("");
                        replyRequest.current = null;
                      }}
                    >
                      <div>
                        <strong>เรื่อง #{t.id.slice(0, 8)}</strong>
                        <span className={`sa-status sa-status-${t.status}`}>
                          {threadLabels[t.status]}
                        </span>
                      </div>
                      <p>
                        {t.messages.filter((m) => m.role === "player").at(-1)
                          ?.text || "ยังไม่มีข้อความ"}
                      </p>
                      <small>
                        {new Date(t.updatedAt).toLocaleString("th-TH")}
                      </small>
                    </button>
                  ))}
                </div>
                <div className="sa-panel sa-conversation">
                  {!thread ? (
                    <div className="sa-empty sa-select-empty">
                      <MessageCircle size={32} />
                      <h2>เลือกเรื่องที่ต้องการดูแล</h2>
                      <p>อ่านประวัติ แล้วรับช่วงตอบจากผู้ช่วยได้ทันที</p>
                    </div>
                  ) : (
                    <>
                      <div className="sa-panel-top">
                        <h2>เรื่อง #{thread.id.slice(0, 8)}</h2>
                        <div className="sa-actions">
                          <button
                            className="sa-button sa-light"
                            disabled={busy || thread.status === "human"}
                            onClick={() =>
                              run(
                                {
                                  type: "ticket.status",
                                  id: thread.id,
                                  status: "human",
                                },
                                "รับช่วงดูแลแล้ว",
                              )
                            }
                          >
                            รับช่วงดูแล
                          </button>
                          <button
                            className="sa-button sa-light"
                            disabled={busy || thread.status === "resolved"}
                            onClick={() =>
                              run(
                                {
                                  type: "ticket.status",
                                  id: thread.id,
                                  status: "resolved",
                                },
                                "ปิดเรื่องแล้ว",
                              )
                            }
                          >
                            ปิดเรื่อง
                          </button>
                        </div>
                      </div>
                      <SupportMessages thread={thread} />
                      <form className="sa-reply" onSubmit={sendReply}>
                        <label htmlFor="owner-reply">คำตอบจากผู้ดูแล</label>
                        <textarea
                          id="owner-reply"
                          rows={3}
                          maxLength={1800}
                          required
                          value={reply}
                          onChange={(e) => setReply(e.target.value)}
                          placeholder="พิมพ์คำตอบที่ผู้เล่นจะเห็นในแชตนี้"
                        />
                        <div className="sa-form-footer">
                          <small>
                            ส่งแล้ว AI จะให้ผู้ดูแลตอบต่อในเรื่องนี้
                          </small>
                          <button
                            className="sa-button"
                            disabled={busy || !reply.trim()}
                          >
                            ส่งคำตอบ
                          </button>
                        </div>
                      </form>
                    </>
                  )}
                </div>
              </section>
            )}
            {tab === "knowledge" && (
              <section className="sa-knowledge">
                <div className="sa-panel">
                  <div className="sa-panel-top">
                    <div>
                      <h2>คำตอบที่คุณตรวจแล้ว</h2>
                      <p className="sa-muted">
                        เผยแพร่เฉพาะข้อมูลจริงของเกม การแก้ไขจะกลับเป็นฉบับร่าง
                      </p>
                    </div>
                    <button
                      className="sa-button"
                      disabled={busy}
                      onClick={() => edit("new")}
                    >
                      <Plus size={16} />
                      เพิ่มคำตอบ
                    </button>
                  </div>
                  {!data.articles.length && (
                    <p className="sa-empty">
                      เริ่มจากวิธีใช้งาน อุปกรณ์ที่รองรับ และวิธีแจ้งปัญหา
                    </p>
                  )}
                  {data.articles.map((a) => (
                    <article className="sa-article" key={a.id}>
                      <div>
                        <span
                          className={`sa-status ${a.status === "published" ? "sa-status-bot" : "sa-status-waiting"}`}
                        >
                          {a.status === "published"
                            ? "เผยแพร่แล้ว"
                            : "ฉบับร่าง"}
                        </span>
                        <h3>{a.title}</h3>
                        <p>{a.answer}</p>
                        <small>
                          คำค้น: {a.keywords.join(" · ") || "ไม่มี"} · รุ่น{" "}
                          {a.revision}
                        </small>
                      </div>
                      <div className="sa-actions">
                        <button
                          className="sa-button sa-light"
                          disabled={busy}
                          onClick={() => edit(a)}
                        >
                          แก้ไข
                        </button>
                        <button
                          className="sa-button sa-light"
                          disabled={busy}
                          onClick={() =>
                            run(
                              {
                                type: "article.publish",
                                id: a.id,
                                revision: a.revision,
                                published: a.status !== "published",
                              },
                              a.status === "published"
                                ? "พักคำตอบแล้ว"
                                : "เผยแพร่คำตอบแล้ว",
                            )
                          }
                        >
                          {a.status === "published"
                            ? "พักคำตอบ"
                            : "เผยแพร่คำตอบ"}
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
                {editing && (
                  <form className="sa-panel sa-editor" onSubmit={saveArticle}>
                    <h2>
                      {editing === "new" ? "เพิ่มคำตอบใหม่" : "แก้ไขคำตอบ"}
                    </h2>
                    <label htmlFor="faq-title">หัวข้อคำถาม</label>
                    <input
                      id="faq-title"
                      ref={titleInput}
                      required
                      minLength={4}
                      maxLength={120}
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                    />
                    <label htmlFor="faq-answer">คำตอบสำหรับผู้เล่น</label>
                    <textarea
                      id="faq-answer"
                      required
                      minLength={10}
                      maxLength={1800}
                      rows={8}
                      value={answer}
                      onChange={(e) => setAnswer(e.target.value)}
                    />
                    <label htmlFor="faq-keywords">
                      วลีคำค้น คั่นด้วยจุลภาค
                    </label>
                    <input
                      id="faq-keywords"
                      value={keywords}
                      onChange={(e) => setKeywords(e.target.value)}
                      placeholder="เช่น เกมค้าง, โหลดไม่ขึ้น"
                    />
                    <p className="sa-muted">
                      ใช้วลีเฉพาะเรื่อง ยาวอย่างน้อย 4 ตัวอักษร สูงสุด 10 วลี
                      ไม่ใส่ข้อมูลบัญชีหรือข้อมูลส่วนตัว
                    </p>
                    <div className="sa-actions">
                      <button
                        type="button"
                        className="sa-button sa-light"
                        disabled={busy}
                        onClick={() => setEditing(null)}
                      >
                        ยกเลิก
                      </button>
                      <button className="sa-button" disabled={busy}>
                        บันทึกฉบับร่าง
                      </button>
                    </div>
                  </form>
                )}
              </section>
            )}
            {tab === "assistant" && (
              <section className="sa-assistant-layout">
                <div className="sa-panel sa-assistant">
                  <div className="sa-assistant-icon">
                    <Sparkles size={24} />
                  </div>
                  <h2>วันนี้ให้ช่วยดูเรื่องไหน</h2>
                  <p className="sa-muted">
                    ถามสรุปงานจากข้อมูลในกล่องรับเรื่องและคลังคำตอบ
                  </p>
                  <div className="sa-quick">
                    {quickQuestions.map((q) => (
                      <button key={q} disabled={busy} onClick={() => ask(q)}>
                        {q}
                      </button>
                    ))}
                  </div>
                  {assistant && (
                    <article className="sa-answer" aria-live="polite">
                      <p>{assistant.answer}</p>
                      <small>
                        ข้อมูลศูนย์ช่วยเหลือ ณ{" "}
                        {new Date(assistant.asOf).toLocaleString("th-TH")}
                      </small>
                    </article>
                  )}
                  <form
                    className="sa-ask-form"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void ask(question);
                    }}
                  >
                    <label className="sa-sr" htmlFor="assistant-question">
                      ถามผู้ช่วยหลังบ้าน
                    </label>
                    <input
                      id="assistant-question"
                      required
                      maxLength={800}
                      value={question}
                      onChange={(e) => setQuestion(e.target.value)}
                      placeholder="เช่น มีเรื่องไหนที่ยังต้องดูแล"
                    />
                    <button
                      className="sa-button"
                      disabled={busy || !question.trim()}
                    >
                      ถามผู้ช่วย
                    </button>
                  </form>
                </div>
                <aside className="sa-panel sa-task-panel">
                  <h2>งานที่ควรติดตาม</h2>
                  {data.report.tasks.length ? (
                    <ul>
                      {data.report.tasks.map((t) => (
                        <li key={t}>{t}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="sa-muted">
                      ยังไม่มีงานค้างที่เข้าเกณฑ์ติดตาม
                    </p>
                  )}
                  <p className="sa-footnote">
                    สรุปจากข้อมูลที่บันทึกไว้ การตอบผู้เล่น เผยแพร่คำตอบ
                    และปิดเรื่องอยู่ที่ปุ่มของผู้ดูแล
                  </p>
                </aside>
              </section>
            )}
            <footer className="sa-footer">
              Gold Mine · Admin Pilot{" "}
              <span>
                เก็บบทสนทนา 30 วัน · ผู้ดูแลหนึ่งบัญชี · หน้าเว็บเท่านั้น
              </span>
            </footer>
          </>
        )}
      </main>
    </div>
  );
}
