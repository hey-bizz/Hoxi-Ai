// Velocity Analysis Engine - Detects automated request patterns
// Analyzes request timing, frequency, and burst patterns

import { DetectionLogEntry, VelocityAnalysis, DetectionConfig } from './types'

export class VelocityAnalyzer {
  private config: DetectionConfig['velocityThresholds']

  constructor(config?: Partial<DetectionConfig['velocityThresholds']>) {
    this.config = {
      maxRequestsPerSecond: 5,      // Human-like threshold
      maxRequestsPerMinute: 100,    // Aggressive bot threshold
      minIntervalMs: 50,            // Minimum time between requests
      ...config
    }
  }

  /**
   * Analyze request velocity patterns for a group of log entries
   */
  analyzeVelocity(entries: DetectionLogEntry[]): VelocityAnalysis[] {
    if (entries.length === 0) return []

    // Group by IP address
    const ipGroups = this.groupByIP(entries)

    return Object.entries(ipGroups).map(([ip, requests]) =>
      this.analyzeIPVelocity(ip, requests)
    )
  }

  /**
   * Analyze velocity patterns for a single IP
   */
  private analyzeIPVelocity(ip: string, requests: DetectionLogEntry[]): VelocityAnalysis {
    if (requests.length === 0) {
      return {
        ip,
        requestsPerSecond: 0,
        requestsPerMinute: 0,
        burstScore: 0,
        isBot: false,
        confidence: 1.0
      }
    }

    // Sort by timestamp
    const sorted = requests.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())

    // Calculate time spans and intervals
    const timeSpan = this.getTimeSpanSeconds(sorted)
    const intervals = this.calculateIntervals(sorted)

    // Calculate metrics
    const requestsPerSecond = timeSpan > 0 ? sorted.length / timeSpan : 0
    const requestsPerMinute = requestsPerSecond * 60

    // Analyze burst patterns
    const burstScore = this.calculateBurstScore(intervals)

    // Determine if this is bot-like behavior
    const isBot = this.isBotLikeVelocity(requestsPerSecond, requestsPerMinute, intervals, burstScore)

    // Calculate confidence based on data quality and patterns
    const confidence = this.calculateConfidence(sorted.length, timeSpan, intervals)

    return {
      ip,
      requestsPerSecond,
      requestsPerMinute,
      burstScore,
      isBot,
      confidence
    }
  }

  /**
   * Group log entries by IP address
   */
  private groupByIP(entries: DetectionLogEntry[]): Record<string, DetectionLogEntry[]> {
    const groups: Record<string, DetectionLogEntry[]> = {}

    for (const entry of entries) {
      const ip = entry.ip_address || 'unknown'
      if (!groups[ip]) groups[ip] = []
      groups[ip].push(entry)
    }

    return groups
  }

  /**
   * Calculate time span in seconds between first and last request
   */
  private getTimeSpanSeconds(sortedRequests: DetectionLogEntry[]): number {
    if (sortedRequests.length < 2) return 0

    const first = sortedRequests[0].timestamp.getTime()
    const last = sortedRequests[sortedRequests.length - 1].timestamp.getTime()

    return (last - first) / 1000 // Convert to seconds
  }

  /**
   * Calculate intervals between consecutive requests in milliseconds
   */
  private calculateIntervals(sortedRequests: DetectionLogEntry[]): number[] {
    const intervals: number[] = []

    for (let i = 1; i < sortedRequests.length; i++) {
      const interval = sortedRequests[i].timestamp.getTime() - sortedRequests[i - 1].timestamp.getTime()
      intervals.push(interval)
    }

    return intervals
  }

  /**
   * Calculate burst score based on interval patterns
   * Higher score = more likely to be automated bursts
   */
  private calculateBurstScore(intervals: number[]): number {
    if (intervals.length === 0) return 0

    // Calculate statistical measures
    const mean = this.calculateMean(intervals)
    const stdDev = this.calculateStandardDeviation(intervals, mean)
    const coefficient = stdDev / mean || 0

    // Detect very consistent timing (low coefficient of variation)
    const consistencyScore = Math.max(0, 1 - coefficient * 2)

    // Detect very fast intervals
    const fastIntervals = intervals.filter(i => i < this.config.minIntervalMs).length
    const speedScore = fastIntervals / intervals.length

    // Detect burst patterns (groups of rapid requests)
    const burstPatternScore = this.detectBurstPatterns(intervals)

    // Combine scores (weighted average)
    return Math.min(1, (consistencyScore * 0.4) + (speedScore * 0.4) + (burstPatternScore * 0.2))
  }

  /**
   * Detect burst patterns in request intervals
   */
  private detectBurstPatterns(intervals: number[]): number {
    if (intervals.length < 5) return 0

    let burstCount = 0
    let currentBurstLength = 0
    const burstThreshold = 1000 // 1 second

    for (const interval of intervals) {
      if (interval < burstThreshold) {
        currentBurstLength++
      } else {
        if (currentBurstLength >= 3) {
          burstCount++
        }
        currentBurstLength = 0
      }
    }

    // Final burst check
    if (currentBurstLength >= 3) {
      burstCount++
    }

    return Math.min(1, burstCount / Math.ceil(intervals.length / 10))
  }

  /**
   * Determine if velocity patterns indicate bot behavior
   */
  private isBotLikeVelocity(
    reqPerSec: number,
    reqPerMin: number,
    intervals: number[],
    burstScore: number
  ): boolean {
    // High request rate
    if (reqPerSec > this.config.maxRequestsPerSecond) return true
    if (reqPerMin > this.config.maxRequestsPerMinute) return true

    // Very consistent timing (likely automated)
    if (burstScore > 0.8) return true

    // Very fast intervals consistently
    const fastIntervals = intervals.filter(i => i < this.config.minIntervalMs)
    if (fastIntervals.length > intervals.length * 0.5) return true

    // Many identical intervals (exact timing)
    const intervalCounts = new Map<number, number>()
    for (const interval of intervals) {
      const rounded = Math.round(interval / 100) * 100 // Round to 100ms
      intervalCounts.set(rounded, (intervalCounts.get(rounded) || 0) + 1)
    }

    const maxCount = Math.max(...intervalCounts.values())
    if (maxCount > intervals.length * 0.7) return true

    return false
  }

  /**
   * Calculate confidence based on data quality and sample size
   */
  private calculateConfidence(sampleSize: number, timeSpan: number, intervals: number[]): number {
    let confidence = 0.5 // Base confidence

    // More samples = higher confidence
    if (sampleSize >= 10) confidence += 0.2
    if (sampleSize >= 50) confidence += 0.1
    if (sampleSize >= 100) confidence += 0.1

    // Longer observation period = higher confidence
    if (timeSpan >= 60) confidence += 0.1    // 1 minute
    if (timeSpan >= 300) confidence += 0.1   // 5 minutes

    // Consistent patterns = higher confidence
    if (intervals.length > 5) {
      const stdDev = this.calculateStandardDeviation(intervals)
      const mean = this.calculateMean(intervals)
      const coefficient = stdDev / mean || 0

      if (coefficient < 0.1) confidence += 0.1 // Very consistent
      if (coefficient < 0.2) confidence += 0.05 // Moderately consistent
    }

    return Math.min(1.0, confidence)
  }

  /**
   * Calculate mean of an array of numbers
   */
  private calculateMean(values: number[]): number {
    if (values.length === 0) return 0
    return values.reduce((sum, val) => sum + val, 0) / values.length
  }

  /**
   * Calculate standard deviation
   */
  private calculateStandardDeviation(values: number[], mean?: number): number {
    if (values.length === 0) return 0

    const avg = mean ?? this.calculateMean(values)
    const squaredDiffs = values.map(val => Math.pow(val - avg, 2))
    const variance = this.calculateMean(squaredDiffs)

    return Math.sqrt(variance)
  }

  /**
   * Get velocity analysis for a specific IP
   */
  analyzeIP(ip: string, entries: DetectionLogEntry[]): VelocityAnalysis {
    const ipEntries = entries.filter(e => e.ip_address === ip)
    return this.analyzeIPVelocity(ip, ipEntries)
  }

  /**
   * Update configuration thresholds
   */
  updateConfig(config: Partial<DetectionConfig['velocityThresholds']>): void {
    this.config = { ...this.config, ...config }
  }
}

// Export singleton instance
export const velocityAnalyzer = new VelocityAnalyzer()