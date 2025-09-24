// Performance Optimizations - Caching and Parallel Processing
// Improves detection engine performance with intelligent caching

interface CacheEntry<T> {
  data: T
  timestamp: number
  accessCount: number
}

interface CacheStats {
  hits: number
  misses: number
  entries: number
  memoryUsage: number
}

export class PerformanceCache<T> {
  private cache = new Map<string, CacheEntry<T>>()
  private maxSize: number
  private ttlMs: number
  private stats: CacheStats = { hits: 0, misses: 0, entries: 0, memoryUsage: 0 }

  constructor(maxSize: number = 1000, ttlMs: number = 5 * 60 * 1000) {
    this.maxSize = maxSize
    this.ttlMs = ttlMs
  }

  get(key: string): T | null {
    const entry = this.cache.get(key)

    if (!entry) {
      this.stats.misses++
      return null
    }

    // Check if expired
    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.cache.delete(key)
      this.stats.misses++
      this.stats.entries--
      return null
    }

    entry.accessCount++
    this.stats.hits++
    return entry.data
  }

  set(key: string, data: T): void {
    // Evict if at capacity
    if (this.cache.size >= this.maxSize) {
      this.evictLRU()
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      accessCount: 1
    })

    this.stats.entries++
  }

  private evictLRU(): void {
    let oldestKey = ''
    let oldestTime = Date.now()
    let lowestAccess = Infinity

    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < oldestTime || entry.accessCount < lowestAccess) {
        oldestKey = key
        oldestTime = entry.timestamp
        lowestAccess = entry.accessCount
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey)
      this.stats.entries--
    }
  }

  clear(): void {
    this.cache.clear()
    this.stats = { hits: 0, misses: 0, entries: 0, memoryUsage: 0 }
  }

  getStats(): CacheStats {
    this.stats.memoryUsage = this.cache.size * 1024 // Rough estimate
    return { ...this.stats }
  }

  has(key: string): boolean {
    return this.cache.has(key) && Date.now() - this.cache.get(key)!.timestamp <= this.ttlMs
  }
}

// Signature Matching Cache
export class SignatureCache {
  private userAgentCache = new PerformanceCache<any>(5000, 10 * 60 * 1000) // 10 minutes
  private ipVerificationCache = new PerformanceCache<boolean>(2000, 30 * 60 * 1000) // 30 minutes

  getUserAgentMatch(userAgent: string): any | null {
    return this.userAgentCache.get(this.hashUserAgent(userAgent))
  }

  setUserAgentMatch(userAgent: string, result: any): void {
    this.userAgentCache.set(this.hashUserAgent(userAgent), result)
  }

  getIPVerification(ip: string, ranges: string[]): boolean | null {
    const key = `${ip}:${ranges.join(',')}`
    return this.ipVerificationCache.get(key)
  }

  setIPVerification(ip: string, ranges: string[], result: boolean): void {
    const key = `${ip}:${ranges.join(',')}`
    this.ipVerificationCache.set(key, result)
  }

  private hashUserAgent(userAgent: string): string {
    // Simple hash for user agent
    let hash = 0
    for (let i = 0; i < userAgent.length; i++) {
      const char = userAgent.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return hash.toString(36)
  }

  getStats(): { userAgent: CacheStats; ipVerification: CacheStats } {
    return {
      userAgent: this.userAgentCache.getStats(),
      ipVerification: this.ipVerificationCache.getStats()
    }
  }

  clear(): void {
    this.userAgentCache.clear()
    this.ipVerificationCache.clear()
  }
}

// Velocity Analysis Cache
export class VelocityCache {
  private analysisCache = new PerformanceCache<any>(1000, 5 * 60 * 1000) // 5 minutes
  private intervalCache = new PerformanceCache<number[]>(500, 10 * 60 * 1000) // 10 minutes

  getAnalysis(sessionKey: string): any | null {
    return this.analysisCache.get(sessionKey)
  }

  setAnalysis(sessionKey: string, analysis: any): void {
    this.analysisCache.set(sessionKey, analysis)
  }

  getIntervals(sessionKey: string): number[] | null {
    return this.intervalCache.get(sessionKey)
  }

  setIntervals(sessionKey: string, intervals: number[]): void {
    this.intervalCache.set(sessionKey, intervals)
  }

  generateSessionKey(ip: string, userAgent: string, timeWindow: number): string {
    const timeSlot = Math.floor(Date.now() / timeWindow) * timeWindow
    return `${ip}:${this.hashUserAgent(userAgent)}:${timeSlot}`
  }

  private hashUserAgent(userAgent: string): string {
    return userAgent.slice(0, 20) // Simple truncation
  }

  getStats(): { analysis: CacheStats; intervals: CacheStats } {
    return {
      analysis: this.analysisCache.getStats(),
      intervals: this.intervalCache.getStats()
    }
  }

  clear(): void {
    this.analysisCache.clear()
    this.intervalCache.clear()
  }
}

// Pattern Analysis Cache
export class PatternCache {
  private patternCache = new PerformanceCache<any>(800, 15 * 60 * 1000) // 15 minutes

  getPattern(pathsHash: string): any | null {
    return this.patternCache.get(pathsHash)
  }

  setPattern(pathsHash: string, pattern: any): void {
    this.patternCache.set(pathsHash, pattern)
  }

  generatePathsHash(paths: string[]): string {
    // Sort and hash paths for consistent caching
    const sortedPaths = [...paths].sort()
    const pathString = sortedPaths.slice(0, 100).join('|') // Limit for performance

    let hash = 0
    for (let i = 0; i < pathString.length; i++) {
      const char = pathString.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash
    }

    return `${hash.toString(36)}:${paths.length}`
  }

  getStats(): CacheStats {
    return this.patternCache.getStats()
  }

  clear(): void {
    this.patternCache.clear()
  }
}

// Parallel Processing Utilities
export class ParallelProcessor {
  private maxConcurrency: number

  constructor(maxConcurrency: number = 4) {
    this.maxConcurrency = maxConcurrency
  }

  async processInParallel<T, R>(
    items: T[],
    processor: (item: T) => Promise<R>,
    chunkSize?: number
  ): Promise<R[]> {
    const chunks = this.createChunks(items, chunkSize || this.maxConcurrency)
    const results: R[] = []

    for (const chunk of chunks) {
      const chunkPromises = chunk.map(processor)
      const chunkResults = await Promise.all(chunkPromises)
      results.push(...chunkResults)
    }

    return results
  }

  async processWithConcurrencyLimit<T, R>(
    items: T[],
    processor: (item: T) => Promise<R>
  ): Promise<R[]> {
    const results: R[] = []
    const semaphore = new Semaphore(this.maxConcurrency)

    const promises = items.map(async (item, index) => {
      const release = await semaphore.acquire()
      try {
        const result = await processor(item)
        results[index] = result
        return result
      } finally {
        release()
      }
    })

    await Promise.all(promises)
    return results
  }

  private createChunks<T>(items: T[], chunkSize: number): T[][] {
    const chunks: T[][] = []
    for (let i = 0; i < items.length; i += chunkSize) {
      chunks.push(items.slice(i, i + chunkSize))
    }
    return chunks
  }
}

class Semaphore {
  private permits: number
  private waitQueue: (() => void)[] = []

  constructor(permits: number) {
    this.permits = permits
  }

  async acquire(): Promise<() => void> {
    return new Promise(resolve => {
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

// Memory Management
export class MemoryManager {
  private maxMemoryMB: number
  private gcThreshold: number

  constructor(maxMemoryMB: number = 512, gcThreshold: number = 0.8) {
    this.maxMemoryMB = maxMemoryMB
    this.gcThreshold = gcThreshold
  }

  getCurrentMemoryUsage(): number {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const usage = process.memoryUsage()
      return Math.round(usage.heapUsed / 1024 / 1024)
    }
    return 0
  }

  checkMemoryPressure(): boolean {
    const current = this.getCurrentMemoryUsage()
    return current > (this.maxMemoryMB * this.gcThreshold)
  }

  async forceGarbageCollection(): Promise<void> {
    if (global.gc) {
      global.gc()
    }

    // Wait for GC to complete
    await new Promise(resolve => setImmediate(resolve))
  }

  async waitForMemoryRelief(maxWaitMs: number = 5000): Promise<boolean> {
    const startTime = Date.now()

    while (this.checkMemoryPressure() && (Date.now() - startTime) < maxWaitMs) {
      await this.forceGarbageCollection()
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    return !this.checkMemoryPressure()
  }

  getMemoryStats(): {
    current: number
    max: number
    pressure: boolean
    percentage: number
  } {
    const current = this.getCurrentMemoryUsage()
    return {
      current,
      max: this.maxMemoryMB,
      pressure: this.checkMemoryPressure(),
      percentage: Math.round((current / this.maxMemoryMB) * 100)
    }
  }
}

// Performance Monitoring
export class PerformanceMonitor {
  private metrics = new Map<string, number[]>()

  startTimer(operation: string): () => void {
    const startTime = performance.now()

    return () => {
      const duration = performance.now() - startTime
      this.recordMetric(operation, duration)
    }
  }

  recordMetric(operation: string, value: number): void {
    if (!this.metrics.has(operation)) {
      this.metrics.set(operation, [])
    }

    const values = this.metrics.get(operation)!
    values.push(value)

    // Keep only last 100 measurements
    if (values.length > 100) {
      values.shift()
    }
  }

  getMetrics(operation: string): {
    average: number
    min: number
    max: number
    count: number
  } | null {
    const values = this.metrics.get(operation)
    if (!values || values.length === 0) return null

    return {
      average: values.reduce((sum, v) => sum + v, 0) / values.length,
      min: Math.min(...values),
      max: Math.max(...values),
      count: values.length
    }
  }

  getAllMetrics(): Record<string, any> {
    const result: Record<string, any> = {}

    for (const [operation, values] of this.metrics) {
      if (values.length > 0) {
        result[operation] = {
          average: values.reduce((sum, v) => sum + v, 0) / values.length,
          min: Math.min(...values),
          max: Math.max(...values),
          count: values.length,
          recent: values.slice(-10) // Last 10 measurements
        }
      }
    }

    return result
  }

  clear(): void {
    this.metrics.clear()
  }
}

// Export singleton instances
export const signatureCache = new SignatureCache()
export const velocityCache = new VelocityCache()
export const patternCache = new PatternCache()
export const parallelProcessor = new ParallelProcessor()
export const memoryManager = new MemoryManager()
export const performanceMonitor = new PerformanceMonitor()