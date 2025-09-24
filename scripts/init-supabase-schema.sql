-- Hoxi AI Supabase Schema
-- Core Detection Engine Results and Hoxi AI Support Tables

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Websites Table
-- Stores registered websites for monitoring
CREATE TABLE IF NOT EXISTS websites (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  url TEXT NOT NULL,
  domain TEXT NOT NULL,
  provider TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Traffic Logs Table
-- Stores raw traffic log entries from hosting providers
CREATE TABLE IF NOT EXISTS traffic_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  website_id UUID NOT NULL REFERENCES websites(id),
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  user_agent TEXT,
  ip_address INET,
  is_bot BOOLEAN DEFAULT FALSE,
  bot_name TEXT,
  bot_category TEXT,
  bytes_transferred BIGINT DEFAULT 0,
  response_time_ms INTEGER,
  status_code INTEGER,
  path TEXT,
  method TEXT,
  fingerprint TEXT UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Bot Detection Results Table
-- Stores results from Core Detection Engine analysis
CREATE TABLE IF NOT EXISTS bot_detections (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  website_id UUID NOT NULL REFERENCES websites(id),
  session_id TEXT NOT NULL,

  -- Bot Information
  bot_name TEXT NOT NULL,
  user_agent TEXT NOT NULL,
  ip_address INET NOT NULL,

  -- Classification Results
  category TEXT NOT NULL CHECK (category IN ('ai_training', 'ai_scraper', 'search_engine', 'malicious', 'beneficial', 'extractive')),
  subcategory TEXT,
  confidence NUMERIC(5,4) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  impact TEXT NOT NULL CHECK (impact IN ('low', 'medium', 'high', 'extreme')),
  verified BOOLEAN DEFAULT FALSE,

  -- Analysis Data
  request_count INTEGER NOT NULL DEFAULT 1,
  bandwidth_bytes BIGINT NOT NULL DEFAULT 0,

  -- Detection Method Details
  detection_method JSONB NOT NULL, -- {velocity: {}, pattern: {}, signature: {}, behavior: {}}
  analysis_metadata JSONB, -- Additional analysis data

  -- Timestamps
  first_seen_at TIMESTAMP WITH TIME ZONE NOT NULL,
  last_seen_at TIMESTAMP WITH TIME ZONE NOT NULL,
  detected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Time Range for this detection session
  time_range_start TIMESTAMP WITH TIME ZONE NOT NULL,
  time_range_end TIMESTAMP WITH TIME ZONE NOT NULL,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Cost Analysis Results Table
-- Stores cost calculations for bot traffic
CREATE TABLE IF NOT EXISTS cost_analyses (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  website_id UUID NOT NULL REFERENCES websites(id),
  analysis_date DATE NOT NULL,

  -- Provider Information
  hosting_provider TEXT NOT NULL,
  region TEXT DEFAULT 'global',
  price_per_gb NUMERIC(8,6),

  -- Cost Breakdown
  total_cost_usd NUMERIC(10,4) NOT NULL DEFAULT 0,
  bot_cost_usd NUMERIC(10,4) NOT NULL DEFAULT 0,
  human_cost_usd NUMERIC(10,4) NOT NULL DEFAULT 0,

  -- Bandwidth Analysis
  total_bandwidth_gb NUMERIC(12,6) NOT NULL DEFAULT 0,
  bot_bandwidth_gb NUMERIC(12,6) NOT NULL DEFAULT 0,
  human_bandwidth_gb NUMERIC(12,6) NOT NULL DEFAULT 0,

  -- Request Analysis
  total_requests INTEGER NOT NULL DEFAULT 0,
  bot_requests INTEGER NOT NULL DEFAULT 0,
  human_requests INTEGER NOT NULL DEFAULT 0,

  -- Projections
  projected_monthly_cost NUMERIC(10,4),
  projected_yearly_cost NUMERIC(10,4),

  -- Cost Breakdown by Category
  cost_by_category JSONB, -- {ai_training: 45.50, search_engine: 12.30, ...}
  cost_by_bot JSONB, -- {GPTBot: 25.00, Googlebot: 15.50, ...}

  -- Processing Statistics
  processing_time_ms INTEGER,
  logs_processed INTEGER,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Ensure one analysis per website per day
  UNIQUE(website_id, analysis_date)
);

-- Hosting Provider Pricing Table
-- Cache for hosting provider pricing data
CREATE TABLE IF NOT EXISTS hosting_pricing (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  provider TEXT NOT NULL,
  region TEXT NOT NULL DEFAULT 'global',

  -- Pricing Information
  price_per_gb NUMERIC(8,6) NOT NULL,
  price_per_million_requests NUMERIC(8,4),

  -- Free Tier Information
  included_bandwidth_gb NUMERIC(8,2) DEFAULT 0,
  included_requests_millions NUMERIC(8,2) DEFAULT 0,

  -- Pricing Tiers (for complex pricing)
  pricing_tiers JSONB, -- [{min_gb: 0, max_gb: 100, price: 0.045}, ...]

  -- Metadata
  currency TEXT DEFAULT 'USD',
  source_url TEXT,
  confidence NUMERIC(3,2) DEFAULT 1.0,
  last_verified TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Ensure one pricing entry per provider/region
  UNIQUE(provider, region)
);

-- Bot Signatures Cache Table (Optional - for performance)
-- Cache frequently used bot signatures
CREATE TABLE IF NOT EXISTS bot_signatures_cache (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  bot_name TEXT NOT NULL UNIQUE,

  -- Signature Information
  user_agent_patterns TEXT[] NOT NULL,
  ip_ranges CIDR[],
  category TEXT NOT NULL,
  subcategory TEXT,
  impact TEXT NOT NULL,

  -- Metadata
  purpose TEXT,
  website TEXT,
  documentation_url TEXT,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Hoxi AI Chat Sessions (Optional)
-- Track conversations for analytics and improvement
CREATE TABLE IF NOT EXISTS hoxi_conversations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  website_id UUID NOT NULL REFERENCES websites(id),
  session_id TEXT NOT NULL,

  -- User Query
  user_message TEXT NOT NULL,
  user_intent TEXT, -- detected intent: 'cost_analysis', 'bot_inquiry', 'recommendations'

  -- Hoxi Response
  hoxi_response TEXT NOT NULL,
  tools_used TEXT[], -- ['queryAnalytics', 'generateRecommendations']
  confidence_score NUMERIC(3,2),

  -- Context
  detection_context JSONB, -- Latest detection results used
  cost_context JSONB, -- Cost data referenced

  -- Performance
  response_time_ms INTEGER,
  token_usage JSONB, -- {input: 150, output: 300, total: 450}

  -- Feedback (for improvement)
  user_feedback TEXT,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for Performance
-- Traffic Logs
CREATE INDEX IF NOT EXISTS idx_traffic_logs_website_id ON traffic_logs(website_id);
CREATE INDEX IF NOT EXISTS idx_traffic_logs_timestamp ON traffic_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_traffic_logs_bot ON traffic_logs(is_bot);
CREATE INDEX IF NOT EXISTS idx_traffic_logs_website_timestamp ON traffic_logs(website_id, timestamp DESC);

-- Bot Detections
CREATE INDEX IF NOT EXISTS idx_bot_detections_website_id ON bot_detections(website_id);
CREATE INDEX IF NOT EXISTS idx_bot_detections_detected_at ON bot_detections(detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_bot_detections_category ON bot_detections(category);
CREATE INDEX IF NOT EXISTS idx_bot_detections_confidence ON bot_detections(confidence DESC);
CREATE INDEX IF NOT EXISTS idx_bot_detections_website_date ON bot_detections(website_id, detected_at DESC);

-- Cost Analyses
CREATE INDEX IF NOT EXISTS idx_cost_analyses_website_id ON cost_analyses(website_id);
CREATE INDEX IF NOT EXISTS idx_cost_analyses_date ON cost_analyses(analysis_date DESC);
CREATE INDEX IF NOT EXISTS idx_cost_analyses_website_date ON cost_analyses(website_id, analysis_date DESC);

-- Hosting Pricing
CREATE INDEX IF NOT EXISTS idx_hosting_pricing_provider ON hosting_pricing(provider);
CREATE INDEX IF NOT EXISTS idx_hosting_pricing_updated ON hosting_pricing(last_verified DESC);

-- Hoxi Conversations
CREATE INDEX IF NOT EXISTS idx_hoxi_conversations_website ON hoxi_conversations(website_id);
CREATE INDEX IF NOT EXISTS idx_hoxi_conversations_session ON hoxi_conversations(session_id);
CREATE INDEX IF NOT EXISTS idx_hoxi_conversations_created ON hoxi_conversations(created_at DESC);

-- Row Level Security (RLS) Policies
-- Enable RLS
ALTER TABLE websites ENABLE ROW LEVEL SECURITY;
ALTER TABLE traffic_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_detections ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE hosting_pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE hoxi_conversations ENABLE ROW LEVEL SECURITY;

-- Policies (adjust based on your auth setup)
-- Basic policy - users can only see their own website data
CREATE POLICY "Users can view their own websites" ON websites
  FOR SELECT USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can insert their own websites" ON websites
  FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Users can view their own traffic logs" ON traffic_logs
  FOR SELECT USING (website_id IN (SELECT id FROM websites WHERE user_id::text = auth.uid()::text));

CREATE POLICY "Users can insert their own traffic logs" ON traffic_logs
  FOR INSERT WITH CHECK (website_id IN (SELECT id FROM websites WHERE user_id::text = auth.uid()::text));

CREATE POLICY "Users can view their own bot detections" ON bot_detections
  FOR SELECT USING (website_id IN (SELECT id FROM websites WHERE user_id::text = auth.uid()::text));

CREATE POLICY "Users can insert their own bot detections" ON bot_detections
  FOR INSERT WITH CHECK (website_id IN (SELECT id FROM websites WHERE user_id::text = auth.uid()::text));

CREATE POLICY "Users can view their own cost analyses" ON cost_analyses
  FOR SELECT USING (website_id IN (SELECT id FROM websites WHERE user_id::text = auth.uid()::text));

CREATE POLICY "Users can insert their own cost analyses" ON cost_analyses
  FOR INSERT WITH CHECK (website_id IN (SELECT id FROM websites WHERE user_id::text = auth.uid()::text));

-- Hosting pricing is public (read-only for users)
CREATE POLICY "Public read access to hosting pricing" ON hosting_pricing
  FOR SELECT USING (true);

CREATE POLICY "Users can view their own conversations" ON hoxi_conversations
  FOR SELECT USING (website_id IN (SELECT id FROM websites WHERE user_id::text = auth.uid()::text));

CREATE POLICY "Users can insert their own conversations" ON hoxi_conversations
  FOR INSERT WITH CHECK (website_id IN (SELECT id FROM websites WHERE user_id::text = auth.uid()::text));

-- Functions for Common Queries
-- Get latest detection summary for website
CREATE OR REPLACE FUNCTION get_latest_detection_summary(website_id_param UUID)
RETURNS TABLE (
  bot_count BIGINT,
  total_bandwidth_gb NUMERIC,
  total_cost_usd NUMERIC,
  top_bot_name TEXT,
  top_bot_confidence NUMERIC,
  analysis_date DATE
) LANGUAGE sql AS $$
  SELECT
    count(*) as bot_count,
    round((sum(bd.bandwidth_bytes) / (1024^3))::numeric, 3) as total_bandwidth_gb,
    coalesce(ca.total_cost_usd, 0) as total_cost_usd,
    (SELECT bot_name FROM bot_detections
     WHERE website_id = website_id_param
     ORDER BY confidence DESC, bandwidth_bytes DESC
     LIMIT 1) as top_bot_name,
    (SELECT confidence FROM bot_detections
     WHERE website_id = website_id_param
     ORDER BY confidence DESC, bandwidth_bytes DESC
     LIMIT 1) as top_bot_confidence,
    current_date as analysis_date
  FROM bot_detections bd
  LEFT JOIN cost_analyses ca ON ca.website_id = bd.website_id
    AND ca.analysis_date = current_date
  WHERE bd.website_id = website_id_param
    AND bd.detected_at >= current_date - interval '1 day'
  GROUP BY ca.total_cost_usd;
$$;

-- Get cost trends for website
CREATE OR REPLACE FUNCTION get_cost_trends(website_id_param UUID, days_back INTEGER DEFAULT 30)
RETURNS TABLE (
  analysis_date DATE,
  total_cost_usd NUMERIC,
  bot_cost_usd NUMERIC,
  total_bandwidth_gb NUMERIC,
  bot_requests INTEGER
) LANGUAGE sql AS $$
  SELECT
    analysis_date,
    total_cost_usd,
    bot_cost_usd,
    total_bandwidth_gb,
    bot_requests
  FROM cost_analyses
  WHERE website_id = website_id_param
    AND analysis_date >= current_date - interval '1 day' * days_back
  ORDER BY analysis_date DESC;
$$;

-- Comments for Documentation
COMMENT ON TABLE websites IS 'Registered websites for monitoring';
COMMENT ON TABLE traffic_logs IS 'Raw traffic log entries from hosting providers';
COMMENT ON TABLE bot_detections IS 'Stores Core Detection Engine analysis results for individual bot sessions';
COMMENT ON TABLE cost_analyses IS 'Daily cost analysis summaries calculated from bot detection results';
COMMENT ON TABLE hosting_pricing IS 'Cached pricing data from hosting providers for cost calculations';
COMMENT ON TABLE hoxi_conversations IS 'Hoxi AI chat sessions for analytics and improvement';

COMMENT ON COLUMN bot_detections.detection_method IS 'JSON object containing analysis results from all 4 detection methods (velocity, pattern, signature, behavior)';
COMMENT ON COLUMN bot_detections.confidence IS 'Overall confidence score (0.0 to 1.0) from Core Detection Engine';
COMMENT ON COLUMN cost_analyses.cost_by_category IS 'Cost breakdown by bot category (ai_training, search_engine, etc.)';
COMMENT ON COLUMN cost_analyses.cost_by_bot IS 'Cost breakdown by individual bot names';