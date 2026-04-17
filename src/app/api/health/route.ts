import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('tenants')
      .select('id, slug, name, plan')
      .limit(5);

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message, hint: 'Did you apply supabase/schema.sql?' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      supabase_url: process.env.NEXT_PUBLIC_SUPABASE_URL,
      tenants_count: data?.length ?? 0,
      tenants: data,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
