-- Hoxi AI Supabase Schema
-- Core Detection Engine Results and Hoxi AI Support Tables

-- Enable necessary extensions
create extension if not exists "uuid-ossp";

-- Bot Detection Results Table
-- Stores results from Core Detection Engine analysis
create table bot_detections (
  id uuid default uuid_generate_v4() primary key,
  website_id text not null,
  session_id text not null,

  -- Bot Information
  bot_name text not null,
  user_agent text not null,
  ip_address inet not null,

  -- Classification Results
  category text not null check (category in ('ai_training', 'ai_scraper', 'search_engine', 'malicious', 'beneficial', 'extractive')),
  subcategory text,
  confidence numeric(5,4) not null check (confidence >= 0 and confidence <= 1),
  impact text not null check (impact in ('low', 'medium', 'high', 'extreme')),
  verified boolean default false,

  -- Analysis Data
  request_count integer not null default 1,
  bandwidth_bytes bigint not null default 0,

  -- Detection Method Details
  detection_method jsonb not null, -- {velocity: {}, pattern: {}, signature: {}, behavior: {}}
  analysis_metadata jsonb, -- Additional analysis data

  -- Timestamps
  first_seen_at timestamp with time zone not null,
  last_seen_at timestamp with time zone not null,
  detected_at timestamp with time zone default now(),

  -- Time Range for this detection session
  time_range_start timestamp with time zone not null,
  time_range_end timestamp with time zone not null,

  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Cost Analysis Results Table
-- Stores cost calculations for bot traffic
create table cost_analyses (
  id uuid default uuid_generate_v4() primary key,
  website_id text not null,
  analysis_date date not null,

  -- Provider Information
  hosting_provider text not null,
  region text default 'global',
  price_per_gb numeric(8,6), -- Custom price if provided

  -- Cost Breakdown
  total_cost_usd numeric(10,4) not null default 0,
  bot_cost_usd numeric(10,4) not null default 0,
  human_cost_usd numeric(10,4) not null default 0,

  -- Bandwidth Analysis
  total_bandwidth_gb numeric(12,6) not null default 0,
  bot_bandwidth_gb numeric(12,6) not null default 0,
  human_bandwidth_gb numeric(12,6) not null default 0,

  -- Request Analysis
  total_requests integer not null default 0,
  bot_requests integer not null default 0,
  human_requests integer not null default 0,

  -- Projections
  projected_monthly_cost numeric(10,4),
  projected_yearly_cost numeric(10,4),

  -- Cost Breakdown by Category
  cost_by_category jsonb, -- {ai_training: 45.50, search_engine: 12.30, ...}
  cost_by_bot jsonb, -- {GPTBot: 25.00, Googlebot: 15.50, ...}

  -- Processing Statistics
  processing_time_ms integer,
  logs_processed integer,

  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),

  -- Ensure one analysis per website per day
  unique(website_id, analysis_date)
);

-- Hosting Provider Pricing Table
-- Cache for hosting provider pricing data
create table hosting_pricing (
  id uuid default uuid_generate_v4() primary key,
  provider text not null,
  region text not null default 'global',

  -- Pricing Information
  price_per_gb numeric(8,6) not null,
  price_per_million_requests numeric(8,4),

  -- Free Tier Information
  included_bandwidth_gb numeric(8,2) default 0,
  included_requests_millions numeric(8,2) default 0,

  -- Pricing Tiers (for complex pricing)
  pricing_tiers jsonb, -- [{min_gb: 0, max_gb: 100, price: 0.045}, ...]

  -- Metadata
  currency text default 'USD',
  source_url text,
  confidence numeric(3,2) default 1.0,
  last_verified timestamp with time zone default now(),

  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),

  -- Ensure one pricing entry per provider/region
  unique(provider, region)
);

-- Bot Signatures Cache Table (Optional - for performance)
-- Cache frequently used bot signatures
create table bot_signatures_cache (
  id uuid default uuid_generate_v4() primary key,
  bot_name text not null unique,

  -- Signature Information
  user_agent_patterns text[] not null,
  ip_ranges cidr[],
  category text not null,
  subcategory text,
  impact text not null,

  -- Metadata
  purpose text,
  website text,
  documentation_url text,
  last_updated timestamp with time zone default now(),

  created_at timestamp with time zone default now()
);

-- Hoxi AI Chat Sessions (Optional)
-- Track conversations for analytics and improvement
create table hoxi_conversations (
  id uuid default uuid_generate_v4() primary key,
  website_id text not null,
  session_id text not null,

  -- User Query
  user_message text not null,
  user_intent text, -- detected intent: 'cost_analysis', 'bot_inquiry', 'recommendations'

  -- Hoxi Response
  hoxi_response text not null,
  tools_used text[], -- ['queryAnalytics', 'generateRecommendations']
  confidence_score numeric(3,2),

  -- Context
  detection_context jsonb, -- Latest detection results used
  cost_context jsonb, -- Cost data referenced

  -- Performance
  response_time_ms integer,
  token_usage jsonb, -- {input: 150, output: 300, total: 450}

  -- Feedback (for improvement)
  user_feedback text,
  rating integer check (rating >= 1 and rating <= 5),

  created_at timestamp with time zone default now()
);

-- Indexes for Performance
-- Bot Detections
create index idx_bot_detections_website_id on bot_detections(website_id);
create index idx_bot_detections_detected_at on bot_detections(detected_at desc);
create index idx_bot_detections_category on bot_detections(category);
create index idx_bot_detections_confidence on bot_detections(confidence desc);
create index idx_bot_detections_website_date on bot_detections(website_id, detected_at desc);

-- Cost Analyses
create index idx_cost_analyses_website_id on cost_analyses(website_id);
create index idx_cost_analyses_date on cost_analyses(analysis_date desc);
create index idx_cost_analyses_website_date on cost_analyses(website_id, analysis_date desc);

-- Hosting Pricing
create index idx_hosting_pricing_provider on hosting_pricing(provider);
create index idx_hosting_pricing_updated on hosting_pricing(last_verified desc);

-- Hoxi Conversations
create index idx_hoxi_conversations_website on hoxi_conversations(website_id);
create index idx_hoxi_conversations_session on hoxi_conversations(session_id);
create index idx_hoxi_conversations_created on hoxi_conversations(created_at desc);

-- Row Level Security (RLS) Policies
-- Enable RLS
alter table bot_detections enable row level security;
alter table cost_analyses enable row level security;
alter table hosting_pricing enable row level security;
alter table hoxi_conversations enable row level security;

-- Policies (adjust based on your auth setup)
-- Basic policy - users can only see their own website data
create policy "Users can view their own bot detections" on bot_detections
  for select using (auth.uid()::text = website_id);

create policy "Users can insert their own bot detections" on bot_detections
  for insert with check (auth.uid()::text = website_id);

create policy "Users can view their own cost analyses" on cost_analyses
  for select using (auth.uid()::text = website_id);

create policy "Users can insert their own cost analyses" on cost_analyses
  for insert with check (auth.uid()::text = website_id);

-- Hosting pricing is public (read-only for users)
create policy "Public read access to hosting pricing" on hosting_pricing
  for select using (true);

create policy "Users can view their own conversations" on hoxi_conversations
  for select using (auth.uid()::text = website_id);

create policy "Users can insert their own conversations" on hoxi_conversations
  for insert with check (auth.uid()::text = website_id);

-- Functions for Common Queries
-- Get latest detection summary for website
create or replace function get_latest_detection_summary(website_id_param text)
returns table (
  bot_count bigint,
  total_bandwidth_gb numeric,
  total_cost_usd numeric,
  top_bot_name text,
  top_bot_confidence numeric,
  analysis_date date
) language sql as $$
  select
    count(*) as bot_count,
    round((sum(bd.bandwidth_bytes) / (1024^3))::numeric, 3) as total_bandwidth_gb,
    coalesce(ca.total_cost_usd, 0) as total_cost_usd,
    (select bot_name from bot_detections
     where website_id = website_id_param
     order by confidence desc, bandwidth_bytes desc
     limit 1) as top_bot_name,
    (select confidence from bot_detections
     where website_id = website_id_param
     order by confidence desc, bandwidth_bytes desc
     limit 1) as top_bot_confidence,
    current_date as analysis_date
  from bot_detections bd
  left join cost_analyses ca on ca.website_id = bd.website_id
    and ca.analysis_date = current_date
  where bd.website_id = website_id_param
    and bd.detected_at >= current_date - interval '1 day'
  group by ca.total_cost_usd;
$$;

-- Get cost trends for website
create or replace function get_cost_trends(website_id_param text, days_back integer default 30)
returns table (
  analysis_date date,
  total_cost_usd numeric,
  bot_cost_usd numeric,
  total_bandwidth_gb numeric,
  bot_requests integer
) language sql as $$
  select
    analysis_date,
    total_cost_usd,
    bot_cost_usd,
    total_bandwidth_gb,
    bot_requests
  from cost_analyses
  where website_id = website_id_param
    and analysis_date >= current_date - interval '1 day' * days_back
  order by analysis_date desc;
$$;

-- Comments for Documentation
comment on table bot_detections is 'Stores Core Detection Engine analysis results for individual bot sessions';
comment on table cost_analyses is 'Daily cost analysis summaries calculated from bot detection results';
comment on table hosting_pricing is 'Cached pricing data from hosting providers for cost calculations';
comment on table hoxi_conversations is 'Hoxi AI chat sessions for analytics and improvement';

comment on column bot_detections.detection_method is 'JSON object containing analysis results from all 4 detection methods (velocity, pattern, signature, behavior)';
comment on column bot_detections.confidence is 'Overall confidence score (0.0 to 1.0) from Core Detection Engine';
comment on column cost_analyses.cost_by_category is 'Cost breakdown by bot category (ai_training, search_engine, etc.)';
comment on column cost_analyses.cost_by_bot is 'Cost breakdown by individual bot names';