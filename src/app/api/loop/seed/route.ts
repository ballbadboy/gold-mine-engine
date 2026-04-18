import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateMockMetrics, type Pattern } from '@/lib/loop/mock';
import { ingestMetrics } from '@/lib/loop/ingest';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  website_domain: z.string().default('longevity-th.com'),
  days: z.number().int().min(1).max(90).default(30),
  extra_pages: z
    .array(
      z.object({
        page_slug: z.string(),
        pattern: z.enum(['winner', 'loser', 'sleeper', 'steady']),
      })
    )
    .optional(),
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
    const { website_domain, days, extra_pages } = parsed.data;

    const supabase = createAdminClient();
    const { data: website, error: wErr } = await supabase
      .from('websites')
      .select('id, domain')
      .eq('domain', website_domain)
      .single();
    if (wErr || !website) {
      return NextResponse.json(
        { ok: false, error: `Website '${website_domain}' not found. Generate a page first via /api/content/generate.` },
        { status: 404 }
      );
    }

    // Real pages from DB — assign default pattern so real seeded content gets metrics too
    const { data: pages } = await supabase
      .from('content_pages')
      .select('slug, type')
      .eq('website_id', website.id);

    const fromDB: Array<{ page_slug: string; pattern: Pattern }> = (pages ?? []).map((p, i) => ({
      page_slug: p.slug,
      // cycle through patterns so dashboard shows variety
      pattern: (['winner', 'sleeper', 'loser', 'steady'] as Pattern[])[i % 4],
    }));

    // Add some synthetic pages so we always have >=4 pages to analyze
    const synth: Array<{ page_slug: string; pattern: Pattern }> = [
      { page_slug: 'best-nmn-supplements-thailand-guide', pattern: 'winner' },
      { page_slug: 'tru-niagen-review-thailand', pattern: 'sleeper' },
      { page_slug: 'anti-aging-supplements-2024', pattern: 'loser' },
      { page_slug: 'resveratrol-benefits-thai', pattern: 'steady' },
    ];

    const pages_input = [
      ...fromDB,
      ...synth.filter((s) => !fromDB.some((d) => d.page_slug === s.page_slug)),
      ...(extra_pages ?? []),
    ];

    const metrics = generateMockMetrics(pages_input, days);
    const result = await ingestMetrics(website.id, metrics);

    return NextResponse.json({
      ok: true,
      website_domain,
      pages_seeded: pages_input.length,
      patterns: pages_input.map((p) => ({ slug: p.page_slug, pattern: p.pattern })),
      ...result,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
