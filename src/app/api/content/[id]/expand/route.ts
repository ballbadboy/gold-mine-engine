import { NextResponse } from 'next/server';
import { z } from 'zod';
import { expandSection } from '@/lib/content/expand';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const bodySchema = z.object({
  section_index: z.number().int().min(0).max(50),
  provider: z.enum(['claude', 'gemini', 'openrouter']).optional(),
  max_tokens: z.number().int().positive().max(8000).optional(),
});

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function POST(req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const json = await req.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: 'Invalid body', issues: parsed.error.issues },
        { status: 400 }
      );
    }
    const { section_index, provider, max_tokens } = parsed.data;

    const result = await expandSection({
      contentPageId: id,
      sectionIndex: section_index,
      provider,
      maxTokens: max_tokens,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
