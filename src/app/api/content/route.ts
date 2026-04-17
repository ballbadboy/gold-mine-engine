import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const tenantSlug = url.searchParams.get('tenant') ?? 'owner';
    const limit = Math.min(Number(url.searchParams.get('limit') ?? 50), 200);

    const supabase = createAdminClient();
    const { data: tenant } = await supabase
      .from('tenants')
      .select('id')
      .eq('slug', tenantSlug)
      .single();

    if (!tenant) {
      return NextResponse.json({ ok: false, error: `Tenant '${tenantSlug}' not found` }, { status: 404 });
    }

    const { data, error } = await supabase
      .from('content_pages')
      .select('id, slug, title, meta_description, type, status, created_at, updated_at, website_id')
      .eq('tenant_id', tenant.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true, count: data?.length ?? 0, pages: data ?? [] });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
