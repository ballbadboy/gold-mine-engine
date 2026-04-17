import { NextResponse } from 'next/server';
import { listProviders } from '@/lib/ai';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const providers = listProviders();
  const configured = providers.filter((p) => p.configured);
  return NextResponse.json({
    ok: configured.length > 0,
    configured_count: configured.length,
    providers,
  });
}
