import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { BetaAnalyticsDataClient } from '@google-analytics/data';

export interface GA4PageMetric {
  page_path: string;
  page_title: string;
  sessions: number;
  screen_page_views: number;
  engaged_sessions: number;
  avg_session_duration: number;
  bounce_rate: number;
  conversions: number;
  total_revenue: number;
}

export interface GA4Status {
  configured: boolean;
  property_id: string | null;
  has_credentials: boolean;
  error?: string;
}

function getPropertyId(): string | null {
  return process.env.GA4_PROPERTY_ID ?? null;
}

function getCredentials(): object | null {
  const raw = process.env.GA4_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  const trimmed = raw.trim();
  try {
    // Inline JSON
    if (trimmed.startsWith('{')) return JSON.parse(trimmed);
    // File path (supports ~/ expansion)
    const path = trimmed.startsWith('~/') ? trimmed.replace(/^~/, homedir()) : trimmed;
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

export function getGA4Status(): GA4Status {
  const property = getPropertyId();
  const creds = getCredentials();
  if (!property) return { configured: false, property_id: null, has_credentials: Boolean(creds), error: 'GA4_PROPERTY_ID not set' };
  if (!creds) return { configured: false, property_id: property, has_credentials: false, error: 'GA4_SERVICE_ACCOUNT_JSON not set or invalid JSON' };
  return { configured: true, property_id: property, has_credentials: true };
}

let client: BetaAnalyticsDataClient | null = null;

function getClient(): BetaAnalyticsDataClient {
  if (client) return client;
  const creds = getCredentials();
  if (!creds) throw new Error('GA4_SERVICE_ACCOUNT_JSON not configured');
  // Credentials shape from service account JSON (client_email, private_key, etc.)
  client = new BetaAnalyticsDataClient({ credentials: creds as { client_email?: string; private_key?: string } });
  return client;
}

export async function getTopPages(days = 7, limit = 20): Promise<GA4PageMetric[]> {
  const propertyId = getPropertyId();
  if (!propertyId) throw new Error('GA4_PROPERTY_ID not set');

  const [response] = await getClient().runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate: `${days}daysAgo`, endDate: 'today' }],
    dimensions: [{ name: 'pagePath' }, { name: 'pageTitle' }],
    metrics: [
      { name: 'sessions' },
      { name: 'screenPageViews' },
      { name: 'engagedSessions' },
      { name: 'averageSessionDuration' },
      { name: 'bounceRate' },
      { name: 'conversions' },
      { name: 'totalRevenue' },
    ],
    orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
    limit,
  });

  return (response.rows ?? []).map((row) => ({
    page_path: row.dimensionValues?.[0]?.value ?? '',
    page_title: row.dimensionValues?.[1]?.value ?? '',
    sessions: Number(row.metricValues?.[0]?.value ?? 0),
    screen_page_views: Number(row.metricValues?.[1]?.value ?? 0),
    engaged_sessions: Number(row.metricValues?.[2]?.value ?? 0),
    avg_session_duration: Number(row.metricValues?.[3]?.value ?? 0),
    bounce_rate: Number(row.metricValues?.[4]?.value ?? 0),
    conversions: Number(row.metricValues?.[5]?.value ?? 0),
    total_revenue: Number(row.metricValues?.[6]?.value ?? 0),
  }));
}
