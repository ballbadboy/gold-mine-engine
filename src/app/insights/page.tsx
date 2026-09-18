import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { createAdminClient } from '@/lib/supabase/admin';
import { LoopActions } from './loop-actions';

export const dynamic = 'force-dynamic';

const DEFAULT_DOMAIN = 'longevity-th.com';

async function getAllDomains(): Promise<string[]> {
  const supabase = createAdminClient();
  const { data } = await supabase.from('websites').select('domain').order('created_at');
  return (data ?? []).map((w: { domain: string }) => w.domain);
}

interface Evidence {
  page_slug?: string;
  classification?: string;
  clicks_before?: number;
  clicks_after?: number;
  position_before?: number;
  position_after?: number;
  bounce_rate?: number;
  ctr_avg?: number;
  impressions_avg?: number;
}

interface Insight {
  id: string;
  type: string;
  severity: string;
  title: string;
  summary: string | null;
  evidence: Evidence | null;
  confidence: number | null;
  status: string;
  created_at: string;
}

const SEVERITY_CONFIG = {
  critical: {
    label: 'LOSER',
    emoji: '📉',
    border: 'border-l-red-500',
    badge: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    dot: 'bg-red-500',
  },
  warning: {
    label: 'SLEEPER',
    emoji: '😴',
    border: 'border-l-amber-500',
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    dot: 'bg-amber-500',
  },
  info: {
    label: 'WINNER',
    emoji: '🏆',
    border: 'border-l-emerald-500',
    badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    dot: 'bg-emerald-500',
  },
  low: {
    label: 'STEADY',
    emoji: '📊',
    border: 'border-l-slate-400',
    badge: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
    dot: 'bg-slate-400',
  },
} as const;

function pct(val?: number) {
  return val != null ? `${(val * 100).toFixed(1)}%` : '—';
}
function num(val?: number) {
  return val != null ? val.toFixed(1) : '—';
}

async function getData(domain: string) {
  const supabase = createAdminClient();

  const { data: website } = await supabase
    .from('websites')
    .select('id, domain')
    .eq('domain', domain)
    .single();

  if (!website) return { website: null, insights: [], counts: { critical: 0, warning: 0, info: 0, low: 0 } };

  const { data: insights } = await supabase
    .from('insights')
    .select('id, type, severity, title, summary, evidence, confidence, status, created_at')
    .eq('website_id', website.id)
    .order('created_at', { ascending: false })
    .limit(50);

  const rows = (insights ?? []) as Insight[];
  const counts = { critical: 0, warning: 0, info: 0, low: 0 };
  for (const r of rows) {
    const k = r.severity as keyof typeof counts;
    if (k in counts) counts[k]++;
  }

  return { website, insights: rows, counts };
}

export default async function InsightsPage({
  searchParams,
}: {
  searchParams: Promise<{ domain?: string }>;
}) {
  const { domain: qDomain } = await searchParams;
  const domain = qDomain ?? DEFAULT_DOMAIN;
  const [{ website, insights, counts }, allDomains] = await Promise.all([
    getData(domain),
    getAllDomains(),
  ]);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-5xl px-6 py-10">

        {/* Header */}
        <header className="mb-8">
          <div className="mb-2">
            <Link href="/" className="text-sm text-muted-foreground hover:underline">
              ← Dashboard
            </Link>
          </div>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">⚡ Loop Insights</h1>
              <p className="mt-1 text-muted-foreground">
                OODA loop · <span className="font-mono text-xs">{domain}</span> · {insights.length} insights
              </p>
              {/* Site switcher */}
              <div className="mt-2 flex flex-wrap gap-2">
                {allDomains.map((d) => (
                  <Link
                    key={d}
                    href={`/insights?domain=${d}`}
                    className={`rounded px-2 py-0.5 text-xs font-mono border transition-colors ${
                      d === domain
                        ? 'bg-foreground text-background border-foreground'
                        : 'border-border text-muted-foreground hover:border-foreground hover:text-foreground'
                    }`}
                  >
                    {d}
                  </Link>
                ))}
              </div>
            </div>
            {website && <LoopActions domain={domain} />}
          </div>
        </header>

        {/* Stat bar */}
        <div className="mb-8 grid grid-cols-4 gap-3">
          {(
            [
              { key: 'info', emoji: '🏆', label: 'Winners' },
              { key: 'critical', emoji: '📉', label: 'Losers' },
              { key: 'warning', emoji: '😴', label: 'Sleepers' },
              { key: 'low', emoji: '📊', label: 'Steady' },
            ] as const
          ).map(({ key, emoji, label }) => {
            const cfg = SEVERITY_CONFIG[key];
            return (
              <Card key={key} className={`border-l-4 ${cfg.border}`}>
                <CardContent className="py-4 px-5">
                  <div className="text-2xl font-bold">{counts[key]}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {emoji} {label}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* No data state */}
        {insights.length === 0 && (
          <Card>
            <CardHeader>
              <p className="font-medium">No insights yet</p>
              <p className="text-sm text-muted-foreground">
                Import and verify analytics data for this website before running analysis. Demo data is isolated in the Marketing Workspace.
              </p>
            </CardHeader>

          </Card>
        )}

        {/* Insight cards */}
        <div className="flex flex-col gap-4">
          {insights.map((insight) => {
            const cfg = SEVERITY_CONFIG[insight.severity as keyof typeof SEVERITY_CONFIG] ?? SEVERITY_CONFIG.low;
            const ev = insight.evidence ?? {};
            const clicksGrowth =
              ev.clicks_before != null && ev.clicks_after != null && ev.clicks_before > 0
                ? ((ev.clicks_after - ev.clicks_before) / ev.clicks_before) * 100
                : null;

            return (
              <Card key={insight.id} className={`border-l-4 ${cfg.border}`}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      {/* Title row */}
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-bold ${cfg.badge}`}>
                          {cfg.emoji} {cfg.label}
                        </span>
                        <span className="font-mono text-xs text-muted-foreground truncate">
                          {ev.page_slug ?? insight.title}
                        </span>
                      </div>

                      {/* AI narrative */}
                      {insight.summary && (
                        <p className="text-sm leading-relaxed text-foreground/90 mb-3">
                          {insight.summary}
                        </p>
                      )}

                      {/* Evidence chips */}
                      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                        {ev.clicks_before != null && (
                          <span className="rounded bg-muted px-2 py-0.5">
                            Clicks {ev.clicks_before}→{ev.clicks_after}
                            {clicksGrowth != null && (
                              <span className={clicksGrowth >= 0 ? ' text-emerald-600' : ' text-red-500'}>
                                {' '}({clicksGrowth >= 0 ? '+' : ''}{clicksGrowth.toFixed(0)}%)
                              </span>
                            )}
                          </span>
                        )}
                        {ev.position_before != null && (
                          <span className="rounded bg-muted px-2 py-0.5">
                            Rank #{num(ev.position_before)}→#{num(ev.position_after)}
                          </span>
                        )}
                        {ev.bounce_rate != null && (
                          <span className="rounded bg-muted px-2 py-0.5">
                            Bounce {pct(ev.bounce_rate)}
                          </span>
                        )}
                        {ev.ctr_avg != null && (
                          <span className="rounded bg-muted px-2 py-0.5">
                            CTR {pct(ev.ctr_avg)}
                          </span>
                        )}
                        {ev.impressions_avg != null && (
                          <span className="rounded bg-muted px-2 py-0.5">
                            Impr {Math.round(ev.impressions_avg)}/day
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Confidence + date */}
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {insight.confidence != null && (
                        <div className="flex flex-col items-end gap-0.5">
                          <span className="text-xs text-muted-foreground">
                            {Math.round(insight.confidence * 100)}% conf
                          </span>
                          <div className="h-1.5 w-16 rounded-full bg-muted overflow-hidden">
                            <div
                              className={`h-full rounded-full ${cfg.dot}`}
                              style={{ width: `${Math.round(insight.confidence * 100)}%` }}
                            />
                          </div>
                        </div>
                      )}
                      <Badge variant="outline" className="text-[10px]">
                        {insight.status}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(insight.created_at).toLocaleString('th-TH', {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </main>
  );
}
