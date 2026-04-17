import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

interface ContentPage {
  id: string;
  slug: string;
  title: string;
  meta_description: string | null;
  type: string | null;
  status: string;
  created_at: string;
  website_id: string;
}

interface Website {
  id: string;
  domain: string;
}

async function getData() {
  const supabase = createAdminClient();
  const [{ data: pages }, { data: websites }] = await Promise.all([
    supabase
      .from('content_pages')
      .select('id, slug, title, meta_description, type, status, created_at, website_id')
      .order('created_at', { ascending: false })
      .limit(100),
    supabase.from('websites').select('id, domain'),
  ]);
  return {
    pages: (pages ?? []) as ContentPage[],
    websites: new Map((websites ?? []).map((w: Website) => [w.id, w.domain])),
  };
}

const TYPE_LABELS: Record<string, string> = {
  pillar: '📚 Pillar',
  listicle: '📋 Listicle',
  review: '⭐ Review',
  comparison: '⚖️ Comparison',
  guide: '🗺️ Guide',
};

export default async function ContentListPage() {
  const { pages, websites } = await getData();

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <div className="mb-2">
              <Link href="/" className="text-sm text-muted-foreground hover:underline">
                ← Dashboard
              </Link>
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Content Library</h1>
            <p className="mt-1 text-muted-foreground">
              Generated outlines saved in Supabase · {pages.length} total
            </p>
          </div>
        </header>

        {pages.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>No content yet</CardTitle>
              <CardDescription>
                Generate your first outline via the API:
              </CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="overflow-x-auto rounded-md bg-muted p-4 text-xs">
{`curl -X POST http://localhost:3000/api/content/generate \\
  -H "Content-Type: application/json" \\
  -d '{
    "topic": "Top 10 NMN Supplements Thailand 2026",
    "niche": "Longevity",
    "type": "listicle",
    "language": "th",
    "provider": "claude",
    "max_tokens": 8000
  }'`}
              </pre>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/30 text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Title</th>
                    <th className="px-4 py-3 font-medium">Website</th>
                    <th className="px-4 py-3 font-medium">Type</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {pages.map((p) => (
                    <tr key={p.id} className="border-b last:border-0 hover:bg-muted/20">
                      <td className="px-4 py-3">
                        <Link href={`/content/${p.id}`} className="block font-medium hover:underline">
                          {p.title}
                        </Link>
                        <div className="text-xs text-muted-foreground">/{p.slug}</div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        {websites.get(p.website_id) ?? '—'}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="secondary">{TYPE_LABELS[p.type ?? ''] ?? p.type}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={p.status === 'published' ? 'default' : 'outline'}>
                          {p.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {new Date(p.created_at).toLocaleString('th-TH', {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
