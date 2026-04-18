'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

interface EnhanceResult {
  ok: boolean;
  before?: { total: number; grade: string };
  after?: { total: number; grade: string };
  delta?: { points_gained: number; grade_change: string };
  enrichments?: {
    new_faqs: number;
    new_schema_types: string[];
    improved_intro: boolean;
    new_stats: number;
    authority_signals: number;
  };
  error?: string;
}

export function EnhanceButton({ pageId, currentScore }: { pageId: string; currentScore: number }) {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<EnhanceResult | null>(null);
  const [, startTransition] = useTransition();
  const router = useRouter();

  async function handleEnhance() {
    setRunning(true);
    setResult(null);
    try {
      const res = await fetch('/api/geo/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ page_id: pageId, provider: 'claude' }),
      });
      const data: EnhanceResult = await res.json();
      setResult(data);
      if (data.ok) {
        // Refresh server component data to reflect new score
        startTransition(() => router.refresh());
      }
    } catch {
      setResult({ ok: false, error: 'Network error' });
    } finally {
      setRunning(false);
    }
  }

  // Compact pill-style button
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleEnhance}
        disabled={running}
        className="rounded-md border border-border bg-background hover:bg-muted px-2 py-1 text-[10px] font-medium disabled:opacity-50 transition-colors whitespace-nowrap"
        title={`Current: ${currentScore}/100 — click to auto-enhance via Claude`}
      >
        {running ? '⏳ Enhancing…' : '⚡ Enhance'}
      </button>
      {result && (
        <span className="text-[10px] whitespace-nowrap">
          {result.ok && result.delta ? (
            <span className="text-emerald-600 dark:text-emerald-400 font-medium">
              +{result.delta.points_gained} · {result.delta.grade_change}
              {result.enrichments && (
                <span className="ml-1 text-muted-foreground">
                  ({result.enrichments.new_faqs} FAQ, {result.enrichments.new_stats} stats)
                </span>
              )}
            </span>
          ) : (
            <span className="text-red-500">❌ {result.error?.slice(0, 40)}</span>
          )}
        </span>
      )}
    </div>
  );
}
