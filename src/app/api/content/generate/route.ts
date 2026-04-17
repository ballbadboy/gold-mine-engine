import { NextResponse } from 'next/server';
import { z } from 'zod';
import { generateOutline } from '@/lib/content/generate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const bodySchema = z.object({
  topic: z.string().min(3).max(300),
  niche: z.string().min(2).max(100),
  type: z.enum(['pillar', 'listicle', 'review', 'comparison', 'guide']).default('pillar'),
  language: z.enum(['th', 'en']).default('th'),
  target_keyword: z.string().optional(),
  affiliate_context: z.string().optional(),
  tenant_slug: z.string().default('owner'),
  website_domain: z.string().default('sandbox.local'),
  provider: z.enum(['claude', 'gemini', 'openrouter']).optional(),
  max_tokens: z.number().int().positive().max(8000).optional(),
});

export async function POST(req: Request) {
  try {
    const json = await req.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: 'Invalid body', issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const {
      topic,
      niche,
      type,
      language,
      target_keyword,
      affiliate_context,
      tenant_slug,
      website_domain,
      provider,
      max_tokens,
    } = parsed.data;

    const result = await generateOutline({
      topic,
      niche,
      type,
      language,
      targetKeyword: target_keyword,
      affiliateContext: affiliate_context,
      tenantSlug: tenant_slug,
      websiteDomain: website_domain,
      provider,
      maxTokens: max_tokens,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
