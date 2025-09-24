import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

interface BotDetectionRow {
  request_count: number
  bandwidth_bytes: number
  category: string | null
  bot_name: string | null
  detected_at: string
  impact?: string | null
  subcategory?: string | null
  confidence?: number
  detection_method?: Record<string, unknown> | null
}

interface CostAnalysisRow {
  bot_cost_usd: number
  projected_monthly_cost: number | null
  projected_yearly_cost: number | null
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
    // Get bot detection data from Supabase
    const { data: botDetectionData, error: botError } = await supabaseAdmin
      .from('bot_detections')
      .select('*')
      .eq('website_id', websiteId)
      .gte('detected_at', since)
      .order('detected_at', { ascending: false })

    if (botError) {
      console.error('Bot detections query error:', botError)
      return NextResponse.json({ error: botError.message }, { status: 500 })
    }

    const botDetections = (botDetectionData ?? []) as BotDetectionRow[]

    // Get cost analysis data from Supabase
    const { data: costAnalysisData, error: costError } = await supabaseAdmin
      .from('cost_analyses')
      .select('*')
      .eq('website_id', websiteId)
      .gte('analysis_date', new Date(since).toISOString().split('T')[0])
      .order('analysis_date', { ascending: false })

    if (costError) {
      console.error('Cost analyses query error:', costError)
      return NextResponse.json({ error: costError.message }, { status: 500 })
    }

    const costAnalyses = (costAnalysisData ?? []) as CostAnalysisRow[]

    // Calculate metrics from bot detections
    const totalRequests = botDetections.reduce((sum, detection) => sum + detection.request_count, 0)
    const botRequests = totalRequests // All detections are bot requests
    const humanRequests = 0 // For now, we're only tracking bot detections
    
    const botBytes = botDetections.reduce((sum, detection) => sum + detection.bandwidth_bytes, 0)
    const humanBytes = 0 // For now, we're only tracking bot detections

    // Group by bot category
    const breakdownMap = new Map<string, { requests: number; bandwidth: number; bots: Set<string> }>()

    botDetections.forEach(detection => {
      const category = detection.category || 'unknown'
      if (!breakdownMap.has(category)) {
        breakdownMap.set(category, {
          requests: 0,
          bandwidth: 0,
          bots: new Set<string>()
        })
      }
      const summary = breakdownMap.get(category)
      if (!summary) return

      summary.requests += detection.request_count
      summary.bandwidth += detection.bandwidth_bytes
      if (detection.bot_name) {
        summary.bots.add(detection.bot_name)
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

    // Get potential savings from cost analysis or calculate if not available
    let potentialSavings: { total: number; monthly: number; yearly: number } = {
      total: 0,
      monthly: 0,
      yearly: 0
    }
    
    if (costAnalyses.length > 0) {
      // Use existing cost analysis data
      const latestCost = costAnalyses[0]
      potentialSavings = {
        total: latestCost.bot_cost_usd,
        monthly: latestCost.projected_monthly_cost || latestCost.bot_cost_usd,
        yearly: latestCost.projected_yearly_cost || (latestCost.bot_cost_usd * 12)
      }
    } else {
      // Calculate potential savings based on bandwidth
      const savingsPerGB = 0.15 // Average cost
      const botGB = botBytes / (1024 ** 3)
      const monthlySavings = botGB * savingsPerGB * 30
      potentialSavings = {
        total: monthlySavings,
        monthly: monthlySavings,
        yearly: monthlySavings * 12
      }
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
      logs: botDetections.slice(0, 100) // Recent 100 for activity feed
    })
  } catch (error) {
    console.error('Error in analyze API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
