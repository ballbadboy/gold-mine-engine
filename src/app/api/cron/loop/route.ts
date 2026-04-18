import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { analyzeWebsite } from '@/lib/loop/insights';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Daily cron — triggered by Vercel Cron.
 * Runs loop analysis for every active website.
 *
 * Security: Vercel sends `Authorization: Bearer ${CRON_SECRET}` in production.
 * Set CRON_SECRET in Vercel env vars. Manual calls without the header are rejected.
 */
export async function GET(req: Request) {
  // Auth: in production, Vercel injects the CRON_SECRET.
  const authHeader = req.headers.get('authorization');
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  const isVercelCron = req.headers.get('x-vercel-cron') === '1';

  if (process.env.NODE_ENV === 'production' && !isVercelCron && authHeader !== expected) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const startedAt = Date.now();
  const supabase = createAdminClient();

  const { data: websites, error } = await supabase
    .from('websites')
    .select('id, domain, status')
    .eq('status', 'active');

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const results: Array<{
    domain: string;
    ok: boolean;
    winners?: number;
    losers?: number;
    sleepers?: number;
    steady?: number;
    insights_created?: number;
    error?: string;
    ms?: number;
  }> = [];

  for (const site of websites ?? []) {
    const siteStart = Date.now();
    try {
      const result = await analyzeWebsite(site.id, {
        days: 30,
        aiEnrichTopN: 3,
      });
      const counts = {
        winners: result.pages.filter((p) => p.classification === 'winner').length,
        losers: result.pages.filter((p) => p.classification === 'loser').length,
        sleepers: result.pages.filter((p) => p.classification === 'sleeper').length,
        steady: result.pages.filter((p) => p.classification === 'steady').length,
      };
      results.push({
        domain: site.domain,
        ok: true,
        ...counts,
        insights_created: result.insights_created,
        ms: Date.now() - siteStart,
      });
    } catch (e: unknown) {
      results.push({
        domain: site.domain,
        ok: false,
        error: e instanceof Error ? e.message : 'Unknown error',
        ms: Date.now() - siteStart,
      });
    }
  }

  return NextResponse.json({
    ok: true,
    total_ms: Date.now() - startedAt,
    websites_processed: results.length,
    results,
    ran_at: new Date().toISOString(),
  });
}
