/**
 * Programmatic SEO — keyword expansion for longevity niche (longevity-th.com)
 *
 * Strategy: seed compounds × intent templates = keyword matrix.
 * Each entry maps 1:1 to a content_pages row via a deterministic slug.
 */

export type Intent = 'informational' | 'commercial' | 'transactional';
export type ContentType = 'pillar' | 'listicle' | 'review' | 'comparison' | 'guide';

export interface KeywordEntry {
  keyword: string;
  slug: string;
  intent: Intent;
  pillar: string;        // parent topic cluster
  type: ContentType;
  topic: string;         // human-readable topic for AI prompt
  targetKeyword: string; // exact keyword to rank for
}

// ─── Seed data ───────────────────────────────────────────────────────────────

const YEAR = '2026';

const COMPOUNDS: Array<{ id: string; name: string; pillar: string }> = [
  { id: 'nmn',          name: 'NMN',                 pillar: 'NAD+ Boosters' },
  { id: 'nr',           name: 'Nicotinamide Riboside', pillar: 'NAD+ Boosters' },
  { id: 'resveratrol',  name: 'Resveratrol',           pillar: 'Sirtuins & Polyphenols' },
  { id: 'spermidine',   name: 'Spermidine',            pillar: 'Autophagy' },
  { id: 'fisetin',      name: 'Fisetin',               pillar: 'Senolytics' },
  { id: 'coq10',        name: 'CoQ10',                 pillar: 'Mitochondria' },
  { id: 'berberine',    name: 'Berberine',             pillar: 'Metabolic Health' },
  { id: 'quercetin',    name: 'Quercetin',             pillar: 'Senolytics' },
  { id: 'tru-niagen',   name: 'Tru Niagen',            pillar: 'NAD+ Boosters' },
  { id: 'lifespan',     name: 'Lifespan',              pillar: 'Longevity Brands' },
];

/** Slugify a string to URL-safe format */
function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// ─── Template expansion ───────────────────────────────────────────────────────

function compoundPages(): KeywordEntry[] {
  const entries: KeywordEntry[] = [];

  for (const c of COMPOUNDS) {
    // Commercial — review
    entries.push({
      keyword: `${c.name} review thailand ${YEAR}`,
      slug: `${c.id}-review-thailand-${YEAR}`,
      intent: 'commercial',
      pillar: c.pillar,
      type: 'review',
      topic: `${c.name} Supplement Review for Thailand ${YEAR}`,
      targetKeyword: `${c.name} review thailand`,
    });

    // Informational — benefits
    entries.push({
      keyword: `${c.name.toLowerCase()} benefits`,
      slug: `${c.id}-benefits`,
      intent: 'informational',
      pillar: c.pillar,
      type: 'guide',
      topic: `${c.name} Benefits — What the Science Says`,
      targetKeyword: `${c.name.toLowerCase()} benefits`,
    });

    // Informational — side effects
    entries.push({
      keyword: `${c.name.toLowerCase()} side effects`,
      slug: `${c.id}-side-effects`,
      intent: 'informational',
      pillar: c.pillar,
      type: 'guide',
      topic: `${c.name} Side Effects — Is it Safe?`,
      targetKeyword: `${c.name.toLowerCase()} side effects`,
    });

    // Informational — dosage
    entries.push({
      keyword: `${c.name.toLowerCase()} dosage guide`,
      slug: `${c.id}-dosage-guide`,
      intent: 'informational',
      pillar: c.pillar,
      type: 'guide',
      topic: `${c.name} Dosage Guide — How Much to Take`,
      targetKeyword: `${c.name.toLowerCase()} dosage`,
    });

    // Transactional — where to buy in Thailand
    entries.push({
      keyword: `where to buy ${c.name.toLowerCase()} thailand`,
      slug: `where-to-buy-${c.id}-thailand`,
      intent: 'transactional',
      pillar: c.pillar,
      type: 'guide',
      topic: `Where to Buy ${c.name} in Thailand — Best Sources ${YEAR}`,
      targetKeyword: `buy ${c.name.toLowerCase()} thailand`,
    });

    // Commercial — best brands
    entries.push({
      keyword: `best ${c.name.toLowerCase()} supplements thailand ${YEAR}`,
      slug: `best-${c.id}-supplements-thailand-${YEAR}`,
      intent: 'commercial',
      pillar: c.pillar,
      type: 'listicle',
      topic: `Best ${c.name} Supplements Available in Thailand ${YEAR}`,
      targetKeyword: `best ${c.name.toLowerCase()} thailand`,
    });
  }

  return entries;
}

function pillarPages(): KeywordEntry[] {
  return [
    {
      keyword: `best longevity supplements thailand ${YEAR}`,
      slug: `best-longevity-supplements-thailand-${YEAR}`,
      intent: 'commercial',
      pillar: 'Longevity',
      type: 'pillar',
      topic: `Best Longevity Supplements in Thailand ${YEAR} — Ultimate Guide`,
      targetKeyword: 'best longevity supplements thailand',
    },
    {
      keyword: 'anti-aging supplements guide thailand',
      slug: 'anti-aging-supplements-guide-thailand',
      intent: 'informational',
      pillar: 'Longevity',
      type: 'pillar',
      topic: 'Anti-Aging Supplements Guide for Thailand — What Works',
      targetKeyword: 'anti-aging supplements thailand',
    },
    {
      keyword: 'biohacking supplements thailand',
      slug: 'biohacking-supplements-thailand',
      intent: 'informational',
      pillar: 'Biohacking',
      type: 'pillar',
      topic: 'Biohacking Supplements in Thailand — Beginner to Advanced',
      targetKeyword: 'biohacking thailand supplements',
    },
    {
      keyword: 'nad+ supplements thailand comparison',
      slug: `nad-plus-supplements-thailand-comparison-${YEAR}`,
      intent: 'commercial',
      pillar: 'NAD+ Boosters',
      type: 'comparison',
      topic: `NAD+ Supplements Thailand — NMN vs NR vs Tru Niagen ${YEAR}`,
      targetKeyword: 'nad+ supplements thailand',
    },
    {
      keyword: 'longevity clinics bangkok',
      slug: 'longevity-clinics-bangkok',
      intent: 'commercial',
      pillar: 'Longevity',
      type: 'listicle',
      topic: 'Best Longevity Clinics in Bangkok — Where to Get Tested',
      targetKeyword: 'longevity clinics bangkok',
    },
    {
      keyword: 'senolytic supplements thailand',
      slug: 'senolytic-supplements-thailand',
      intent: 'commercial',
      pillar: 'Senolytics',
      type: 'listicle',
      topic: 'Senolytic Supplements in Thailand — Fisetin, Quercetin & More',
      targetKeyword: 'senolytic supplements thailand',
    },
    {
      keyword: 'autophagy supplements guide',
      slug: 'autophagy-supplements-guide',
      intent: 'informational',
      pillar: 'Autophagy',
      type: 'guide',
      topic: 'Autophagy Supplements — How to Boost Cellular Cleanup',
      targetKeyword: 'autophagy supplements',
    },
    {
      keyword: 'mitochondria supplements thailand',
      slug: 'mitochondria-supplements-thailand',
      intent: 'commercial',
      pillar: 'Mitochondria',
      type: 'listicle',
      topic: 'Best Mitochondria Supplements in Thailand — CoQ10, PQQ & More',
      targetKeyword: 'mitochondria supplements thailand',
    },
  ];
}

function comparisonPages(): KeywordEntry[] {
  const pairs: Array<[typeof COMPOUNDS[0], typeof COMPOUNDS[0]]> = [
    [COMPOUNDS[0], COMPOUNDS[1]], // NMN vs NR
    [COMPOUNDS[2], COMPOUNDS[4]], // Resveratrol vs Fisetin
    [COMPOUNDS[4], COMPOUNDS[7]], // Fisetin vs Quercetin
    [COMPOUNDS[0], COMPOUNDS[8]], // NMN vs Tru Niagen
    [COMPOUNDS[5], COMPOUNDS[3]], // CoQ10 vs Spermidine
    [COMPOUNDS[6], COMPOUNDS[2]], // Berberine vs Resveratrol
  ];

  return pairs.map(([a, b]) => ({
    keyword: `${a.name.toLowerCase()} vs ${b.name.toLowerCase()}`,
    slug: `${a.id}-vs-${b.id}`,
    intent: 'commercial' as Intent,
    pillar: a.pillar,
    type: 'comparison' as ContentType,
    topic: `${a.name} vs ${b.name} — Which Longevity Supplement is Better?`,
    targetKeyword: `${a.name.toLowerCase()} vs ${b.name.toLowerCase()}`,
  }));
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Full keyword plan — all expanded entries, deduplicated by slug */
export function buildKeywordPlan(): KeywordEntry[] {
  const all = [...compoundPages(), ...pillarPages(), ...comparisonPages()];
  const seen = new Set<string>();
  return all.filter((e) => {
    if (seen.has(e.slug)) return false;
    seen.add(e.slug);
    return true;
  });
}

/** Group entries by pillar cluster */
export function clusterByPillar(plan: KeywordEntry[]): Record<string, KeywordEntry[]> {
  const clusters: Record<string, KeywordEntry[]> = {};
  for (const entry of plan) {
    if (!clusters[entry.pillar]) clusters[entry.pillar] = [];
    clusters[entry.pillar].push(entry);
  }
  return clusters;
}

/** Group entries by intent */
export function clusterByIntent(plan: KeywordEntry[]): Record<Intent, KeywordEntry[]> {
  return {
    informational: plan.filter((e) => e.intent === 'informational'),
    commercial: plan.filter((e) => e.intent === 'commercial'),
    transactional: plan.filter((e) => e.intent === 'transactional'),
  };
}
