import type { NormalizedLog } from '@/lib/integrations/base'

type VercelLog = {
  timestamp?: string | number
  message?: string
  proxy?: {
    userAgent?: string
    bytes?: number
    responseTime?: number
    statusCode?: number
    path?: string
    method?: string
  }
}

export function normalizeVercelLogs(entries: unknown[]): NormalizedLog[] {
  const out: NormalizedLog[] = []
  for (const entryRaw of (Array.isArray(entries) ? entries : [])) {
    const e = entryRaw as VercelLog
    try {
      const ts = new Date(e.timestamp || Date.now())
      const ua = (e.proxy?.userAgent || e.message || '') as string
      const bytes = Number(e.proxy?.bytes || 0)
      const rt = Number(e.proxy?.responseTime || 0)
      const status = Number(e.proxy?.statusCode || 0) || undefined
      const path = (e.proxy?.path || '') as string
      const method = (e.proxy?.method || '') as string
      out.push({
        timestamp: ts,
        user_agent: ua || undefined,
        is_bot: false,
        bot_name: null,
        bot_category: null,
        bytes_transferred: Number.isFinite(bytes) ? bytes : 0,
        response_time_ms: Number.isFinite(rt) ? rt : undefined,
        status_code: status,
        path: path || undefined,
        method: method || undefined
      })
    } catch { /* ignore */ }
  }
  return out
}

