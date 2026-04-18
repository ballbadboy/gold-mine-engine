import JSON5 from 'json5';
import type { ChatMessage } from '@/lib/ai';

export type ContentType = 'pillar' | 'listicle' | 'review' | 'comparison' | 'guide';

export interface OutlineRequest {
  topic: string;
  niche: string;
  type: ContentType;
  language: 'th' | 'en';
  targetKeyword?: string;
  affiliateContext?: string; // e.g. "promote Thorne NMN, Tru Niagen"
}

const SYSTEM_BY_LANG: Record<'th' | 'en', string> = {
  th: 'คุณเป็น SEO content strategist สำหรับตลาดไทย เชี่ยวชาญ GEO (Generative Engine Optimization) สำหรับ AI search (ChatGPT/Perplexity/Claude) เขียน structured outline ที่นำไปสร้าง content ได้ทันที โดยคำนึงถึง E-E-A-T, schema markup, internal linking strategy และ affiliate CTA placement',
  en: 'You are an SEO content strategist specializing in GEO (Generative Engine Optimization) for AI search engines. Produce structured outlines optimized for E-E-A-T, schema markup, internal linking, and affiliate CTA placement.',
};

const TYPE_BRIEF: Record<ContentType, string> = {
  pillar: 'Long-form pillar (3000-5000 words) covering a topic broadly with many sub-topics for internal linking',
  listicle: 'Top-N listicle (1500-3000 words) with ranked products and comparison',
  review: 'Single-product deep review (2000-3000 words) with pros/cons and personal experience',
  comparison: 'Head-to-head comparison (1500-2500 words) between 2-3 products',
  guide: 'How-to or buying guide (2000-4000 words) explaining decisions and trade-offs',
};

export function buildOutlineMessages(req: OutlineRequest): {
  system: string;
  messages: ChatMessage[];
} {
  const { topic, niche, type, language, targetKeyword, affiliateContext } = req;
  const system = SYSTEM_BY_LANG[language];

  const instructions = language === 'th'
    ? `สร้าง outline บทความแบบ ${type} (${TYPE_BRIEF[type]}) เรื่อง "${topic}" ใน niche ${niche}

ตอบกลับเป็น JSON เท่านั้น (ห้ามมี markdown code fence) ตาม schema นี้:

{
  "slug": "url-friendly-slug",
  "title": "H1 (ควรมี keyword หลัก)",
  "meta_title": "SEO title 55-60 ตัวอักษร",
  "meta_description": "meta description 150-160 ตัวอักษร",
  "target_keyword": "keyword หลัก",
  "secondary_keywords": ["keyword1", "keyword2"],
  "lsi_keywords": ["..."],
  "intro_hook": "intro 200 คำ ภาษาไทย",
  "toc": ["หัวข้อ 1", "หัวข้อ 2"],
  "sections": [
    {
      "h2": "หัวข้อ H2",
      "word_count_target": 500,
      "key_points": ["point 1"],
      "internal_links": ["related-slug-1"],
      "cta_placement": "above-fold|mid|end|none",
      "schema_type": "FAQ|HowTo|Review|Product|null"
    }
  ],
  "faqs": [{"q": "คำถาม", "a": "คำตอบสั้น"}],
  "affiliate_strategy": {
    "primary_cta_position": "above-fold|TOC|section-1|end",
    "product_card_count": 5,
    "comparison_table": true
  },
  "schema_jsonld_types": ["BlogPosting", "FAQPage"],
  "image_suggestions": [{"alt": "...", "placement": "hero|section-1"}]
}

${targetKeyword ? `Target keyword: "${targetKeyword}"` : ''}
${affiliateContext ? `Affiliate products to promote: ${affiliateContext}` : ''}

สำคัญ: เขียน intro_hook, title, meta_description เป็นภาษาไทยที่เป็นธรรมชาติ ไม่ใช่แปลจาก AI`
    : `Create a ${type} outline (${TYPE_BRIEF[type]}) for "${topic}" in ${niche} niche.

Return JSON only (no markdown fences) matching this schema:

${JSON.stringify({
  slug: 'url-friendly-slug',
  title: 'H1',
  meta_title: 'SEO title 55-60 chars',
  meta_description: '150-160 chars',
  target_keyword: 'main keyword',
  secondary_keywords: [],
  lsi_keywords: [],
  intro_hook: '200-word intro',
  toc: [],
  sections: [{ h2: '', word_count_target: 500, key_points: [], internal_links: [], cta_placement: 'mid', schema_type: null }],
  faqs: [{ q: '', a: '' }],
  affiliate_strategy: { primary_cta_position: 'above-fold', product_card_count: 5, comparison_table: true },
  schema_jsonld_types: ['BlogPosting', 'FAQPage'],
  image_suggestions: [],
}, null, 2)}

${targetKeyword ? `Target keyword: "${targetKeyword}"` : ''}
${affiliateContext ? `Products to promote: ${affiliateContext}` : ''}`;

  return { system, messages: [{ role: 'user', content: instructions }] };
}

/**
 * Clean model output that may contain code fences or leading text,
 * and parse the JSON payload.
 */
export function parseOutlineJson<T = unknown>(text: string): T {
  let cleaned = text.trim();
  // Strip ```json fences if present
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  // Take content between first { and last }
  const first = cleaned.indexOf('{');
  const last = cleaned.lastIndexOf('}');
  if (first >= 0 && last > first) {
    cleaned = cleaned.slice(first, last + 1);
  }
  // Strict JSON first (fast path). Fall back to JSON5 for Claude's Thai
  // output quirks: trailing commas, unescaped newlines in string literals.
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    return JSON5.parse(cleaned) as T;
  }
}
