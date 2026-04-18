'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

interface BulkResult {
  ok: boolean;
  generated?: number;
  failed?: number;
  batch_size?: number;
  next_offset?: number;
  total_in_plan?: number;
  pages?: Array<{ slug: string; status: string; error?: string }>;
  error?: string;
}

interface BulkTriggerProps {
  niche: string;
  pillar?: string;
  totalInPillar: number;
}

export function BulkTrigger({ niche, pillar, totalInPillar }: BulkTriggerProps) {
  const [running, setRunning] = useState(false);
  const [offset, setOffset] = useState(0);
  const [log, setLog] = useState<string[]>([]);
  const [done, setDone] = useState(false);

  async function runBatch() {
    setRunning(true);
    try {
      const res = await fetch('/api/seo/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          niche,
          pillar: pillar ?? undefined,
          limit: 5,
          offset,
          concurrency: 3,
        }),
      });
      const data: BulkResult = await res.json();

      if (data.ok) {
        const msg = `✅ Batch offset ${offset}: ${data.generated ?? 0} generated, ${data.failed ?? 0} failed`;
        setLog((prev) => [...prev, msg]);
        const nextOffset = data.next_offset ?? offset + 5;
        if ((data.batch_size ?? 0) < 5 || nextOffset >= totalInPillar) {
          setDone(true);
          setLog((prev) => [...prev, `🏁 Done — all ${totalInPillar} pages processed`]);
        } else {
          setOffset(nextOffset);
        }
      } else {
        setLog((prev) => [...prev, `❌ Error: ${data.error}`]);
      }
    } catch {
      setLog((prev) => [...prev, '❌ Network error']);
    } finally {
      setRunning(false);
    }
  }

  function reset() {
    setOffset(0);
    setLog([]);
    setDone(false);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={runBatch} disabled={running || done} className="text-xs">
          {running ? `⏳ Generating batch (offset ${offset})…` : done ? '✅ All done' : `⚡ Generate next 5 pages`}
        </Button>
        {(log.length > 0 || done) && (
          <Button size="sm" variant="outline" onClick={reset} className="text-xs">
            Reset
          </Button>
        )}
        <span className="text-xs text-muted-foreground">
          {offset}/{totalInPillar} generated
        </span>
      </div>
      {log.length > 0 && (
        <ul className="space-y-0.5 font-mono text-xs text-muted-foreground">
          {log.map((l, i) => <li key={i}>{l}</li>)}
        </ul>
      )}
    </div>
  );
}
