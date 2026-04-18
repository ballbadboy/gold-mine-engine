import { NextResponse } from 'next/server';
import { buildKeywordPlan, clusterByPillar, clusterByIntent } from '@/lib/seo/keywords';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/seo/plan
 * Returns the full keyword plan — no DB writes, safe to call freely.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const pillar = url.searchParams.get('pillar');
  const intent = url.searchParams.get('intent');
  const limit = Number(url.searchParams.get('limit') ?? '500');

  const plan = buildKeywordPlan();

  let filtered = plan;
  if (pillar) filtered = filtered.filter((e) => e.pillar === pillar);
  if (intent) filtered = filtered.filter((e) => e.intent === intent);
  filtered = filtered.slice(0, limit);

  const byPillar = clusterByPillar(plan);
  const byIntent = clusterByIntent(plan);

  return NextResponse.json({
    ok: true,
    total: plan.length,
    filtered: filtered.length,
    clusters: {
      pillars: Object.keys(byPillar).map((p) => ({ pillar: p, count: byPillar[p].length })),
      by_intent: {
        informational: byIntent.informational.length,
        commercial: byIntent.commercial.length,
        transactional: byIntent.transactional.length,
      },
    },
    entries: filtered,
  });
}
