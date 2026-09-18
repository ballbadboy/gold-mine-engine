export interface PeriodStats {
  days: number;
  clicks: number;
  impressions: number;
  sessions: number;
  conversions: number;
  revenue: number;
  avg_ctr: number;
  avg_position: number;
  avg_bounce: number;
}

export function aggregate(
  rows: Array<{
    date: string;
    clicks: number;
    impressions: number;
    sessions: number;
    conversions: number;
    revenue: number;
    ctr: number;
    position: number;
    bounce_rate: number;
  }>,
): PeriodStats {
  if (rows.length === 0) {
    return {
      days: 0,
      clicks: 0,
      impressions: 0,
      sessions: 0,
      conversions: 0,
      revenue: 0,
      avg_ctr: 0,
      avg_position: 0,
      avg_bounce: 0,
    };
  }
  const sum = rows.reduce(
    (acc, r) => ({
      clicks: acc.clicks + r.clicks,
      impressions: acc.impressions + r.impressions,
      sessions: acc.sessions + r.sessions,
      conversions: acc.conversions + r.conversions,
      revenue: acc.revenue + Number(r.revenue ?? 0),
      ctr: acc.ctr + Number(r.ctr ?? 0),
      position: acc.position + Number(r.position ?? 0),
      bounce: acc.bounce + Number(r.bounce_rate ?? 0) * r.sessions,
    }),
    {
      clicks: 0,
      impressions: 0,
      sessions: 0,
      conversions: 0,
      revenue: 0,
      ctr: 0,
      position: 0,
      bounce: 0,
    },
  );
  return {
    days: rows.length,
    clicks: sum.clicks,
    impressions: sum.impressions,
    sessions: sum.sessions,
    conversions: sum.conversions,
    revenue: sum.revenue,
    avg_ctr: sum.impressions > 0 ? sum.clicks / sum.impressions : 0,
    avg_position: sum.position / rows.length,
    avg_bounce: sum.sessions > 0 ? sum.bounce / sum.sessions : 0,
  };
}
