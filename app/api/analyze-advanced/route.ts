// Advanced Analysis API - Uses Core Detection Engine instead of LLM
// Replaces expensive LLM-based analysis with algorithmic detection

import { NextRequest, NextResponse } from 'next/server'
import { NormalizedLog } from '@/lib/integrations/base'
import { coreDetectionEngine } from '@/lib/core-detection'
import { BotAnalysis, CostImpactAnalysis } from '@/lib/core-detection/types'

export const maxDuration = 300 // 5 minutes for large datasets

interface AnalysisRequest {
  logs: NormalizedLog[]
  websiteId: string
  provider?: string
  pricePerGB?: number
  timeRange?: {
    start: string
    end: string
  }
  config?: {
    includesCosts?: boolean
    detailedAnalysis?: boolean
    chunkSize?: number
  }
}

interface AnalysisResponse {
  success: boolean
  data?: {
    analysis: BotAnalysis
    costAnalysis?: CostImpactAnalysis
    summary: {
      totalRequests: number
      botRequests: number
      humanRequests: number
      botPercentage: number
      bandwidthUsed: string
      timeSpan: string
      processingTime: number
    }
    topOffenders?: TopOffender[]
  }
  error?: string
  processingStats?: {
    totalLogs: number
    processingTime: number
    memoryUsage: number
  }
}

type BotCategory = BotAnalysis['bots'][number]['classification']['category']
type BotImpact = BotAnalysis['bots'][number]['classification']['impact']

interface TopOffender {
  botName: string | null
  category: BotCategory
  impact: BotImpact
  requests: number
  bandwidth: string
  confidence: number
}

type AnalysisResult = Awaited<ReturnType<typeof coreDetectionEngine.analyze>>

export async function POST(request: NextRequest): Promise<NextResponse<AnalysisResponse>> {
  try {
    const body: AnalysisRequest = await request.json()

    // Validate required fields
    if (!body.logs || !Array.isArray(body.logs)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid or missing logs array'
      }, { status: 400 })
    }

    if (!body.websiteId) {
      return NextResponse.json({
        success: false,
        error: 'Missing websiteId'
      }, { status: 400 })
    }

    const {
      logs,
      websiteId,
      provider = 'generic',
      pricePerGB,
      timeRange,
      config = {}
    } = body

    // Convert string timestamps to Date objects
    const normalizedLogs: NormalizedLog[] = logs.map(log => ({
      ...log,
      timestamp: new Date(log.timestamp)
    }))

    let result: AnalysisResult

    if (timeRange) {
      const startTime = new Date(timeRange.start)
      const endTime = new Date(timeRange.end)

      result = await coreDetectionEngine.analyzeTimeRange(
        normalizedLogs,
        websiteId,
        startTime,
        endTime,
        {
          provider,
          pricePerGB,
          includesCosts: config.includesCosts ?? true
        }
      )
    } else {
      result = await coreDetectionEngine.analyze(
        normalizedLogs,
        websiteId,
        {
          provider,
          pricePerGB,
          includesCosts: config.includesCosts ?? true
        }
      )
    }

    const { botAnalysis, costAnalysis, processingStats } = result

    // Generate summary
    const summary = {
      totalRequests: botAnalysis.summary.totalRequests,
      botRequests: botAnalysis.summary.botRequests,
      humanRequests: botAnalysis.summary.humanRequests,
      botPercentage: Math.round((botAnalysis.summary.botRequests / botAnalysis.summary.totalRequests) * 100),
      bandwidthUsed: formatBandwidth(botAnalysis.summary.totalBandwidth),
      timeSpan: formatTimeSpan(botAnalysis.summary.timeRange),
      processingTime: processingStats.processingTime
    }

    // Get top offenders
    const topOffenders: TopOffender[] = botAnalysis.bots
      .sort((a, b) => b.bandwidth - a.bandwidth)
      .slice(0, 10)
      .map(bot => ({
        botName: bot.classification.botName,
        category: bot.classification.category,
        impact: bot.classification.impact,
        requests: bot.requestCount,
        bandwidth: formatBandwidth(bot.bandwidth),
        confidence: Math.round(bot.classification.confidence * 100)
      }))

    // Note: Recommendations removed - detection engine only provides raw data

    const response: AnalysisResponse = {
      success: true,
      data: {
        analysis: botAnalysis,
        costAnalysis,
        summary,
        topOffenders
      },
      processingStats
    }

    // Add cache headers for performance
    const responseHeaders = {
      'Cache-Control': 'public, max-age=300, s-maxage=300', // 5 minutes
      'Content-Type': 'application/json'
    }

    return NextResponse.json(response, { headers: responseHeaders })

  } catch (error) {
    console.error('Analysis error:', error)

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Analysis failed'
    }, { status: 500 })
  }
}

export async function GET(_request: NextRequest): Promise<NextResponse> {
  // Health check endpoint
  try {
    const status = coreDetectionEngine.getSystemStatus()

    return NextResponse.json({
      success: true,
      status: 'healthy',
      systemInfo: {
        memoryUsage: `${status.memoryUsage}MB`,
        cacheSize: status.cacheSize,
        version: '1.0.0'
      },
      config: status.config
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'System check failed'
    }, { status: 500 })
  }
}

// Utility functions
function formatBandwidth(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let size = bytes
  let unitIndex = 0

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }

  return `${Math.round(size * 100) / 100} ${units[unitIndex]}`
}

function formatTimeSpan(timeRange: { start: Date; end: Date }): string {
  const diff = timeRange.end.getTime() - timeRange.start.getTime()
  const hours = Math.round(diff / (1000 * 60 * 60))

  if (hours < 24) {
    return `${hours} hours`
  } else {
    const days = Math.round(hours / 24)
    return `${days} days`
  }
}
