// Pattern Analysis Engine - Detects crawl and access patterns
// Identifies sequential, systematic, and targeted crawling patterns

import { DetectionLogEntry, CrawlPattern } from './types'

export class PatternAnalyzer {
  /**
   * Analyze crawl patterns for a group of log entries
   */
  analyzePattern(entries: DetectionLogEntry[]): CrawlPattern {
    if (entries.length === 0) {
      return {
        type: 'random',
        confidence: 0,
        paths: [],
        indicators: {
          sequentialScore: 0,
          systematicScore: 0,
          sitemapAccess: false,
          depthConsistency: 0
        }
      }
    }

    // Extract paths from entries
    const paths = entries
      .map(e => e.path || '/')
      .filter(p => p !== '')

    // Calculate different pattern scores
    const sequentialScore = this.detectSequentialAccess(paths)
    const systematicScore = this.detectSystematicCrawling(paths)
    const sitemapAccess = this.detectSitemapAccess(paths)
    const depthConsistency = this.analyzeURLDepth(paths)

    // Determine pattern type and confidence
    const { type, confidence } = this.determinePatternType({
      sequentialScore,
      systematicScore,
      sitemapAccess,
      depthConsistency,
      pathCount: paths.length
    })

    return {
      type,
      confidence,
      paths: this.getSamplePaths(paths, 10),
      indicators: {
        sequentialScore,
        systematicScore,
        sitemapAccess,
        depthConsistency
      }
    }
  }

  /**
   * Detect sequential access patterns like /page/1, /page/2, /page/3
   */
  private detectSequentialAccess(paths: string[]): number {
    if (paths.length < 3) return 0

    let sequentialCount = 0
    const patterns = [
      // Numeric sequences: /page/1, /page/2, /page/3
      /\/page\/(\d+)/i,
      /\/p(\d+)/i,
      /\/(\d+)\//,
      /\?page=(\d+)/i,
      /\?p=(\d+)/i,
      // Category/ID patterns
      /\/product\/(\d+)/i,
      /\/article\/(\d+)/i,
      /\/item\/(\d+)/i,
      /\/post\/(\d+)/i
    ]

    for (const pattern of patterns) {
      const matches = paths
        .map(path => {
          const match = path.match(pattern)
          return match ? parseInt(match[1]) : null
        })
        .filter(num => num !== null)
        .sort((a, b) => a! - b!)

      if (matches.length >= 3) {
        // Check for consecutive sequences
        let consecutiveCount = 1
        let maxConsecutive = 1

        for (let i = 1; i < matches.length; i++) {
          if (matches[i]! === matches[i - 1]! + 1) {
            consecutiveCount++
            maxConsecutive = Math.max(maxConsecutive, consecutiveCount)
          } else {
            consecutiveCount = 1
          }
        }

        const sequenceRatio = maxConsecutive / matches.length
        sequentialCount = Math.max(sequentialCount, sequenceRatio)
      }
    }

    // Check for alphabetical sequences
    const alphaScore = this.detectAlphabeticalSequence(paths)
    sequentialCount = Math.max(sequentialCount, alphaScore)

    return Math.min(1, sequentialCount)
  }

  /**
   * Detect alphabetical sequential patterns
   */
  private detectAlphabeticalSequence(paths: string[]): number {
    // Extract potential alphabetical patterns
    const alphaPattern = /\/([a-z])\//i
    const matches = paths
      .map(path => {
        const match = path.match(alphaPattern)
        return match ? match[1].toLowerCase() : null
      })
      .filter(char => char !== null)

    if (matches.length < 3) return 0

    matches.sort()
    let consecutiveCount = 1
    let maxConsecutive = 1

    for (let i = 1; i < matches.length; i++) {
      if (matches[i]!.charCodeAt(0) === matches[i - 1]!.charCodeAt(0) + 1) {
        consecutiveCount++
        maxConsecutive = Math.max(maxConsecutive, consecutiveCount)
      } else {
        consecutiveCount = 1
      }
    }

    return maxConsecutive / matches.length
  }

  /**
   * Detect systematic crawling patterns
   */
  private detectSystematicCrawling(paths: string[]): number {
    if (paths.length < 5) return 0

    let systematicScore = 0

    // Check for hierarchical crawling (depth-first or breadth-first)
    const hierarchicalScore = this.detectHierarchicalCrawling(paths)
    systematicScore = Math.max(systematicScore, hierarchicalScore)

    // Check for parameter sweeping
    const parameterScore = this.detectParameterSweeping(paths)
    systematicScore = Math.max(systematicScore, parameterScore)

    // Check for file extension patterns
    const extensionScore = this.detectExtensionPatterns(paths)
    systematicScore = Math.max(systematicScore, extensionScore)

    // Check for common crawl patterns
    const commonPatternScore = this.detectCommonCrawlPatterns(paths)
    systematicScore = Math.max(systematicScore, commonPatternScore)

    return Math.min(1, systematicScore)
  }

  /**
   * Detect hierarchical crawling patterns
   */
  private detectHierarchicalCrawling(paths: string[]): number {
    const depthMap = new Map<number, number>()

    // Count paths by depth
    for (const path of paths) {
      const depth = (path.match(/\//g) || []).length
      depthMap.set(depth, (depthMap.get(depth) || 0) + 1)
    }

    // Check if crawling follows depth patterns
    const depths = Array.from(depthMap.keys()).sort((a, b) => a - b)
    let hierarchicalScore = 0

    if (depths.length >= 3) {
      // Breadth-first: many shallow paths, then deeper
      const shallowPaths = depthMap.get(depths[0]) || 0
      const totalPaths = paths.length

      if (shallowPaths / totalPaths > 0.6) {
        hierarchicalScore += 0.5
      }

      // Consistent depth progression
      let consistentProgression = true
      for (let i = 1; i < depths.length; i++) {
        if (depths[i] !== depths[i - 1] + 1) {
          consistentProgression = false
          break
        }
      }

      if (consistentProgression) {
        hierarchicalScore += 0.3
      }
    }

    return hierarchicalScore
  }

  /**
   * Detect parameter sweeping patterns
   */
  private detectParameterSweeping(paths: string[]): number {
    const parameterCounts = new Map<string, Set<string>>()

    for (const path of paths) {
      const url = new URL('http://example.com' + path)

      for (const [key, value] of url.searchParams.entries()) {
        if (!parameterCounts.has(key)) {
          parameterCounts.set(key, new Set())
        }
        parameterCounts.get(key)!.add(value)
      }
    }

    let maxParameterVariety = 0
    for (const [, values] of parameterCounts) {
      const variety = values.size / paths.length
      maxParameterVariety = Math.max(maxParameterVariety, variety)
    }

    // High parameter variety suggests systematic sweeping
    return Math.min(1, maxParameterVariety * 2)
  }

  /**
   * Detect file extension patterns
   */
  private detectExtensionPatterns(paths: string[]): number {
    const extensions = new Map<string, number>()

    for (const path of paths) {
      const match = path.match(/\.([a-z0-9]+)$/i)
      if (match) {
        const ext = match[1].toLowerCase()
        extensions.set(ext, (extensions.get(ext) || 0) + 1)
      }
    }

    // Bot-like if targeting specific file types systematically
    const crawlerExtensions = ['xml', 'json', 'rss', 'atom', 'txt', 'csv']
    let botExtensionCount = 0

    for (const ext of crawlerExtensions) {
      if (extensions.has(ext)) {
        botExtensionCount += extensions.get(ext)!
      }
    }

    return botExtensionCount / paths.length
  }

  /**
   * Detect common crawl patterns
   */
  private detectCommonCrawlPatterns(paths: string[]): number {
    const botPatterns = [
      /robots\.txt$/i,
      /sitemap.*\.xml$/i,
      /\.well-known/i,
      /\/api\//i,
      /\/admin/i,
      /\/wp-/i,
      /\/feed/i,
      /\/rss/i
    ]

    let botPatternCount = 0
    for (const path of paths) {
      for (const pattern of botPatterns) {
        if (pattern.test(path)) {
          botPatternCount++
          break
        }
      }
    }

    return botPatternCount / paths.length
  }

  /**
   * Check for sitemap access
   */
  private detectSitemapAccess(paths: string[]): boolean {
    return paths.some(path =>
      /sitemap.*\.xml$/i.test(path) ||
      /robots\.txt$/i.test(path)
    )
  }

  /**
   * Analyze URL depth consistency
   */
  private analyzeURLDepth(paths: string[]): number {
    if (paths.length === 0) return 0

    const depths = paths.map(path => (path.match(/\//g) || []).length)
    const avgDepth = depths.reduce((sum, d) => sum + d, 0) / depths.length

    // Calculate variance
    const variance = depths.reduce((sum, d) => sum + Math.pow(d - avgDepth, 2), 0) / depths.length
    const stdDev = Math.sqrt(variance)

    // Lower variance = more consistent depth = more bot-like
    return Math.max(0, 1 - (stdDev / avgDepth))
  }

  /**
   * Determine pattern type and confidence based on all indicators
   */
  private determinePatternType(indicators: {
    sequentialScore: number
    systematicScore: number
    sitemapAccess: boolean
    depthConsistency: number
    pathCount: number
  }): { type: CrawlPattern['type']; confidence: number } {

    const sitemapBonus = indicators.sitemapAccess ? 0.3 : 0
    const totalScore = Math.max(
      indicators.sequentialScore,
      indicators.systematicScore,
      sitemapBonus
    )

    // Pattern type determination
    let type: CrawlPattern['type'] = 'random'

    if (indicators.sequentialScore > 0.6) {
      type = 'sequential'
    } else if (indicators.systematicScore > 0.5 || indicators.sitemapAccess) {
      type = 'systematic'
    } else if (indicators.pathCount < 10 && indicators.depthConsistency > 0.8) {
      type = 'targeted'
    }

    // Confidence calculation
    let confidence = totalScore

    // Boost confidence with more data points
    if (indicators.pathCount >= 20) confidence += 0.1
    if (indicators.pathCount >= 50) confidence += 0.1

    // Consistency boosts confidence
    if (indicators.depthConsistency > 0.7) confidence += 0.1

    return {
      type,
      confidence: Math.min(1, confidence)
    }
  }

  /**
   * Get sample paths for analysis
   */
  private getSamplePaths(paths: string[], maxCount: number): string[] {
    if (paths.length <= maxCount) return [...paths]

    // Return a representative sample
    const step = Math.floor(paths.length / maxCount)
    const samples: string[] = []

    for (let i = 0; i < paths.length; i += step) {
      samples.push(paths[i])
      if (samples.length >= maxCount) break
    }

    return samples
  }

  /**
   * Analyze patterns for a specific IP
   */
  analyzeIPPattern(ip: string, entries: DetectionLogEntry[]): CrawlPattern {
    const ipEntries = entries.filter(e => e.ip_address === ip)
    return this.analyzePattern(ipEntries)
  }
}

// Export singleton instance
export const patternAnalyzer = new PatternAnalyzer()