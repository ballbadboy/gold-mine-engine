"use client";
import { useEffect, useRef } from "react";
import type { PublicThread } from "@/lib/support/model";

export const threadLabels = {
  bot: "ผู้ช่วยอัตโนมัติ",
  waiting: "รอผู้ดูแล",
  human: "ผู้ดูแลรับเรื่องแล้ว",
  resolved: "ปิดเรื่องแล้ว",
};
export function SupportMessages({ thread }: { thread: PublicThread }) {
  const log = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (log.current) log.current.scrollTop = log.current.scrollHeight;
  }, [thread.id, thread.messages.length, thread.pending]);
  return (
    <div
      ref={log}
      className="sa-messages"
      role="log"
      aria-label="ประวัติสนทนา"
      aria-live="polite"
    >
      {thread.messages.map((message) => (
        <article
          className={`sa-message sa-message-${message.role}`}
          key={message.id}
        >
          <div className="sa-message-meta">
            <strong>
              {message.role === "player"
                ? "ผู้เล่น"
                : message.role === "owner"
                  ? "ผู้ดูแล"
                  : "ผู้ช่วยอัตโนมัติ"}
            </strong>
            <time dateTime={message.createdAt}>
              {new Date(message.createdAt).toLocaleTimeString("th-TH", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </time>
          </div>
          <p>{message.text}</p>
          {message.sourceTitle && (
            <small>
              อ้างอิง: {message.sourceTitle} · รุ่น {message.sourceRevision}
            </small>
          )}
        </article>
      ))}
      {thread.pending && (
        <p className="sa-muted" role="status">
          กำลังค้นคำตอบให้คุณ…
        </p>
      )}
    </div>
  );
}
