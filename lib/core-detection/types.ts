// Core Detection Engine Types - Unified Interface
// Bridges the specification with existing codebase

import { NormalizedLog } from '@/lib/integrations/base'

// Extended log entry that includes detection engine fields
export interface DetectionLogEntry extends NormalizedLog {
  // Core fields (from existing NormalizedLog)
  timestamp: Date
  ip_address?: string
  user_agent?: string
  bot_name?: string | null
  is_bot: boolean
  bot_category?: string | null
  bytes_transferred: number
  response_time_ms?: number
  status_code?: number
  path?: string
  method?: string

  // Detection engine extensions
  fingerprint: string           // Unique request hash
  sessionId?: string           // Grouped by IP + UA + time window

  // Optional extended fields
  referer?: string
  host?: string
  protocol?: string
  country?: string
  tlsVersion?: string
  requestBytes?: number
}

// Analysis result interfaces
export interface VelocityAnalysis {
  ip: string
  requestsPerSecond: number
  requestsPerMinute: number
  burstScore: number        // 0-1, likelihood of automated bursts
  isBot: boolean
  confidence: number
}

export interface CrawlPattern {
  type: 'sequential' | 'systematic' | 'random' | 'targeted'
  confidence: number
  paths: string[]
  indicators: {
    sequentialScore: number
    systematicScore: number
    sitemapAccess: boolean
    depthConsistency: number
  }
}

export interface SessionBehavior {
  sessionId: string
  sessionDuration: number     // milliseconds
  pagesViewed: number
  avgTimePerPage: number
  assetsLoaded: boolean
  hasReferer: boolean
  humanScore: number          // 0-1, likelihood of human behavior
  patterns: {
    viewsHomepage: boolean
    varyingResponseTimes: boolean
    realisticSessionLength: boolean
  }
}

export interface BotClassification {
  botName: string | null
  category: 'beneficial' | 'extractive' | 'malicious' | 'unknown'
  subcategory?: string        // ai_training, search_engine, etc.
  confidence: number
  verified: boolean           // IP verification passed
  impact: 'low' | 'medium' | 'high' | 'extreme'
  metadata: {
    operator?: string
    purpose?: string
    respectsRobotsTxt?: boolean
    averageCrawlRate?: number
  }
}

export interface DetectionResult {
  ip: string
  userAgent: string
  classification: BotClassification
  requestCount: number
  bandwidth: number
  timeRange: {
    start: Date
    end: Date
  }
  analysis: {
    velocity: VelocityAnalysis
    pattern: CrawlPattern
    behavior: SessionBehavior
  }
}

export interface BotAnalysis {
  summary: {
    totalRequests: number
    botRequests: number
    humanRequests: number
    totalBandwidth: number
    timeRange: { start: Date; end: Date }
  }
  bots: DetectionResult[]
  aggregations: {
    byCategory: Record<string, { requests: number; bandwidth: number }>
    byImpact: Record<string, { requests: number; bandwidth: number }>
    topOffenders: DetectionResult[]
  }
}

// Configuration interfaces
export interface DetectionConfig {
  velocityThresholds: {
    maxRequestsPerSecond: number
    maxRequestsPerMinute: number
    minIntervalMs: number
  }
  sessionWindows: {
    maxGapMinutes: number
    maxDurationHours: number
  }
  confidenceWeights: {
    velocity: number
    pattern: number
    signature: number
    behavior: number
  }
}

// Cost analysis integration
export interface CostImpactAnalysis {
  byBot: Array<{
    botName: string
    category: string
    bandwidth: number
    requests: number
    cost: {
      current: number
      projected: { monthly: number; yearly: number }
    }
  }>
  summary: {
    totalCost: number
    totalMonthlyCost: number
    totalYearlyCost: number
    totalBandwidth: number
  }
}

// Enhanced bot signature for detection engine
export interface EnhancedBotSignature {
  name: string
  category: 'beneficial' | 'extractive' | 'malicious'
  subcategory: string
  patterns: RegExp[]
  ipRanges?: string[]         // CIDR notation
  impact: 'low' | 'medium' | 'high' | 'extreme'
  metadata: {
    operator: string
    purpose: string
    respectsRobotsTxt: boolean
    averageCrawlRate: number
    crawlPatterns?: string[]  // Known crawl patterns
  }
  verification?: {
    reverseDns?: RegExp[]     // Expected reverse DNS patterns
    headers?: Record<string, RegExp>  // Expected headers
  }
}