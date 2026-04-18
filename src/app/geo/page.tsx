import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { createAdminClient } from '@/lib/supabase/admin';
import { scoreOutline, type GeoScore } from '@/lib/geo/score';
import type { Outline } from '@/lib/content/generate';
import { EnhanceButton } from './enhance-button';

export const dynamic = 'force-dynamic';

const DEFAULT_DOMAIN = 'longevity-th.com';

const GRADE_COLOR: Record<string, string> = {
  A: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400',
  B: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400',
  C: 'text-amber-600 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400',
  D: 'text-orange-600 bg-orange-100 dark:bg-orange-900/30 dark:text-orange-400',
  F: 'text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400',
};

const DIM_LABELS = {
  answer_first:        { label: 'Answer-First',    emoji: '🎯' },
  faq_depth:           { label: 'FAQ Depth',       emoji: '❓' },
  schema_coverage:     { label: 'Schema Markup',   emoji: '🏷️' },
  citability:          { label: 'Citability',      emoji: '📌' },
  statistical_density: { label: 'Statistics',      emoji: '📊' },
};

type PageScore = {
  id: string;
  slug: string;
  title: string;
  type: string | null;
  score: GeoScore | null;
  error?: string;
};

async function getData(domain: string) {
  const supabase = createAdminClient();

  const { data: website } = await supabase
    .from('websites')
    .select('id, domain')
    .eq('domain', domain)
    .single();

  if (!website) return { domain, pages: [] as PageScore[], siteAvg: null, gradeCounts: null, allDomains: [] };

  const [{ data: allSitesData }, { data: pagesData }] = await Promise.all([
    supabase.from('websites').select('domain').order('created_at'),
    supabase
      .from('content_pages')
      .select('id, slug, title, type, body_mdx, created_at')
      .eq('website_id', website.id)
      .order('created_at', { ascending: false })
      .limit(100),
  ]);

  const allDomains = (allSitesData ?? []).map((w: { domain: string }) => w.domain);

  const scored: PageScore[] = (pagesData ?? []).map((p) => {
    try {
      const outline = JSON.parse(p.body_mdx ?? '{}') as Outline;
      if (!outline.slug) return { id: p.id, slug: p.slug, title: p.title, type: p.type, score: null, error: 'Invalid outline' };
      return { id: p.id, slug: p.slug, title: p.title, type: p.type, score: scoreOutline(outline) };
    } catch (e) {
      return { id: p.id, slug: p.slug, title: p.title, type: p.type, score: null, error: e instanceof Error ? e.message : 'parse error' };
    }
  });

  const valid = scored.filter((s): s is PageScore & { score: GeoScore } => s.score !== null);
  const count = valid.length;

  const siteAvg = count === 0
    ? null
    : {
        total: valid.reduce((sum, s) => sum + s.score.total, 0) / count,
        answer_first: valid.reduce((sum, s) => sum + s.score.dimensions.answer_first.score, 0) / count,
        faq_depth: valid.reduce((sum, s) => sum + s.score.dimensions.faq_depth.score, 0) / count,
        schema_coverage: valid.reduce((sum, s) => sum + s.score.dimensions.schema_coverage.score, 0) / count,
        citability: valid.reduce((sum, s) => sum + s.score.dimensions.citability.score, 0) / count,
        statistical_density: valid.reduce((sum, s) => sum + s.score.dimensions.statistical_density.score, 0) / count,
      };

  const gradeCounts = { A: 0, B: 0, C: 0, D: 0, F: 0 };
  for (const s of valid) gradeCounts[s.score.grade]++;

  // Sort: worst first (biggest room for improvement)
  scored.sort((a, b) => {
    if (a.score === null && b.score === null) return 0;
    if (a.score === null) return 1;
    if (b.score === null) return -1;
    return a.score.total - b.score.total;
  });

  return { domain, pages: scored, siteAvg, gradeCounts, allDomains };
}

export default async function GeoPage({
  searchParams,
}: {
  searchParams: Promise<{ domain?: string }>;
}) {
  const { domain: qDomain } = await searchParams;
  const domain = qDomain ?? DEFAULT_DOMAIN;
  const { pages, siteAvg, gradeCounts, allDomains } = await getData(domain);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-5xl px-6 py-10">

        {/* Header */}
        <header className="mb-8">
          <div className="mb-2">
            <Link href="/" className="text-sm text-muted-foreground hover:underline">← Dashboard</Link>
          </div>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">🎯 GEO Score</h1>
              <p className="mt-1 text-muted-foreground">
                Generative Engine Optimization · <span className="font-mono text-xs">{domain}</span> · {pages.length} pages
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {allDomains.map((d) => (
                  <Link
                    key={d}
                    href={`/geo?domain=${d}`}
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
            <Badge variant="secondary" className="text-sm shrink-0">Sprint 8</Badge>
          </div>
        </header>

        {/* Site-wide scorecard */}
        {siteAvg && (
          <Card className="mb-8">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Site-wide GEO Scorecard</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-6 mb-5">
                <div className="text-center">
                  <div className="text-5xl font-bold tracking-tight">{Math.round(siteAvg.total)}</div>
                  <div className="text-xs text-muted-foreground mt-1">out of 100</div>
                </div>
                <div className="flex-1 grid grid-cols-5 gap-2">
                  {(['A','B','C','D','F'] as const).map((g) => (
                    <div key={g} className={`rounded-md p-2 text-center ${GRADE_COLOR[g]}`}>
                      <div className="text-xl font-bold">{gradeCounts?.[g] ?? 0}</div>
                      <div className="text-[10px] font-semibold">Grade {g}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Dimension bars */}
              <div className="space-y-2">
                {(Object.entries(DIM_LABELS) as Array<[keyof typeof DIM_LABELS, { label: string; emoji: string }]>).map(([key, meta]) => {
                  const val = siteAvg[key];
                  const pct = (val / 20) * 100;
                  return (
                    <div key={key} className="flex items-center gap-3">
                      <div className="w-32 text-xs text-muted-foreground shrink-0">
                        {meta.emoji} {meta.label}
                      </div>
                      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-foreground"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="w-12 text-right text-xs font-mono tabular-nums">
                        {val.toFixed(1)}/20
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Per-page scores — sorted worst first */}
        {pages.length === 0 ? (
          <Card>
            <CardHeader>
              <p className="font-medium">No content yet</p>
              <p className="text-sm text-muted-foreground">
                Generate pages via <Link className="underline" href="/seo">/seo</Link> first, then come back to score them.
              </p>
            </CardHeader>
          </Card>
        ) : (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Per-Page Scores</CardTitle>
                <span className="text-xs text-muted-foreground">sorted by lowest score — biggest opportunities first</span>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-xs">
                <thead className="border-b bg-muted/30 text-left text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 font-medium">Page</th>
                    <th className="px-4 py-2 font-medium">Grade</th>
                    <th className="px-4 py-2 font-medium w-56">Dimensions</th>
                    <th className="px-4 py-2 font-medium text-right">Score</th>
                    <th className="px-4 py-2 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pages.map((p) => (
                    <tr key={p.id} className="border-b last:border-0 hover:bg-muted/20">
                      <td className="px-4 py-3 max-w-xs">
                        <Link href={`/content/${p.id}`} className="block font-medium hover:underline truncate">
                          {p.title}
                        </Link>
                        <div className="text-[10px] text-muted-foreground font-mono truncate">/{p.slug}</div>
                        {p.score && p.score.recommendations.length > 0 && (
                          <div className="text-[10px] text-muted-foreground mt-1 italic">
                            💡 {p.score.recommendations[0]}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {p.score ? (
                          <span className={`inline-flex items-center justify-center w-7 h-7 rounded font-bold text-sm ${GRADE_COLOR[p.score.grade]}`}>
                            {p.score.grade}
                          </span>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {p.score && (
                          <div className="flex gap-0.5">
                            {(Object.keys(DIM_LABELS) as Array<keyof typeof DIM_LABELS>).map((key) => {
                              const val = p.score!.dimensions[key].score;
                              const h = Math.max(4, (val / 20) * 20);
                              return (
                                <div
                                  key={key}
                                  title={`${DIM_LABELS[key].label}: ${val}/20`}
                                  className="w-5 bg-muted rounded-sm flex flex-col justify-end"
                                  style={{ height: 20 }}
                                >
                                  <div
                                    className="bg-foreground rounded-sm"
                                    style={{ height: `${h}px` }}
                                  />
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums">
                        {p.score ? `${p.score.total}/100` : <span className="text-muted-foreground">error</span>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {p.score && p.score.total < 85 ? (
                          <EnhanceButton pageId={p.id} currentScore={p.score.total} />
                        ) : (
                          <span className="text-[10px] text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}

        {/* llms.txt preview */}
        <Card className="mt-8 border-dashed">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <p className="font-medium text-sm">🤖 llms.txt served at</p>
              <Badge variant="outline" className="font-mono text-[10px]">/llms.txt?domain={domain}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              AI crawlers (Perplexity, ChatGPT, Claude, Gemini) check this path to discover indexed content.
              Auto-generated from content_pages table.
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
