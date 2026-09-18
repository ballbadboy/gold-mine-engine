"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Headphones, Send, Sparkles } from "lucide-react";
import type { PublicThread } from "@/lib/support/model";
import { SupportMessages, threadLabels } from "@/components/support-messages";

type Data = {
  demo: boolean;
  aiEnabled: boolean;
  topics: { id: string; title: string }[];
  thread: PublicThread | null;
};
async function request(body?: object) {
  const response = await fetch(
    "/api/support",
    body
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : { cache: "no-store" },
  );
  const result = await response.json();
  if (!response.ok)
    throw new Error(result.error ?? "ติดต่อศูนย์ช่วยเหลือไม่สำเร็จ");
  return result;
}
export function PlayerChat() {
  const [data, setData] = useState<Data | null>(null),
    [text, setText] = useState("");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const pending = useRef<{ text: string; id: string } | null>(null);
  const threadId = data?.thread?.id;
  const refresh = useCallback(async () => {
    setData(await request());
  }, []);
  useEffect(() => {
    let active = true;
    request()
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
  useEffect(() => {
    if (!threadId) return;
    let active = true,
      inFlight = false;
    const timer = setInterval(async () => {
      if (document.hidden || inFlight) return;
      inFlight = true;
      try {
        const result = await request();
        if (active) setData(result);
      } catch (e) {
        if (active)
          setError(e instanceof Error ? e.message : "โหลดแชตไม่สำเร็จ");
      } finally {
        inFlight = false;
      }
    }, 10_000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [threadId]);
  async function send(message: string) {
    if (!message.trim() || busy || !data) return;
    setBusy(true);
    setError("");
    if (pending.current?.text !== message)
      pending.current = { text: message, id: crypto.randomUUID() };
    try {
      if (!data.thread) await request({ type: "start" });
      await request({
        type: "message",
        requestId: pending.current.id,
        text: message,
      });
      pending.current = null;
      setText("");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "ส่งข้อความไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }
  async function handoff() {
    if (!data || busy) return;
    setBusy(true);
    setError("");
    try {
      if (!data.thread) await request({ type: "start" });
      await request({ type: "handoff" });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "รับเรื่องไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="sa-player-page sa-shell" lang="th">
      <div className="sa-player-wrap">
        <a className="sa-brand" href="/help">
          <span>G</span>GOLD MINE <small>PLAYER CARE</small>
        </a>
        <header className="sa-player-heading">
          <span className="sa-assistant-icon">
            <Headphones size={25} />
          </span>
          <p className="sa-eyebrow">ยินดีช่วยเหลือคุณ</p>
          <h1>มีอะไรให้ช่วยไหมครับ</h1>
          <p>ถามเรื่องการใช้งาน หรือฝากเรื่องให้ผู้ดูแล</p>
        </header>
        {data?.demo && (
          <p className="sa-demo-note">
            หน้าสาธิต · คำตอบตัวอย่างสำหรับทดลองระบบ
          </p>
        )}
        {error && (
          <p className="sa-alert" role="alert">
            {error}
          </p>
        )}
        <section
          className="sa-panel sa-player-chat"
          aria-label="แชตศูนย์ช่วยเหลือ"
        >
          <div className="sa-panel-top">
            <div>
              <strong>
                <Sparkles size={16} /> ผู้ช่วยอัตโนมัติ
              </strong>
              <small>
                {data?.thread
                  ? threadLabels[data.thread.status]
                  : "ตอบจากข้อมูลที่ผู้ดูแลเผยแพร่"}
              </small>
            </div>
            <button
              className="sa-button sa-light"
              disabled={
                !data ||
                busy ||
                data.thread?.status === "waiting" ||
                data.thread?.status === "human"
              }
              onClick={handoff}
            >
              ขอผู้ดูแล
            </button>
          </div>
          {data?.thread?.messages.length ? (
            <SupportMessages thread={data.thread} />
          ) : (
            <div className="sa-player-intro">
              <h2>เริ่มจากคำถามของคุณ</h2>
              <p>
                ผมเป็นผู้ช่วยอัตโนมัติ หากไม่มีข้อมูลที่ยืนยันได้
                จะรับเรื่องให้ผู้ดูแลครับ
              </p>
              <div className="sa-quick">
                {data?.topics.slice(0, 4).map((topic) => (
                  <button
                    disabled={busy}
                    key={topic.id}
                    onClick={() => send(topic.title)}
                  >
                    {topic.title}
                  </button>
                ))}
              </div>
            </div>
          )}
          <form
            className="sa-player-compose"
            onSubmit={(e) => {
              e.preventDefault();
              void send(text);
            }}
          >
            <label className="sa-sr" htmlFor="player-message">
              คำถามถึงศูนย์ช่วยเหลือ
            </label>
            <textarea
              id="player-message"
              rows={2}
              required
              maxLength={1000}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="พิมพ์คำถามหรืออธิบายปัญหาที่พบ…"
            />
            <button
              className="sa-button"
              disabled={!data || busy || !!data.thread?.pending || !text.trim()}
            >
              <Send size={16} />
              {busy ? "กำลังส่ง…" : "ส่ง"}
            </button>
          </form>
          <p className="sa-chat-policy">
            อย่าส่งรหัสผ่าน OTP ข้อมูลบัญชีหรือการเงิน
            เก็บข้อความบนระบบศูนย์ช่วยเหลือ 30 วัน
            เปิดอ่านต่อด้วยเบราว์เซอร์เดิม{" "}
            {data?.aiEnabled
              ? "คำถามที่ยังจับคู่ไม่ได้จะส่งให้ผู้ให้บริการ AI ช่วยเลือกหัวข้อคำตอบ"
              : "ขณะนี้ตอบด้วยคลังคำตอบของผู้ดูแล"}{" "}
            เรื่องที่ส่งต่อจะปรากฏในแชตนี้เมื่อผู้ดูแลตอบ
          </p>
        </section>
        <p className="sa-player-footer">Gold Mine · ศูนย์ช่วยเหลือผู้เล่น</p>
      </div>
    </main>
  );
}
