// Core Detection Engine - Main Entry Point
// Exports all detection engine components and provides unified interface

// Types
export * from './types'

// Core Analyzers
export { velocityAnalyzer, VelocityAnalyzer } from './velocity-analyzer'
export { patternAnalyzer, PatternAnalyzer } from './pattern-analyzer'
export { signatureMatcher, SignatureMatcher } from './signature-matcher'
export { behaviorAnalyzer, BehaviorAnalyzer } from './behavior-analyzer'

// Signature Management
export { signatureLoader, SignatureLoader } from './signature-loader'

// Main Classifier
export { botClassifier, BotClassifier } from './classifier'

// Pipeline and Processing
export { detectionPipeline, DetectionPipeline, LogFileProcessor } from './pipeline'
export { logNormalizer, LogNormalizer, LogParser } from './normalizer'

// Cost Integration
export { costIntegrator, CostIntegrator } from './cost-integration'

// Main Detection Engine Class - Simplified Interface
import { NormalizedLog } from '@/lib/integrations/base'
import { BotAnalysis, DetectionConfig, DetectionLogEntry, ProcessingProgress } from './types'
import { detectionPipeline } from './pipeline'
import { costIntegrator } from './cost-integration'

export class CoreDetectionEngine {
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
   * Main analysis method - processes logs and returns comprehensive analysis
   */
  async analyze(
    logs: NormalizedLog[],
    websiteId: string,
    options?: {
      provider?: string
      pricePerGB?: number
      includesCosts?: boolean
      onProgress?: (progress: ProcessingProgress) => void
    }
  ): Promise<{
    botAnalysis: BotAnalysis
    normalizedLogs: DetectionLogEntry[]
    costAnalysis?: any
    processingStats: {
      totalLogs: number
      processingTime: number
      memoryUsage: number
    }
  }> {
    const startTime = Date.now()
    const initialMemory = this.getMemoryUsage()

    // Process logs through detection pipeline
    const result = await detectionPipeline.processRecentLogs(
      logs,
      websiteId,
      options?.onProgress
    )

    const botAnalysis = result.analysis

    // Calculate cost analysis if requested
    let costAnalysis
    if (options?.includesCosts && options?.provider) {
      costAnalysis = costIntegrator.calculateCostImpact(
        botAnalysis,
        options.provider,
        options.pricePerGB
      )
    }

    return {
      botAnalysis,
      normalizedLogs: result.logs,
      costAnalysis,
      processingStats: {
        totalLogs: result.totalLogs,
        processingTime: result.processingTime,
        memoryUsage: Math.max(0, result.memoryPeak - initialMemory)
      }
    }
  }

  /**
   * Analyze specific time range
   */
  async analyzeTimeRange(
    logs: NormalizedLog[],
    websiteId: string,
    startTime: Date,
    endTime: Date,
    options?: {
      provider?: string
      pricePerGB?: number
      includesCosts?: boolean
      onProgress?: (progress: ProcessingProgress) => void
    }
  ) {
    const filteredLogs = logs.filter(log => {
      const logTime = log.timestamp.getTime()
      return logTime >= startTime.getTime() && logTime <= endTime.getTime()
    })

    return this.analyze(filteredLogs, websiteId, options)
  }

  /**
   * Get cost analysis only
   */
  calculateCosts(
    analysis: BotAnalysis,
    provider: string,
    pricePerGB?: number
  ) {
    return costIntegrator.calculateCostImpact(analysis, provider, pricePerGB)
  }

  /**
   * Get cost report
   */
  generateCostReport(
    analysis: BotAnalysis,
    provider: string,
    pricePerGB?: number
  ) {
    return costIntegrator.generateCostReport(analysis, provider, pricePerGB)
  }

  // Note: ROI calculation removed - detection engine only provides raw data

  /**
   * Update configuration
   */
  updateConfig(config: Partial<DetectionConfig>): void {
    this.config = { ...this.config, ...config }
    detectionPipeline.updateConfig({
      timeWindowHours: 48, // Keep default
      chunkSize: 5000,     // Keep default
      maxConcurrentChunks: 3, // Keep default
      maxMemoryMB: 512,    // Keep default
      enableProgress: true // Keep default
    })
  }

  /**
   * Get current configuration
   */
  getConfig(): DetectionConfig {
    return { ...this.config }
  }

  /**
   * Get system status and performance metrics
   */
  getSystemStatus(): {
    memoryUsage: number
    cacheSize: number
    config: DetectionConfig
  } {
    return {
      memoryUsage: this.getMemoryUsage(),
      cacheSize: 0, // Would track cache sizes
      config: this.config
    }
  }

  /**
   * Clear caches and reset state
   */
  reset(): void {
    // Clear any caches
    logNormalizer.clearCache()
    signatureMatcher.clearCache()
  }

  /**
   * Get memory usage
   */
  private getMemoryUsage(): number {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const usage = process.memoryUsage()
      return Math.round(usage.heapUsed / 1024 / 1024)
    }
    return 0
  }
}

// Export singleton instance
export const coreDetectionEngine = new CoreDetectionEngine()

// Utility functions for common use cases
export const DetectionUtils = {
  /**
   * Quick bot analysis for small datasets
   */
  async quickAnalysis(logs: NormalizedLog[], websiteId: string): Promise<BotAnalysis> {
    const result = await coreDetectionEngine.analyze(logs, websiteId)
    return result.botAnalysis
  },

  /**
   * Get top bot offenders by bandwidth
   */
  getTopOffenders(analysis: BotAnalysis, limit: number = 5) {
    return analysis.bots
      .sort((a, b) => b.bandwidth - a.bandwidth)
      .slice(0, limit)
  },

  /**
   * Get bot statistics summary
   */
  getStatsSummary(analysis: BotAnalysis) {
    const { summary, bots } = analysis
    const botPercentage = (summary.botRequests / summary.totalRequests) * 100
    const bandwidthPercentage = bots.reduce((sum, bot) => sum + bot.bandwidth, 0) / summary.totalBandwidth * 100

    return {
      totalRequests: summary.totalRequests,
      botRequests: summary.botRequests,
      botPercentage: Math.round(botPercentage * 100) / 100,
      bandwidthPercentage: Math.round(bandwidthPercentage * 100) / 100,
      uniqueBots: bots.length,
      timeSpan: summary.timeRange.end.getTime() - summary.timeRange.start.getTime()
    }
  },

  /**
   * Format bandwidth for display
   */
  formatBandwidth(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB', 'TB']
    let size = bytes
    let unitIndex = 0

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024
      unitIndex++
    }

    return `${Math.round(size * 100) / 100} ${units[unitIndex]}`
  }
}
