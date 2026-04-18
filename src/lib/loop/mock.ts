/**
 * Mock metrics generator for Sprint 4 development.
 * Generates realistic GA4-like traffic patterns so the loop pipeline
 * can be built and tested before real GA4 data is wired up.
 *
 * Patterns produced (per page):
 *  - 'winner'  : steady upward trend, high CTR, good conversions
 *  - 'loser'   : declining traffic, high bounce, no conversions
 *  - 'sleeper' : flat but with occasional spikes (opportunity signal)
 *  - 'steady'  : typical baseline behavior
 */

export type Pattern = 'winner' | 'loser' | 'sleeper' | 'steady';

export interface MockPageInput {
  page_slug: string;
  pattern: Pattern;
}

export interface MockMetric {
  page_slug: string;
  date: string; // YYYY-MM-DD
  source: 'ga4' | 'gsc' | 'ads';
  impressions: number;
  clicks: number;
  ctr: number;
  position: number;
  sessions: number;
  bounce_rate: number;
  conversions: number;
  revenue: number;
  cost: number;
  raw: Record<string, unknown>;
}

function rng(seed: number) {
  // Deterministic PRNG for reproducible mocks
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

interface PatternCurve {
  dayIndex: number; // 0..days-1, 0 = oldest
  totalDays: number;
}

function baseByPattern(p: Pattern, c: PatternCurve, r: () => number) {
  const progress = c.dayIndex / Math.max(1, c.totalDays - 1); // 0..1
  switch (p) {
    case 'winner':
      // Gentle S-curve growth; rewards AI "promote" actions
      return {
        impressionsBase: 50 + progress * 2500 + r() * 100,
        ctrBase: 0.03 + progress * 0.07, // 3% → 10%
        positionBase: 45 - progress * 35, // 45 → 10
        bounceBase: 0.75 - progress * 0.25, // 75% → 50%
        convRate: 0.005 + progress * 0.035, // 0.5% → 4%
        aovTHB: 3500,
      };
    case 'loser':
      // Traffic decays, bounce high, no buying intent
      return {
        impressionsBase: 800 - progress * 600 + r() * 80,
        ctrBase: 0.02 - progress * 0.015,
        positionBase: 25 + progress * 40, // 25 → 65
        bounceBase: 0.82 + progress * 0.08,
        convRate: 0.003,
        aovTHB: 2500,
      };
    case 'sleeper':
      // Flat baseline + occasional spikes (signals untapped demand)
      const spike = r() < 0.15 ? 5 : 1;
      return {
        impressionsBase: (120 + r() * 80) * spike,
        ctrBase: 0.04 + r() * 0.02,
        positionBase: 28 + r() * 8,
        bounceBase: 0.6 + r() * 0.1,
        convRate: 0.01 + r() * 0.02,
        aovTHB: 3200,
      };
    case 'steady':
    default:
      return {
        impressionsBase: 350 + r() * 120,
        ctrBase: 0.035 + r() * 0.015,
        positionBase: 18 + r() * 6,
        bounceBase: 0.65 + r() * 0.08,
        convRate: 0.015,
        aovTHB: 3000,
      };
  }
}

export function generateMockMetrics(pages: MockPageInput[], days = 30): MockMetric[] {
  const out: MockMetric[] = [];
  const random = rng(42);

  for (const page of pages) {
    for (let i = 0; i < days; i++) {
      const dateStr = formatDate(daysAgo(days - 1 - i));
      const { impressionsBase, ctrBase, positionBase, bounceBase, convRate, aovTHB } =
        baseByPattern(page.pattern, { dayIndex: i, totalDays: days }, random);

      const impressions = Math.max(0, Math.round(impressionsBase + (random() - 0.5) * 60));
      const ctr = Math.max(0, Math.min(1, ctrBase + (random() - 0.5) * 0.008));
      const clicks = Math.round(impressions * ctr);
      const position = Math.max(1, Math.min(100, positionBase + (random() - 0.5) * 3));
      const sessions = Math.round(clicks * (0.85 + random() * 0.2));
      const bounce_rate = Math.max(0, Math.min(1, bounceBase + (random() - 0.5) * 0.06));
      const conversions = Math.round(sessions * convRate * (0.8 + random() * 0.4));
      const revenue = conversions * aovTHB;
      const cost = 0; // organic only for now

      // GA4 + GSC rows share the same metrics; use one 'ga4' row per day/page
      out.push({
        page_slug: page.page_slug,
        date: dateStr,
        source: 'ga4',
        impressions,
        clicks,
        ctr: Number(ctr.toFixed(4)),
        position: Number(position.toFixed(2)),
        sessions,
        bounce_rate: Number(bounce_rate.toFixed(4)),
        conversions,
        revenue,
        cost,
        raw: { pattern: page.pattern, mock: true },
      });
    }
  }
  return out;
}
