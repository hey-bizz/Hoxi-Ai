import type { NormalizedLog } from '@/lib/integrations/base'

type AWSLog = {
  timestamp?: string | number
  userAgent?: string
  bytes?: number
  responseTime?: number
  status?: number
  statusCode?: number
  path?: string
  uri?: string
  method?: string
  clientIp?: string
  ip?: string
}

export function normalizeAWSLogs(entries: unknown[]): NormalizedLog[] {
  const out: NormalizedLog[] = []
  for (const raw of (Array.isArray(entries) ? entries : [])) {
    const e = raw as AWSLog
    try {
      const ts = new Date(e.timestamp || Date.now())
      out.push({
        timestamp: ts,
        user_agent: e.userAgent || '',
        is_bot: false,
        bot_name: null,
        bot_category: null,
        bytes_transferred: Number(e.bytes || 0) || 0,
        response_time_ms: Number(e.responseTime || 0) || undefined,
        status_code: Number(e.status || e.statusCode || 0) || undefined,
        path: e.path || e.uri || undefined,
        method: e.method || undefined,
        ip_address: e.clientIp || e.ip || undefined
      })
    } catch { /* ignore */ }
  }
  return out
}

