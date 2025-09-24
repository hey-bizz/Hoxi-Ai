import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { LogParser } from '@/lib/log-parser'
import { costCalculator } from '@/lib/cost-calculator'
import { CoreDetectionEngine } from '@/lib/core-detection'
import { applyBotDetection } from '@/lib/integrations/normalizers/common'
import type { NormalizedLog } from '@/lib/integrations/base'

const logParser = new LogParser()
const detectionEngine = new CoreDetectionEngine()

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const files = formData.getAll('files') as File[]
    const dryRun = (formData.get('dryRun') as string)?.toString() !== 'false' // Default to true for test

    if (!files.length) {
      return NextResponse.json({ error: 'Missing files' }, { status: 400 })
    }

    // Auto-generate websiteId for test uploads
    const websiteId = `test-upload-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`

    const { lines, headers } = await readFiles(files)
    const parsedLogs = parseLogs(lines, headers, websiteId)

    if (parsedLogs.length === 0) {
      return NextResponse.json({
        success: true,
        stats: {
          totalEntries: 0,
          botRequests: 0,
          humanRequests: 0,
          totalBytes: 0,
          potentialSavings: 0
        },
        message: 'No valid log lines found'
      })
    }

    // Use Core Detection Engine
    console.log(`🔍 Processing ${parsedLogs.length} logs with Core Detection Engine`)
    const detectionResult = await detectionEngine.analyze(parsedLogs, websiteId, {
      provider: 'upload',
      includesCosts: true,
      skipTimeFilter: true
    })


    const normalizedEntries = detectionResult.normalizedLogs || []
    console.log(`✅ Core Detection completed in ${detectionResult.processingStats.processingTime}ms`)

    // Calculate statistics
    const botEntries = normalizedEntries.filter(entry => entry.is_bot)
    const totalBotBytes = botEntries.reduce((sum, entry) => sum + (entry.bytes_transferred || 0), 0)

    const stats = {
      totalEntries: normalizedEntries.length,
      botRequests: botEntries.length,
      humanRequests: normalizedEntries.length - botEntries.length,
      totalBytes: normalizedEntries.reduce((sum, entry) => sum + (entry.bytes_transferred || 0), 0),
      potentialSavings: costCalculator.calculateBandwidthCost(totalBotBytes, 'upload').monthly,
      domain: extractDomainFromLogs(lines, headers) || 'uploaded-logs.local'
    }

    return NextResponse.json({
      success: true,
      stats,
      processing: detectionResult.processingStats,
      message: `Processed ${normalizedEntries.length} log entries (test mode, no database writes)`
    })
  } catch (error) {
    console.error('Error processing test upload:', error)
    return NextResponse.json(
      { error: 'Failed to process logs' },
      { status: 500 }
    )
  }
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