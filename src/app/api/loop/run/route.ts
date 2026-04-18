import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { analyzeWebsite } from '@/lib/loop/insights';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const bodySchema = z.object({
  website_domain: z.string().default('longevity-th.com'),
  days: z.number().int().min(1).max(90).default(30),
  ai_enrich_top_n: z.number().int().min(0).max(20).default(5),
  provider: z.enum(['claude', 'gemini', 'openrouter']).optional(),
});

export async function POST(req: Request) {
  try {
    const json = await req.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: 'Invalid body', issues: parsed.error.issues },
        { status: 400 }
      );
    }
    const { website_domain, days, ai_enrich_top_n, provider } = parsed.data;

    const supabase = createAdminClient();
    const { data: website, error } = await supabase
      .from('websites')
      .select('id, domain')
      .eq('domain', website_domain)
      .single();
    if (error || !website) {
      return NextResponse.json(
        { ok: false, error: `Website '${website_domain}' not found` },
        { status: 404 }
      );
    }

    const result = await analyzeWebsite(website.id, {
      days,
      aiEnrichTopN: ai_enrich_top_n,
      aiProvider: provider,
    });

    return NextResponse.json({
      ok: true,
      website_domain,
      ...result,
      summary: {
        winners: result.pages.filter((p) => p.classification === 'winner').length,
        losers: result.pages.filter((p) => p.classification === 'loser').length,
        sleepers: result.pages.filter((p) => p.classification === 'sleeper').length,
        steady: result.pages.filter((p) => p.classification === 'steady').length,
      },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

// Convenience: GET returns last 10 insights for the default site (no AI call)
export async function GET(req: Request) {
  const url = new URL(req.url);
  const domain = url.searchParams.get('website_domain') ?? 'longevity-th.com';

  const supabase = createAdminClient();
  const { data: website } = await supabase
    .from('websites')
    .select('id')
    .eq('domain', domain)
    .single();
  if (!website) return NextResponse.json({ ok: false, error: `Website '${domain}' not found` }, { status: 404 });

  const { data: insights } = await supabase
    .from('insights')
    .select('id, type, severity, title, summary, evidence, confidence, status, created_at')
    .eq('website_id', website.id)
    .order('created_at', { ascending: false })
    .limit(50);

  return NextResponse.json({ ok: true, count: insights?.length ?? 0, insights: insights ?? [] });
}
