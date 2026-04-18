import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

interface Tenant {
  id: string;
  slug: string;
  name: string;
  plan: string;
}

async function getTenants(): Promise<{ ok: boolean; tenants: Tenant[]; error?: string }> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('tenants')
      .select('id, slug, name, plan')
      .order('created_at', { ascending: true });

    if (error) return { ok: false, tenants: [], error: error.message };
    return { ok: true, tenants: data ?? [] };
  } catch (e: unknown) {
    return { ok: false, tenants: [], error: e instanceof Error ? e.message : 'Unknown error' };
  }
}

const SYSTEMS = [
  { name: 'Next.js 16', status: 'ok', note: 'App Router + Turbopack' },
  { name: 'Tailwind CSS 4', status: 'ok', note: 'PostCSS pipeline' },
  { name: 'shadcn/ui', status: 'ok', note: 'base-nova + neutral' },
  { name: 'Supabase', status: 'pending', note: 'checking...' },
  { name: 'Claude / Gemini / OR', status: 'ok', note: 'Auto-fallback chain' },
  { name: 'GA4', status: 'pending', note: 'Add service account viewer' },
  { name: 'OODA Loop', status: 'ok', note: 'Sprint 4 ✓' },
] as const;

export default async function Home() {
  const result = await getTenants();
  const systems = SYSTEMS.map((s) =>
    s.name === 'Supabase'
      ? { ...s, status: result.ok ? 'ok' : 'error', note: result.ok ? `${result.tenants.length} tenant(s)` : result.error ?? 'error' }
      : s
  );

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-5xl px-6 py-16">
        <header className="mb-12 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold tracking-tight">🏆 Gold Mine Engine</h1>
            <p className="mt-2 text-muted-foreground">
              Self-optimizing growth system — affiliate + SEO + ads loop
            </p>
          </div>
          <Badge variant="secondary" className="text-sm">Sprint 4 · OODA Loop ✓</Badge>
        </header>

        <section className="mb-10">
          <h2 className="mb-4 text-xl font-semibold">System Status</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {systems.map((s) => (
              <Card key={s.name}>
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <p className="font-medium">{s.name}</p>
                    <p className="text-xs text-muted-foreground">{s.note}</p>
                  </div>
                  <StatusBadge status={s.status} />
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="mb-10">
          <Card>
            <CardHeader>
              <CardTitle>Tenants</CardTitle>
              <CardDescription>Multi-tenant ready from day 1 — 1 row = you (owner)</CardDescription>
            </CardHeader>
            <CardContent>
              {result.ok ? (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="pb-2 font-medium">Slug</th>
                      <th className="pb-2 font-medium">Name</th>
                      <th className="pb-2 font-medium">Plan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.tenants.map((t) => (
                      <tr key={t.id} className="border-b last:border-0">
                        <td className="py-2 font-mono text-xs">{t.slug}</td>
                        <td className="py-2">{t.name}</td>
                        <td className="py-2">
                          <Badge variant="outline">{t.plan}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-sm text-destructive">⚠️ {result.error}</p>
              )}
            </CardContent>
          </Card>
        </section>

        <footer className="flex items-center justify-center gap-4 text-center text-xs text-muted-foreground">
          <Link href="/content" className="underline">Content Library</Link>
          <span>·</span>
          <Link href="/insights" className="underline font-medium text-foreground">⚡ Loop Insights</Link>
          <span>·</span>
          <Link href="/seo" className="underline font-medium text-foreground">🗂️ SEO Planner</Link>
          <span>·</span>
          <a href="/api/health" className="underline">Health</a>
          <span>·</span>
          <a href="/api/ai/status" className="underline">AI Status</a>
        </footer>
      </div>
    </main>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string }> = {
    ok: { label: '✓ OK', className: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' },
    pending: { label: '… Pending', className: 'bg-amber-500/10 text-amber-700 dark:text-amber-400' },
    error: { label: '✗ Error', className: 'bg-red-500/10 text-red-700 dark:text-red-400' },
    off: { label: '○ Off', className: 'bg-muted text-muted-foreground' },
  };
  const c = config[status] ?? config.off;
  return <span className={`rounded-md px-2 py-1 text-xs font-medium ${c.className}`}>{c.label}</span>;
}
