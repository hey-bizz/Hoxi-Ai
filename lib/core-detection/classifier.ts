// Core Detection Engine Classifier - Combines all analysis methods
// Provides unified bot classification with confidence scoring

import {
  DetectionLogEntry,
  BotAnalysis,
  DetectionResult,
  BotClassification,
  DetectionConfig
} from './types'
import { velocityAnalyzer } from './velocity-analyzer'
import { patternAnalyzer } from './pattern-analyzer'
import { signatureMatcher } from './signature-matcher'
import { behaviorAnalyzer } from './behavior-analyzer'

export class BotClassifier {
  private config: DetectionConfig

  constructor(config?: Partial<DetectionConfig>) {
    this.config = {
      velocityThresholds: {
        maxRequestsPerSecond: 5,
        maxRequestsPerMinute: 100,
        minIntervalMs: 50
      },
      sessionWindows: {
        maxGapMinutes: 30,
        maxDurationHours: 8
      },
      confidenceWeights: {
        velocity: 0.25,
        pattern: 0.25,
        signature: 0.35,
        behavior: 0.15
      },
      ...config
    }
  }

  /**
   * Main classification method - analyzes log entries and returns bot analysis
   */
  async classify(normalizedLogs: DetectionLogEntry[]): Promise<BotAnalysis> {
    if (normalizedLogs.length === 0) {
      return this.createEmptyAnalysis()
    }

    // Group by IP + UserAgent for session analysis
    const sessions = this.groupIntoSessions(normalizedLogs)

    // Process all sessions in parallel
    const results = await Promise.all(
      sessions.map(session => this.classifySession(session))
    )

    // Filter out non-bot results and aggregate
    const botResults = results.filter(r => r.classification.confidence > 0.3)

    return this.aggregateResults(botResults, normalizedLogs)
  }

  /**
   * Group logs into sessions by IP + User Agent
   */
  private groupIntoSessions(logs: DetectionLogEntry[]): DetectionLogEntry[][] {
    const sessionMap = new Map<string, DetectionLogEntry[]>()

    for (const log of logs) {
      const sessionKey = `${log.ip_address || 'unknown'}|${log.user_agent || 'unknown'}`

      if (!sessionMap.has(sessionKey)) {
        sessionMap.set(sessionKey, [])
      }
      sessionMap.get(sessionKey)!.push(log)
    }

    return Array.from(sessionMap.values())
  }

  /**
   * Classify a single session (group of logs from same IP + User Agent)
   */
  private async classifySession(sessionLogs: DetectionLogEntry[]): Promise<DetectionResult> {
    if (sessionLogs.length === 0) {
      throw new Error('Empty session logs')
    }

    const ip = sessionLogs[0].ip_address || 'unknown'
    const userAgent = sessionLogs[0].user_agent || 'unknown'

    // Run all analyzers in parallel
    const [velocityResults, patternResult, behaviorResults] = await Promise.all([
      Promise.resolve(velocityAnalyzer.analyzeVelocity(sessionLogs)),
      Promise.resolve(patternAnalyzer.analyzePattern(sessionLogs)),
      Promise.resolve(behaviorAnalyzer.analyzeBehavior(sessionLogs))
    ])

    // Get signature match for the first log entry (same user agent for all)
    const signatureResult = await signatureMatcher.matchSignature(sessionLogs[0])

    // Find velocity analysis for this IP
    const velocityAnalysis = velocityResults.find(v => v.ip === ip) || {
      ip,
      requestsPerSecond: 0,
      requestsPerMinute: 0,
      burstScore: 0,
      isBot: false,
      confidence: 0
    }

    // Get primary behavior analysis (first session for this IP+UA)
    const primaryBehavior = behaviorResults[0] || {
      sessionId: `${ip}_1_${Date.now()}`,
      sessionDuration: 0,
      pagesViewed: sessionLogs.length,
      avgTimePerPage: 0,
      assetsLoaded: false,
      hasReferer: false,
      humanScore: 0.5,
      patterns: {
        viewsHomepage: false,
        varyingResponseTimes: false,
        realisticSessionLength: false
      }
    }

    // Combine analysis results with weighted scoring
    const finalClassification = this.combineAnalysis({
      velocity: { weight: this.config.confidenceWeights.velocity, analysis: velocityAnalysis },
      pattern: { weight: this.config.confidenceWeights.pattern, analysis: patternResult },
      signature: { weight: this.config.confidenceWeights.signature, analysis: signatureResult },
      behavior: { weight: this.config.confidenceWeights.behavior, analysis: primaryBehavior }
    })

    // Calculate metrics
    const bandwidth = sessionLogs.reduce((sum, log) => sum + (log.bytes_transferred || 0), 0)
    const timeRange = {
      start: new Date(Math.min(...sessionLogs.map(l => l.timestamp.getTime()))),
      end: new Date(Math.max(...sessionLogs.map(l => l.timestamp.getTime())))
    }

    return {
      ip,
      userAgent,
      classification: finalClassification,
      requestCount: sessionLogs.length,
      bandwidth,
      timeRange,
      analysis: {
        velocity: velocityAnalysis,
        pattern: patternResult,
        behavior: primaryBehavior
      }
    }
  }

  /**
   * Combine analysis results using weighted scoring
   */
  private combineAnalysis(analyses: {
    velocity: { weight: number; analysis: any }
    pattern: { weight: number; analysis: any }
    signature: { weight: number; analysis: any }
    behavior: { weight: number; analysis: any }
  }): BotClassification {

    // Start with signature matching if available (highest priority)
    if (analyses.signature.analysis) {
      const sig = analyses.signature.analysis
      return {
        ...sig,
        // Adjust confidence based on other analyses
        confidence: this.adjustConfidenceWithOtherAnalyses(sig.confidence, analyses)
      }
    }

    // If no signature match, build classification from other analyses
    return this.buildClassificationFromAnalyses(analyses)
  }

  /**
   * Adjust signature confidence based on other analysis results
   */
  private adjustConfidenceWithOtherAnalyses(
    baseConfidence: number,
    analyses: any
  ): number {
    let confidence = baseConfidence

    // Velocity analysis confirmation
    if (analyses.velocity.analysis.isBot) {
      confidence += 0.1
    } else if (analyses.velocity.analysis.confidence > 0.7) {
      confidence -= 0.1 // Contradicts bot classification
    }

    // Pattern analysis confirmation
    if (analyses.pattern.analysis.confidence > 0.7) {
      confidence += 0.1
    }

    // Behavior analysis adjustment
    const humanScore = analyses.behavior.analysis.humanScore
    if (humanScore < 0.3) {
      confidence += 0.1 // Very bot-like behavior
    } else if (humanScore > 0.7) {
      confidence -= 0.15 // Very human-like behavior
    }

    return Math.max(0.1, Math.min(1.0, confidence))
  }

  /**
   * Build classification from analysis results when no signature match
   */
  private buildClassificationFromAnalyses(analyses: any): BotClassification {
    const velocity = analyses.velocity.analysis
    const pattern = analyses.pattern.analysis
    const behavior = analyses.behavior.analysis

    // Calculate weighted confidence
    let confidence = 0
    let weights = 0

    // Velocity contribution
    if (velocity.isBot) {
      confidence += velocity.confidence * analyses.velocity.weight
      weights += analyses.velocity.weight
    }

    // Pattern contribution
    if (pattern.confidence > 0.5) {
      confidence += pattern.confidence * analyses.pattern.weight
      weights += analyses.pattern.weight
    }

    // Behavior contribution (inverse of human score)
    const botScore = 1 - behavior.humanScore
    if (botScore > 0.5) {
      confidence += botScore * analyses.behavior.weight
      weights += analyses.behavior.weight
    }

    // Normalize confidence
    const finalConfidence = weights > 0 ? confidence / weights : 0

    // Determine category based on patterns
    let category: BotClassification['category'] = 'unknown'
    let subcategory = 'unknown'

    if (pattern.type === 'systematic' && velocity.requestsPerSecond > 2) {
      category = 'extractive'
      subcategory = 'scraper'
    } else if (velocity.requestsPerSecond > 10) {
      category = 'malicious'
      subcategory = 'aggressive_scraper'
    } else if (pattern.type === 'sequential') {
      category = 'extractive'
      subcategory = 'crawler'
    }

    return {
      botName: this.generateBotName(velocity, pattern),
      category,
      subcategory,
      confidence: finalConfidence,
      verified: false,
      impact: this.determineImpact(velocity, pattern, finalConfidence),
      metadata: {
        operator: 'Unknown',
        purpose: this.determinePurpose(pattern, velocity),
        respectsRobotsTxt: false,
        averageCrawlRate: velocity.requestsPerMinute
      }
    }
  }

  /**
   * Generate bot name for unidentified bots
   */
  private generateBotName(velocity: any, pattern: any): string {
    if (velocity.requestsPerSecond > 10) {
      return 'Aggressive Bot'
    } else if (pattern.type === 'systematic') {
      return 'Systematic Crawler'
    } else if (pattern.type === 'sequential') {
      return 'Sequential Bot'
    } else {
      return 'Unknown Bot'
    }
  }

  /**
   * Determine impact level based on analysis
   */
  private determineImpact(velocity: any, pattern: any, confidence: number): BotClassification['impact'] {
    if (velocity.requestsPerSecond > 10 || velocity.requestsPerMinute > 500) {
      return 'extreme'
    } else if (velocity.requestsPerSecond > 5 || confidence > 0.8) {
      return 'high'
    } else if (pattern.confidence > 0.7) {
      return 'medium'
    } else {
      return 'low'
    }
  }

  /**
   * Determine purpose based on patterns
   */
  private determinePurpose(pattern: any, velocity: any): string {
    if (pattern.type === 'systematic' && pattern.indicators.sitemapAccess) {
      return 'Search Engine Crawling'
    } else if (pattern.type === 'sequential') {
      return 'Content Extraction'
    } else if (velocity.requestsPerSecond > 5) {
      return 'Mass Data Collection'
    } else {
      return 'Unknown'
    }
  }

  /**
   * Aggregate results into final analysis
   */
  private aggregateResults(
    results: DetectionResult[],
    allLogs: DetectionLogEntry[]
  ): BotAnalysis {
    const totalRequests = allLogs.length
    const botRequests = results.reduce((sum, r) => sum + r.requestCount, 0)
    const humanRequests = totalRequests - botRequests
    const totalBandwidth = allLogs.reduce((sum, log) => sum + (log.bytes_transferred || 0), 0)

    const timeRange = {
      start: new Date(Math.min(...allLogs.map(l => l.timestamp.getTime()))),
      end: new Date(Math.max(...allLogs.map(l => l.timestamp.getTime())))
    }

    // Group by category and impact
    const byCategory: Record<string, { requests: number; bandwidth: number }> = {}
    const byImpact: Record<string, { requests: number; bandwidth: number }> = {}

    for (const result of results) {
      const category = result.classification.subcategory || result.classification.category
      const impact = result.classification.impact

      // By category
      if (!byCategory[category]) byCategory[category] = { requests: 0, bandwidth: 0 }
      byCategory[category].requests += result.requestCount
      byCategory[category].bandwidth += result.bandwidth

      // By impact
      if (!byImpact[impact]) byImpact[impact] = { requests: 0, bandwidth: 0 }
      byImpact[impact].requests += result.requestCount
      byImpact[impact].bandwidth += result.bandwidth
    }

    // Top offenders by bandwidth
    const topOffenders = results
      .sort((a, b) => b.bandwidth - a.bandwidth)
      .slice(0, 10)

    return {
      summary: {
        totalRequests,
        botRequests,
        humanRequests,
        totalBandwidth,
        timeRange
      },
      bots: results,
      aggregations: {
        byCategory,
        byImpact,
        topOffenders
      }
    }
  }

  /**
   * Create empty analysis for edge cases
   */
  private createEmptyAnalysis(): BotAnalysis {
    return {
      summary: {
        totalRequests: 0,
        botRequests: 0,
        humanRequests: 0,
        totalBandwidth: 0,
        timeRange: { start: new Date(), end: new Date() }
      },
      bots: [],
      aggregations: {
        byCategory: {},
        byImpact: {},
        topOffenders: []
      }
    }
  }

  /**
   * Update classifier configuration
   */
  updateConfig(config: Partial<DetectionConfig>): void {
    this.config = { ...this.config, ...config }

    // Update individual analyzer configs
    if (config.velocityThresholds) {
      velocityAnalyzer.updateConfig(config.velocityThresholds)
    }
    if (config.sessionWindows) {
      behaviorAnalyzer.updateConfig(config.sessionWindows)
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): DetectionConfig {
    return { ...this.config }
  }
}

// Export singleton instance
export const botClassifier = new BotClassifier()