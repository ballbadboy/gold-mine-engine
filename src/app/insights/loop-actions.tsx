'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

interface LoopResult {
  ok: boolean;
  summary?: { winners: number; losers: number; sleepers: number; steady: number };
  pages?: { page_slug: string; classification: string }[];
  error?: string;
}

export function LoopActions({ domain }: { domain: string }) {
  const [running, setRunning] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);

  async function handleRun() {
    setRunning(true);
    setLastResult(null);
    try {
      const res = await fetch('/api/loop/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ website_domain: domain, days: 30, ai_enrich_top_n: 5 }),
      });
      const data: LoopResult = await res.json();
      if (data.ok && data.summary) {
        const { winners, losers, sleepers, steady } = data.summary;
        setLastResult(`✅ Done — ${winners} winner · ${losers} loser · ${sleepers} sleeper · ${steady} steady → refresh page`);
      } else {
        setLastResult(`❌ ${data.error}`);
      }
    } catch {
      setLastResult('❌ Network error');
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          onClick={handleRun}
          disabled={running}
          className="text-xs"
        >
          {running ? '⏳ Running…' : '⚡ Run Analysis'}
        </Button>
      </div>
      {lastResult && (
        <p className="text-xs text-muted-foreground">{lastResult}</p>
      )}
    </div>
  );
}
