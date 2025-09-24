import type { NormalizedLog } from '@/lib/integrations/base'

// Netlify Traffic Log format based on official documentation
type NetlifyTrafficLog = {
  account_id?: string
  client_ip?: string // Omitted if PII excluded
  content_type?: string
  country?: string
  deploy_id?: string
  duration?: number // milliseconds
  firewall_rule?: string
  block_reason?: string
  rate_limit?: {
    rule_id?: string
  }
  log_type?: string // "traffic"
  method?: string
  referrer?: string
  request_id?: string
  request_size?: number
  response_size?: number
  site_id?: string
  status_code?: number
  timestamp?: string // RFC 3339 format
  url?: string
  user_agent?: string // Omitted if PII excluded
  waf?: {
    outcome?: string
    rule_id?: string
    policy_id?: string
    rule_set_id?: string
  }
}

// Netlify Function Log format
type NetlifyFunctionLog = {
  account_id?: string
  branch?: string
  deploy_id?: string
  duration?: number
  function_name?: string
  function_type?: string // "regular", "background", "edge"
  level?: string // "INFO", "ERROR", "WARN", "REPORT"
  message?: string
  log_type?: string // "functions"
  method?: string
  path?: string
  request_id?: string
  site_id?: string
  status_code?: number
  timestamp?: string
}

// Generic Netlify log that could be any type
type NetlifyLog = NetlifyTrafficLog | NetlifyFunctionLog | {
  timestamp?: string | number
  userAgent?: string
  ua?: string
  bytes?: number
  responseTime?: number
  status?: number
  path?: string
  url?: string
  method?: string
  ip?: string
  // Legacy format support
}

export function normalizeNetlifyLogs(entries: unknown[]): NormalizedLog[] {
  const out: NormalizedLog[] = []
  for (const raw of (Array.isArray(entries) ? entries : [])) {
    const e = raw as NetlifyLog
    try {
      // Handle timestamp - Netlify uses RFC 3339 format
      let timestamp: Date
      if (e.timestamp) {
        timestamp = new Date(e.timestamp)
        // Validate timestamp
        if (isNaN(timestamp.getTime())) {
          timestamp = new Date()
        }
      } else {
        timestamp = new Date()
      }

      // Determine if this is a traffic log or function log
      const logType = (e as NetlifyTrafficLog).log_type

      if (logType === 'traffic') {
        // Handle traffic logs (main focus for bot detection)
        const trafficLog = e as NetlifyTrafficLog
        out.push({
          timestamp,
          user_agent: trafficLog.user_agent || '',
          is_bot: false, // Will be determined by detection engine
          bot_name: null,
          bot_category: null,
          bytes_transferred: Number(trafficLog.response_size || trafficLog.request_size || 0) || 0,
          response_time_ms: Number(trafficLog.duration || 0) || undefined,
          status_code: Number(trafficLog.status_code || 0) || undefined,
          path: trafficLog.url || undefined,
          method: trafficLog.method || undefined,
          ip_address: trafficLog.client_ip || undefined,
          // Additional Netlify-specific data
          extra_data: {
            deploy_id: trafficLog.deploy_id,
            site_id: trafficLog.site_id,
            request_id: trafficLog.request_id,
            country: trafficLog.country,
            content_type: trafficLog.content_type,
            referrer: trafficLog.referrer,
            firewall_rule: trafficLog.firewall_rule,
            block_reason: trafficLog.block_reason,
            waf_outcome: trafficLog.waf?.outcome
          }
        })
      } else if (logType === 'functions') {
        // Handle function logs (less relevant for traffic bot detection but still useful)
        const functionLog = e as NetlifyFunctionLog
        out.push({
          timestamp,
          user_agent: '', // Function logs don't typically have user agents
          is_bot: false,
          bot_name: null,
          bot_category: null,
          bytes_transferred: 0,
          response_time_ms: Number(functionLog.duration || 0) || undefined,
          status_code: Number(functionLog.status_code || 0) || undefined,
          path: functionLog.path || undefined,
          method: functionLog.method || undefined,
          ip_address: undefined,
          extra_data: {
            function_name: functionLog.function_name,
            function_type: functionLog.function_type,
            level: functionLog.level,
            message: functionLog.message,
            deploy_id: functionLog.deploy_id,
            site_id: functionLog.site_id,
            request_id: functionLog.request_id
          }
        })
      } else {
        // Handle legacy/generic format for backward compatibility
        const legacyLog = e as {
          timestamp?: string | number
          userAgent?: string
          ua?: string
          bytes?: number
          responseTime?: number
          status?: number
          path?: string
          url?: string
          method?: string
          ip?: string
        }

        out.push({
          timestamp,
          user_agent: legacyLog.userAgent || legacyLog.ua || '',
          is_bot: false,
          bot_name: null,
          bot_category: null,
          bytes_transferred: Number(legacyLog.bytes || 0) || 0,
          response_time_ms: Number(legacyLog.responseTime || 0) || undefined,
          status_code: Number(legacyLog.status || 0) || undefined,
          path: legacyLog.path || legacyLog.url || undefined,
          method: legacyLog.method || undefined,
          ip_address: legacyLog.ip || undefined
        })
      }
    } catch (error) {
      console.error('Error normalizing Netlify log entry:', error, raw)
      // Continue processing other entries
    }
  }
  return out
}

