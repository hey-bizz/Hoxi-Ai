-- Hoxi AI Supabase alignment migration
-- Brings the hosted database in sync with detection pipeline, dashboard, and agent expectations

BEGIN;

-- Enable UUID helpers
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Websites table alignment --------------------------------------------------
ALTER TABLE public.websites
  ADD COLUMN IF NOT EXISTS url TEXT,
  ADD COLUMN IF NOT EXISTS provider TEXT,
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT NOW();

UPDATE public.websites
SET url  = COALESCE(url, domain),
    name = COALESCE(name, domain)
WHERE url IS NULL OR name IS NULL;

ALTER TABLE public.websites
  ALTER COLUMN domain SET NOT NULL,
  ALTER COLUMN url SET NOT NULL,
  ALTER COLUMN created_at SET DEFAULT NOW(),
  ALTER COLUMN updated_at SET DEFAULT NOW();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'websites_user_id_fkey'
  ) THEN
    ALTER TABLE public.websites
      ADD CONSTRAINT websites_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Traffic logs alignment ----------------------------------------------------
ALTER TABLE public.traffic_logs
  ADD COLUMN IF NOT EXISTS ip_address inet,
  ADD COLUMN IF NOT EXISTS status_code integer,
  ADD COLUMN IF NOT EXISTS method TEXT,
  ADD COLUMN IF NOT EXISTS response_time_ms integer,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT NOW();

ALTER TABLE public.traffic_logs
  ALTER COLUMN website_id SET NOT NULL,
  ALTER COLUMN "timestamp" SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'traffic_logs_website_id_fkey'
  ) THEN
    ALTER TABLE public.traffic_logs
      ADD CONSTRAINT traffic_logs_website_id_fkey
      FOREIGN KEY (website_id) REFERENCES public.websites(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_traffic_logs_website_time
  ON public.traffic_logs(website_id, "timestamp" DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_traffic_logs_fingerprint_unique
  ON public.traffic_logs(fingerprint)
  WHERE fingerprint IS NOT NULL;

-- Remove unused legacy table ------------------------------------------------
DROP TABLE IF EXISTS public.traffic_log_analysis;

-- Core detection + cost tables ---------------------------------------------
CREATE TABLE IF NOT EXISTS public.bot_detections (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  website_id uuid NOT NULL REFERENCES public.websites(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  bot_name TEXT NOT NULL,
  user_agent TEXT NOT NULL,
  ip_address inet NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('ai_training','ai_scraper','search_engine','malicious','beneficial','extractive')),
  subcategory TEXT,
  confidence numeric(5,4) NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  impact TEXT NOT NULL CHECK (impact IN ('low','medium','high','extreme')),
  verified BOOLEAN DEFAULT FALSE,
  request_count integer NOT NULL DEFAULT 1,
  bandwidth_bytes bigint NOT NULL DEFAULT 0,
  detection_method jsonb NOT NULL,
  analysis_metadata jsonb,
  first_seen_at timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL,
  detected_at timestamptz DEFAULT NOW(),
  time_range_start timestamptz NOT NULL,
  time_range_end timestamptz NOT NULL,
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.cost_analyses (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  website_id uuid NOT NULL REFERENCES public.websites(id) ON DELETE CASCADE,
  analysis_date date NOT NULL,
  hosting_provider TEXT NOT NULL,
  region TEXT DEFAULT 'global',
  price_per_gb numeric(8,6),
  total_cost_usd numeric(10,4) NOT NULL DEFAULT 0,
  bot_cost_usd numeric(10,4) NOT NULL DEFAULT 0,
  human_cost_usd numeric(10,4) NOT NULL DEFAULT 0,
  total_bandwidth_gb numeric(12,6) NOT NULL DEFAULT 0,
  bot_bandwidth_gb numeric(12,6) NOT NULL DEFAULT 0,
  human_bandwidth_gb numeric(12,6) NOT NULL DEFAULT 0,
  total_requests integer NOT NULL DEFAULT 0,
  bot_requests integer NOT NULL DEFAULT 0,
  human_requests integer NOT NULL DEFAULT 0,
  projected_monthly_cost numeric(10,4),
  projected_yearly_cost numeric(10,4),
  cost_by_category jsonb,
  cost_by_bot jsonb,
  processing_time_ms integer,
  logs_processed integer,
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW(),
  UNIQUE (website_id, analysis_date)
);

CREATE TABLE IF NOT EXISTS public.hosting_pricing (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  provider TEXT NOT NULL,
  region TEXT NOT NULL DEFAULT 'global',
  price_per_gb numeric(8,6) NOT NULL,
  price_per_million_requests numeric(8,4),
  included_bandwidth_gb numeric(8,2) DEFAULT 0,
  included_requests_millions numeric(8,2) DEFAULT 0,
  pricing_tiers jsonb,
  currency TEXT DEFAULT 'USD',
  source_url TEXT,
  confidence numeric(3,2) DEFAULT 1.0,
  last_verified timestamptz DEFAULT NOW(),
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW(),
  UNIQUE (provider, region)
);

CREATE TABLE IF NOT EXISTS public.hoxi_conversations (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  website_id uuid NOT NULL REFERENCES public.websites(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  user_message TEXT NOT NULL,
  user_intent TEXT,
  hoxi_response TEXT NOT NULL,
  tools_used TEXT[],
  confidence_score numeric(3,2),
  detection_context jsonb,
  cost_context jsonb,
  response_time_ms integer,
  token_usage jsonb,
  user_feedback TEXT,
  rating integer CHECK (rating BETWEEN 1 AND 5),
  created_at timestamptz DEFAULT NOW()
);

-- Indexes for analytics -----------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_bot_detections_website_id    ON public.bot_detections(website_id);
CREATE INDEX IF NOT EXISTS idx_bot_detections_detected_at   ON public.bot_detections(detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_bot_detections_category      ON public.bot_detections(category);
CREATE INDEX IF NOT EXISTS idx_bot_detections_confidence    ON public.bot_detections(confidence DESC);
CREATE INDEX IF NOT EXISTS idx_bot_detections_website_date  ON public.bot_detections(website_id, detected_at DESC);

CREATE INDEX IF NOT EXISTS idx_cost_analyses_website_id     ON public.cost_analyses(website_id);
CREATE INDEX IF NOT EXISTS idx_cost_analyses_date           ON public.cost_analyses(analysis_date DESC);
CREATE INDEX IF NOT EXISTS idx_cost_analyses_website_date   ON public.cost_analyses(website_id, analysis_date DESC);

CREATE INDEX IF NOT EXISTS idx_hosting_pricing_provider     ON public.hosting_pricing(provider);
CREATE INDEX IF NOT EXISTS idx_hosting_pricing_updated      ON public.hosting_pricing(last_verified DESC);

CREATE INDEX IF NOT EXISTS idx_hoxi_conversations_website   ON public.hoxi_conversations(website_id);
CREATE INDEX IF NOT EXISTS idx_hoxi_conversations_session   ON public.hoxi_conversations(session_id);
CREATE INDEX IF NOT EXISTS idx_hoxi_conversations_created   ON public.hoxi_conversations(created_at DESC);

-- Row-Level Security (RLS) -------------------------------------------------
ALTER TABLE public.bot_detections   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cost_analyses    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hosting_pricing  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hoxi_conversations ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'bot_detections'
      AND policyname = 'bot_detections_owner_select'
  ) THEN
    CREATE POLICY bot_detections_owner_select ON public.bot_detections
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM public.websites w
          WHERE w.id = bot_detections.website_id
            AND w.user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'bot_detections'
      AND policyname = 'bot_detections_owner_insert'
  ) THEN
    CREATE POLICY bot_detections_owner_insert ON public.bot_detections
      FOR INSERT WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.websites w
          WHERE w.id = bot_detections.website_id
            AND w.user_id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'cost_analyses'
      AND policyname = 'cost_analyses_owner_select'
  ) THEN
    CREATE POLICY cost_analyses_owner_select ON public.cost_analyses
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM public.websites w
          WHERE w.id = cost_analyses.website_id
            AND w.user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'cost_analyses'
      AND policyname = 'cost_analyses_owner_insert'
  ) THEN
    CREATE POLICY cost_analyses_owner_insert ON public.cost_analyses
      FOR INSERT WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.websites w
          WHERE w.id = cost_analyses.website_id
            AND w.user_id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'hosting_pricing'
      AND policyname = 'hosting_pricing_public_read'
  ) THEN
    CREATE POLICY hosting_pricing_public_read ON public.hosting_pricing
      FOR SELECT USING (TRUE);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'hoxi_conversations'
      AND policyname = 'hoxi_conversations_owner_select'
  ) THEN
    CREATE POLICY hoxi_conversations_owner_select ON public.hoxi_conversations
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM public.websites w
          WHERE w.id = hoxi_conversations.website_id
            AND w.user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'hoxi_conversations'
      AND policyname = 'hoxi_conversations_owner_insert'
  ) THEN
    CREATE POLICY hoxi_conversations_owner_insert ON public.hoxi_conversations
      FOR INSERT WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.websites w
          WHERE w.id = hoxi_conversations.website_id
            AND w.user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- Helper functions consumed by analytics tools -----------------------------
CREATE OR REPLACE FUNCTION public.get_latest_detection_summary(website_id_param uuid)
RETURNS TABLE (
  bot_count bigint,
  total_bandwidth_gb numeric,
  total_cost_usd numeric,
  top_bot_name TEXT,
  top_bot_confidence numeric,
  analysis_date DATE
) LANGUAGE sql AS $$
  SELECT
    COUNT(*) AS bot_count,
    COALESCE(ROUND(SUM(bd.bandwidth_bytes) / 1024^3, 3), 0) AS total_bandwidth_gb,
    COALESCE(ca.total_cost_usd, 0) AS total_cost_usd,
    (SELECT bot_name FROM public.bot_detections
      WHERE website_id = website_id_param
      ORDER BY confidence DESC, bandwidth_bytes DESC
      LIMIT 1) AS top_bot_name,
    (SELECT confidence FROM public.bot_detections
      WHERE website_id = website_id_param
      ORDER BY confidence DESC, bandwidth_bytes DESC
      LIMIT 1) AS top_bot_confidence,
    CURRENT_DATE AS analysis_date
  FROM public.bot_detections bd
  LEFT JOIN public.cost_analyses ca
    ON ca.website_id = bd.website_id
    AND ca.analysis_date = CURRENT_DATE
  WHERE bd.website_id = website_id_param
    AND bd.detected_at >= CURRENT_DATE - INTERVAL '1 day'
  GROUP BY ca.total_cost_usd;
$$;

CREATE OR REPLACE FUNCTION public.get_cost_trends(website_id_param uuid, days_back integer DEFAULT 30)
RETURNS TABLE (
  analysis_date DATE,
  total_cost_usd numeric,
  bot_cost_usd numeric,
  total_bandwidth_gb numeric,
  bot_requests integer
) LANGUAGE sql AS $$
  SELECT
    analysis_date,
    total_cost_usd,
    bot_cost_usd,
    total_bandwidth_gb,
    bot_requests
  FROM public.cost_analyses
  WHERE website_id = website_id_param
    AND analysis_date >= CURRENT_DATE - (days_back || ' days')::interval
  ORDER BY analysis_date DESC;
$$;

-- Documentation comments ----------------------------------------------------
COMMENT ON TABLE public.bot_detections  IS 'Stores Core Detection Engine analysis results for individual bot sessions';
COMMENT ON TABLE public.cost_analyses   IS 'Daily cost analysis summaries calculated from bot detection results';
COMMENT ON TABLE public.hosting_pricing IS 'Cached pricing data from hosting providers for cost calculations';
COMMENT ON TABLE public.hoxi_conversations IS 'Hoxi AI chat sessions for analytics and improvement';

COMMIT;
