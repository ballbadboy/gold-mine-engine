import { generate, type ProviderName } from '@/lib/ai';
import { createAdminClient } from '@/lib/supabase/admin';
import { buildOutlineMessages, parseOutlineJson, type ContentType, type OutlineRequest } from './prompts';

export interface OutlineSection {
  h2: string;
  word_count_target: number;
  key_points: string[];
  internal_links: string[];
  cta_placement: string;
  schema_type: string | null;
}

export interface Outline {
  slug: string;
  title: string;
  meta_title: string;
  meta_description: string;
  target_keyword: string;
  secondary_keywords: string[];
  lsi_keywords: string[];
  intro_hook: string;
  toc: string[];
  sections: OutlineSection[];
  faqs: Array<{ q: string; a: string }>;
  affiliate_strategy: {
    primary_cta_position: string;
    product_card_count: number;
    comparison_table: boolean;
  };
  schema_jsonld_types: string[];
  image_suggestions: Array<{ alt: string; placement: string }>;
}

interface GenerateOutlineOptions extends OutlineRequest {
  tenantSlug?: string;
  websiteDomain?: string; // ensure/create website with this domain
  provider?: ProviderName;
  maxTokens?: number;
}

interface GenerateOutlineResult {
  content_page_id: string;
  website_id: string;
  tenant_id: string;
  outline: Outline;
  meta: {
    provider: ProviderName;
    model: string;
    input_tokens: number;
    output_tokens: number;
    latency_ms: number;
  };
}

/**
 * Ensure the tenant + website exist, returning their ids.
 * Idempotent — safe to call for every generation.
 */
async function ensureTenantAndWebsite(
  tenantSlug: string,
  domain: string,
  niche: string,
  language: 'th' | 'en'
): Promise<{ tenantId: string; websiteId: string }> {
  const supabase = createAdminClient();

  const { data: tenant, error: tErr } = await supabase
    .from('tenants')
    .select('id')
    .eq('slug', tenantSlug)
    .single();
  if (tErr || !tenant) throw new Error(`Tenant '${tenantSlug}' not found: ${tErr?.message ?? ''}`);

  const { data: existing } = await supabase
    .from('websites')
    .select('id')
    .eq('tenant_id', tenant.id)
    .eq('domain', domain)
    .maybeSingle();

  if (existing) return { tenantId: tenant.id, websiteId: existing.id };

  const { data: created, error: wErr } = await supabase
    .from('websites')
    .insert({ tenant_id: tenant.id, domain, niche, language, status: 'active' })
    .select('id')
    .single();
  if (wErr || !created) throw new Error(`Failed to create website: ${wErr?.message ?? ''}`);
  return { tenantId: tenant.id, websiteId: created.id };
}

export async function generateOutline(opts: GenerateOutlineOptions): Promise<GenerateOutlineResult> {
  const tenantSlug = opts.tenantSlug ?? 'owner';
  const websiteDomain = opts.websiteDomain ?? 'sandbox.local';
  const { tenantId, websiteId } = await ensureTenantAndWebsite(
    tenantSlug,
    websiteDomain,
    opts.niche,
    opts.language
  );

  const { system, messages } = buildOutlineMessages(opts);
  const result = await generate(messages, {
    provider: opts.provider,
    system,
    maxTokens: opts.maxTokens ?? 3500,
    temperature: 0.5,
  });

  const outline = parseOutlineJson<Outline>(result.text);

  const supabase = createAdminClient();
  const { data: inserted, error } = await supabase
    .from('content_pages')
    .upsert(
      {
        tenant_id: tenantId,
        website_id: websiteId,
        slug: outline.slug,
        title: outline.title,
        body_mdx: JSON.stringify(outline, null, 2),
        meta_description: outline.meta_description,
        type: opts.type as ContentType,
        status: 'draft',
      },
      { onConflict: 'website_id,slug' }
    )
    .select('id')
    .single();

  if (error || !inserted) throw new Error(`Failed to save content page: ${error?.message ?? ''}`);

  return {
    content_page_id: inserted.id,
    website_id: websiteId,
    tenant_id: tenantId,
    outline,
    meta: {
      provider: result.provider,
      model: result.model,
      input_tokens: result.inputTokens,
      output_tokens: result.outputTokens,
      latency_ms: result.latencyMs,
    },
  };
}
