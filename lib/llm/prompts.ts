// Centralized prompt builders for the LLM agent

export const SYSTEM_JSON_ONLY = 'You are a precise log analytics assistant. Always output valid JSON only.'

export function buildUAClassificationUser(provider: string, websiteUrl: string | undefined, userAgents: string[]): string {
  const mappings = `Known mappings (use when exact/near-exact match):
- ai_training: GPTBot, GPT-Bot, ChatGPT-User, Claude-Web, anthropic-ai, Google-Extended, FacebookBot, cohere-ai
- ai_scraper: CCBot, Bytespider, DataForSeoBot, MJ12bot, PetalBot
- ai_search: PerplexityBot, YouBot
- search_engine: Googlebot, bingbot, Baiduspider, YandexBot, DuckDuckBot
- seo_tool: SemrushBot, AhrefsBot, Screaming Frog
- social_media: LinkedInBot, Twitterbot, facebookexternalhit, WhatsApp, Slackbot
- scraper: python-requests, curl, wget (and other generic libraries)
- monitoring: UptimeRobot, Pingdom, WordPress, Jetpack`

  const rules = `Rules:
- Prefer specific bot names when present in UA. Map to the categories above.
- Empty or generic UAs (e.g., just "Mozilla/5.0") → default to is_bot=false with low confidence unless the UA itself clearly indicates automation.
- WordPress/Jetpack are not AI crawlers; classify as monitoring (is_bot=true), not ai_*.
- Search engine crawlers are beneficial; classify under search_engine (is_bot=true).
- Be conservative on false positives; set confidence 0–1 accordingly.`

  const header = `Classify the following HTTP user agents as bots or humans for web traffic analytics.\nReturn JSON strictly matching the provided schema.`
  const ctx = `Context: provider=${provider}, site=${websiteUrl || ''}`
  const list = `UserAgents:\n` + userAgents.map((ua) => `- ${ua}`).join('\n')
  return [header, mappings, rules, ctx, '', list].join('\n\n')
}

export const SYSTEM_PRICING_JSON_ONLY = 'You identify hosting region and egress bandwidth price per GB in USD. Output valid JSON only. Prefer official vendor pricing pages; include source URLs. If live web data is unavailable, fall back to these baselines (USD/GB): AWS 0.09, Vercel 0.40, Netlify 0.55, Cloudflare 0.045, Generic 0.10.'

export function buildPricingUser(websiteUrl: string, provider: string): string {
  return `Site: ${websiteUrl}\nProvider: ${provider}\nTask: Determine likely hosting region (e.g., AWS CloudFront region group, Azure CDN geo, Vercel/Netlify geography) and current egress price per GB for that region. Provide 1–3 sources and a confidence score. If region-specific pricing is not determinable, use the closest global/standard pricing and reduce confidence.`
}

