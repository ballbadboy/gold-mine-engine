import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { createAdminClient } from '@/lib/supabase/admin';
import type { Outline, OutlineSection } from '@/lib/content/generate';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ id: string }>;
}

async function getPage(id: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('content_pages')
    .select('*')
    .eq('id', id)
    .single();
  if (error || !data) return null;

  let outline: Outline | null = null;
  try {
    outline = data.body_mdx ? (JSON.parse(data.body_mdx) as Outline) : null;
  } catch {
    outline = null;
  }

  const { data: website } = await supabase
    .from('websites')
    .select('domain, niche')
    .eq('id', data.website_id)
    .single();

  return { page: data, outline, website };
}

export default async function ContentDetailPage({ params }: Props) {
  const { id } = await params;
  const result = await getPage(id);
  if (!result) notFound();
  const { page, outline, website } = result;

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-4xl px-6 py-10">
        <nav className="mb-6 text-sm text-muted-foreground">
          <Link href="/" className="hover:underline">Dashboard</Link>
          <span className="mx-2">/</span>
          <Link href="/content" className="hover:underline">Content Library</Link>
          <span className="mx-2">/</span>
          <span>{page.slug}</span>
        </nav>

        <header className="mb-8">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{page.type}</Badge>
            <Badge variant="outline">{page.status}</Badge>
            {website?.domain && (
              <Badge variant="outline" className="font-mono text-xs">
                {website.domain}
              </Badge>
            )}
          </div>
          <h1 className="text-3xl font-bold tracking-tight">{page.title}</h1>
          <p className="mt-2 text-sm text-muted-foreground font-mono">/{page.slug}</p>
        </header>

        {!outline ? (
          <Card>
            <CardHeader>
              <CardTitle>Raw content</CardTitle>
              <CardDescription>Could not parse outline JSON</CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="overflow-x-auto rounded-md bg-muted p-4 text-xs">
                {page.body_mdx ?? '(empty)'}
              </pre>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>SEO Metadata</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <Field label="Meta Title" value={outline.meta_title} />
                <Field label="Meta Description" value={outline.meta_description} />
                <Field label="Target Keyword" value={outline.target_keyword} />
                <div>
                  <div className="mb-1 text-xs font-medium text-muted-foreground">Secondary Keywords</div>
                  <div className="flex flex-wrap gap-1.5">
                    {outline.secondary_keywords?.map((k) => <Badge key={k} variant="secondary">{k}</Badge>)}
                  </div>
                </div>
                {outline.lsi_keywords?.length > 0 && (
                  <div>
                    <div className="mb-1 text-xs font-medium text-muted-foreground">LSI Keywords</div>
                    <div className="flex flex-wrap gap-1.5">
                      {outline.lsi_keywords.map((k) => <Badge key={k} variant="outline">{k}</Badge>)}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Intro Hook</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{outline.intro_hook}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Sections ({outline.sections?.length ?? 0})</CardTitle>
                <CardDescription>
                  Total target: {outline.sections?.reduce((s, x) => s + (x.word_count_target ?? 0), 0)} words
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {outline.sections?.map((s: OutlineSection, i: number) => (
                  <div key={i} className="rounded-md border p-3">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <h3 className="font-medium">{i + 1}. {s.h2}</h3>
                      <div className="flex shrink-0 gap-1">
                        <Badge variant="outline" className="text-xs">{s.word_count_target}w</Badge>
                        {s.cta_placement && s.cta_placement !== 'none' && (
                          <Badge variant="default" className="text-xs">CTA: {s.cta_placement}</Badge>
                        )}
                        {s.schema_type && <Badge variant="secondary" className="text-xs">{s.schema_type}</Badge>}
                      </div>
                    </div>
                    {s.key_points?.length > 0 && (
                      <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                        {s.key_points.map((kp, j) => <li key={j}>• {kp}</li>)}
                      </ul>
                    )}
                    {s.internal_links?.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {s.internal_links.map((l, j) => (
                          <Badge key={j} variant="outline" className="text-xs font-mono">🔗 /{l}</Badge>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>

            {outline.faqs?.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>FAQs ({outline.faqs.length})</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {outline.faqs.map((f, i) => (
                    <div key={i} className="rounded-md border p-3 text-sm">
                      <div className="font-medium">Q: {f.q}</div>
                      <div className="mt-1 text-muted-foreground">A: {f.a}</div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Affiliate Strategy</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Field label="Primary CTA Position" value={outline.affiliate_strategy?.primary_cta_position} />
                <Field label="Product Card Count" value={String(outline.affiliate_strategy?.product_card_count)} />
                <Field
                  label="Comparison Table"
                  value={outline.affiliate_strategy?.comparison_table ? 'Yes' : 'No'}
                />
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </main>
  );
}

function Field({ label, value }: { label: string; value: string | undefined | null }) {
  return (
    <div>
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="text-sm">{value ?? '—'}</div>
    </div>
  );
}
