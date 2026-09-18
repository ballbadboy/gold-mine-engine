"use client";
import { useState, type FormEvent } from "react";
import "../marketing/marketing.css";

export default function LoginPage() {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const password = new FormData(event.currentTarget).get("password");
      const response = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      window.location.href = "/marketing";
    } catch (e) {
      setError(e instanceof Error ? e.message : "เข้าสู่ระบบไม่สำเร็จ");
      setBusy(false);
    }
  }
  return (
    <main className="gm-login">
      <div className="gm-login-card">
        <a className="gm-brand" href="/marketing">
          <span className="gm-mark">G</span>
          <span>
            GOLD MINE<small>MARKETING WORKSPACE</small>
          </span>
        </a>
        <h1>เข้าสู่พื้นที่ทำงาน</h1>
        <p>สำหรับผู้ดูแลแคมเปญและข้อมูลการตลาด</p>
        <form onSubmit={submit}>
          <label className="gm-field">
            <span>รหัสผ่านผู้ดูแล</span>
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              maxLength={256}
            />
          </label>
          {error && (
            <p role="alert" className="gm-alert">
              {error}
            </p>
          )}
          <button className="gm-primary" disabled={busy}>
            {busy ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ"}
          </button>
        </form>
      </div>
    </main>
  );
}
