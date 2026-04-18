/**
 * Programmatic SEO — niche-agnostic keyword expansion.
 *
 * Strategy: each niche is a config object (compounds + pillars + comparisons).
 * A single `buildKeywordPlan(nicheId)` function expands any niche into a
 * KeywordEntry[] ready for bulk AI generation.
 *
 * Adding a new niche = 1 new entry in NICHES, zero code changes.
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

interface Compound {
  id: string;
  name: string;
  pillar: string;
}

interface PillarPage {
  keyword: string;
  slug: string;
  intent: Intent;
  pillar: string;
  type: ContentType;
  topic: string;
  targetKeyword: string;
}

export interface NicheConfig {
  id: string;
  label: string;
  domain: string;
  niche: string;            // stored in websites.niche
  language: 'th' | 'en';
  year: string;
  market: string;           // "thailand", "singapore", etc.
  productWord: string;      // "supplements", "protein", "skincare"
  compounds: Compound[];
  pillars: PillarPage[];
  comparisonPairs: Array<[string, string]>; // compound ID pairs
  affiliateContext: string; // passed to AI prompt for this niche
}

// ─── Niche registry ──────────────────────────────────────────────────────────

export const NICHES: Record<string, NicheConfig> = {
  longevity: {
    id: 'longevity',
    label: 'Longevity & Biohacking',
    domain: 'longevity-th.com',
    niche: 'Longevity/Biohacking',
    language: 'th',
    year: '2026',
    market: 'thailand',
    productWord: 'supplements',
    affiliateContext: 'longevity supplements sold in Thailand — affiliate links to iHerb, Lazada, Shopee',
    compounds: [
      { id: 'nmn',         name: 'NMN',                    pillar: 'NAD+ Boosters' },
      { id: 'nr',          name: 'Nicotinamide Riboside',  pillar: 'NAD+ Boosters' },
      { id: 'resveratrol', name: 'Resveratrol',            pillar: 'Sirtuins & Polyphenols' },
      { id: 'spermidine',  name: 'Spermidine',             pillar: 'Autophagy' },
      { id: 'fisetin',     name: 'Fisetin',                pillar: 'Senolytics' },
      { id: 'coq10',       name: 'CoQ10',                  pillar: 'Mitochondria' },
      { id: 'berberine',   name: 'Berberine',              pillar: 'Metabolic Health' },
      { id: 'quercetin',   name: 'Quercetin',              pillar: 'Senolytics' },
      { id: 'tru-niagen',  name: 'Tru Niagen',             pillar: 'NAD+ Boosters' },
      { id: 'lifespan',    name: 'Lifespan',               pillar: 'Longevity Brands' },
    ],
    pillars: [
      { keyword: 'best longevity supplements thailand 2026', slug: 'best-longevity-supplements-thailand-2026',
        intent: 'commercial', pillar: 'Longevity', type: 'pillar',
        topic: 'Best Longevity Supplements in Thailand 2026 — Ultimate Guide', targetKeyword: 'best longevity supplements thailand' },
      { keyword: 'anti-aging supplements guide thailand', slug: 'anti-aging-supplements-guide-thailand',
        intent: 'informational', pillar: 'Longevity', type: 'pillar',
        topic: 'Anti-Aging Supplements Guide for Thailand — What Works', targetKeyword: 'anti-aging supplements thailand' },
      { keyword: 'biohacking supplements thailand', slug: 'biohacking-supplements-thailand',
        intent: 'informational', pillar: 'Biohacking', type: 'pillar',
        topic: 'Biohacking Supplements in Thailand — Beginner to Advanced', targetKeyword: 'biohacking thailand supplements' },
      { keyword: 'nad+ supplements thailand comparison', slug: 'nad-plus-supplements-thailand-comparison-2026',
        intent: 'commercial', pillar: 'NAD+ Boosters', type: 'comparison',
        topic: 'NAD+ Supplements Thailand — NMN vs NR vs Tru Niagen 2026', targetKeyword: 'nad+ supplements thailand' },
      { keyword: 'longevity clinics bangkok', slug: 'longevity-clinics-bangkok',
        intent: 'commercial', pillar: 'Longevity', type: 'listicle',
        topic: 'Best Longevity Clinics in Bangkok — Where to Get Tested', targetKeyword: 'longevity clinics bangkok' },
    ],
    comparisonPairs: [
      ['nmn', 'nr'],
      ['resveratrol', 'fisetin'],
      ['fisetin', 'quercetin'],
      ['nmn', 'tru-niagen'],
      ['coq10', 'spermidine'],
      ['berberine', 'resveratrol'],
    ],
  },

  protein: {
    id: 'protein',
    label: 'Protein & Sports Nutrition',
    domain: 'protein-th.com',
    niche: 'Sports Nutrition',
    language: 'th',
    year: '2026',
    market: 'thailand',
    productWord: 'protein',
    affiliateContext: 'sports nutrition and protein supplements sold in Thailand — affiliate links to MuscleTech, MyProtein, Optimum Nutrition via Lazada/Shopee',
    compounds: [
      { id: 'whey-isolate',   name: 'Whey Isolate',   pillar: 'Whey Protein' },
      { id: 'whey-concentrate', name: 'Whey Concentrate', pillar: 'Whey Protein' },
      { id: 'casein',         name: 'Casein Protein', pillar: 'Slow-Release Protein' },
      { id: 'plant-protein',  name: 'Plant Protein',  pillar: 'Plant-Based' },
      { id: 'creatine',       name: 'Creatine',       pillar: 'Performance' },
      { id: 'bcaa',           name: 'BCAA',           pillar: 'Amino Acids' },
      { id: 'eaa',            name: 'EAA',            pillar: 'Amino Acids' },
      { id: 'pre-workout',    name: 'Pre-Workout',    pillar: 'Performance' },
      { id: 'mass-gainer',    name: 'Mass Gainer',    pillar: 'Weight Gain' },
      { id: 'l-carnitine',    name: 'L-Carnitine',    pillar: 'Fat Loss' },
    ],
    pillars: [
      { keyword: 'best whey protein thailand 2026', slug: 'best-whey-protein-thailand-2026',
        intent: 'commercial', pillar: 'Whey Protein', type: 'pillar',
        topic: 'Best Whey Protein in Thailand 2026 — Tested & Reviewed', targetKeyword: 'best whey protein thailand' },
      { keyword: 'protein powder buying guide thailand', slug: 'protein-powder-buying-guide-thailand',
        intent: 'informational', pillar: 'Whey Protein', type: 'pillar',
        topic: 'How to Choose Protein Powder — Complete Thai Buyer\'s Guide', targetKeyword: 'protein powder thailand guide' },
      { keyword: 'creatine thailand guide', slug: 'creatine-thailand-guide',
        intent: 'informational', pillar: 'Performance', type: 'pillar',
        topic: 'Creatine in Thailand — Everything You Need to Know', targetKeyword: 'creatine thailand' },
      { keyword: 'best supplements for muscle gain thailand', slug: 'best-supplements-muscle-gain-thailand-2026',
        intent: 'commercial', pillar: 'Performance', type: 'listicle',
        topic: 'Best Supplements for Muscle Gain in Thailand 2026', targetKeyword: 'muscle gain supplements thailand' },
      { keyword: 'best pre-workout thailand', slug: 'best-pre-workout-thailand-2026',
        intent: 'commercial', pillar: 'Performance', type: 'listicle',
        topic: 'Best Pre-Workout Supplements in Thailand 2026', targetKeyword: 'best pre workout thailand' },
    ],
    comparisonPairs: [
      ['whey-isolate', 'whey-concentrate'],
      ['whey-isolate', 'casein'],
      ['bcaa', 'eaa'],
      ['whey-isolate', 'plant-protein'],
      ['creatine', 'pre-workout'],
    ],
  },

  beauty: {
    id: 'beauty',
    label: 'Beauty & Collagen',
    domain: 'collagen-beauty-th.com',
    niche: 'Beauty Supplements',
    language: 'th',
    year: '2026',
    market: 'thailand',
    productWord: 'supplements',
    affiliateContext: 'beauty supplements sold in Thailand — collagen, biotin, glutathione — affiliate links via Lazada/Shopee',
    compounds: [
      { id: 'marine-collagen',    name: 'Marine Collagen',    pillar: 'Collagen' },
      { id: 'bovine-collagen',    name: 'Bovine Collagen',    pillar: 'Collagen' },
      { id: 'collagen-peptides',  name: 'Collagen Peptides',  pillar: 'Collagen' },
      { id: 'hyaluronic-acid',    name: 'Hyaluronic Acid',    pillar: 'Skin Hydration' },
      { id: 'glutathione',        name: 'Glutathione',        pillar: 'Skin Whitening' },
      { id: 'biotin',             name: 'Biotin',             pillar: 'Hair & Nails' },
      { id: 'vitamin-c',          name: 'Vitamin C',          pillar: 'Antioxidants' },
      { id: 'astaxanthin',        name: 'Astaxanthin',        pillar: 'Antioxidants' },
      { id: 'silica',             name: 'Silica',             pillar: 'Hair & Nails' },
    ],
    pillars: [
      { keyword: 'best collagen thailand 2026', slug: 'best-collagen-thailand-2026',
        intent: 'commercial', pillar: 'Collagen', type: 'pillar',
        topic: 'Best Collagen Supplements in Thailand 2026 — Derma-Tested', targetKeyword: 'best collagen thailand' },
      { keyword: 'beauty supplements guide thailand', slug: 'beauty-supplements-guide-thailand',
        intent: 'informational', pillar: 'Beauty', type: 'pillar',
        topic: 'Beauty Supplements Guide for Thai Women — What Actually Works', targetKeyword: 'beauty supplements thailand' },
      { keyword: 'glutathione thailand guide', slug: 'glutathione-thailand-guide',
        intent: 'informational', pillar: 'Skin Whitening', type: 'pillar',
        topic: 'Glutathione in Thailand — Safe Brightening or Hype?', targetKeyword: 'glutathione thailand' },
      { keyword: 'best supplements for hair growth thailand', slug: 'best-hair-growth-supplements-thailand',
        intent: 'commercial', pillar: 'Hair & Nails', type: 'listicle',
        topic: 'Best Supplements for Hair Growth in Thailand 2026', targetKeyword: 'hair growth supplements thailand' },
    ],
    comparisonPairs: [
      ['marine-collagen', 'bovine-collagen'],
      ['marine-collagen', 'collagen-peptides'],
      ['glutathione', 'vitamin-c'],
      ['biotin', 'silica'],
    ],
  },
};

// ─── Generic expansion engine ─────────────────────────────────────────────────

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function compoundPages(cfg: NicheConfig): KeywordEntry[] {
  const entries: KeywordEntry[] = [];
  const { market, year, productWord } = cfg;

  for (const c of cfg.compounds) {
    // Commercial — review
    entries.push({
      keyword: `${c.name} review ${market} ${year}`,
      slug: `${c.id}-review-${market}-${year}`,
      intent: 'commercial', pillar: c.pillar, type: 'review',
      topic: `${c.name} Review for ${market.charAt(0).toUpperCase() + market.slice(1)} ${year}`,
      targetKeyword: `${c.name.toLowerCase()} review ${market}`,
    });

    // Informational — benefits
    entries.push({
      keyword: `${c.name.toLowerCase()} benefits`,
      slug: `${c.id}-benefits`,
      intent: 'informational', pillar: c.pillar, type: 'guide',
      topic: `${c.name} Benefits — What the Science Says`,
      targetKeyword: `${c.name.toLowerCase()} benefits`,
    });

    // Informational — side effects
    entries.push({
      keyword: `${c.name.toLowerCase()} side effects`,
      slug: `${c.id}-side-effects`,
      intent: 'informational', pillar: c.pillar, type: 'guide',
      topic: `${c.name} Side Effects — Is it Safe?`,
      targetKeyword: `${c.name.toLowerCase()} side effects`,
    });

    // Informational — dosage
    entries.push({
      keyword: `${c.name.toLowerCase()} dosage guide`,
      slug: `${c.id}-dosage-guide`,
      intent: 'informational', pillar: c.pillar, type: 'guide',
      topic: `${c.name} Dosage Guide — How Much to Take`,
      targetKeyword: `${c.name.toLowerCase()} dosage`,
    });

    // Transactional — where to buy
    entries.push({
      keyword: `where to buy ${c.name.toLowerCase()} ${market}`,
      slug: `where-to-buy-${c.id}-${market}`,
      intent: 'transactional', pillar: c.pillar, type: 'guide',
      topic: `Where to Buy ${c.name} in ${market.charAt(0).toUpperCase() + market.slice(1)} — Best Sources ${year}`,
      targetKeyword: `buy ${c.name.toLowerCase()} ${market}`,
    });

    // Commercial — best brands
    entries.push({
      keyword: `best ${c.name.toLowerCase()} ${productWord} ${market} ${year}`,
      slug: `best-${c.id}-${slugify(productWord)}-${market}-${year}`,
      intent: 'commercial', pillar: c.pillar, type: 'listicle',
      topic: `Best ${c.name} ${productWord.charAt(0).toUpperCase() + productWord.slice(1)} Available in ${market.charAt(0).toUpperCase() + market.slice(1)} ${year}`,
      targetKeyword: `best ${c.name.toLowerCase()} ${market}`,
    });
  }

  return entries;
}

function comparisonPages(cfg: NicheConfig): KeywordEntry[] {
  const byId = new Map(cfg.compounds.map((c) => [c.id, c]));
  return cfg.comparisonPairs
    .map(([aId, bId]) => {
      const a = byId.get(aId);
      const b = byId.get(bId);
      if (!a || !b) return null;
      return {
        keyword: `${a.name.toLowerCase()} vs ${b.name.toLowerCase()}`,
        slug: `${a.id}-vs-${b.id}`,
        intent: 'commercial' as Intent,
        pillar: a.pillar,
        type: 'comparison' as ContentType,
        topic: `${a.name} vs ${b.name} — Which is Better for You?`,
        targetKeyword: `${a.name.toLowerCase()} vs ${b.name.toLowerCase()}`,
      } satisfies KeywordEntry;
    })
    .filter((x): x is KeywordEntry => x !== null);
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function listNiches(): Array<{ id: string; label: string; domain: string; pageCount: number }> {
  return Object.values(NICHES).map((cfg) => ({
    id: cfg.id,
    label: cfg.label,
    domain: cfg.domain,
    pageCount: buildKeywordPlan(cfg.id).length,
  }));
}

/** Full keyword plan for a niche — all expanded entries, deduplicated by slug */
export function buildKeywordPlan(nicheId: string = 'longevity'): KeywordEntry[] {
  const cfg = NICHES[nicheId];
  if (!cfg) throw new Error(`Unknown niche: ${nicheId}`);

  const all = [...compoundPages(cfg), ...cfg.pillars, ...comparisonPages(cfg)];
  const seen = new Set<string>();
  return all.filter((e) => {
    if (seen.has(e.slug)) return false;
    seen.add(e.slug);
    return true;
  });
}

export function getNicheConfig(nicheId: string): NicheConfig {
  const cfg = NICHES[nicheId];
  if (!cfg) throw new Error(`Unknown niche: ${nicheId}`);
  return cfg;
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
