// Streaming Pipeline for Processing 24-48 Hour Log Chunks
// Efficiently processes large volumes of logs with memory management

import { NormalizedLog } from '@/lib/integrations/base'
import { DetectionLogEntry, BotAnalysis, DetectionResult } from './types'
import { logNormalizer } from './normalizer'
import { botClassifier } from './classifier'

interface ProcessingConfig {
  chunkSize: number
  maxConcurrentChunks: number
  timeWindowHours: number
  maxMemoryMB: number
  enableProgress: boolean
}

interface ProcessingProgress {
  processed: number
  total: number
  currentChunk: number
  totalChunks: number
  startTime: Date
  estimatedCompletion?: Date
  memoryUsage: number
}

interface ProcessingResult {
  analysis: BotAnalysis
  processingTime: number
  chunksProcessed: number
  totalLogs: number
  memoryPeak: number
  logs: DetectionLogEntry[]
}

export class DetectionPipeline {
  private config: ProcessingConfig
  private progressCallback?: (progress: ProcessingProgress) => void

  constructor(config?: Partial<ProcessingConfig>) {
    this.config = {
      chunkSize: 5000,           // Process 5K logs at a time
      maxConcurrentChunks: 3,    // Max 3 chunks in memory
      timeWindowHours: 48,       // Default to 48-hour window
      maxMemoryMB: 512,          // Memory limit
      enableProgress: true,
      ...config
    }
  }

  /**
   * Process logs from the last 24-48 hours
   */
  async processRecentLogs(
    logs: NormalizedLog[],
    websiteId: string,
    onProgress?: (progress: ProcessingProgress) => void
  ): Promise<ProcessingResult> {
    const startTime = new Date()
    this.progressCallback = onProgress

    // Filter to recent time window
    const recentLogs = this.filterRecentLogs(logs)

    if (recentLogs.length === 0) {
      return this.createEmptyResult(startTime)
    }

    // Process in streaming chunks
    const result = await this.processLogsStreaming(recentLogs, websiteId, startTime)

    return result
  }

  /**
   * Filter logs to recent time window (24-48 hours)
   */
  private filterRecentLogs(logs: NormalizedLog[]): NormalizedLog[] {
    const cutoffTime = new Date()
    cutoffTime.setHours(cutoffTime.getHours() - this.config.timeWindowHours)

    return logs.filter(log => log.timestamp >= cutoffTime)
  }

  /**
   * Process logs using streaming approach with memory management
   */
  private async processLogsStreaming(
    logs: NormalizedLog[],
    websiteId: string,
    startTime: Date
  ): Promise<ProcessingResult> {
    const totalLogs = logs.length
    const totalChunks = Math.ceil(totalLogs / this.config.chunkSize)
    let processed = 0
    let currentChunk = 0
    let memoryPeak = 0

    // Accumulated results
    const allDetectionEntries: DetectionLogEntry[] = []
    const processingSemaphore = new Semaphore(this.config.maxConcurrentChunks)

    // Process chunks
    const chunkPromises: Promise<DetectionLogEntry[]>[] = []

    for (let i = 0; i < totalLogs; i += this.config.chunkSize) {
      const chunk = logs.slice(i, i + this.config.chunkSize)
      currentChunk++

      const chunkPromise = processingSemaphore.acquire().then(async (release) => {
        try {
          // Check memory usage
          const memoryUsage = this.getMemoryUsage()
          memoryPeak = Math.max(memoryPeak, memoryUsage)

          if (memoryUsage > this.config.maxMemoryMB) {
            // Force garbage collection if available
            if (global.gc) {
              global.gc()
            }

            // Wait a bit for memory to be freed
            await new Promise(resolve => setTimeout(resolve, 100))
          }

          // Process chunk
          const normalizedChunk = await logNormalizer.normalizeBatch(chunk, websiteId, 1000)

          processed += chunk.length

          // Update progress
          if (this.progressCallback && this.config.enableProgress) {
            this.updateProgress({
              processed,
              total: totalLogs,
              currentChunk,
              totalChunks,
              startTime,
              memoryUsage: this.getMemoryUsage()
            })
          }

          return normalizedChunk
        } finally {
          release()
        }
      })

      chunkPromises.push(chunkPromise)

      // Process in batches to avoid memory overload
      if (chunkPromises.length >= this.config.maxConcurrentChunks) {
        const batchResults = await Promise.all(chunkPromises.splice(0, this.config.maxConcurrentChunks))
        for (const result of batchResults) {
          allDetectionEntries.push(...result)
        }
      }
    }

    // Process remaining chunks
    if (chunkPromises.length > 0) {
      const remainingResults = await Promise.all(chunkPromises)
      for (const result of remainingResults) {
        allDetectionEntries.push(...result)
      }
    }

    // Run final classification on all normalized entries
    const analysis = await botClassifier.classify(allDetectionEntries)
    const annotatedLogs = this.annotateLogs(allDetectionEntries, analysis.bots)

    const processingTime = Date.now() - startTime.getTime()

    return {
      analysis,
      processingTime,
      chunksProcessed: totalChunks,
      totalLogs,
      memoryPeak,
      logs: annotatedLogs
    }
  }

  /**
   * Merge bot classification results back into normalized logs
   */
  private annotateLogs(
    logs: DetectionLogEntry[],
    detections: DetectionResult[]
  ): DetectionLogEntry[] {
    if (logs.length === 0 || detections.length === 0) {
      return logs
    }

    const sessionMap = new Map<string, DetectionResult>()

    for (const detection of detections) {
      const sessionId = detection.analysis?.behavior?.sessionId
      if (sessionId) {
        sessionMap.set(sessionId, detection)
      }
    }

    return logs.map(log => {
      const sessionId = log.sessionId
      if (!sessionId) {
        return log
      }

      const detection = sessionMap.get(sessionId)
      if (!detection) {
        return log
      }

      return {
        ...log,
        is_bot: true,
        bot_name: detection.classification.botName,
        bot_category:
          detection.classification.subcategory || detection.classification.category
      }
    })
  }

  /**
   * Update progress with estimated completion time
   */
  private updateProgress(progress: Omit<ProcessingProgress, 'estimatedCompletion'>): void {
    const elapsed = Date.now() - progress.startTime.getTime()
    const rate = progress.processed / elapsed // logs per ms
    const remaining = progress.total - progress.processed
    const estimatedRemaining = remaining / rate

    const estimatedCompletion = new Date(Date.now() + estimatedRemaining)

    if (this.progressCallback) {
      this.progressCallback({
        ...progress,
        estimatedCompletion
      })
    }
  }

  /**
   * Get current memory usage in MB
   */
  private getMemoryUsage(): number {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const usage = process.memoryUsage()
      return Math.round(usage.heapUsed / 1024 / 1024)
    }
    return 0 // Fallback for browser environments
  }

  /**
   * Create empty result for edge cases
   */
  private createEmptyResult(startTime: Date): ProcessingResult {
    return {
      analysis: {
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
      },
      processingTime: Date.now() - startTime.getTime(),
      chunksProcessed: 0,
      totalLogs: 0,
      memoryPeak: this.getMemoryUsage()
    }
  }

  /**
   * Process logs from a specific time range
   */
  async processTimeRange(
    logs: NormalizedLog[],
    websiteId: string,
    startTime: Date,
    endTime: Date,
    onProgress?: (progress: ProcessingProgress) => void
  ): Promise<ProcessingResult> {
    const filteredLogs = logs.filter(log => {
      const logTime = log.timestamp.getTime()
      return logTime >= startTime.getTime() && logTime <= endTime.getTime()
    })

    return this.processRecentLogs(filteredLogs, websiteId, onProgress)
  }

  /**
   * Process logs with custom configuration
   */
  async processWithConfig(
    logs: NormalizedLog[],
    websiteId: string,
    config: Partial<ProcessingConfig>,
    onProgress?: (progress: ProcessingProgress) => void
  ): Promise<ProcessingResult> {
    const originalConfig = { ...this.config }
    this.config = { ...this.config, ...config }

    try {
      return await this.processRecentLogs(logs, websiteId, onProgress)
    } finally {
      this.config = originalConfig
    }
  }

  /**
   * Update pipeline configuration
   */
  updateConfig(config: Partial<ProcessingConfig>): void {
    this.config = { ...this.config, ...config }
  }

  /**
   * Get current configuration
   */
  getConfig(): ProcessingConfig {
    return { ...this.config }
  }
}

/**
 * Semaphore for controlling concurrent operations
 */
class Semaphore {
  private permits: number
  private waitQueue: (() => void)[] = []

  constructor(permits: number) {
    this.permits = permits
  }

  async acquire(): Promise<() => void> {
    return new Promise((resolve) => {
      if (this.permits > 0) {
        this.permits--
        resolve(this.createReleaseFunction())
      } else {
        this.waitQueue.push(() => {
          this.permits--
          resolve(this.createReleaseFunction())
        })
      }
    })
  }

  private createReleaseFunction(): () => void {
    return () => {
      this.permits++
      if (this.waitQueue.length > 0) {
        const next = this.waitQueue.shift()!
        next()
      }
    }
  }
}

/**
 * Utility class for processing log files from various sources
 */
export class LogFileProcessor {
  /**
   * Process log file from file system
   */
  static async processFile(
    filePath: string,
    websiteId: string,
    pipeline: DetectionPipeline
  ): Promise<ProcessingResult> {
    // This would read and parse the file in chunks
    // Implementation depends on the environment (Node.js vs browser)
    throw new Error('File processing not implemented - depends on runtime environment')
  }

  /**
   * Process logs from URL (webhook data, API endpoints)
   */
  static async processFromURL(
    url: string,
    websiteId: string,
    pipeline: DetectionPipeline,
    headers?: Record<string, string>
  ): Promise<ProcessingResult> {
    // This would fetch data from URL and process
    throw new Error('URL processing not implemented')
  }

  /**
   * Process logs from stream
   */
  static async processStream(
    stream: ReadableStream<string>,
    websiteId: string,
    pipeline: DetectionPipeline,
    format: 'json' | 'apache' | 'nginx' = 'json'
  ): Promise<ProcessingResult> {
    const logs: NormalizedLog[] = []
    const reader = stream.getReader()

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        // Parse log line based on format
        const parsedLog = this.parseLogLine(value, format)
        if (parsedLog) {
          logs.push(parsedLog)
        }
      }
    } finally {
      reader.releaseLock()
    }

    return pipeline.processRecentLogs(logs, websiteId)
  }

  /**
   * Parse a single log line based on format
   */
  private static parseLogLine(line: string, format: string): NormalizedLog | null {
    try {
      switch (format) {
        case 'json':
          const jsonLog = JSON.parse(line)
          return {
            timestamp: new Date(jsonLog.timestamp || Date.now()),
            ip_address: jsonLog.ip,
            user_agent: jsonLog.user_agent,
            method: jsonLog.method,
            path: jsonLog.path,
            status_code: jsonLog.status,
            bytes_transferred: jsonLog.bytes || 0,
            response_time_ms: jsonLog.response_time,
            is_bot: false
          }

        case 'apache':
        case 'nginx':
          // Use existing parser logic
          return null // Would implement Apache/Nginx parsing

        default:
          return null
      }
    } catch {
      return null
    }
  }
}

// Export singleton instance
export const detectionPipeline = new DetectionPipeline()
