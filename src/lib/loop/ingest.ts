import { createAdminClient } from '@/lib/supabase/admin';
import type { MockMetric } from './mock';

export interface IngestResult {
  website_id: string;
  tenant_id: string;
  rows_upserted: number;
  date_range: { from: string; to: string };
}

/**
 * Upsert metrics into metrics_daily (idempotent by website_id+date+source+page_slug).
 * Accepts either mock data or real GA4 data shaped the same way.
 */
export async function ingestMetrics(
  websiteId: string,
  metrics: MockMetric[]
): Promise<IngestResult> {
  if (metrics.length === 0) {
    throw new Error('No metrics provided');
  }

  const supabase = createAdminClient();

  // Resolve tenant from website
  const { data: website, error: wErr } = await supabase
    .from('websites')
    .select('tenant_id, domain')
    .eq('id', websiteId)
    .single();
  if (wErr || !website) throw new Error(`Website not found: ${wErr?.message ?? ''}`);

  const rows = metrics.map((m) => ({
    tenant_id: website.tenant_id,
    website_id: websiteId,
    page_slug: m.page_slug,
    date: m.date,
    source: m.source,
    impressions: m.impressions,
    clicks: m.clicks,
    ctr: m.ctr,
    position: m.position,
    sessions: m.sessions,
    bounce_rate: m.bounce_rate,
    conversions: m.conversions,
    revenue: m.revenue,
    cost: m.cost,
    raw: m.raw,
  }));

  // Chunk inserts to stay under Supabase row-size limits
  const CHUNK = 500;
  let total = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const { error, count } = await supabase
      .from('metrics_daily')
      .upsert(chunk, { onConflict: 'website_id,date,source,page_slug', count: 'exact' });
    if (error) throw new Error(`Upsert failed at chunk ${i / CHUNK}: ${error.message}`);
    total += count ?? chunk.length;
  }

  const dates = metrics.map((m) => m.date).sort();
  return {
    website_id: websiteId,
    tenant_id: website.tenant_id,
    rows_upserted: total,
    date_range: { from: dates[0], to: dates[dates.length - 1] },
  };
}
