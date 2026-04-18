import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { enrichOutline } from '@/lib/geo/enrich';
import type { Outline } from '@/lib/content/generate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 90;

const bodySchema = z.object({
  page_id: z.string().uuid(),
  provider: z.enum(['claude', 'gemini', 'openrouter']).optional(),
  dry_run: z.boolean().default(false), // if true, don't save, just return preview
});

/**
 * POST /api/geo/enrich
 * Enriches a single content page with GEO improvements.
 * Idempotent — safe to re-run (dedupes FAQs, schema types).
 */
export async function POST(req: Request) {
  try {
    const json = await req.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: 'Invalid body', issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const { page_id, provider, dry_run } = parsed.data;
    const supabase = createAdminClient();

    // Load the page
    const { data: page, error: pErr } = await supabase
      .from('content_pages')
      .select('id, slug, title, body_mdx, website_id')
      .eq('id', page_id)
      .single();

    if (pErr || !page) {
      return NextResponse.json(
        { ok: false, error: `Page not found: ${pErr?.message ?? page_id}` },
        { status: 404 },
      );
    }

    let outline: Outline;
    try {
      outline = JSON.parse(page.body_mdx ?? '{}') as Outline;
    } catch {
      return NextResponse.json(
        { ok: false, error: 'Page body_mdx is not a valid outline JSON' },
        { status: 400 },
      );
    }

    if (!outline.slug) {
      return NextResponse.json(
        { ok: false, error: 'Outline missing required slug field — cannot enrich' },
        { status: 400 },
      );
    }

    // Run enrichment
    const result = await enrichOutline(outline, { provider });

    // Save enriched outline back (unless dry_run)
    if (!dry_run) {
      const { error: uErr } = await supabase
        .from('content_pages')
        .update({ body_mdx: JSON.stringify(result.outline, null, 2) })
        .eq('id', page_id);

      if (uErr) {
        return NextResponse.json(
          { ok: false, error: `Failed to save: ${uErr.message}` },
          { status: 500 },
        );
      }
    }

    return NextResponse.json({
      ok: true,
      page_id,
      slug: page.slug,
      title: page.title,
      dry_run,
      before: {
        total: result.before.total,
        grade: result.before.grade,
        dimensions: Object.fromEntries(
          Object.entries(result.before.dimensions).map(([k, v]) => [k, v.score]),
        ),
      },
      after: {
        total: result.after.total,
        grade: result.after.grade,
        dimensions: Object.fromEntries(
          Object.entries(result.after.dimensions).map(([k, v]) => [k, v.score]),
        ),
      },
      delta: {
        points_gained: result.after.total - result.before.total,
        grade_change: `${result.before.grade} → ${result.after.grade}`,
      },
      enrichments: {
        new_faqs: result.delta.new_faqs.length,
        new_schema_types: result.delta.new_schema_types,
        improved_intro: !!result.delta.improved_intro,
        new_stats: result.delta.new_stats.length,
        authority_signals: result.delta.authority_signals.length,
      },
      meta: {
        provider: result.provider,
        model: result.model,
        latency_ms: result.latency_ms,
        tokens: result.cost_tokens,
      },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
