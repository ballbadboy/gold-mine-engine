-- ════════════════════════════════════════════════════════
--  Gold Mine Engine — Initial Schema
--  Version: 0.1.0
--  Multi-tenant ready, RLS enabled
-- ════════════════════════════════════════════════════════

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ─── Tenants (multi-tenant by default) ──────────────────
CREATE TABLE IF NOT EXISTS tenants (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  plan text DEFAULT 'free' CHECK (plan IN ('free', 'startup', 'business', 'enterprise')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Seed owner tenant
INSERT INTO tenants (slug, name, plan)
VALUES ('owner', 'Gold Mine Owner', 'enterprise')
ON CONFLICT (slug) DO NOTHING;

-- ─── Websites ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS websites (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  domain text NOT NULL,
  niche text,
  language text DEFAULT 'th',
  status text DEFAULT 'active' CHECK (status IN ('active', 'paused', 'archived')),
  config jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (tenant_id, domain)
);

CREATE INDEX IF NOT EXISTS idx_websites_tenant ON websites(tenant_id);

-- ─── Products (affiliate items) ────────────────────────
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  platform text NOT NULL CHECK (platform IN ('shopee','lazada','amazon','iherb','agoda','klook','other')),
  external_id text NOT NULL,
  name text NOT NULL,
  description text,
  price numeric(10,2),
  currency text DEFAULT 'THB',
  image_url text,
  affiliate_url text,
  commission_rate numeric(5,2),
  category text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (tenant_id, platform, external_id)
);

CREATE INDEX IF NOT EXISTS idx_products_tenant ON products(tenant_id);
CREATE INDEX IF NOT EXISTS idx_products_platform ON products(platform);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);

-- ─── Content (articles, pages) ─────────────────────────
CREATE TABLE IF NOT EXISTS content_pages (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  website_id uuid NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
  slug text NOT NULL,
  title text NOT NULL,
  body_mdx text,
  meta_description text,
  type text CHECK (type IN ('pillar','listicle','review','comparison','guide','product')),
  status text DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  product_ids uuid[] DEFAULT '{}',
  version int DEFAULT 1,
  last_optimized_at timestamptz,
  published_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (website_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_content_tenant ON content_pages(tenant_id);
CREATE INDEX IF NOT EXISTS idx_content_website ON content_pages(website_id);
CREATE INDEX IF NOT EXISTS idx_content_status ON content_pages(status);

-- ─── Metrics (daily roll-up from GA4/GSC/Ads) ──────────
CREATE TABLE IF NOT EXISTS metrics_daily (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  website_id uuid NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
  page_slug text,
  date date NOT NULL,
  source text NOT NULL CHECK (source IN ('ga4','gsc','ads','shopee','lazada','amazon')),
  impressions int DEFAULT 0,
  clicks int DEFAULT 0,
  ctr numeric(5,4),
  position numeric(5,2),
  sessions int DEFAULT 0,
  bounce_rate numeric(5,4),
  conversions int DEFAULT 0,
  revenue numeric(10,2) DEFAULT 0,
  cost numeric(10,2) DEFAULT 0,
  raw jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  UNIQUE (website_id, date, source, page_slug)
);

CREATE INDEX IF NOT EXISTS idx_metrics_tenant ON metrics_daily(tenant_id);
CREATE INDEX IF NOT EXISTS idx_metrics_date ON metrics_daily(date DESC);
CREATE INDEX IF NOT EXISTS idx_metrics_website_date ON metrics_daily(website_id, date DESC);

-- ─── Insights (AI-derived) ─────────────────────────────
CREATE TABLE IF NOT EXISTS insights (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  website_id uuid NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
  type text CHECK (type IN ('opportunity','anomaly','pattern','prediction')),
  severity text CHECK (severity IN ('info','low','medium','high','critical')),
  title text NOT NULL,
  summary text,
  evidence jsonb DEFAULT '{}'::jsonb,
  confidence numeric(3,2),                 -- 0.00-1.00
  status text DEFAULT 'new' CHECK (status IN ('new','acting','resolved','ignored')),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_insights_tenant ON insights(tenant_id);
CREATE INDEX IF NOT EXISTS idx_insights_status ON insights(status);

-- ─── Actions (what the loop did) ───────────────────────
CREATE TABLE IF NOT EXISTS actions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  insight_id uuid REFERENCES insights(id) ON DELETE SET NULL,
  type text NOT NULL,                      -- e.g. 'content.rewrite','ads.pause','seo.meta-update'
  target_id uuid,                          -- content_page/product/etc
  proposed_by text CHECK (proposed_by IN ('ai','rule','human')),
  approved_by text,
  status text DEFAULT 'pending' CHECK (status IN ('pending','approved','executing','done','failed','rolled_back')),
  diff jsonb DEFAULT '{}'::jsonb,
  before_metrics jsonb DEFAULT '{}'::jsonb,
  after_metrics jsonb DEFAULT '{}'::jsonb,
  error_message text,
  created_at timestamptz DEFAULT now(),
  executed_at timestamptz,
  evaluated_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_actions_tenant ON actions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_actions_status ON actions(status);

-- ─── Knowledge Base (RAG chunks) ───────────────────────
CREATE TABLE IF NOT EXISTS knowledge_chunks (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,  -- null = global
  source text,                             -- 'obsidian','notebooklm','web','manual'
  source_ref text,                          -- file path / URL / note id
  title text,
  content text NOT NULL,
  embedding vector(1536),                   -- OpenAI/Voyage dim
  tags text[],
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_knowledge_tenant ON knowledge_chunks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_embedding ON knowledge_chunks
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- ─── Row-Level Security ────────────────────────────────
ALTER TABLE tenants          ENABLE ROW LEVEL SECURITY;
ALTER TABLE websites         ENABLE ROW LEVEL SECURITY;
ALTER TABLE products         ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_pages    ENABLE ROW LEVEL SECURITY;
ALTER TABLE metrics_daily    ENABLE ROW LEVEL SECURITY;
ALTER TABLE insights         ENABLE ROW LEVEL SECURITY;
ALTER TABLE actions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_chunks ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS automatically.
-- For now (Sprint 0), allow all for authenticated. Tighten in Sprint 3+.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['tenants','websites','products','content_pages','metrics_daily','insights','actions','knowledge_chunks']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "allow_all_authenticated" ON %I', t);
    EXECUTE format('CREATE POLICY "allow_all_authenticated" ON %I FOR ALL TO authenticated USING (true) WITH CHECK (true)', t);
  END LOOP;
END $$;

-- ─── Updated_at trigger ────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['tenants','websites','products','content_pages']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_updated_at ON %I', t);
    EXECUTE format('CREATE TRIGGER set_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at()', t);
  END LOOP;
END $$;
