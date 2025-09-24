import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createHash } from 'crypto'

import { supabaseAdmin } from '@/lib/supabase'
import { LogParser } from '@/lib/log-parser'
import { costCalculator } from '@/lib/cost-calculator'
import { CoreDetectionEngine } from '@/lib/core-detection'
import { applyBotDetection, toTrafficRow } from '@/lib/integrations/normalizers/common'
import type { NormalizedLog } from '@/lib/integrations/base'
import type { BotAnalysis, CostImpactAnalysis, DetectionResult } from '@/lib/core-detection'

const logParser = new LogParser()
const detectionEngine = new CoreDetectionEngine()

interface ProcessingStats {
  totalLogs: number
  processingTime: number
  memoryUsage: number
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const files = formData.getAll('files') as File[]
    let websiteId = (formData.get('websiteId') as string) || ''
    const dryRun = (formData.get('dryRun') as string)?.toString() === 'true'
    const providerOverride = (formData.get('provider') as string) || undefined

    if (!files.length) {
      return NextResponse.json({ error: 'Missing files' }, { status: 400 })
    }

    // Auto-generate websiteId if not provided
    if (!websiteId) {
      websiteId = `upload-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
    }

    const accessToken = extractAccessToken(request)
    if (!accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: userData, error: authError } = await supabaseAdmin.auth.getUser(accessToken)
    if (authError || !userData?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = userData.user.id

    // Try to find existing website or create new one for uploads
    let websiteRow: any = null

    // Check if websiteId is a UUID (existing website)
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(websiteId)

    if (isUUID) {
      // Existing website - validate ownership
      const { data, error: websiteError } = await supabaseAdmin
        .from('websites')
        .select('id, user_id, provider')
        .eq('id', websiteId)
        .maybeSingle()

      if (websiteError) {
        throw websiteError
      }
      if (!data) {
        return NextResponse.json({ error: 'Website not found' }, { status: 404 })
      }
      if (data.user_id && data.user_id !== userId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      websiteRow = data
    }

    const provider = providerOverride || websiteRow?.provider || 'generic'

    const { lines, headers } = await readFiles(files)

    // For auto-generated IDs, create website record using extracted domain
    if (!isUUID) {
      const domain = extractDomainFromLogs(lines, headers) || 'uploaded-logs.local'
      const uploadUUID = generateUUIDFromString(websiteId)

      // Create website record
      const { data: newWebsite, error: createError } = await supabaseAdmin
        .from('websites')
        .upsert({
          id: uploadUUID,
          user_id: userId,
          domain: domain,
          provider: 'upload',
          name: `Uploaded logs - ${domain}`,
          created_at: new Date().toISOString()
        }, { onConflict: 'id' })
        .select('id, user_id, provider')
        .single()

      if (createError) {
        console.error('Failed to create website record:', createError)
        // Continue with processing even if website creation fails
      }

      websiteId = uploadUUID
      websiteRow = newWebsite || { id: uploadUUID, user_id: userId, provider: 'upload' }
    }

    const parsedLogs = parseLogs(lines, headers, websiteId)

    if (parsedLogs.length === 0) {
      return NextResponse.json({
        success: true,
        stats: {
          totalEntries: 0,
          botRequests: 0,
          humanRequests: 0,
          totalBytes: 0,
          potentialSavings: 0,
          inserted: 0
        },
        message: 'No valid log lines found'
      })
    }

    const useCoreDetection = process.env.CORE_DETECTION_ENABLED !== 'false'

    let normalizedEntries: NormalizedLog[] = []
    let botAnalysis: BotAnalysis | null = null
    let costAnalysis: CostImpactAnalysis | null = null
    let processingStats: ProcessingStats | null = null

    if (useCoreDetection) {
      console.log(`🔍 Processing ${parsedLogs.length} logs with Core Detection Engine`)
      const detectionResult = await detectionEngine.analyze(parsedLogs, websiteId, {
        provider,
        includesCosts: true,
        skipTimeFilter: provider === 'upload'
      })
      normalizedEntries = detectionResult.normalizedLogs
      botAnalysis = detectionResult.botAnalysis
      costAnalysis = detectionResult.costAnalysis
      processingStats = detectionResult.processingStats
      console.log(`✅ Core Detection completed in ${processingStats.processingTime}ms`)
    } else {
      normalizedEntries = parsedLogs.map(log => applyBotDetection({ ...log }))
    }

    const rows = normalizedEntries.map(entry => toTrafficRow(entry, websiteId))

    let inserted = 0
    if (!dryRun && rows.length > 0) {
      const chunkSize = 1000
      for (let i = 0; i < rows.length; i += chunkSize) {
        const chunk = rows.slice(i, i + chunkSize)
        const { error } = await supabaseAdmin
          .from('traffic_logs')
          .upsert(chunk, { onConflict: 'fingerprint', ignoreDuplicates: true })
        if (error) {
          throw error
        }
        inserted += chunk.length
      }
    }

    let detectionsInserted = 0
    if (!dryRun && useCoreDetection && botAnalysis?.bots?.length) {
      const detectionRows = mapDetectionsToRows(botAnalysis.bots, websiteId)
      if (detectionRows.length) {
        const { error } = await supabaseAdmin.from('bot_detections').insert(detectionRows)
        if (error) {
          console.error('Failed to insert bot detections:', error)
        } else {
          detectionsInserted = detectionRows.length
        }
      }
    }

    if (!dryRun && useCoreDetection && costAnalysis && botAnalysis) {
      const costRow = mapCostAnalysis(costAnalysis, botAnalysis, provider, websiteId, processingStats)
      const { error } = await supabaseAdmin
        .from('cost_analyses')
        .upsert(costRow, { onConflict: 'website_id,analysis_date' })
      if (error) {
        console.error('Failed to upsert cost analysis:', error)
      }
    }

    const botEntries = normalizedEntries.filter(entry => entry.is_bot)
    const totalBotBytes = botEntries.reduce((sum, entry) => sum + (entry.bytes_transferred || 0), 0)
    const stats = {
      totalEntries: normalizedEntries.length,
      botRequests: botEntries.length,
      humanRequests: normalizedEntries.length - botEntries.length,
      totalBytes: normalizedEntries.reduce((sum, entry) => sum + (entry.bytes_transferred || 0), 0),
      potentialSavings: costCalculator.calculateBandwidthCost(totalBotBytes, provider).monthly,
      inserted
    }

    return NextResponse.json({
      success: true,
      stats,
      detectionsInserted,
      processing: processingStats,
      message: `Processed ${normalizedEntries.length} log entries${dryRun ? ' (dry-run, no DB writes)' : `, inserted ${inserted} rows`}`
    })
  } catch (error) {
    console.error('Error processing logs:', error)
    return NextResponse.json(
      { error: 'Failed to process logs' },
      { status: 500 }
    )
  }
}

function extractAccessToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim()
    if (token) {
      return token
    }
  }

  const cookieStore = cookies()
  return (
    cookieStore.get('sb-access-token')?.value ||
    cookieStore.get('supabase-auth-token')?.value ||
    null
  )
}

async function readFiles(files: File[]): Promise<{ lines: string[]; headers?: string[] }> {
  const lines: string[] = []
  let headers: string[] | undefined

  for (const file of files) {
    const text = await file.text()
    const rawLines = text.split(/\r?\n/)
    let startIndex = 0

    if (rawLines.length > 0) {
      const potentialHeader = rawLines[0].trim()
      if (potentialHeader) {
        if (!headers && potentialHeader.includes(',')) {
          headers = potentialHeader.split(',').map(h => h.trim().replace(/"/g, ''))
          startIndex = 1
        } else if (headers) {
          const normalized = potentialHeader
            .split(',')
            .map(h => h.trim().replace(/"/g, ''))
            .join(',')
          const headerSignature = headers.join(',')
          if (normalized === headerSignature) {
            startIndex = 1
          }
        }
      }
    }

    for (let i = startIndex; i < rawLines.length; i++) {
      const line = rawLines[i].trim()
      if (line) {
        lines.push(line)
      }
    }
  }

  return { lines, headers }
}

function parseLogs(lines: string[], headers: string[] | undefined, websiteId: string): NormalizedLog[] {
  const logs: NormalizedLog[] = []
  const dedupe = new Set<string>()

  for (const line of lines) {
    const entry = logParser.parseLogLine(line, headers)
    if (!entry) continue

    const key = [
      websiteId,
      entry.timestamp.toISOString(),
      entry.method,
      entry.path,
      entry.status,
      entry.bytes,
      entry.userAgent
    ].join('|')

    if (dedupe.has(key)) continue
    dedupe.add(key)

    const bytesTransferred = Number.isFinite(entry.bytes) ? Number(entry.bytes) : 0
    const responseMsRaw = Number.isFinite(entry.responseTime)
      ? Number(entry.responseTime)
      : 0
    const responseTimeMs = Math.max(0, Math.round(responseMsRaw))

    logs.push({
      timestamp: entry.timestamp,
      user_agent: entry.userAgent,
      ip_address: entry.ip || undefined,
      method: entry.method || undefined,
      path: entry.path || undefined,
      status_code: entry.status || undefined,
      bytes_transferred: bytesTransferred,
      response_time_ms: responseTimeMs,
      is_bot: false,
      bot_name: null,
      bot_category: null
    })
  }

  return logs
}

function mapDetectionsToRows(detections: DetectionResult[], websiteId: string) {
  const allowedCategories = new Set([
    'ai_training',
    'ai_scraper',
    'search_engine',
    'malicious',
    'beneficial',
    'extractive'
  ])

  return detections.map(detection => {
    const behaviorSessionId = detection.analysis?.behavior?.sessionId
    const sessionId = behaviorSessionId ||
      `${websiteId}_${detection.ip}_${detection.timeRange.start.getTime()}_${detection.timeRange.end.getTime()}`

    const primaryCategory = detection.classification.subcategory || detection.classification.category
    const category = allowedCategories.has(primaryCategory)
      ? primaryCategory
      : detection.classification.category === 'malicious'
        ? 'malicious'
        : detection.classification.category === 'beneficial'
          ? 'beneficial'
          : detection.classification.category === 'extractive'
            ? 'extractive'
            : 'extractive'

    return {
      website_id: websiteId,
      session_id: sessionId,
      bot_name: detection.classification.botName,
      user_agent: detection.userAgent,
      ip_address: detection.ip === 'unknown' ? null : detection.ip,
      category,
      subcategory: detection.classification.subcategory || detection.classification.category,
      confidence: detection.classification.confidence,
      impact: detection.classification.impact,
      verified: detection.classification.verified,
      request_count: detection.requestCount,
      bandwidth_bytes: Math.round(detection.bandwidth),
      detection_method: {
        velocity: detection.analysis.velocity,
        pattern: detection.analysis.pattern,
        behavior: detection.analysis.behavior
      },
      analysis_metadata: {
        timeRange: {
          start: detection.timeRange.start.toISOString(),
          end: detection.timeRange.end.toISOString()
        }
      },
      first_seen_at: detection.timeRange.start.toISOString(),
      last_seen_at: detection.timeRange.end.toISOString(),
      time_range_start: detection.timeRange.start.toISOString(),
      time_range_end: detection.timeRange.end.toISOString()
    }
  })
}

function mapCostAnalysis(
  costAnalysis: CostImpactAnalysis,
  botAnalysis: BotAnalysis,
  provider: string,
  websiteId: string,
  processingStats: ProcessingStats | null
) {
  const today = new Date().toISOString().split('T')[0]

  const costByBot: Record<string, number> = {}
  const costByCategory: Record<string, number> = {}

  for (const bot of costAnalysis.byBot || []) {
    const botKey = bot.botName || 'Unknown Bot'
    costByBot[botKey] = (costByBot[botKey] || 0) + bot.cost.current

    const categoryKey = bot.category
    costByCategory[categoryKey] = (costByCategory[categoryKey] || 0) + bot.cost.current
  }

  const bandwidthGB = costAnalysis.summary.totalBandwidth / (1024 ** 3)

  return {
    website_id: websiteId,
    analysis_date: today,
    hosting_provider: provider,
    region: 'global',
    price_per_gb: null,
    total_cost_usd: costAnalysis.summary.totalCost,
    bot_cost_usd: costAnalysis.summary.totalCost,
    human_cost_usd: 0,
    total_bandwidth_gb: bandwidthGB,
    bot_bandwidth_gb: bandwidthGB,
    human_bandwidth_gb: 0,
    total_requests: botAnalysis.summary.totalRequests,
    bot_requests: botAnalysis.summary.botRequests,
    human_requests: botAnalysis.summary.humanRequests,
    projected_monthly_cost: costAnalysis.summary.totalMonthlyCost,
    projected_yearly_cost: costAnalysis.summary.totalYearlyCost,
    cost_by_category: costByCategory,
    cost_by_bot: costByBot,
    processing_time_ms: processingStats?.processingTime ?? null,
    logs_processed: processingStats?.totalLogs ?? null,
    updated_at: new Date().toISOString()
  }
}

function extractDomainFromLogs(lines: string[], headers?: string[]): string | null {
  // Try to extract domain from common log formats
  for (const line of lines.slice(0, 100)) { // Check first 100 lines
    try {
      // For CSV logs with headers
      if (headers) {
        const values = line.split(',')
        const hostIndex = headers.findIndex(h =>
          h.toLowerCase().includes('host') ||
          h.toLowerCase().includes('domain')
        )
        if (hostIndex >= 0 && values[hostIndex]) {
          const host = values[hostIndex].replace(/"/g, '').trim()
          if (host && host !== '-' && host.includes('.')) {
            return host
          }
        }
      }

      // For JSON logs
      if (line.trim().startsWith('{')) {
        const parsed = JSON.parse(line)
        const host = parsed.host || parsed.http_host || parsed.server_name || parsed.domain
        if (host && host !== '-' && host.includes('.')) {
          return host
        }
      }

      // For common log format - extract from URL or host header
      const hostMatch = line.match(/Host:\s*([^\s]+)/i)
      if (hostMatch && hostMatch[1].includes('.')) {
        return hostMatch[1]
      }

      // Extract from URL in log line
      const urlMatch = line.match(/https?:\/\/([^\/\s]+)/)
      if (urlMatch && urlMatch[1].includes('.')) {
        return urlMatch[1]
      }
    } catch {
      // Skip invalid lines
      continue
    }
  }

  return null
}

function generateUUIDFromString(str: string): string {
  // Generate a deterministic UUID v5-style from string
  const hash = createHash('sha256').update(str).digest('hex')

  // Format as UUID v4
  return [
    hash.substring(0, 8),
    hash.substring(8, 12),
    '4' + hash.substring(13, 16), // Version 4
    ((parseInt(hash.substring(16, 17), 16) & 0x3) | 0x8).toString(16) + hash.substring(17, 20), // Variant bits
    hash.substring(20, 32)
  ].join('-')
}
