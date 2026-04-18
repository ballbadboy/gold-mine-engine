import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Dynamic /llms.txt endpoint — an AI-crawler-friendly site index.
 * Spec: https://llmstxt.org/
 *
 * Serves markdown that Perplexity, ChatGPT, Claude, Gemini can ingest to
 * understand the site structure and find primary content.
 *
 * Supports ?domain=<site> to scope to a specific website.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const domain = url.searchParams.get('domain') ?? 'longevity-th.com';

  const supabase = createAdminClient();

  const { data: website } = await supabase
    .from('websites')
    .select('id, domain, niche')
    .eq('domain', domain)
    .single();

  if (!website) {
    return new Response(`# Site not found\n\nDomain: ${domain}\n`, {
      status: 404,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }

  const { data: pages } = await supabase
    .from('content_pages')
    .select('slug, title, meta_description, type, status, created_at')
    .eq('website_id', website.id)
    .in('status', ['published', 'draft'])
    .order('created_at', { ascending: false })
    .limit(200);

  const byType: Record<string, typeof pages> = {};
  for (const p of pages ?? []) {
    const key = p.type ?? 'other';
    if (!byType[key]) byType[key] = [];
    byType[key].push(p);
  }

  const lines: string[] = [];
  lines.push(`# ${website.domain}`);
  lines.push('');
  lines.push(`> ${website.niche} resource — curated guides, reviews, and comparisons.`);
  lines.push('');
  lines.push('This is the llms.txt file — a machine-readable index for AI search engines.');
  lines.push('');

  const TYPE_LABELS: Record<string, string> = {
    pillar: 'Core Guides',
    listicle: 'Top Lists',
    review: 'Reviews',
    comparison: 'Comparisons',
    guide: 'How-To Guides',
    other: 'Other',
  };

  for (const [type, items] of Object.entries(byType)) {
    if (!items || items.length === 0) continue;
    lines.push(`## ${TYPE_LABELS[type] ?? type}`);
    lines.push('');
    for (const p of items) {
      const desc = p.meta_description ? `: ${p.meta_description.slice(0, 160)}` : '';
      lines.push(`- [${p.title}](https://${website.domain}/${p.slug})${desc}`);
    }
    lines.push('');
  }

  if ((pages ?? []).length === 0) {
    lines.push('## No content indexed yet');
    lines.push('');
    lines.push('This site is being populated. Check back soon.');
  }

  lines.push('---');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push(`Total pages: ${(pages ?? []).length}`);

  return new Response(lines.join('\n'), {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
