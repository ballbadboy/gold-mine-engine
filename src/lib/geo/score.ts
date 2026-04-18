/**
 * GEO (Generative Engine Optimization) Scorer
 *
 * Analyzes a content outline across 5 dimensions that predict AI citation
 * behavior in Perplexity, ChatGPT, Gemini, and Claude search tools.
 *
 * Score: 0-100 total (5 dimensions × 20 points each)
 *
 * Dimensions (based on Princeton GEO-bench + Perplexity citation studies):
 *   1. Answer-First Structure    — direct definition in intro
 *   2. FAQ Depth                 — question density + answer quality
 *   3. Schema Markup Coverage    — structured data types
 *   4. Citability Markers        — bullets, lists, key takeaways
 *   5. Statistical Density       — specific numbers, percentages
 */

import type { Outline, OutlineSection } from '@/lib/content/generate';

export interface GeoDimensionScore {
  score: number;       // 0-20
  max: number;         // always 20
  signals: string[];   // positive signals detected
  gaps: string[];      // what's missing
}

export interface GeoScore {
  total: number;       // 0-100
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  dimensions: {
    answer_first: GeoDimensionScore;
    faq_depth: GeoDimensionScore;
    schema_coverage: GeoDimensionScore;
    citability: GeoDimensionScore;
    statistical_density: GeoDimensionScore;
  };
  recommendations: string[];
}

// ─── Scorers (each returns 0-20) ──────────────────────────────────────────────

function scoreAnswerFirst(outline: Outline): GeoDimensionScore {
  const signals: string[] = [];
  const gaps: string[] = [];
  let score = 0;

  // Direct answer in intro_hook (< 60 words)
  const introWords = outline.intro_hook?.trim().split(/\s+/).length ?? 0;
  if (introWords > 0 && introWords <= 60) {
    score += 8;
    signals.push(`Concise intro (${introWords} words)`);
  } else if (introWords > 60 && introWords <= 100) {
    score += 4;
    signals.push('Intro present but long');
  } else {
    gaps.push('Intro too long or missing — keep under 60 words for AI quoting');
  }

  // Title contains question or direct descriptor
  if (/\b(what is|how to|best|guide|review|vs|top \d+)\b/i.test(outline.title)) {
    score += 6;
    signals.push('Title phrased as searchable question/descriptor');
  } else {
    gaps.push('Title lacks question/descriptor pattern');
  }

  // Meta description ~150 chars, contains target keyword
  const md = outline.meta_description ?? '';
  if (md.length >= 120 && md.length <= 165 && outline.target_keyword && md.toLowerCase().includes(outline.target_keyword.toLowerCase())) {
    score += 6;
    signals.push('Meta description optimized for snippet');
  } else {
    gaps.push('Meta description should be 120-165 chars and include target keyword');
  }

  return { score, max: 20, signals, gaps };
}

function scoreFaqDepth(outline: Outline): GeoDimensionScore {
  const signals: string[] = [];
  const gaps: string[] = [];
  let score = 0;

  const faqs = outline.faqs ?? [];
  const count = faqs.length;

  if (count >= 8) { score += 10; signals.push(`${count} FAQs — excellent depth`); }
  else if (count >= 5) { score += 7; signals.push(`${count} FAQs`); }
  else if (count >= 3) { score += 4; signals.push(`${count} FAQs — minimum viable`); }
  else { gaps.push('Fewer than 3 FAQs — AI engines prefer 5-10 for citation'); }

  // Answer quality (average answer length)
  if (count > 0) {
    const avgAnswerWords =
      faqs.reduce((sum, f) => sum + (f.a?.split(/\s+/).length ?? 0), 0) / count;
    if (avgAnswerWords >= 40 && avgAnswerWords <= 120) {
      score += 6;
      signals.push(`FAQ answers avg ${Math.round(avgAnswerWords)} words — quotable length`);
    } else if (avgAnswerWords > 0) {
      score += 2;
      gaps.push(`FAQ answers avg ${Math.round(avgAnswerWords)} words — aim for 40-120`);
    }
  }

  // Questions start with question words
  const qWords = faqs.filter((f) => /^(what|how|why|when|where|who|is|are|can|does|do)\s/i.test(f.q ?? '')).length;
  if (qWords >= Math.ceil(count * 0.8)) {
    score += 4;
    signals.push('Questions use natural question words');
  } else if (count > 0) {
    gaps.push('Some FAQ questions don\'t start with question words');
  }

  return { score, max: 20, signals, gaps };
}

function scoreSchemaCoverage(outline: Outline): GeoDimensionScore {
  const signals: string[] = [];
  const gaps: string[] = [];
  let score = 0;

  const types = new Set((outline.schema_jsonld_types ?? []).map((t) => t.toLowerCase()));

  if (types.has('article') || types.has('blogposting')) { score += 5; signals.push('Article schema'); }
  else { gaps.push('Missing Article schema (baseline)'); }

  if (types.has('faqpage')) { score += 6; signals.push('FAQPage schema'); }
  else if (outline.faqs && outline.faqs.length > 0) { gaps.push('Has FAQs but missing FAQPage schema'); }

  if (types.has('howto')) { score += 4; signals.push('HowTo schema'); }

  if (types.has('product') || types.has('review')) { score += 5; signals.push('Product/Review schema'); }

  // Also check schema_type hints on sections
  const sectionSchemas = (outline.sections ?? [])
    .map((s: OutlineSection) => s.schema_type)
    .filter((t): t is string => !!t && t !== 'null' && t !== '');
  if (sectionSchemas.length > 0) {
    score = Math.min(20, score + 2);
    signals.push(`${sectionSchemas.length} sections with schema hints`);
  }

  return { score: Math.min(score, 20), max: 20, signals, gaps };
}

function scoreCitability(outline: Outline): GeoDimensionScore {
  const signals: string[] = [];
  const gaps: string[] = [];
  let score = 0;

  const sections = outline.sections ?? [];

  // Key points per section
  const avgKeyPoints =
    sections.length > 0
      ? sections.reduce((sum, s) => sum + (s.key_points?.length ?? 0), 0) / sections.length
      : 0;
  if (avgKeyPoints >= 4) { score += 8; signals.push(`${avgKeyPoints.toFixed(1)} avg key points per section`); }
  else if (avgKeyPoints >= 2) { score += 4; signals.push(`${avgKeyPoints.toFixed(1)} avg key points`); }
  else { gaps.push('Sections need 3-5 key bullet points each for AI extraction'); }

  // TOC present and substantial
  if (outline.toc && outline.toc.length >= 5) {
    score += 5;
    signals.push(`TOC with ${outline.toc.length} entries`);
  } else {
    gaps.push('Add a table of contents (5+ entries) for quick scanning');
  }

  // Secondary keywords — semantic richness
  const secondaryCount = (outline.secondary_keywords ?? []).length;
  const lsiCount = (outline.lsi_keywords ?? []).length;
  if (secondaryCount + lsiCount >= 10) {
    score += 4;
    signals.push(`${secondaryCount + lsiCount} related keywords — rich semantic signal`);
  }

  // Image suggestions (alt text = extractable)
  if ((outline.image_suggestions ?? []).length >= 3) {
    score += 3;
    signals.push('Image alt text suggestions present');
  }

  return { score: Math.min(score, 20), max: 20, signals, gaps };
}

function scoreStatisticalDensity(outline: Outline): GeoDimensionScore {
  const signals: string[] = [];
  const gaps: string[] = [];
  let score = 0;

  // Gather all text from the outline
  const allText = [
    outline.intro_hook ?? '',
    outline.meta_description ?? '',
    ...(outline.toc ?? []),
    ...(outline.sections ?? []).flatMap((s) => [s.h2, ...(s.key_points ?? [])]),
    ...(outline.faqs ?? []).flatMap((f) => [f.q, f.a]),
  ].join(' ');

  // Specific numbers (not years alone)
  const percentMatches = allText.match(/\b\d+(?:\.\d+)?%/g) ?? [];
  const multipliers = allText.match(/\b\d+(?:\.\d+)?x\b/gi) ?? [];
  const dollarAmounts = allText.match(/(?:฿|\$|€|£)\s?\d+/g) ?? [];
  const specificNumbers = allText.match(/\b\d{2,}(?:,\d{3})*(?:\.\d+)?\s+(?:mg|g|ml|kg|users|people|studies|trials)/gi) ?? [];

  const totalStats = percentMatches.length + multipliers.length + dollarAmounts.length + specificNumbers.length;

  if (totalStats >= 8) { score += 12; signals.push(`${totalStats} statistics found — excellent`); }
  else if (totalStats >= 4) { score += 8; signals.push(`${totalStats} statistics`); }
  else if (totalStats >= 2) { score += 4; signals.push(`${totalStats} statistics — add more`); }
  else { gaps.push('Very few statistics — AI engines prefer content with specific numbers (%, $, multipliers)'); }

  // Word count target total (proxy for research depth)
  const totalWords = (outline.sections ?? []).reduce((sum, s) => sum + (s.word_count_target ?? 0), 0);
  if (totalWords >= 2500) { score += 5; signals.push(`Target ${totalWords} words — research depth`); }
  else if (totalWords >= 1500) { score += 3; }
  else { gaps.push('Target word count low — aim for 2000+ for pillar content'); }

  // Citations/studies mentioned
  if (/\b(study|studies|research|meta-analysis|clinical trial|peer-reviewed)\b/i.test(allText)) {
    score += 3;
    signals.push('References studies/research');
  } else {
    gaps.push('No mention of studies/research — add authority signals');
  }

  return { score: Math.min(score, 20), max: 20, signals, gaps };
}

// ─── Public API ───────────────────────────────────────────────────────────────

function grade(total: number): GeoScore['grade'] {
  if (total >= 85) return 'A';
  if (total >= 70) return 'B';
  if (total >= 55) return 'C';
  if (total >= 40) return 'D';
  return 'F';
}

function topRecommendations(dims: GeoScore['dimensions']): string[] {
  // Sort dimensions by score ascending, take gaps from the 2 lowest
  const sorted = Object.entries(dims).sort(([, a], [, b]) => a.score - b.score);
  const recs: string[] = [];
  for (const [, dim] of sorted.slice(0, 2)) {
    recs.push(...dim.gaps.slice(0, 2));
  }
  return recs.slice(0, 4);
}

export function scoreOutline(outline: Outline): GeoScore {
  const dimensions = {
    answer_first: scoreAnswerFirst(outline),
    faq_depth: scoreFaqDepth(outline),
    schema_coverage: scoreSchemaCoverage(outline),
    citability: scoreCitability(outline),
    statistical_density: scoreStatisticalDensity(outline),
  };

  const total =
    dimensions.answer_first.score +
    dimensions.faq_depth.score +
    dimensions.schema_coverage.score +
    dimensions.citability.score +
    dimensions.statistical_density.score;

  return {
    total,
    grade: grade(total),
    dimensions,
    recommendations: topRecommendations(dimensions),
  };
}
