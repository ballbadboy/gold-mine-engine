import { serializeJsonLd } from '@/lib/content/json-ld';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import { createAdminClient } from '@/lib/supabase/admin';
import type { Outline } from '@/lib/content/generate';
import { LONGEVITY_PRODUCTS, primaryLink, type AffiliateProduct } from '@/lib/affiliate/products';

export const revalidate = 300; // ISR: re-render every 5 min
export const dynamicParams = true;

interface PageProps {
  params: Promise<{ slug: string }>;
}

// ─── Metadata (SEO + OpenGraph) ──────────────────────────────────────────────

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const page = await loadPage(slug);
  if (!page) return { title: 'Not found' };

  return {
    title: page.outline.meta_title || page.outline.title,
    description: page.outline.meta_description,
    openGraph: {
      title: page.outline.title,
      description: page.outline.meta_description,
      type: 'article',
      locale: 'th_TH',
    },
    alternates: { canonical: `/read/${slug}` },
  };
}

// ─── Data ───────────────────────────────────────────────────────────────────

async function loadPage(slug: string): Promise<{ outline: Outline; updated_at: string } | null> {
  const websiteId = process.env.PUBLIC_CONTENT_WEBSITE_ID;
  if (!websiteId) return null;
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('content_pages')
    .select('slug, body_mdx, updated_at')
    .eq('slug', slug)
    .eq('website_id', websiteId)
    .eq('status', 'published')
    .maybeSingle();

  if (!data?.body_mdx) return null;
  try {
    const outline = JSON.parse(data.body_mdx) as Outline;
    if (!outline.slug) return null;
    return { outline, updated_at: data.updated_at };
  } catch {
    return null;
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function findMatchingProducts(outline: Outline): AffiliateProduct[] {
  const haystack = [
    outline.title,
    outline.target_keyword ?? '',
    (outline.secondary_keywords ?? []).join(' '),
    (outline.sections ?? []).map((s) => s.h2 + ' ' + (s.key_points ?? []).join(' ')).join(' '),
  ].join(' ').toLowerCase();

  const matches: AffiliateProduct[] = [];
  for (const p of LONGEVITY_PRODUCTS) {
    if (p.match_phrases.some((ph) => haystack.includes(ph))) matches.push(p);
  }

  // If no specific match, surface NMN/NR/Resveratrol defaults based on topic
  if (matches.length === 0) {
    const lower = haystack;
    if (lower.includes('nmn')) matches.push(LONGEVITY_PRODUCTS.find((p) => p.id === 'prohealth-nmn')!, LONGEVITY_PRODUCTS.find((p) => p.id === 'double-wood-nmn')!);
    else if (lower.includes('nicotinamide riboside') || lower.includes(' nr ') || lower.includes(' nr ')) matches.push(LONGEVITY_PRODUCTS.find((p) => p.id === 'tru-niagen')!, LONGEVITY_PRODUCTS.find((p) => p.id === 'thorne-nmn')!);
    else if (lower.includes('resveratrol')) matches.push(LONGEVITY_PRODUCTS.find((p) => p.id === 'life-extension-resveratrol')!);
    else if (lower.includes('coq10')) matches.push(LONGEVITY_PRODUCTS.find((p) => p.id === 'now-coq10')!);
  }

  return matches.slice(0, 3); // cap at 3 products per article
}

function estimateReadingMinutes(outline: Outline): number {
  const totalWords = (outline.sections ?? []).reduce((s, x) => s + (x.word_count_target ?? 0), 0);
  return Math.max(3, Math.ceil(totalWords / 200));
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default async function ArticlePage({ params }: PageProps) {
  const { slug } = await params;
  const loaded = await loadPage(slug);
  if (!loaded) notFound();

  const { outline, updated_at } = loaded;
  const products = findMatchingProducts(outline);
  const readingMin = estimateReadingMinutes(outline);
  const published = new Date(updated_at).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });

  // JSON-LD schema
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Article',
        headline: outline.title,
        description: outline.meta_description,
        datePublished: updated_at,
        dateModified: updated_at,
        author: { '@type': 'Organization', name: 'Longevity Thailand' },
      },
      outline.faqs?.length
        ? {
            '@type': 'FAQPage',
            mainEntity: outline.faqs.map((f) => ({
              '@type': 'Question',
              name: f.q,
              acceptedAnswer: { '@type': 'Answer', text: f.a },
            })),
          }
        : null,
    ].filter(Boolean),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />
      <main className="bg-stone-50 text-stone-900 dark:bg-stone-950 dark:text-stone-100">

        {/* Top bar */}
        <nav className="border-b border-stone-200 dark:border-stone-800">
          <div className="mx-auto max-w-3xl px-6 py-4 flex items-center justify-between">
            <Link href="/" className="font-serif text-lg font-semibold tracking-tight">
              Longevity <span className="text-emerald-700">·</span> Thailand
            </Link>
            <div className="text-xs text-stone-500">ตีพิมพ์ {published}</div>
          </div>
        </nav>

        <article className="mx-auto max-w-3xl px-6 py-16">

          {/* Hero */}
          <header className="mb-12">
            <div className="mb-4 text-xs uppercase tracking-widest text-emerald-700 font-semibold">
              {outline.target_keyword}
            </div>
            <h1 className="font-serif text-4xl sm:text-5xl font-bold tracking-tight leading-[1.1] mb-6">
              {outline.title}
            </h1>
            <p className="font-serif text-xl leading-relaxed text-stone-700 dark:text-stone-300">
              {outline.intro_hook}
            </p>
            <div className="mt-6 flex gap-3 text-xs text-stone-500">
              <span>โดย Longevity Thailand</span>
              <span>·</span>
              <span>อ่าน ~{readingMin} นาที</span>
              <span>·</span>
              <span>{(outline.faqs ?? []).length} คำถาม</span>
            </div>
          </header>

          {/* TOC */}
          {(outline.toc ?? []).length > 0 && (
            <aside className="mb-14 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-6">
              <div className="text-xs uppercase tracking-wider font-semibold text-stone-500 mb-3">
                📑 สารบัญ
              </div>
              <ol className="space-y-1.5 text-sm">
                {outline.toc!.map((item, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="text-stone-400 tabular-nums">{String(i + 1).padStart(2, '0')}</span>
                    <a href={`#section-${i}`} className="hover:text-emerald-700 hover:underline">{item}</a>
                  </li>
                ))}
              </ol>
            </aside>
          )}

          {/* Featured product card (top of article) */}
          {products.length > 0 && (
            <div className="mb-14 rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50/50 dark:bg-emerald-950/20 p-6">
              <div className="text-xs uppercase tracking-wider font-semibold text-emerald-700 mb-3">
                ⭐ ตัวเลือกแนะนำ
              </div>
              <ProductCard product={products[0]} slug={slug} />
            </div>
          )}

          {/* Sections */}
          <div className="space-y-14">
            {(outline.sections ?? []).map((section, i) => (
              <section key={i} id={`section-${i}`} className="scroll-mt-20">
                <h2 className="font-serif text-3xl font-bold tracking-tight mb-6 text-stone-900 dark:text-stone-50">
                  {section.h2}
                </h2>
                {(section as typeof section & { expanded_text?: string }).expanded_text ? (
                  <div className="space-y-4 text-lg leading-relaxed"><ReactMarkdown skipHtml>{(section as typeof section & { expanded_text: string }).expanded_text}</ReactMarkdown></div>
                ) : section.key_points && section.key_points.length > 0 ? (
                  <ul className="space-y-3 text-lg leading-relaxed text-stone-700 dark:text-stone-300">
                    {section.key_points.map((point, j) => (
                      <li key={j} className="flex gap-4">
                        <span aria-hidden className="mt-[0.6em] block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-emerald-700" />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {/* Mid-article product card — insert after every 3rd section */}
                {i > 0 && (i + 1) % 3 === 0 && products[Math.floor(i / 3)] && (
                  <div className="mt-10 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-6">
                    <ProductCard product={products[Math.floor(i / 3)]} slug={slug} />
                  </div>
                )}
              </section>
            ))}
          </div>

          {/* FAQ */}
          {(outline.faqs ?? []).length > 0 && (
            <section className="mt-20 pt-10 border-t border-stone-200 dark:border-stone-800">
              <h2 className="font-serif text-3xl font-bold tracking-tight mb-8">
                คำถามที่พบบ่อย
              </h2>
              <div className="space-y-6">
                {outline.faqs!.map((faq, i) => (
                  <details key={i} className="group rounded-lg border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900">
                    <summary className="cursor-pointer list-none p-5 flex items-start justify-between gap-4 hover:bg-stone-50 dark:hover:bg-stone-800/50">
                      <span className="font-serif font-semibold text-lg">{faq.q}</span>
                      <span className="mt-1 text-stone-400 group-open:rotate-45 transition-transform">+</span>
                    </summary>
                    <div className="px-5 pb-5 pt-0 text-stone-700 dark:text-stone-300 leading-relaxed">
                      {faq.a}
                    </div>
                  </details>
                ))}
              </div>
            </section>
          )}

          {/* Disclosure */}
          <footer className="mt-20 pt-10 border-t border-stone-200 dark:border-stone-800 text-xs text-stone-500 leading-relaxed space-y-2">
            <p className="font-semibold text-stone-600 dark:text-stone-400">เปิดเผยความร่วมมือ (Affiliate Disclosure)</p>
            <p>
              บทความนี้อาจมีลิงก์ affiliate ถ้าคุณซื้อสินค้าผ่านลิงก์จากหน้านี้ เราจะได้รับค่าคอมมิชชันเล็กน้อยจากผู้ขาย โดยไม่มีค่าใช้จ่ายเพิ่มเติมกับคุณ รายได้นี้ช่วยให้เราผลิตคอนเทนต์ที่อิงหลักฐานต่อไปได้
            </p>
            <p>
              ข้อมูลนี้ใช้เพื่อการศึกษาเท่านั้น ไม่ได้ตั้งใจเป็นคำแนะนำทางการแพทย์ ปรึกษาแพทย์ก่อนเริ่มใช้อาหารเสริมทุกครั้ง โดยเฉพาะหากมีโรคประจำตัวหรือทานยาอื่นอยู่
            </p>
          </footer>
        </article>
      </main>
    </>
  );
}

// ─── Components ─────────────────────────────────────────────────────────────

function ProductCard({ product, slug }: { product: AffiliateProduct; slug: string }) {
  const link = primaryLink(product);
  return (
    <div className="flex items-start gap-5">
      <div className="flex-1 min-w-0">
        <div className="text-xs font-semibold uppercase tracking-wider text-stone-500 mb-1">
          {product.brand}
        </div>
        <div className="font-serif text-lg font-bold mb-2">{product.product_name}</div>
        <div className="text-sm text-stone-600 dark:text-stone-400 leading-relaxed mb-3">
          {product.description}
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="font-bold text-emerald-700">{product.price_thb}</span>
          <span className="text-amber-500">{'★'.repeat(Math.round(product.rating))}</span>
          <span className="text-stone-500 tabular-nums">{product.rating}</span>
        </div>
      </div>
      <a
        href={link.url}
        target="_blank"
        rel="sponsored noopener"
        data-product={product.id}
        data-source-slug={slug}
        className="shrink-0 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-semibold px-5 py-2.5 text-sm transition-colors whitespace-nowrap"
      >
        ดูราคา →
      </a>
    </div>
  );
}
