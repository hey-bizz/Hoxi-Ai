import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

interface TrafficLogRow {
  id: string
  website_id: string
  timestamp: string
  user_agent: string | null
  bot_name: string | null
  is_bot: boolean
  bot_category: string | null
  bytes_transferred: number | null
  response_time_ms: number | null
  path: string | null
}

interface TrafficAnalysisRow {
  fingerprint: string
  website_id: string
  classification: string | null
  confidence: number | null
  signature_match: string | null
  velocity_rpm: number | null
  burst_score: number | null
  pattern_hits: any
  behavior_score: number | null
  source: string | null
}

interface BotBreakdownSummary {
  requests: number
  bandwidth: number
  bots: string[]
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  let websiteId = searchParams.get('websiteId')
  const websiteUrl = searchParams.get('websiteUrl')
  
  if (!websiteId && websiteUrl) {
    const { canonicalizeHost, uuidv5FromHost } = await import('@/lib/utils/website-id')
    websiteId = uuidv5FromHost(canonicalizeHost(websiteUrl))
  }
  
  const timeRange = (searchParams.get('timeRange') || '24h').toLowerCase()

  if (!websiteId) {
    return NextResponse.json({ error: 'Missing websiteId' }, { status: 400 })
  }

  // Validate UUID to avoid DB errors on invalid input
  const isValidUUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(websiteId)
  if (!isValidUUID) {
    return NextResponse.json({ error: 'Invalid websiteId (must be UUID)' }, { status: 400 })
  }

  // Calculate time filter
  const hoursMap: Record<string, number> = {
    '1h': 1,
    '24h': 24,
    '7d': 168,
    '30d': 720
  }
  const hours = hoursMap[timeRange] || 24
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()

  try {
    // Get traffic logs from Supabase
    const { data: trafficData, error: trafficError } = await supabaseAdmin
      .from('traffic_logs')
      .select('*')
      .eq('website_id', websiteId)
      .gte('timestamp', since)
      .order('timestamp', { ascending: false })

    if (trafficError) {
      console.error('Traffic logs query error:', trafficError)
      return NextResponse.json({ error: trafficError.message }, { status: 500 })
    }

    const trafficLogs = (trafficData ?? []) as TrafficLogRow[]

    // Calculate metrics from traffic logs
    const totalRequests = trafficLogs.length
    const botLogs = trafficLogs.filter(log => log.is_bot)
    const humanLogs = trafficLogs.filter(log => !log.is_bot)

    const botRequests = botLogs.length
    const humanRequests = humanLogs.length

    const botBytes = botLogs.reduce((sum, log) => sum + (log.bytes_transferred || 0), 0)
    const humanBytes = humanLogs.reduce((sum, log) => sum + (log.bytes_transferred || 0), 0)

    // Group by bot category
    const breakdownMap = new Map<string, { requests: number; bandwidth: number; bots: Set<string> }>()

    botLogs.forEach(log => {
      const category = log.bot_category || 'unknown'
      if (!breakdownMap.has(category)) {
        breakdownMap.set(category, {
          requests: 0,
          bandwidth: 0,
          bots: new Set<string>()
        })
      }
      const summary = breakdownMap.get(category)
      if (!summary) return

      summary.requests += 1
      summary.bandwidth += (log.bytes_transferred || 0)
      if (log.bot_name) {
        summary.bots.add(log.bot_name)
      }
    })

    const botBreakdown: Record<string, BotBreakdownSummary> = {}
    breakdownMap.forEach((value, key) => {
      botBreakdown[key] = {
        requests: value.requests,
        bandwidth: value.bandwidth,
        bots: Array.from(value.bots)
      }
    })

    // Calculate potential savings based on bandwidth
    const savingsPerGB = 0.15 // Average cost per GB
    const botGB = botBytes / (1024 ** 3)
    const monthlySavings = botGB * savingsPerGB * 30
    const potentialSavings: { total: number; monthly: number; yearly: number } = {
      total: monthlySavings,
      monthly: monthlySavings,
      yearly: monthlySavings * 12
    }

    // If no real data exists, return demo data for new users
    if (totalRequests === 0) {
      const demoMetrics = {
        totalRequests: 14523,
        botRequests: 6826,
        humanRequests: 7697,
        aiPercentage: '47.0',
        humanPercentage: '53.0',
        botBandwidth: 255599616000, // ~238 GB
        humanBandwidth: 189599616000, // ~177 GB
        potentialSavings: {
          total: 847,
          monthly: 847,
          yearly: 10164
        },
        botBreakdown: {
          'ai_training': {
            requests: 2843,
            bandwidth: 89599616000, // ~84 GB
            bots: ['GPTBot', 'ChatGPT-User', 'Bard']
          },
          'ai_scraper': {
            requests: 1654,
            bandwidth: 67599616000, // ~63 GB
            bots: ['ClaudeBot', 'Perplexity', 'AI-Assistant']
          },
          'search_engine': {
            requests: 1123,
            bandwidth: 45599616000, // ~43 GB
            bots: ['Googlebot', 'Bingbot', 'DuckDuckBot']
          },
          'social_media': {
            requests: 756,
            bandwidth: 24599616000, // ~23 GB
            bots: ['facebookexternalhit', 'TwitterBot', 'LinkedInBot']
          },
          'seo_tool': {
            requests: 450,
            bandwidth: 28200384000, // ~26 GB
            bots: ['AhrefsBot', 'SemrushBot', 'MozBot']
          }
        }
      }

      return NextResponse.json({
        metrics: demoMetrics,
        isDemo: true,
        logs: [] // No logs for demo
      })
    }

    return NextResponse.json({
      metrics: {
        totalRequests,
        botRequests,
        humanRequests,
        aiPercentage: totalRequests > 0 ? ((botRequests / totalRequests) * 100).toFixed(1) : '0',
        humanPercentage: totalRequests > 0 ? ((humanRequests / totalRequests) * 100).toFixed(1) : '100',
        botBandwidth: botBytes,
        humanBandwidth: humanBytes,
        potentialSavings,
        botBreakdown
      },
      logs: trafficLogs.slice(0, 100).map(log => ({
        detected_at: log.timestamp,
        bot_name: log.bot_name,
        category: log.bot_category,
        path: log.path,
        bandwidth_bytes: log.bytes_transferred || 0
      })) // Recent 100 for activity feed
    })
  } catch (error) {
    console.error('Error in analyze API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
