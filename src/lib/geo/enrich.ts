/**
 * GEO Enrichment — surgical upgrades to existing outlines.
 *
 * Flow: score current outline → identify weak dimensions → ask AI for ONLY
 * the missing elements (stats, FAQs, schema, better intro) → merge back.
 *
 * Cost: ~500-1000 output tokens vs 4000+ for a full regenerate.
 * Idempotent: safe to re-run — dedupes FAQs by question, schema by type.
 */

import JSON5 from 'json5';
import { generate, type ProviderName } from '@/lib/ai';
import type { Outline } from '@/lib/content/generate';
import { scoreOutline, type GeoScore } from './score';

export interface EnrichmentDelta {
  new_faqs: Array<{ q: string; a: string }>;
  new_schema_types: string[];
  improved_intro: string | null;
  new_stats: string[];
  authority_signals: string[];
}

export interface EnrichmentResult {
  outline: Outline;
  before: GeoScore;
  after: GeoScore;
  delta: EnrichmentDelta;
  provider: ProviderName;
  model: string;
  latency_ms: number;
  cost_tokens: { input: number; output: number };
}

// ─── Prompt builder ──────────────────────────────────────────────────────────

function buildEnrichmentPrompt(outline: Outline, score: GeoScore) {
  // Find the 2-3 weakest dimensions
  const weakDims = (Object.entries(score.dimensions) as Array<[string, typeof score.dimensions.answer_first]>)
    .sort(([, a], [, b]) => a.score - b.score)
    .slice(0, 3)
    .filter(([, d]) => d.score < 16); // only fix dims below 16/20

  const weakSummary = weakDims
    .map(([key, d]) => `- ${key} (${d.score}/20): ${d.gaps.join('; ')}`)
    .join('\n');

  const existingFaqQs = (outline.faqs ?? []).map((f) => f.q).join('\n  - ');
  const existingSchemas = (outline.schema_jsonld_types ?? []).join(', ') || 'none';
  const sectionHeadings = (outline.sections ?? []).map((s) => s.h2).join('\n  - ');

  const system = `You are a GEO (Generative Engine Optimization) expert. You enhance content outlines so they get cited in Perplexity, ChatGPT, Claude, and Gemini search answers.

You return ONLY the missing enhancements as a JSON object — never rewrite existing fields.

Required JSON shape (every field REQUIRED, use empty array/null if not needed):
{
  "new_faqs": [{"q": "question?", "a": "answer"}],
  "new_schema_types": ["FAQPage", "Article", "HowTo"],
  "improved_intro": "40-55 word intro" or null,
  "new_stats": ["statistic with source"],
  "authority_signals": ["expert quote or citation"]
}

HARD LIMITS (to stay within token budget):
- MAX 3 new_faqs (each answer 40-70 words — keep concise)
- MAX 2 new_schema_types
- MAX 5 new_stats (one sentence each, with source in parens)
- MAX 2 authority_signals

Rules:
- Every "new_faqs[].a" MUST include at least one specific number
- "new_stats" MUST be specific: percentages, multipliers, amounts, dosages with units
- "improved_intro" must be 40-55 words AND include the target keyword
- Use \\n NOT raw newlines inside strings
- Return plain JSON only. No markdown fences. No prose. No commentary.`;

  const userMsg = `Enhance this outline. Current GEO score: ${score.total}/100 (Grade ${score.grade}).

Weak dimensions to fix:
${weakSummary || '(all dimensions acceptable — suggest minor upgrades)'}

Existing outline context:
- Title: ${outline.title}
- Target keyword: ${outline.target_keyword}
- Language: based on the title above
- Existing FAQs (${(outline.faqs ?? []).length}):
  - ${existingFaqQs || '(none)'}
- Existing schema types: ${existingSchemas}
- Section H2s:
  - ${sectionHeadings}

Generate enhancements that specifically address the weak dimensions. Keep them in the same language as the title.`;

  return { system, messages: [{ role: 'user' as const, content: userMsg }] };
}

// ─── JSON parsing (tolerant) ──────────────────────────────────────────────────

/** Common Claude JSON issues: trailing commas, raw newlines in strings, stray control chars */
function repairJson(raw: string): string {
  let s = raw;
  // Remove trailing commas before } or ]
  s = s.replace(/,(\s*[}\]])/g, '$1');
  // Escape raw newlines and tabs inside string literals (between "...")
  // This regex walks the string and escapes newlines only when inside a string.
  let repaired = '';
  let inString = false;
  let prev = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '"' && prev !== '\\') inString = !inString;
    if (inString && c === '\n') { repaired += '\\n'; prev = c; continue; }
    if (inString && c === '\r') { repaired += '\\r'; prev = c; continue; }
    if (inString && c === '\t') { repaired += '\\t'; prev = c; continue; }
    repaired += c;
    prev = c;
  }
  return repaired;
}

function parseEnrichmentJson(text: string): EnrichmentDelta {
  // Strip markdown fences
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');

  // Find first { and last }
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end < 0) throw new Error('No JSON object found in response');

  const jsonText = cleaned.slice(start, end + 1);

  // Try strict parse first (cheapest), then fall back to json5 (tolerant of
  // trailing commas, unquoted strings, multi-line strings — the failure modes
  // Claude exhibits most often when emitting Thai content).
  let parsed: Partial<EnrichmentDelta>;
  try {
    parsed = JSON.parse(jsonText) as Partial<EnrichmentDelta>;
  } catch {
    try {
      parsed = JSON5.parse(jsonText) as Partial<EnrichmentDelta>;
    } catch {
      // Last resort: manual repair + JSON5
      parsed = JSON5.parse(repairJson(jsonText)) as Partial<EnrichmentDelta>;
    }
  }

  return {
    new_faqs: Array.isArray(parsed.new_faqs) ? parsed.new_faqs : [],
    new_schema_types: Array.isArray(parsed.new_schema_types) ? parsed.new_schema_types : [],
    improved_intro: typeof parsed.improved_intro === 'string' ? parsed.improved_intro : null,
    new_stats: Array.isArray(parsed.new_stats) ? parsed.new_stats : [],
    authority_signals: Array.isArray(parsed.authority_signals) ? parsed.authority_signals : [],
  };
}

// ─── Merge — surgical & deduplicated ─────────────────────────────────────────

function normalizeQuestion(q: string): string {
  return q.toLowerCase().replace(/[^a-z0-9ก-๙]+/g, ' ').trim();
}

export function mergeEnrichment(outline: Outline, delta: EnrichmentDelta): Outline {
  const out: Outline = JSON.parse(JSON.stringify(outline));

  // Merge FAQs — dedupe by normalized question
  const existingQs = new Set((out.faqs ?? []).map((f) => normalizeQuestion(f.q)));
  const newFaqs = delta.new_faqs.filter((f) => f.q && f.a && !existingQs.has(normalizeQuestion(f.q)));
  out.faqs = [...(out.faqs ?? []), ...newFaqs];

  // Merge schema types (dedupe, case-insensitive)
  const existingSchemas = new Set((out.schema_jsonld_types ?? []).map((s) => s.toLowerCase()));
  const newSchemas = delta.new_schema_types.filter((s) => s && !existingSchemas.has(s.toLowerCase()));
  out.schema_jsonld_types = [...(out.schema_jsonld_types ?? []), ...newSchemas];

  // Replace intro if AI provided a better one
  if (delta.improved_intro && delta.improved_intro.trim().length > 0) {
    out.intro_hook = delta.improved_intro.trim();
  }

  // Inject stats + authority as a new "Key Facts & Evidence" section at position 1
  const statsAndAuth = [...delta.new_stats, ...delta.authority_signals].filter(Boolean);
  if (statsAndAuth.length > 0) {
    // Check if we already have such a section from a previous enrichment run
    const existingStatsIdx = (out.sections ?? []).findIndex((s) =>
      /key facts|evidence|statistics|ข้อเท็จจริง|สถิติ/i.test(s.h2),
    );
    if (existingStatsIdx >= 0) {
      // Merge into existing key_points (dedupe by exact string)
      const existing = new Set(out.sections[existingStatsIdx].key_points ?? []);
      const merged = [
        ...(out.sections[existingStatsIdx].key_points ?? []),
        ...statsAndAuth.filter((x) => !existing.has(x)),
      ];
      out.sections[existingStatsIdx] = {
        ...out.sections[existingStatsIdx],
        key_points: merged,
      };
    } else {
      // Insert a new section after intro (index 1)
      const newSection = {
        h2: out.target_keyword?.toLowerCase().includes('ไทย') || /[ก-๙]/.test(out.title)
          ? 'ข้อเท็จจริงและสถิติสำคัญ (Key Facts & Evidence)'
          : 'Key Facts & Evidence',
        word_count_target: 250,
        key_points: statsAndAuth,
        internal_links: [],
        cta_placement: 'none',
        schema_type: 'ClaimReview',
      };
      out.sections = [...(out.sections ?? [])];
      const insertAt = Math.min(1, out.sections.length);
      out.sections.splice(insertAt, 0, newSection);
    }
  }

  return out;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function enrichOutline(
  outline: Outline,
  opts: { provider?: ProviderName } = {},
): Promise<EnrichmentResult> {
  const before = scoreOutline(outline);

  const { system, messages } = buildEnrichmentPrompt(outline, before);
  const result = await generate(messages, {
    provider: opts.provider ?? 'claude', // Claude handles structured JSON best
    system,
    maxTokens: 4000, // Thai text ~3-4x token cost of English; headroom avoids truncation
    temperature: 0.3, // Lower for structured output consistency
  });

  const delta = parseEnrichmentJson(result.text);
  const enriched = mergeEnrichment(outline, delta);
  const after = scoreOutline(enriched);

  return {
    outline: enriched,
    before,
    after,
    delta,
    provider: result.provider,
    model: result.model,
    latency_ms: result.latencyMs,
    cost_tokens: { input: result.inputTokens, output: result.outputTokens },
  };
}
