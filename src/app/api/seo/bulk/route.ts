import { NextResponse } from 'next/server';
import { z } from 'zod';
import { buildKeywordPlan } from '@/lib/seo/keywords';
import { generateOutline } from '@/lib/content/generate';
import type { ProviderName } from '@/lib/ai';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const bodySchema = z.object({
  website_domain: z.string().default('longevity-th.com'),
  pillar: z.string().optional(),          // filter to one cluster
  intent: z.enum(['informational', 'commercial', 'transactional']).optional(),
  limit: z.number().int().min(1).max(20).default(10), // pages per run
  offset: z.number().int().min(0).default(0),         // pagination
  concurrency: z.number().int().min(1).max(5).default(3),
  provider: z.enum(['claude', 'gemini', 'openrouter']).optional(),
  language: z.enum(['th', 'en']).default('th'),
});

/** Run at most `concurrency` async tasks in parallel, queue the rest. */
async function concurrentPool<T>(
  tasks: Array<() => Promise<T>>,
  concurrency: number,
): Promise<Array<{ ok: true; value: T } | { ok: false; error: string }>> {
  const results: Array<{ ok: true; value: T } | { ok: false; error: string }> = [];
  const queue = [...tasks];
  const running: Promise<void>[] = [];

  async function runNext(): Promise<void> {
    const task = queue.shift();
    if (!task) return;
    try {
      const value = await task();
      results.push({ ok: true, value });
    } catch (e: unknown) {
      results.push({ ok: false, error: e instanceof Error ? e.message : String(e) });
    }
    await runNext();
  }

  for (let i = 0; i < Math.min(concurrency, tasks.length); i++) {
    running.push(runNext());
  }
  await Promise.all(running);
  return results;
}

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

    const { website_domain, pillar, intent, limit, offset, concurrency, provider, language } =
      parsed.data;

    // Build and filter the keyword plan
    let plan = buildKeywordPlan();
    if (pillar) plan = plan.filter((e) => e.pillar === pillar);
    if (intent) plan = plan.filter((e) => e.intent === intent);
    const batch = plan.slice(offset, offset + limit);

    if (batch.length === 0) {
      return NextResponse.json({ ok: true, generated: 0, skipped: 0, failed: 0, pages: [] });
    }

    // Build generation tasks
    const tasks = batch.map((entry) => () =>
      generateOutline({
        topic: entry.topic,
        niche: 'Longevity',
        type: entry.type,
        language,
        targetKeyword: entry.targetKeyword,
        affiliateContext: 'longevity supplements sold in Thailand — affiliate links to iHerb, Lazada, Shopee',
        tenantSlug: 'owner',
        websiteDomain: website_domain,
        provider: provider as ProviderName | undefined,
        maxTokens: 4000,
      }).then((result) => ({ entry, result })),
    );

    const outcomes = await concurrentPool(tasks, concurrency);

    const pages = outcomes.map((o, i) =>
      o.ok
        ? { slug: batch[i].slug, keyword: batch[i].keyword, status: 'generated', id: o.value.result.content_page_id }
        : { slug: batch[i].slug, keyword: batch[i].keyword, status: 'failed', error: o.error },
    );

    const generated = pages.filter((p) => p.status === 'generated').length;
    const failed = pages.filter((p) => p.status === 'failed').length;

    return NextResponse.json({
      ok: true,
      total_in_plan: plan.length,
      batch_size: batch.length,
      offset,
      next_offset: offset + limit,
      generated,
      failed,
      pages,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

/** GET — show plan stats, current batch preview */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const pillar = url.searchParams.get('pillar') ?? undefined;
  const intent = (url.searchParams.get('intent') ?? undefined) as
    | 'informational'
    | 'commercial'
    | 'transactional'
    | undefined;

  let plan = buildKeywordPlan();
  if (pillar) plan = plan.filter((e) => e.pillar === pillar);
  if (intent) plan = plan.filter((e) => e.intent === intent);

  return NextResponse.json({
    ok: true,
    total: plan.length,
    preview: plan.slice(0, 10).map((e) => ({ slug: e.slug, keyword: e.keyword, intent: e.intent, pillar: e.pillar })),
  });
}
