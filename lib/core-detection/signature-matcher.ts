// Enhanced Signature Matching Engine with IP verification and confidence scoring
// Builds on existing bot detector with improved accuracy and verification

import { DetectionLogEntry, BotClassification, EnhancedBotSignature } from './types'
import { BotDetector } from '@/lib/bot-detector'
import { signatureLoader } from './signature-loader'

interface IPRange {
  start: bigint
  end: bigint
  cidr: string
}

export class SignatureMatcher {
  private botDetector: BotDetector
  private enhancedSignatures: Map<string, EnhancedBotSignature>
  private ipRangeCache: Map<string, IPRange[]>
  private initialized: boolean = false

  constructor() {
    this.botDetector = new BotDetector()
    this.enhancedSignatures = new Map()
    this.ipRangeCache = new Map()
  }

  /**
   * Initialize with loaded signatures
   */
  async initialize(): Promise<void> {
    if (this.initialized) return

    try {
      this.enhancedSignatures = await signatureLoader.loadSignatures()
      this.initialized = true

      const stats = signatureLoader.getStatistics()
      console.log(`✅ SignatureMatcher initialized with ${stats.total} signatures`)
      console.log(`   Categories: ${Object.keys(stats.byCategory).join(', ')}`)
      console.log(`   High-impact bots: ${stats.byImpact.high || 0} + ${stats.byImpact.extreme || 0}`)
    } catch (error) {
      console.error('Failed to initialize SignatureMatcher:', error)
      // Fall back to built-in signatures
      this.initializeEnhancedSignatures()
    }
  }

  /**
   * Match bot signatures with IP verification and enhanced confidence scoring
   */
  async matchSignature(entry: DetectionLogEntry): Promise<BotClassification | null> {
    // Ensure signatures are loaded
    await this.initialize()

    const userAgent = entry.user_agent || ''
    const ip = entry.ip_address

    // First try enhanced signatures
    const enhancedMatch = this.matchEnhancedSignature(userAgent, ip)
    if (enhancedMatch) return enhancedMatch

    // Fallback to existing bot detector
    const basicMatch = this.botDetector.detect(userAgent)
    if (basicMatch.isBot) {
      return this.convertBasicToClassification(basicMatch, ip)
    }

    return null
  }

  /**
   * Match against enhanced signatures with IP verification
   */
  private matchEnhancedSignature(userAgent: string, ip?: string): BotClassification | null {
    for (const [name, signature] of this.enhancedSignatures) {
      // Test user agent patterns
      const uaMatch = signature.patterns.some(pattern => pattern.test(userAgent))
      if (!uaMatch) continue

      // Check IP verification if available
      let ipVerified = false
      let ipSpoof = false

      if (signature.ipRanges && ip) {
        ipVerified = this.isIPInRanges(ip, signature.ipRanges)
        if (!ipVerified) {
          // Possible spoofing - user agent matches but IP doesn't
          ipSpoof = true
        }
      }

      // Calculate confidence based on verification
      let confidence = 0.75 // Base confidence for pattern match

      if (signature.ipRanges) {
        if (ipVerified) {
          confidence = 0.95 // High confidence with IP verification
        } else if (ipSpoof) {
          confidence = 0.3  // Low confidence - possible spoofing
        } else {
          confidence = 0.6  // Medium confidence - no IP to verify
        }
      }

      // Additional verification checks
      confidence = this.applyAdditionalVerification(confidence, signature, userAgent)

      return {
        botName: signature.name,
        category: signature.category,
        subcategory: signature.subcategory,
        confidence,
        verified: ipVerified,
        impact: signature.impact,
        metadata: signature.metadata
      }
    }

    return null
  }

  /**
   * Apply additional verification checks
   */
  private applyAdditionalVerification(
    baseConfidence: number,
    signature: EnhancedBotSignature,
    userAgent: string
  ): number {
    let confidence = baseConfidence

    // Check for reverse DNS patterns if available
    if (signature.verification?.reverseDns) {
      // This would require actual reverse DNS lookup in production
      // For now, we'll use heuristics based on user agent structure
      const hasStructuredUA = /\/[\d.]+$/.test(userAgent) // Ends with version
      if (hasStructuredUA) confidence += 0.05
    }

    // Check for expected headers patterns
    if (signature.verification?.headers) {
      // In a real implementation, this would check actual HTTP headers
      // For now, we'll use user agent completeness as a proxy
      const isCompleteUA = userAgent.length > 20 && userAgent.includes('/')
      if (isCompleteUA) confidence += 0.05
    }

    // Penalize suspicious patterns
    const suspiciousPatterns = [
      /^Mozilla\/5\.0 \(compatible\; \w+\)$/, // Generic bot pattern
      /python-requests/i,
      /curl/i,
      /wget/i
    ]

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(userAgent)) {
        confidence = Math.max(0.1, confidence - 0.2)
        break
      }
    }

    return Math.min(1.0, confidence)
  }

  /**
   * Check if IP is in any of the given CIDR ranges
   */
  private isIPInRanges(ip: string, cidrs: string[]): boolean {
    const ipBigInt = this.ipToBigInt(ip)
    if (ipBigInt === null) return false

    for (const cidr of cidrs) {
      if (!this.ipRangeCache.has(cidr)) {
        const range = this.parseCIDR(cidr)
        if (range) {
          this.ipRangeCache.set(cidr, [range])
        }
      }

      const ranges = this.ipRangeCache.get(cidr)
      if (ranges) {
        for (const range of ranges) {
          if (ipBigInt >= range.start && ipBigInt <= range.end) {
            return true
          }
        }
      }
    }

    return false
  }

  /**
   * Convert IP address to BigInt for range checking
   */
  private ipToBigInt(ip: string): bigint | null {
    try {
      // IPv4
      if (ip.includes('.')) {
        const parts = ip.split('.').map(p => parseInt(p))
        if (parts.length !== 4 || parts.some(p => p < 0 || p > 255)) return null

        return BigInt(
          (parts[0] << 24) +
          (parts[1] << 16) +
          (parts[2] << 8) +
          parts[3]
        )
      }

      // IPv6 (simplified - would need full implementation)
      if (ip.includes(':')) {
        // For now, return null for IPv6 - would need proper implementation
        return null
      }

      return null
    } catch {
      return null
    }
  }

  /**
   * Parse CIDR notation to IP range
   */
  private parseCIDR(cidr: string): IPRange | null {
    try {
      const [ip, prefixLength] = cidr.split('/')
      const prefix = parseInt(prefixLength)

      if (prefix < 0 || prefix > 32) return null

      const ipBigInt = this.ipToBigInt(ip)
      if (ipBigInt === null) return null

      const mask = BigInt(0xFFFFFFFF) << BigInt(32 - prefix)
      const start = ipBigInt & mask
      const end = start | (BigInt(0xFFFFFFFF) >> BigInt(prefix))

      return { start, end, cidr }
    } catch {
      return null
    }
  }

  /**
   * Convert basic bot detection result to enhanced classification
   */
  private convertBasicToClassification(
    basicResult: ReturnType<BotDetector['detect']>,
    ip?: string
  ): BotClassification {
    // Map existing categories to enhanced categories
    const categoryMap: Record<string, 'beneficial' | 'extractive' | 'malicious'> = {
      'search_engine': 'beneficial',
      'social_media': 'beneficial',
      'monitoring': 'beneficial',
      'ai_training': 'extractive',
      'ai_scraper': 'extractive',
      'ai_search': 'extractive',
      'scraper': 'malicious',
      'seo_tool': 'malicious'
    }

    const category = categoryMap[basicResult.category || 'unknown'] || 'unknown'

    return {
      botName: basicResult.botName,
      category: category as any,
      subcategory: basicResult.category || undefined,
      confidence: basicResult.confidence,
      verified: false, // No IP verification in basic detection
      impact: this.mapSeverityToImpact(basicResult.severity),
      metadata: {
        operator: 'Unknown',
        purpose: basicResult.description || 'Unknown',
        respectsRobotsTxt: category === 'beneficial'
      }
    }
  }

  /**
   * Map severity to impact level
   */
  private mapSeverityToImpact(severity?: string): 'low' | 'medium' | 'high' | 'extreme' {
    const severityMap: Record<string, 'low' | 'medium' | 'high' | 'extreme'> = {
      'low': 'low',
      'medium': 'medium',
      'high': 'high',
      'critical': 'extreme'
    }

    return severityMap[severity || 'medium'] || 'medium'
  }

  /**
   * Initialize enhanced bot signatures with IP ranges and verification
   */
  private initializeEnhancedSignatures(): void {
    const signatures: EnhancedBotSignature[] = [
      {
        name: 'GPTBot',
        category: 'extractive',
        subcategory: 'ai_training',
        patterns: [/GPTBot\/[\d.]+/i],
        ipRanges: ['20.171.0.0/16', '20.163.0.0/16'], // OpenAI IP ranges
        impact: 'extreme',
        metadata: {
          operator: 'OpenAI',
          purpose: 'LLM Training Data Collection',
          respectsRobotsTxt: false,
          averageCrawlRate: 1000,
          crawlPatterns: ['systematic', 'deep-crawl']
        },
        verification: {
          reverseDns: [/.*\.openai\.com$/],
          headers: {
            'user-agent': /GPTBot/
          }
        }
      },
      {
        name: 'ChatGPT-User',
        category: 'extractive',
        subcategory: 'ai_training',
        patterns: [/ChatGPT-User/i],
        ipRanges: ['20.171.0.0/16', '40.84.180.0/22'],
        impact: 'high',
        metadata: {
          operator: 'OpenAI',
          purpose: 'ChatGPT Web Browsing',
          respectsRobotsTxt: true,
          averageCrawlRate: 50
        }
      },
      {
        name: 'Googlebot',
        category: 'beneficial',
        subcategory: 'search_engine',
        patterns: [/Googlebot\/[\d.]+/i, /Googlebot-Image/i, /Googlebot-News/i],
        ipRanges: ['66.249.64.0/19', '66.249.64.0/27', '209.85.128.0/17'],
        impact: 'low',
        metadata: {
          operator: 'Google',
          purpose: 'Search Index Crawling',
          respectsRobotsTxt: true,
          averageCrawlRate: 30
        },
        verification: {
          reverseDns: [/.*\.googlebot\.com$/, /.*\.google\.com$/]
        }
      },
      {
        name: 'CCBot',
        category: 'malicious',
        subcategory: 'ai_scraper',
        patterns: [/CCBot\/[\d.]+/i],
        ipRanges: ['54.36.148.0/22', '54.36.149.0/24'],
        impact: 'extreme',
        metadata: {
          operator: 'Common Crawl',
          purpose: 'Mass Data Collection',
          respectsRobotsTxt: false,
          averageCrawlRate: 2000,
          crawlPatterns: ['aggressive', 'systematic']
        }
      },
      {
        name: 'Claude-Web',
        category: 'extractive',
        subcategory: 'ai_training',
        patterns: [/Claude-Web/i, /anthropic-ai/i],
        ipRanges: ['52.70.0.0/15'], // Anthropic/AWS ranges
        impact: 'high',
        metadata: {
          operator: 'Anthropic',
          purpose: 'AI Training and Web Browsing',
          respectsRobotsTxt: true,
          averageCrawlRate: 100
        }
      }
    ]

    for (const signature of signatures) {
      this.enhancedSignatures.set(signature.name, signature)
    }
  }

  /**
   * Add a new enhanced signature
   */
  addSignature(signature: EnhancedBotSignature): void {
    this.enhancedSignatures.set(signature.name, signature)
  }

  /**
   * Get all enhanced signatures
   */
  getSignatures(): Map<string, EnhancedBotSignature> {
    return new Map(this.enhancedSignatures)
  }

  /**
   * Update IP ranges for a signature
   */
  updateIPRanges(botName: string, ipRanges: string[]): void {
    const signature = this.enhancedSignatures.get(botName)
    if (signature) {
      signature.ipRanges = ipRanges
      // Clear cache for these ranges
      for (const range of ipRanges) {
        this.ipRangeCache.delete(range)
      }
    }
  }

  /**
   * Clear IP range cache
   */
  clearCache(): void {
    this.ipRangeCache.clear()
  }
}

// Export singleton instance
export const signatureMatcher = new SignatureMatcher()