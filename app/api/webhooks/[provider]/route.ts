import { NextRequest, NextResponse } from 'next/server'
import type { NormalizedLog, Provider } from '@/lib/integrations/base'
import { supabaseAdmin } from '@/lib/supabase'
import { applyBotDetection, toTrafficRow, chunk } from '@/lib/integrations/normalizers/common'
import { canonicalizeHost, uuidv5FromHost } from '@/lib/utils/website-id'
import { normalizeCloudflareLogpush } from '@/lib/integrations/normalizers/cloudflare'
import { normalizeNetlifyLogs } from '@/lib/integrations/normalizers/netlify'
import { CoreDetectionEngine } from '@/lib/core-detection'

export const runtime = 'nodejs'

export async function POST(request: NextRequest, context: { params: Promise<{ provider: string }> | { provider: string } }) {
  const p = await Promise.resolve(context.params as { provider: string } | Promise<{ provider: string }>)
  const provider = ((p?.provider as string) || 'unknown') as Provider
  const secret = request.headers.get('x-ai-monitor-secret') || ''
  const expected = process.env.WEBHOOK_SECRET || ''
  if (!expected || secret !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // websiteId can be passed as query param or header when providers support per-site drains
  const { searchParams } = new URL(request.url)
  let websiteId = searchParams.get('websiteId') || request.headers.get('x-website-id') || ''
  if (!websiteId) {
    // Fallback: accept websiteUrl/domain and derive a deterministic UUID
    const websiteUrl = searchParams.get('websiteUrl') || request.headers.get('x-website-url')
    if (!websiteUrl) return NextResponse.json({ error: 'Missing websiteId or websiteUrl' }, { status: 400 })
    const host = canonicalizeHost(websiteUrl)
    websiteId = uuidv5FromHost(host)
    if (process.env.DEV_AUTO_REGISTER_WEBSITES === 'true') {
      const ensured = await ensureWebsiteRow(websiteId, host)
      if (ensured) websiteId = ensured
    }
  }
  const isValidUUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(websiteId)
  if (!isValidUUID) return NextResponse.json({ error: 'Invalid websiteId (must be UUID)' }, { status: 400 })

  try {
    const contentType = request.headers.get('content-type') || ''
    const raw = await request.text()

    let logs: NormalizedLog[] = []

    switch (provider) {
      case 'cloudflare': {
        const records = parseIncoming(raw, contentType)
        logs = normalizeCloudflareLogpush(records)
        break
      }
      case 'vercel': {
        const payload = safeJson(raw)
        const arr = Array.isArray(payload) ? (payload as unknown[]) : []
        logs = arr.map((entryRaw) => {
          const entry = entryRaw as {
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
          return {
          timestamp: new Date(entry.timestamp || Date.now()),
          user_agent: (entry.proxy?.userAgent || entry.message || '') as string,
          is_bot: false,
          bot_name: null,
          bot_category: null,
          bytes_transferred: Number(entry.proxy?.bytes || 0),
          response_time_ms: Number(entry.proxy?.responseTime || 0),
          status_code: Number(entry.proxy?.statusCode || 0) || undefined,
          path: (entry.proxy?.path || '') as string,
          method: (entry.proxy?.method || '') as string
          }
        })
        break
      }
      case 'aws': {
        // Accept plain array of events from a forwarding Lambda
        const payload = safeJson(raw)
        const arr = Array.isArray(payload) ? (payload as unknown[]) : []
        logs = arr.map((eRaw) => {
          const e = eRaw as {
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
          return {
          timestamp: new Date(e.timestamp || Date.now()),
          user_agent: e.userAgent || '',
          is_bot: false,
          bot_name: null,
          bot_category: null,
          bytes_transferred: Number(e.bytes || 0),
          response_time_ms: Number(e.responseTime || 0) || undefined,
          status_code: Number(e.status || e.statusCode || 0) || undefined,
          path: e.path || e.uri || undefined,
          method: e.method || undefined,
          ip_address: e.clientIp || e.ip || undefined
          }
        })
        break
      }
      case 'netlify': {
        const payload = safeJson(raw)
        const arr = Array.isArray(payload) ? (payload as unknown[]) : []
        logs = normalizeNetlifyLogs(arr)
        break
      }
      default:
        return NextResponse.json({ error: 'Unsupported provider' }, { status: 400 })
    }

    // Enrich with detection: Core Detection Engine (primary) or simple heuristic fallback
    const useCoreDetection = process.env.CORE_DETECTION_ENABLED !== 'false' // Default to true

    let normalized: NormalizedLog[]

    if (useCoreDetection) {
      // Use the high-performance Core Detection Engine (preferred)
      console.log(`🔍 Processing ${logs.length} logs with Core Detection Engine`)
      const coreEngine = new CoreDetectionEngine()
      const result = await coreEngine.analyze(logs, websiteId, {
        provider,
        includesCosts: false // Skip costs for webhook processing
      })

      // Extract the analyzed logs with bot detection results
      normalized = result.normalizedLogs.length
        ? result.normalizedLogs
        : logs.map(l => applyBotDetection({ ...l }))

      console.log(`✅ Core Detection completed in ${result.processingStats.processingTime}ms`)
    } else {
      // Simple rule-based detection fallback
      console.log(`📝 Processing ${logs.length} logs with simple rule-based detection`)
      normalized = logs.map((l) => applyBotDetection({ ...l }))
    }

    // Convert to DB rows with fingerprints
    const rows = normalized.map((n) => toTrafficRow(n, websiteId))

    // Upsert in chunks
    let inserted = 0
    if (rows.length > 0) {
      const CHUNK_SIZE = 1000
      for (const part of chunk(rows, CHUNK_SIZE)) {
        const { error } = await supabaseAdmin
          .from('traffic_logs')
          .upsert(part, { onConflict: 'fingerprint', ignoreDuplicates: true })
        if (error) throw error
        inserted += part.length
      }
    }

    return NextResponse.json({ success: true, processed: rows.length, inserted })
  } catch (e: unknown) {
    console.error('Webhook error:', e)
    let detail: string | undefined
    try {
      if (isErrorWithMessage(e)) {
        detail = e.message
      } else {
        detail = JSON.stringify(e)
      }
    } catch { /* ignore */ }
    return NextResponse.json({ error: 'Processing failed', detail }, { status: 500 })
  }
}

function parseIncoming(raw: string, contentType: string): Record<string, unknown>[] {
  // Cloudflare Logpush often sends NDJSON; support JSON array too
  if (/application\/json/i.test(contentType)) {
    const parsed = safeJson(raw)
    if (Array.isArray(parsed)) return parsed as Record<string, unknown>[]
    if (parsed && typeof parsed === 'object' && Array.isArray((parsed as { records?: unknown[] }).records)) {
      return (parsed as { records: Record<string, unknown>[] }).records
    }
  }
  // NDJSON
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  const out: Record<string, unknown>[] = []
  for (const line of lines) {
    try { out.push(JSON.parse(line)) } catch { /* ignore */ }
  }
  return out
}

function safeJson(raw: string): unknown {
  try { return JSON.parse(raw) } catch { return null }
}

async function ensureWebsiteRow(derivedId: string, host: string): Promise<string | null> {
  try {
    const { data: existing } = await supabaseAdmin
      .from('websites')
      .select('id')
      .eq('domain', host)
      .maybeSingle()

    if (existing && (existing as { id?: string }).id) {
      return (existing as { id?: string }).id || null
    }

    const payload: Record<string, unknown> = { id: derivedId, domain: host }
    if (process.env.DEV_WEBSITE_USER_ID) payload.user_id = process.env.DEV_WEBSITE_USER_ID

    const { error } = await supabaseAdmin
      .from('websites')
      .insert(payload)

    if (error) {
      const { data: after } = await supabaseAdmin
        .from('websites')
        .select('id')
        .eq('domain', host)
        .maybeSingle()
      return (after && (after as { id?: string }).id) || null
    }
    return derivedId
  } catch {
    return null
  }
}

function isErrorWithMessage(error: unknown): error is { message: string } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as { message: unknown }).message === 'string'
  )
}
