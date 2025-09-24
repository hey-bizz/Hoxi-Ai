import { openrouterChat } from '@/lib/llm/openrouter'
import type { NormalizedLog } from '@/lib/integrations/base'
import { detectProvider } from '@/lib/integrations/detect-provider'
import { SYSTEM_JSON_ONLY, buildUAClassificationUser, SYSTEM_PRICING_JSON_ONLY, buildPricingUser } from '@/lib/llm/prompts'

type Classification = {
  user_agent: string
  is_bot: boolean
  bot_name: string | null
  bot_category: 'ai_training' | 'ai_scraper' | 'ai_search' | 'search_engine' | 'social_media' | 'seo_tool' | 'scraper' | 'monitoring' | 'security' | 'unknown' | null
  confidence: number
}

export async function classifyUserAgentsWithLLM(userAgents: string[], ctx: { websiteUrl?: string; providerHint?: string } = {}): Promise<Record<string, Classification>> {
  const unique = Array.from(new Set(userAgents.filter(Boolean))).slice(0, 2000)
  if (unique.length === 0) return {}
  const provider = ctx.providerHint || (ctx.websiteUrl ? await detectProviderSafe(ctx.websiteUrl) : 'unknown')

  const schema = {
    type: 'object',
    properties: {
      classifications: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            user_agent: { type: 'string' },
            is_bot: { type: 'boolean' },
            bot_name: { type: ['string', 'null'] },
            bot_category: {
              type: ['string', 'null'],
              enum: ['ai_training','ai_scraper','ai_search','search_engine','social_media','seo_tool','scraper','monitoring','security','unknown', null]
            },
            confidence: { type: 'number' }
          },
          required: ['user_agent', 'is_bot', 'bot_category', 'confidence'],
          additionalProperties: false
        }
      }
    },
    required: ['classifications'],
    additionalProperties: false
  }

  const messages = [
    { role: 'system' as const, content: SYSTEM_JSON_ONLY },
    { role: 'user' as const, content: buildUAClassificationUser(provider as string, ctx.websiteUrl, unique) }
  ]

  const { parsed, content } = await openrouterChat<{ classifications: Classification[] }>(messages, {
    response_format: { type: 'json_schema', json_schema: { name: 'ua_bot_classification', strict: true, schema } },
    // Fallbacks supported via env LLM_FALLBACK_MODEL
  })

  const out: Record<string, Classification> = {}
  const arr = parsed?.classifications || safeJson(content)?.classifications || []
  for (const c of arr) if (c && c.user_agent) out[c.user_agent] = c
  return out
}

export async function annotateLogsWithLLM(logs: NormalizedLog[], ctx: { websiteUrl?: string; providerHint?: string }): Promise<NormalizedLog[]> {
  const uaList = logs.map(l => l.user_agent || '').filter(Boolean)
  const map = await classifyUserAgentsWithLLM(uaList, ctx)
  return logs.map(l => {
    const ua = l.user_agent || ''
    const c = map[ua]
    return c ? { ...l, is_bot: !!c.is_bot, bot_name: c.bot_name, bot_category: (c.bot_category || null) } : l
  })
}

type Pricing = { provider: string; region: string; price_per_gb_usd: number; sources?: string[]; confidence?: number }

export async function getRegionPricingWithLLM(websiteUrl: string, providerHint?: string): Promise<Pricing> {
  const provider = providerHint || await detectProviderSafe(websiteUrl)
  const schema = {
    type: 'object',
    properties: {
      provider: { type: 'string' },
      region: { type: 'string' },
      price_per_gb_usd: { type: 'number' },
      sources: { type: 'array', items: { type: 'string' } },
      confidence: { type: 'number' }
    },
    required: ['provider','region','price_per_gb_usd'],
    additionalProperties: false
  }
  const messages = [
    { role: 'system' as const, content: SYSTEM_PRICING_JSON_ONLY },
    { role: 'user' as const, content: buildPricingUser(websiteUrl, provider) }
  ]
  const { parsed, content } = await openrouterChat<Pricing>(messages, {
    model: (process.env.LLM_PRICING_MODEL || (process.env.LLM_PRIMARY_MODEL || 'openrouter/auto')) + (process.env.LLM_USE_WEB_PLUGIN === 'true' ? ':online' : ''),
    plugins: process.env.LLM_USE_WEB_PLUGIN === 'true' ? [{ id: 'web', max_results: 3 }] : undefined,
    response_format: { type: 'json_schema', json_schema: { name: 'region_pricing', strict: true, schema } }
  })
  return parsed ?? safeJson<Pricing>(content) ?? { provider, region: 'unknown', price_per_gb_usd: 0.1 }
}

async function detectProviderSafe(url: string): Promise<string> {
  try { return await detectProvider(url) } catch { return 'unknown' }
}

function safeJson<T = any>(s?: string): T | undefined { try { return s ? JSON.parse(s) : undefined } catch { return undefined } }
