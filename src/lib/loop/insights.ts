import { aggregate, type PeriodStats } from './metrics';
import { generate, type ProviderName } from '@/lib/ai';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Insights pipeline: classify pages deterministically → enrich with AI narrative.
 * "Cheap filter → expensive think" pattern: rules run on all pages (free),
 * AI only called for pages that matter.
 */

interface PageAggregate {
  first_half: PeriodStats;
  second_half: PeriodStats;
  total: PeriodStats;
}

export type Classification = 'winner' | 'loser' | 'sleeper' | 'steady';

export interface PageInsight {
  page_slug: string;
  classification: Classification;
  scores: {
    growth_ratio: number;      // second_half_clicks / first_half_clicks
    ctr_delta: number;
    position_delta: number;    // negative = improved (lower rank number)
    bounce_rate: number;
    conv_rate: number;
    total_revenue: number;
  };
  signal_strength: number;      // 0..1 — how confident the classification is
  ai_narrative?: string;        // filled by AI for notable cases only
  recommended_actions?: string[];
}

interface AnalyzeResult {
  website_id: string;
  days_analyzed: number;
  page_count: number;
  insights_created: number;
  pages: PageInsight[];
}

// ── Thresholds ─────────────────────────────────────────
// Tune these after ~2 weeks of real data.
const WINNER_GROWTH = 1.5;     // 50%+ clicks growth week-over-week
const LOSER_GROWTH = 0.6;      // 40%+ decline
const SLEEPER_MIN_SPIKE = 2.5; // occasional 2.5x days on low baseline
const HIGH_BOUNCE = 0.78;
const MIN_EVIDENCE_CLICKS = 20; // below this = not enough signal

function classify(agg: PageAggregate): { classification: Classification; signal_strength: number; scores: PageInsight['scores'] } {
  const { first_half, second_half, total } = agg;
  const growth_ratio = first_half.clicks > 0 ? second_half.clicks / first_half.clicks : second_half.clicks > 0 ? 99 : 0;
  const ctr_delta = second_half.avg_ctr - first_half.avg_ctr;
  const position_delta = second_half.avg_position - first_half.avg_position;
  const bounce_rate = total.avg_bounce;
  const conv_rate = total.sessions > 0 ? total.conversions / total.sessions : 0;

  const scores: PageInsight['scores'] = {
    growth_ratio: Number(growth_ratio.toFixed(3)),
    ctr_delta: Number(ctr_delta.toFixed(4)),
    position_delta: Number(position_delta.toFixed(2)),
    bounce_rate: Number(bounce_rate.toFixed(4)),
    conv_rate: Number(conv_rate.toFixed(4)),
    total_revenue: total.revenue,
  };

  // Not enough data
  if (total.clicks < MIN_EVIDENCE_CLICKS) {
    return { classification: 'steady', signal_strength: 0.2, scores };
  }

  // Winner: strong growth + either improving position or decent conversions
  if (growth_ratio >= WINNER_GROWTH && (position_delta < -3 || conv_rate > 0.02)) {
    const strength = Math.min(1, (growth_ratio - WINNER_GROWTH) / 2 + 0.5);
    return { classification: 'winner', signal_strength: Number(strength.toFixed(2)), scores };
  }

  // Loser: declining + high bounce
  if (growth_ratio <= LOSER_GROWTH || (bounce_rate >= HIGH_BOUNCE && growth_ratio < 0.9)) {
    const strength = Math.min(1, (LOSER_GROWTH - growth_ratio) + (bounce_rate - HIGH_BOUNCE) * 2 + 0.5);
    return { classification: 'loser', signal_strength: Number(Math.max(0.3, strength).toFixed(2)), scores };
  }

  // Sleeper: any single day ≥ 2.5× baseline
  const baseline = first_half.clicks / Math.max(1, first_half.days);
  const maxSpike = baseline * SLEEPER_MIN_SPIKE;
  if (second_half.clicks / Math.max(1, second_half.days) >= maxSpike && second_half.clicks > MIN_EVIDENCE_CLICKS) {
    return { classification: 'sleeper', signal_strength: 0.6, scores };
  }

  return { classification: 'steady', signal_strength: 0.4, scores };
}

async function enrichWithAI(
  insight: PageInsight,
  pageTitle: string,
  provider?: ProviderName
): Promise<{ narrative: string; actions: string[] }> {
  const system =
    'คุณเป็น growth analyst สำหรับเว็บ affiliate ในตลาดไทย วิเคราะห์ข้อมูลตัวเลขให้เป็น insight ภาษาธรรมชาติ + แนะนำ action ที่ execute ได้จริง (ไม่ใช่ "optimize" ลอยๆ) ตอบเป็น JSON เท่านั้น';

  const { scores, classification } = insight;
  const user = `บทความ: "${pageTitle}"
Classification: ${classification}
Metrics (30 วัน):
- Growth ratio (second half / first half): ${scores.growth_ratio}x
- CTR delta: ${(scores.ctr_delta * 100).toFixed(2)}%
- Position delta: ${scores.position_delta} (negative = ranking improved)
- Bounce rate: ${(scores.bounce_rate * 100).toFixed(1)}%
- Conv rate: ${(scores.conv_rate * 100).toFixed(2)}%
- Revenue: ฿${scores.total_revenue.toLocaleString()}

ตอบ JSON:
{
  "narrative": "2-3 ประโยค อธิบายว่าทำไม classification นี้ (อ้างตัวเลข)",
  "actions": ["action 1 (imperative สั้นๆ)", "action 2", "action 3"]
}

กติกา actions:
- winner: ขยายผล (สร้าง supporting content, boost ads, update meta ให้เด่น)
- loser: ซ่อม (rewrite intro, fix intent mismatch, kill if no potential)
- sleeper: ขุด (หา keyword ซ่อน, A/B test title, เพิ่ม internal link)
- steady: ไม่ต้องทำ (ระบุ "maintain" พอ)`;

  const result = await generate(
    [{ role: 'user', content: user }],
    { provider, system, maxTokens: 600, temperature: 0.4 }
  );

  // Parse JSON — tolerant to code fences
  let cleaned = result.text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  const first = cleaned.indexOf('{');
  const last = cleaned.lastIndexOf('}');
  if (first >= 0 && last > first) cleaned = cleaned.slice(first, last + 1);
  const parsed = JSON.parse(cleaned) as { narrative: string; actions: string[] };
  return parsed;
}

export async function analyzeWebsite(
  websiteId: string,
  options: { days?: number; aiProvider?: ProviderName; aiEnrichTopN?: number } = {}
): Promise<AnalyzeResult> {
  const { days = 30, aiProvider, aiEnrichTopN = 5 } = options;
  const supabase = createAdminClient();

  const since = new Date();
  since.setUTCDate(since.getUTCDate() - days);
  const sinceStr = since.toISOString().slice(0, 10);

  // Pull metrics for the window
  const { data: metrics, error } = await supabase
    .from('metrics_daily')
    .select('page_slug, date, clicks, impressions, sessions, conversions, revenue, ctr, position, bounce_rate')
    .eq('website_id', websiteId)
    .eq('source', 'ga4')
    .gte('date', sinceStr)
    .order('date', { ascending: true });

  if (error) throw new Error(`Failed to load metrics: ${error.message}`);
  if (!metrics || metrics.length === 0) {
    return { website_id: websiteId, days_analyzed: days, page_count: 0, insights_created: 0, pages: [] };
  }

  // Group by page_slug, split into first/second half for trend detection
  const bySlug = new Map<string, typeof metrics>();
  for (const row of metrics) {
    if (!bySlug.has(row.page_slug)) bySlug.set(row.page_slug, []);
    bySlug.get(row.page_slug)!.push(row);
  }

  const pageInsights: PageInsight[] = [];
  for (const [slug, rows] of bySlug.entries()) {
    const mid = Math.floor(rows.length / 2);
    const agg: PageAggregate = {
      first_half: aggregate(rows.slice(0, mid)),
      second_half: aggregate(rows.slice(mid)),
      total: aggregate(rows),
    };
    const { classification, signal_strength, scores } = classify(agg);
    pageInsights.push({ page_slug: slug, classification, signal_strength, scores });
  }

  // Rank for AI enrichment: winners & losers with highest signal first
  const enrichCandidates = pageInsights
    .filter((p) => p.classification === 'winner' || p.classification === 'loser' || p.classification === 'sleeper')
    .sort((a, b) => b.signal_strength - a.signal_strength)
    .slice(0, aiEnrichTopN);

  // Resolve page titles for prompt context
  const { data: pageRows } = await supabase
    .from('content_pages')
    .select('slug, title, tenant_id')
    .eq('website_id', websiteId)
    .in('slug', enrichCandidates.map((e) => e.page_slug));
  const titleMap = new Map((pageRows ?? []).map((p) => [p.slug, p.title]));
  const tenantId = pageRows?.[0]?.tenant_id ?? null;

  // AI-enrich in parallel
  await Promise.all(
    enrichCandidates.map(async (insight) => {
      try {
        const { narrative, actions } = await enrichWithAI(
          insight,
          titleMap.get(insight.page_slug) ?? insight.page_slug,
          aiProvider
        );
        insight.ai_narrative = narrative;
        insight.recommended_actions = actions;
      } catch (e) {
        insight.ai_narrative = `AI enrichment failed: ${e instanceof Error ? e.message : 'unknown'}`;
      }
    })
  );

  // Persist into insights table
  if (tenantId) {
    const insightRows = pageInsights
      .filter((p) => p.classification !== 'steady') // skip noise
      .map((p) => ({
        tenant_id: tenantId,
        website_id: websiteId,
        type: p.classification === 'winner' ? 'opportunity' :
              p.classification === 'loser' ? 'anomaly' :
              p.classification === 'sleeper' ? 'opportunity' : 'pattern',
        severity: p.signal_strength > 0.7 ? 'high' : p.signal_strength > 0.4 ? 'medium' : 'low',
        title: `[${p.classification.toUpperCase()}] ${p.page_slug}`,
        summary: p.ai_narrative ?? `Classified as ${p.classification} with signal ${p.signal_strength}`,
        evidence: { scores: p.scores, recommended_actions: p.recommended_actions ?? [] },
        confidence: p.signal_strength,
        status: 'new',
      }));

    if (insightRows.length > 0) {
      const { error: insErr } = await supabase.from('insights').insert(insightRows);
      if (insErr) throw new Error(`Failed to save insights: ${insErr.message}`);
    }

    return {
      website_id: websiteId,
      days_analyzed: days,
      page_count: pageInsights.length,
      insights_created: insightRows.length,
      pages: pageInsights,
    };
  }

  return {
    website_id: websiteId,
    days_analyzed: days,
    page_count: pageInsights.length,
    insights_created: 0,
    pages: pageInsights,
  };
}
