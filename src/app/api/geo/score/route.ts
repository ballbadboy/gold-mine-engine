import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { scoreOutline, type GeoScore } from '@/lib/geo/score';
import type { Outline } from '@/lib/content/generate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/geo/score?domain=<site>
 * Scores all content pages for a site.
 *
 * Returns per-page GEO scores + site-wide averages across 5 dimensions.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const domain = url.searchParams.get('domain') ?? 'longevity-th.com';

  const supabase = createAdminClient();

  const { data: website } = await supabase
    .from('websites')
    .select('id, domain')
    .eq('domain', domain)
    .single();

  if (!website) {
    return NextResponse.json(
      { ok: false, error: `Website not found: ${domain}` },
      { status: 404 },
    );
  }

  const { data: pages } = await supabase
    .from('content_pages')
    .select('id, slug, title, type, status, body_mdx, created_at')
    .eq('website_id', website.id)
    .order('created_at', { ascending: false })
    .limit(100);

  const scored: Array<{
    id: string;
    slug: string;
    title: string;
    type: string | null;
    status: string;
    score: GeoScore | null;
    error?: string;
  }> = [];

  for (const p of pages ?? []) {
    try {
      const outline = JSON.parse(p.body_mdx ?? '{}') as Outline;
      if (!outline.slug) {
        scored.push({ id: p.id, slug: p.slug, title: p.title, type: p.type, status: p.status, score: null, error: 'Not a valid outline' });
        continue;
      }
      const score = scoreOutline(outline);
      scored.push({ id: p.id, slug: p.slug, title: p.title, type: p.type, status: p.status, score });
    } catch (e) {
      scored.push({
        id: p.id, slug: p.slug, title: p.title, type: p.type, status: p.status,
        score: null,
        error: e instanceof Error ? e.message : 'Parse error',
      });
    }
  }

  // Site-wide averages
  const valid = scored.filter((s) => s.score !== null);
  const count = valid.length;
  const site_avg = count === 0
    ? null
    : {
        total: Math.round(valid.reduce((sum, s) => sum + s.score!.total, 0) / count),
        answer_first: Math.round(valid.reduce((sum, s) => sum + s.score!.dimensions.answer_first.score, 0) / count),
        faq_depth: Math.round(valid.reduce((sum, s) => sum + s.score!.dimensions.faq_depth.score, 0) / count),
        schema_coverage: Math.round(valid.reduce((sum, s) => sum + s.score!.dimensions.schema_coverage.score, 0) / count),
        citability: Math.round(valid.reduce((sum, s) => sum + s.score!.dimensions.citability.score, 0) / count),
        statistical_density: Math.round(valid.reduce((sum, s) => sum + s.score!.dimensions.statistical_density.score, 0) / count),
      };

  // Grade distribution
  const grade_counts = { A: 0, B: 0, C: 0, D: 0, F: 0 };
  for (const s of valid) grade_counts[s.score!.grade]++;

  return NextResponse.json({
    ok: true,
    domain,
    pages_scored: count,
    pages_total: (pages ?? []).length,
    site_avg,
    grade_counts,
    pages: scored,
  });
}
