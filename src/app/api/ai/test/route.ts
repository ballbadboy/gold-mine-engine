import { NextResponse } from 'next/server';
import { z } from 'zod';
import { generate, type ProviderName } from '@/lib/ai';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  prompt: z.string().min(1).max(2000).default('Say hi in Thai, one short sentence.'),
  provider: z.enum(['claude', 'gemini', 'openrouter']).optional(),
  system: z.string().optional(),
  maxTokens: z.number().int().positive().max(4000).optional(),
});

export async function POST(req: Request) {
  try {
    const json = await req.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.message }, { status: 400 });
    }
    const { prompt, provider, system, maxTokens } = parsed.data;

    const result = await generate(
      [{ role: 'user', content: prompt }],
      { provider: provider as ProviderName | undefined, system, maxTokens }
    );

    return NextResponse.json({
      ok: true,
      provider: result.provider,
      model: result.model,
      text: result.text,
      input_tokens: result.inputTokens,
      output_tokens: result.outputTokens,
      latency_ms: result.latencyMs,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

// Allow GET for quick browser test with default prompt
export async function GET() {
  return POST(new Request('http://localhost/api/ai/test', { method: 'POST', body: '{}' }));
}
