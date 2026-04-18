/**
 * Affiliate product catalog for the longevity niche.
 *
 * When content mentions one of these product names, we wrap it in an
 * affiliate link. Users configure their own affiliate IDs via env vars:
 *   - IHERB_REF_CODE
 *   - LAZADA_AFFILIATE_ID
 *   - SHOPEE_AFFILIATE_ID
 *
 * Links fall back to plain search URLs if env vars are missing, so the
 * site always works — it just won't earn commission until configured.
 */

export interface AffiliateLink {
  network: 'iherb' | 'lazada' | 'shopee';
  /** Raw merchant URL */
  url: string;
}

export interface AffiliateProduct {
  id: string;
  brand: string;
  product_name: string;
  /** Keywords in article text that should become links (lowercased, partial match OK). */
  match_phrases: string[];
  /** Short description shown in the product card */
  description: string;
  price_thb: string;
  rating: number;
  /** Which networks to use, in priority order */
  links: AffiliateLink[];
}

const IHERB_REF = process.env.IHERB_REF_CODE ?? 'HNJ1820';
const LAZADA_AFF = process.env.LAZADA_AFFILIATE_ID ?? '';
const SHOPEE_AFF = process.env.SHOPEE_AFFILIATE_ID ?? '';

/** Wrap an iHerb product URL with our ref code */
export function iherbLink(path: string): string {
  const sep = path.includes('?') ? '&' : '?';
  return `https://www.iherb.com${path}${sep}rcode=${IHERB_REF}`;
}

/** Wrap a Lazada URL with our affiliate sub_id */
export function lazadaLink(url: string, subId: string): string {
  if (!LAZADA_AFF) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}sub_aff_id=${LAZADA_AFF}&sub_id=${encodeURIComponent(subId)}`;
}

/** Wrap a Shopee URL with our affiliate sub_id */
export function shopeeLink(url: string, subId: string): string {
  if (!SHOPEE_AFF) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}af_id=${SHOPEE_AFF}&af_sub=${encodeURIComponent(subId)}`;
}

// ─── Longevity niche products ────────────────────────────────────────────────

export const LONGEVITY_PRODUCTS: AffiliateProduct[] = [
  {
    id: 'tru-niagen',
    brand: 'Tru Niagen',
    product_name: 'Tru Niagen Nicotinamide Riboside 300mg',
    match_phrases: ['tru niagen', 'tru-niagen'],
    description: 'ชั้นนำของโลก สำหรับ NR (Nicotinamide Riboside) — ผ่านการวิจัยทางคลินิกมากกว่า 10 ปี',
    price_thb: '฿2,490',
    rating: 4.7,
    links: [
      { network: 'iherb', url: iherbLink('/pr/tru-niagen-nicotinamide-riboside-300-mg-30-veggie-capsules/107728') },
    ],
  },
  {
    id: 'thorne-nmn',
    brand: 'Thorne',
    product_name: 'Thorne NiaCel 400 (Nicotinamide Riboside 400mg)',
    match_phrases: ['thorne niacel', 'thorne nr'],
    description: 'NR ขนาดสูงจากแบรนด์พรีเมียม Thorne — NSF Certified for Sport',
    price_thb: '฿3,190',
    rating: 4.6,
    links: [
      { network: 'iherb', url: iherbLink('/pr/thorne-niacel-400-nicotinamide-riboside-60-capsules/110289') },
    ],
  },
  {
    id: 'prohealth-nmn',
    brand: 'ProHealth',
    product_name: 'ProHealth Longevity NMN Pro 500mg',
    match_phrases: ['prohealth nmn', 'prohealth longevity'],
    description: 'NMN ที่นิยมที่สุดในสาย longevity — สะอาด 99%+ ราคาดี',
    price_thb: '฿2,290',
    rating: 4.8,
    links: [
      { network: 'iherb', url: iherbLink('/pr/prohealth-longevity-nmn-pro-30-500-mg-30-capsules/106273') },
    ],
  },
  {
    id: 'double-wood-nmn',
    brand: 'Double Wood',
    product_name: 'Double Wood NMN 250mg',
    match_phrases: ['double wood nmn', 'double wood'],
    description: 'ตัวเลือกคุ้มค่าสำหรับมือใหม่ — NMN คุณภาพดี ราคาเข้าถึงได้',
    price_thb: '฿990',
    rating: 4.5,
    links: [
      { network: 'iherb', url: iherbLink('/pr/double-wood-supplements-nmn-250-mg-60-capsules/105729') },
    ],
  },
  {
    id: 'life-extension-resveratrol',
    brand: 'Life Extension',
    product_name: 'Life Extension Optimized Resveratrol Elite',
    match_phrases: ['life extension resveratrol', 'optimized resveratrol'],
    description: 'Resveratrol + Pterostilbene + Quercetin ในแคปซูลเดียว — สูตรครบเครื่อง',
    price_thb: '฿1,590',
    rating: 4.6,
    links: [
      { network: 'iherb', url: iherbLink('/pr/life-extension-optimized-resveratrol-elite-60-vegetarian-capsules/32897') },
    ],
  },
  {
    id: 'now-coq10',
    brand: 'NOW Foods',
    product_name: 'NOW Foods CoQ10 100mg',
    match_phrases: ['now coq10', 'now foods coq10'],
    description: 'CoQ10 ราคาคุ้มจากแบรนด์ยักษ์ใหญ่ — ยอดขายเบอร์ต้นของโลก',
    price_thb: '฿790',
    rating: 4.7,
    links: [
      { network: 'iherb', url: iherbLink('/pr/now-foods-coq10-100-mg-150-softgels/862') },
    ],
  },
];

/** Pick the primary (first) link for a product */
export function primaryLink(product: AffiliateProduct): AffiliateLink {
  return product.links[0];
}
