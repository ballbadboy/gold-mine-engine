import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { buildKeywordPlan, clusterByPillar, clusterByIntent } from '@/lib/seo/keywords';
import { BulkTrigger } from './bulk-trigger';

export const dynamic = 'force-dynamic';

const INTENT_BADGE: Record<string, string> = {
  informational: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  commercial:    'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
  transactional: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
};

const TYPE_EMOJI: Record<string, string> = {
  pillar: '📚',
  listicle: '📋',
  review: '⭐',
  comparison: '⚖️',
  guide: '🗺️',
};

export default function SeoPage() {
  const plan = buildKeywordPlan();
  const byPillar = clusterByPillar(plan);
  const byIntent = clusterByIntent(plan);

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
              <h1 className="text-3xl font-bold tracking-tight">🗂️ Programmatic SEO</h1>
              <p className="mt-1 text-muted-foreground">
                {plan.length} keyword targets · {Object.keys(byPillar).length} topic clusters
              </p>
            </div>
            <Badge variant="secondary" className="text-sm shrink-0">Sprint 5</Badge>
          </div>
        </header>

        {/* Intent summary */}
        <div className="mb-8 grid grid-cols-3 gap-3">
          {(
            [
              { key: 'informational', emoji: '🔍', label: 'Informational' },
              { key: 'commercial',    emoji: '💼', label: 'Commercial' },
              { key: 'transactional', emoji: '🛒', label: 'Transactional' },
            ] as const
          ).map(({ key, emoji, label }) => (
            <Card key={key}>
              <CardContent className="py-4 px-5">
                <div className="text-2xl font-bold">{byIntent[key].length}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{emoji} {label}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Bulk generate — all pages */}
        <Card className="mb-8 border-dashed">
          <CardContent className="py-4 px-5">
            <p className="text-sm font-medium mb-2">⚡ Bulk Generate — All {plan.length} pages</p>
            <p className="text-xs text-muted-foreground mb-3">
              Runs 5 pages per batch · 3 parallel AI calls · idempotent (safe to re-run)
            </p>
            <BulkTrigger totalInPillar={plan.length} />
          </CardContent>
        </Card>

        {/* Per-pillar clusters */}
        <div className="flex flex-col gap-6">
          {Object.entries(byPillar).map(([pillar, entries]) => (
            <Card key={pillar}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-4">
                  <CardTitle className="text-base">{pillar}</CardTitle>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{entries.length} pages</span>
                    <BulkTrigger pillar={pillar} totalInPillar={entries.length} />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-xs">
                  <thead className="border-b bg-muted/30 text-left text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2 font-medium">Keyword</th>
                      <th className="px-4 py-2 font-medium">Type</th>
                      <th className="px-4 py-2 font-medium">Intent</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((e) => (
                      <tr key={e.slug} className="border-b last:border-0 hover:bg-muted/20">
                        <td className="px-4 py-2">
                          <div className="font-medium">{e.keyword}</div>
                          <div className="text-muted-foreground font-mono">/{e.slug}</div>
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap">
                          {TYPE_EMOJI[e.type] ?? ''} {e.type}
                        </td>
                        <td className="px-4 py-2">
                          <span className={`inline-flex rounded px-2 py-0.5 text-[10px] font-semibold ${INTENT_BADGE[e.intent] ?? ''}`}>
                            {e.intent}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </main>
  );
}
