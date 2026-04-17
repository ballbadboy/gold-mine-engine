import { NextResponse } from 'next/server';
import { getGA4Status, getTopPages } from '@/lib/analytics/ga4';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const days = Math.min(Math.max(Number(url.searchParams.get('days') ?? 7), 1), 90);
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit') ?? 20), 1), 200);

  const status = getGA4Status();
  if (!status.configured) {
    return NextResponse.json(
      {
        ok: false,
        configured: false,
        error: status.error,
        hint: 'Set GA4_PROPERTY_ID and GA4_SERVICE_ACCOUNT_JSON in .env.local',
        setup_steps: [
          '1. Go to https://analytics.google.com and copy your Property ID (Admin → Property Settings)',
          '2. In Google Cloud Console, create a service account and download JSON key',
          '3. In GA4 Admin → Property Access Management, add the service account email as Viewer',
          '4. Paste property ID → GA4_PROPERTY_ID',
          '5. Paste entire JSON as single line → GA4_SERVICE_ACCOUNT_JSON',
        ],
      },
      { status: 200 }
    );
  }

  try {
    const pages = await getTopPages(days, limit);
    return NextResponse.json({
      ok: true,
      configured: true,
      property_id: status.property_id,
      date_range_days: days,
      count: pages.length,
      pages,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ ok: false, configured: true, error: message }, { status: 500 });
  }
}
