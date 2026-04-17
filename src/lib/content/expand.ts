import { generate, type ProviderName } from '@/lib/ai';
import { createAdminClient } from '@/lib/supabase/admin';
import type { Outline, OutlineSection } from './generate';

export interface ExpandedSection extends OutlineSection {
  expanded_text?: string;
  expanded_at?: string;
  expanded_by_provider?: ProviderName;
  expanded_tokens?: { input: number; output: number };
}

export interface ExpandOptions {
  contentPageId: string;
  sectionIndex: number;
  provider?: ProviderName;
  maxTokens?: number;
}

interface ExpandResult {
  content_page_id: string;
  section_index: number;
  text: string;
  words: number;
  meta: {
    provider: ProviderName;
    model: string;
    input_tokens: number;
    output_tokens: number;
    latency_ms: number;
  };
}

function buildSectionPrompt(
  outline: Outline,
  section: OutlineSection,
  language: string
): { system: string; user: string } {
  const system = language === 'th'
    ? 'คุณเป็น SEO copywriter ไทยที่เขียน long-form content สำหรับ Longevity/Biohacking niche เขียนด้วยภาษาธรรมชาติ มี E-E-A-T (ประสบการณ์จริง แหล่งอ้างอิง ข้อเสียจริงใจ) ใช้ heading H3 เหมาะสม มี internal/affiliate CTA ที่ไม่ขายของ hard-sell'
    : 'You are an SEO copywriter for Longevity/Biohacking niche. Write long-form with natural prose, E-E-A-T signals (personal experience, sources, honest cons), proper H3 structure, soft-sell CTAs.';

  const user = language === 'th'
    ? `เขียน body ของ section นี้ในบทความ "${outline.title}" (target keyword: ${outline.target_keyword})

Section: ${section.h2}
Word count target: ${section.word_count_target} คำ (±15%)
Key points ที่ต้อง cover:
${section.key_points.map((p) => `- ${p}`).join('\n')}
${section.internal_links?.length ? `Internal links ที่ต้องแทรก (markdown): ${section.internal_links.map((l) => `[${l}](/${l})`).join(', ')}` : ''}
CTA placement: ${section.cta_placement}
${section.schema_type ? `Schema: ${section.schema_type}` : ''}

กติกา:
- เขียน Markdown เท่านั้น (ไม่ต้องใส่ H2 heading เพราะจะใส่ข้างนอก)
- ใช้ H3 (###) สำหรับ subheadings ภายใน
- ภาษาธรรมชาติ ไม่ใช่แปล AI
- ไม่ใช่ bullet list ทั้งหมด — mix paragraph + list
- ใส่ตัวเลข/สถิติ/ตัวอย่างจริง (ถ้าไม่รู้ ใช้ placeholder เช่น [ref: study-id])
- ถ้า CTA mid หรือ end ให้แทรก affiliate link แบบ inline แบบไม่ hard-sell`
    : `Write the body of this section for article "${outline.title}" (target keyword: ${outline.target_keyword})

Section: ${section.h2}
Word count target: ${section.word_count_target} words (±15%)
Key points to cover:
${section.key_points.map((p) => `- ${p}`).join('\n')}
${section.internal_links?.length ? `Internal links to embed (markdown): ${section.internal_links.map((l) => `[${l}](/${l})`).join(', ')}` : ''}
CTA placement: ${section.cta_placement}

Rules:
- Markdown only (don't include H2 — it goes outside)
- Use H3 (###) for subheadings inside
- Mix paragraphs + lists, not all bullets
- Include numbers/stats/examples (use [ref: study-id] if unknown)
- Soft-sell CTA as inline markdown link`;

  return { system, user };
}

export async function expandSection(opts: ExpandOptions): Promise<ExpandResult> {
  const { contentPageId, sectionIndex, provider, maxTokens } = opts;
  const supabase = createAdminClient();

  const { data: page, error: pErr } = await supabase
    .from('content_pages')
    .select('id, body_mdx, website_id')
    .eq('id', contentPageId)
    .single();
  if (pErr || !page) throw new Error(`Page not found: ${pErr?.message ?? ''}`);

  const { data: website } = await supabase
    .from('websites')
    .select('language')
    .eq('id', page.website_id)
    .single();
  const language = website?.language ?? 'th';

  let outline: Outline;
  try {
    outline = JSON.parse(page.body_mdx) as Outline;
  } catch (e) {
    throw new Error(`body_mdx is not valid outline JSON: ${e}`);
  }

  const section = outline.sections?.[sectionIndex];
  if (!section) throw new Error(`Section index ${sectionIndex} out of range (0..${outline.sections.length - 1})`);

  const { system, user } = buildSectionPrompt(outline, section, language);

  // Dynamic maxTokens: word-count target * ~3 tokens/word + margin
  const dynamicMax = Math.min(8000, Math.max(1500, section.word_count_target * 4));
  const result = await generate(
    [{ role: 'user', content: user }],
    {
      provider,
      system,
      maxTokens: maxTokens ?? dynamicMax,
      temperature: 0.6,
    }
  );

  const expandedSection: ExpandedSection = {
    ...section,
    expanded_text: result.text,
    expanded_at: new Date().toISOString(),
    expanded_by_provider: result.provider,
    expanded_tokens: { input: result.inputTokens, output: result.outputTokens },
  };

  // Update outline in place, persist back
  outline.sections[sectionIndex] = expandedSection;
  const { error: uErr } = await supabase
    .from('content_pages')
    .update({ body_mdx: JSON.stringify(outline, null, 2) })
    .eq('id', contentPageId);
  if (uErr) throw new Error(`Failed to save expanded section: ${uErr.message}`);

  return {
    content_page_id: contentPageId,
    section_index: sectionIndex,
    text: result.text,
    words: result.text.split(/\s+/).length,
    meta: {
      provider: result.provider,
      model: result.model,
      input_tokens: result.inputTokens,
      output_tokens: result.outputTokens,
      latency_ms: result.latencyMs,
    },
  };
}
