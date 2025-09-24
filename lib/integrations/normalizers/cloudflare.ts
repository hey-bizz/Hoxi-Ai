import { NormalizedLog } from '@/lib/integrations/base'

// Normalize Cloudflare Logpush http_requests dataset records
// Supports common fields: ClientIP, ClientRequestHost, ClientRequestMethod,
// ClientRequestURI, EdgeResponseBytes, EdgeResponseStatus, ClientRequestUserAgent,
// EdgeStartTimestamp, EdgeEndTimestamp

type CFLogpushRecord = {
  EdgeEndTimestamp?: string | number
  EdgeStartTimestamp?: string | number
  ClientRequestURI?: string
  ClientRequestMethod?: string
  EdgeResponseStatus?: number | string
  EdgeResponseBytes?: number | string
  ClientRequestUserAgent?: string
  ClientIP?: string
  [key: string]: unknown
}

export function normalizeCloudflareLogpush(records: CFLogpushRecord[]): NormalizedLog[] {
  const out: NormalizedLog[] = []
  for (const r of records || []) {
    try {
      const endTs = parseTimestamp(r.EdgeEndTimestamp) || new Date()
      const startTs = parseTimestamp(r.EdgeStartTimestamp)
      const rtMs = startTs && endTs ? Math.max(0, endTs.getTime() - startTs.getTime()) : undefined
      const path = (r.ClientRequestURI || '').toString()
      const method = (r.ClientRequestMethod || '').toString()
      const status = toNumber(r.EdgeResponseStatus)
      const bytes = toNumber(r.EdgeResponseBytes)
      const ua = (r.ClientRequestUserAgent || '').toString()
      const ip = (r.ClientIP || '').toString()

      out.push({
        timestamp: endTs,
        ip_address: ip || undefined,
        user_agent: ua || undefined,
        // bot fields populated later by common helper
        is_bot: false,
        bot_name: null,
        bot_category: null,
        bytes_transferred: Number.isFinite(bytes) ? bytes : 0,
        response_time_ms: rtMs,
        status_code: Number.isFinite(status) ? status : undefined,
        path: path || undefined,
        method: method || undefined
      })
    } catch {
      // ignore bad record
    }
  }
  return out
}

// Normalize Cloudflare Analytics GraphQL grouped entries into pseudo-request logs
// Each group represents 1-minute aggregates; we project requests as a single record with bytes.
type CFAnalyticsGroup = {
  dimensions?: {
    datetime?: string
    clientRequestHTTPMethodName?: string
    clientRequestPath?: string
    clientRequestUserAgent?: string
  }
  sum?: { bytes?: number | string }
  avg?: { originResponseDurationMs?: number | string }
}

export function normalizeCloudflareGraphQL(groups: CFAnalyticsGroup[]): NormalizedLog[] {
  const out: NormalizedLog[] = []
  for (const g of groups || []) {
    try {
      const ts = new Date(g.dimensions?.datetime || Date.now())
      const ua = g.dimensions?.clientRequestUserAgent || ''
      const method = g.dimensions?.clientRequestHTTPMethodName || ''
      const path = g.dimensions?.clientRequestPath || ''
      const bytes = toNumber(g.sum?.bytes)
      out.push({
        timestamp: ts,
        user_agent: ua || undefined,
        is_bot: false,
        bot_name: null,
        bot_category: null,
        bytes_transferred: Number.isFinite(bytes) ? bytes : 0,
        response_time_ms: toNumber(g.avg?.originResponseDurationMs) || undefined,
        status_code: undefined,
        path: path || undefined,
        method: method || undefined
      })
    } catch {
      // ignore
    }
  }
  return out
}

function toNumber(v: unknown): number {
  const n = typeof v === 'string' ? Number(v) : v
  return typeof n === 'number' && isFinite(n) ? n : 0
}

function parseTimestamp(v: unknown): Date | null {
  if (!v) return null
  // Cloudflare often emits RFC3339/ISO strings or epoch seconds
  if (typeof v === 'number') return new Date(Math.round(v * 1000))
  if (typeof v === 'string') {
    const d = new Date(v)
    return isNaN(d.getTime()) ? null : d
  }
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v
  return null
}
