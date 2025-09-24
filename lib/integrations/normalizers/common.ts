import { createHash } from 'crypto'
import { NormalizedLog } from '@/lib/integrations/base'
import { botDetector } from '@/lib/bot-detector'

export function applyBotDetection(
  log: Omit<NormalizedLog, 'is_bot' | 'bot_name' | 'bot_category'>
): NormalizedLog {
  const ua = log.user_agent || ''
  const info = botDetector.detect(ua)
  return {
    ...log,
    is_bot: info.isBot,
    bot_name: info.botName,
    bot_category: info.category
  }
}

export function fingerprint(log: NormalizedLog, websiteId: string): string {
  const ts = new Date(log.timestamp)
  // Round to second to avoid excessive uniqueness from millis
  const isoSec = new Date(Math.floor(ts.getTime() / 1000) * 1000).toISOString()
  const parts = [
    websiteId,
    isoSec,
    log.method || '',
    log.path || '',
    String(log.status_code || ''),
    String(log.bytes_transferred || 0),
    (log.user_agent || '').slice(0, 200),
    log.ip_address || ''
  ]
  const raw = parts.join('|')
  return createHash('sha256').update(raw).digest('hex')
}

export function toTrafficRow(log: NormalizedLog, websiteId: string) {
  const existingFingerprint = (log as { fingerprint?: string }).fingerprint
  const computedFingerprint = existingFingerprint || fingerprint(log, websiteId)

  return {
    website_id: websiteId,
    timestamp: log.timestamp,
    user_agent: log.user_agent,
    bot_name: log.bot_name,
    is_bot: log.is_bot,
    bot_category: log.bot_category,
    bytes_transferred: log.bytes_transferred,
    response_time_ms: log.response_time_ms,
    path: log.path,
    method: log.method,
    status_code: log.status_code,
    ip_address: log.ip_address,
    fingerprint: computedFingerprint
  }
}

export function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}
