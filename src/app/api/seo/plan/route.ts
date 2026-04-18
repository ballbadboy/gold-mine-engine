import { NextResponse } from 'next/server';
import { buildKeywordPlan, clusterByPillar, clusterByIntent, listNiches, NICHES } from '@/lib/seo/keywords';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/seo/plan?niche=longevity|protein|beauty
 * Returns the full keyword plan — no DB writes, safe to call freely.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const nicheId = url.searchParams.get('niche') ?? 'longevity';
  const pillar = url.searchParams.get('pillar');
  const intent = url.searchParams.get('intent');
  const limit = Number(url.searchParams.get('limit') ?? '500');

  if (!NICHES[nicheId]) {
    return NextResponse.json(
      { ok: false, error: `Unknown niche: ${nicheId}`, available: Object.keys(NICHES) },
      { status: 400 },
    );
  }

  const plan = buildKeywordPlan(nicheId);

  let filtered = plan;
  if (pillar) filtered = filtered.filter((e) => e.pillar === pillar);
  if (intent) filtered = filtered.filter((e) => e.intent === intent);
  filtered = filtered.slice(0, limit);

  const byPillar = clusterByPillar(plan);
  const byIntent = clusterByIntent(plan);

  return NextResponse.json({
    ok: true,
    niche: nicheId,
    domain: NICHES[nicheId].domain,
    total: plan.length,
    filtered: filtered.length,
    niches: listNiches(),
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
