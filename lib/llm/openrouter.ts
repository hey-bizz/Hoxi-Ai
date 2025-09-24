// Minimal OpenRouter client wrapper (no SDK dependency)
// Env: OPENROUTER_API_KEY, LLM_PRIMARY_MODEL?, LLM_FALLBACK_MODEL?, LLM_APP_URL?, LLM_APP_NAME?

const BASE_URL = 'https://openrouter.ai/api/v1/chat/completions'

type ChatMessage = { role: 'system' | 'user' | 'assistant' | 'tool'; content: string; tool_call_id?: string }

export type OpenRouterOptions = {
  model?: string
  fallbackModels?: string[]
  plugins?: Array<{ id: string; [k: string]: unknown }>
  response_format?: unknown
  extra_body?: Record<string, unknown>
}

export async function openrouterChat<T = unknown>(
  messages: ChatMessage[],
  opts: OpenRouterOptions = {}
): Promise<{ content: string; parsed?: T; raw: any; usedModel?: string }> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) throw new Error('Missing OPENROUTER_API_KEY')

  const model = opts.model || process.env.LLM_PRIMARY_MODEL || 'openrouter/auto'
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json'
  }
  if (process.env.LLM_APP_URL) headers['HTTP-Referer'] = process.env.LLM_APP_URL
  if (process.env.LLM_APP_NAME) headers['X-Title'] = process.env.LLM_APP_NAME

  const body: Record<string, unknown> = {
    model,
    messages,
  }
  const fallback = opts.fallbackModels || (process.env.LLM_FALLBACK_MODEL ? [process.env.LLM_FALLBACK_MODEL] : undefined)
  if (fallback && fallback.length > 0) (body as any).models = fallback
  if (opts.plugins) (body as any).plugins = opts.plugins
  if (opts.response_format) (body as any).response_format = opts.response_format
  if (opts.extra_body) Object.assign(body, opts.extra_body)

  const res = await fetch(BASE_URL, { method: 'POST', headers, body: JSON.stringify(body) })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = (json && (json.error?.message || json.error || json.message)) || `HTTP ${res.status}`
    throw new Error(`OpenRouter error: ${msg}`)
  }
  const choice = json?.choices?.[0]?.message
  const content: string = choice?.content || ''
  const usedModel: string | undefined = json?.model
  let parsed: any
  try { parsed = content ? JSON.parse(content) : undefined } catch { /* not strict JSON */ }
  return { content, parsed, raw: json, usedModel }
}

