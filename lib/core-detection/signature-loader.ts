// Signature Loader - Loads bot signatures from fetched data
// Integrates 1,500+ bot signatures into the detection engine

import fs from 'fs/promises'
import path from 'path'
import { EnhancedBotSignature } from './types'

export class SignatureLoader {
  private static instance: SignatureLoader
  private signatures: Map<string, EnhancedBotSignature> = new Map()
  private loaded: boolean = false

  private constructor() {}

  static getInstance(): SignatureLoader {
    if (!SignatureLoader.instance) {
      SignatureLoader.instance = new SignatureLoader()
    }
    return SignatureLoader.instance
  }

  /**
   * Load bot signatures from the fetched data
   */
  async loadSignatures(): Promise<Map<string, EnhancedBotSignature>> {
    if (this.loaded) {
      return this.signatures
    }

    try {
      // Load enhanced signatures
      const enhancedPath = path.join(process.cwd(), 'data/enhanced-bot-signatures.json')
      const enhancedData = await fs.readFile(enhancedPath, 'utf-8')
      const enhancedSignatures = JSON.parse(enhancedData)

      console.log(`Loading ${enhancedSignatures.length} enhanced bot signatures...`)

      for (const sig of enhancedSignatures) {
        // Convert pattern strings back to RegExp objects
        const patterns = sig.patterns.map((p: any) => {
          if (typeof p === 'string') {
            return new RegExp(p, 'i')
          }
          return new RegExp(p.source || p, 'i')
        })

        const enhancedSig: EnhancedBotSignature = {
          name: sig.name,
          category: sig.category,
          subcategory: sig.subcategory,
          patterns,
          impact: sig.impact,
          metadata: sig.metadata,
          // Add IP ranges for known bots
          ipRanges: this.getKnownIPRanges(sig.name),
          verification: this.getVerificationRules(sig.name)
        }

        this.signatures.set(sig.name, enhancedSig)
      }

      this.loaded = true
      console.log(`✅ Loaded ${this.signatures.size} bot signatures successfully`)

      return this.signatures

    } catch (error) {
      console.error('Error loading bot signatures:', error)

      // Fallback to basic signatures if enhanced ones fail
      return this.loadFallbackSignatures()
    }
  }

  /**
   * Get known IP ranges for specific bots
   */
  private getKnownIPRanges(botName: string): string[] | undefined {
    const ipRanges: Record<string, string[]> = {
      'GPTBot': ['20.171.0.0/16', '20.163.0.0/16'],
      'ChatGPT-User': ['20.171.0.0/16', '40.84.180.0/22'],
      'Googlebot': ['66.249.64.0/19', '66.249.64.0/27', '209.85.128.0/17'],
      'GoogleBot': ['66.249.64.0/19', '66.249.64.0/27', '209.85.128.0/17'],
      'bingbot': ['40.77.167.0/24', '207.46.13.0/24'],
      'Bingbot': ['40.77.167.0/24', '207.46.13.0/24'],
      'CCBot': ['54.36.148.0/22', '54.36.149.0/24'],
      'Claude-Web': ['52.70.0.0/15'],
      'ClaudeBot': ['52.70.0.0/15'],
      'anthropic-ai': ['52.70.0.0/15'],
      'Bytespider': ['110.249.201.0/24', '111.225.148.0/24'],
      'YandexBot': ['5.255.253.0/24', '5.255.254.0/24'],
      'Baiduspider': ['180.76.15.0/24', '123.125.71.0/24']
    }

    return ipRanges[botName]
  }

  /**
   * Get verification rules for specific bots
   */
  private getVerificationRules(botName: string): EnhancedBotSignature['verification'] | undefined {
    const verificationRules: Record<string, EnhancedBotSignature['verification']> = {
      'Googlebot': {
        reverseDns: [/.*\.googlebot\.com$/, /.*\.google\.com$/]
      },
      'GoogleBot': {
        reverseDns: [/.*\.googlebot\.com$/, /.*\.google\.com$/]
      },
      'bingbot': {
        reverseDns: [/.*\.search\.msn\.com$/]
      },
      'Bingbot': {
        reverseDns: [/.*\.search\.msn\.com$/]
      },
      'GPTBot': {
        reverseDns: [/.*\.openai\.com$/]
      },
      'YandexBot': {
        reverseDns: [/.*\.yandex\.com$/, /.*\.yandex\.ru$/]
      }
    }

    return verificationRules[botName]
  }

  /**
   * Fallback signatures if enhanced loading fails
   */
  private async loadFallbackSignatures(): Promise<Map<string, EnhancedBotSignature>> {
    console.log('Loading fallback signatures...')

    const fallbackSigs: EnhancedBotSignature[] = [
      {
        name: 'GPTBot',
        category: 'extractive',
        subcategory: 'ai_training',
        patterns: [/GPTBot\/[\d.]+/i],
        ipRanges: ['20.171.0.0/16', '20.163.0.0/16'],
        impact: 'extreme',
        metadata: {
          operator: 'OpenAI',
          purpose: 'LLM Training Data Collection',
          respectsRobotsTxt: false,
          averageCrawlRate: 1000
        }
      },
      {
        name: 'Googlebot',
        category: 'beneficial',
        subcategory: 'search_engine',
        patterns: [/Googlebot\/[\d.]+/i, /Googlebot-Image/i],
        ipRanges: ['66.249.64.0/19'],
        impact: 'low',
        metadata: {
          operator: 'Google',
          purpose: 'Search Index Crawling',
          respectsRobotsTxt: true,
          averageCrawlRate: 30
        }
      },
      {
        name: 'CCBot',
        category: 'malicious',
        subcategory: 'ai_scraper',
        patterns: [/CCBot\/[\d.]+/i],
        ipRanges: ['54.36.148.0/22'],
        impact: 'extreme',
        metadata: {
          operator: 'Common Crawl',
          purpose: 'Mass Data Collection',
          respectsRobotsTxt: false,
          averageCrawlRate: 2000
        }
      }
    ]

    for (const sig of fallbackSigs) {
      this.signatures.set(sig.name, sig)
    }

    return this.signatures
  }

  /**
   * Get signatures by category
   */
  getSignaturesByCategory(category: 'beneficial' | 'extractive' | 'malicious'): EnhancedBotSignature[] {
    return Array.from(this.signatures.values()).filter(sig => sig.category === category)
  }

  /**
   * Get signatures by subcategory
   */
  getSignaturesBySubcategory(subcategory: string): EnhancedBotSignature[] {
    return Array.from(this.signatures.values()).filter(sig => sig.subcategory === subcategory)
  }

  /**
   * Get high-impact signatures
   */
  getHighImpactSignatures(): EnhancedBotSignature[] {
    return Array.from(this.signatures.values()).filter(sig =>
      sig.impact === 'high' || sig.impact === 'extreme'
    )
  }

  /**
   * Search signatures by name pattern
   */
  searchSignatures(namePattern: string): EnhancedBotSignature[] {
    const regex = new RegExp(namePattern, 'i')
    return Array.from(this.signatures.values()).filter(sig => regex.test(sig.name))
  }

  /**
   * Get signature statistics
   */
  getStatistics(): {
    total: number
    byCategory: Record<string, number>
    bySubcategory: Record<string, number>
    byImpact: Record<string, number>
    withIPRanges: number
    withVerification: number
  } {
    const stats = {
      total: this.signatures.size,
      byCategory: {} as Record<string, number>,
      bySubcategory: {} as Record<string, number>,
      byImpact: {} as Record<string, number>,
      withIPRanges: 0,
      withVerification: 0
    }

    for (const sig of this.signatures.values()) {
      // Count by category
      stats.byCategory[sig.category] = (stats.byCategory[sig.category] || 0) + 1

      // Count by subcategory
      if (sig.subcategory) {
        stats.bySubcategory[sig.subcategory] = (stats.bySubcategory[sig.subcategory] || 0) + 1
      }

      // Count by impact
      stats.byImpact[sig.impact] = (stats.byImpact[sig.impact] || 0) + 1

      // Count enhanced features
      if (sig.ipRanges && sig.ipRanges.length > 0) {
        stats.withIPRanges++
      }

      if (sig.verification) {
        stats.withVerification++
      }
    }

    return stats
  }

  /**
   * Reload signatures from disk
   */
  async reload(): Promise<Map<string, EnhancedBotSignature>> {
    this.loaded = false
    this.signatures.clear()
    return this.loadSignatures()
  }

  /**
   * Check if signatures are loaded
   */
  isLoaded(): boolean {
    return this.loaded
  }

  /**
   * Get all signatures
   */
  getAllSignatures(): Map<string, EnhancedBotSignature> {
    return new Map(this.signatures)
  }
}

// Export singleton instance
export const signatureLoader = SignatureLoader.getInstance()