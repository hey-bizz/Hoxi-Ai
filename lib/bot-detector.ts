interface BotSignature {
  pattern: RegExp
  category: 'ai_training' | 'ai_scraper' | 'ai_search' | 'search_engine' | 'social_media' | 'seo_tool' | 'scraper' | 'monitoring' | 'security'
  severity: 'low' | 'medium' | 'high' | 'critical'
  description: string
  recommendation: 'allow' | 'rate_limit' | 'block'
  rateLimit?: number // requests per minute if rate limiting
}

interface BotDetectionResult {
  isBot: boolean
  botName: string | null
  category: string | null
  severity: string | null
  description?: string
  recommendation?: string
  confidence: number
}

export class BotDetector {
  private signatures: Map<string, BotSignature> = new Map([
    // AI Training Bots (Usually Heavy)
    ['GPTBot', {
      pattern: /GPTBot\/\d+\.\d+/i,
      category: 'ai_training',
      severity: 'high',
      description: 'OpenAI GPT training crawler',
      recommendation: 'rate_limit',
      rateLimit: 10
    }],
    ['ChatGPT-User', {
      pattern: /ChatGPT-User/i,
      category: 'ai_training',
      severity: 'high',
      description: 'ChatGPT web browsing',
      recommendation: 'rate_limit',
      rateLimit: 20
    }],
    ['Claude-Web', {
      pattern: /Claude-Web/i,
      category: 'ai_training',
      severity: 'high',
      description: 'Anthropic Claude crawler',
      recommendation: 'rate_limit',
      rateLimit: 10
    }],
    ['anthropic-ai', {
      pattern: /anthropic-ai/i,
      category: 'ai_training',
      severity: 'high',
      description: 'Anthropic AI bot',
      recommendation: 'rate_limit'
    }],
    ['Cohere-ai', {
      pattern: /cohere-ai/i,
      category: 'ai_training',
      severity: 'medium',
      description: 'Cohere AI training bot',
      recommendation: 'rate_limit'
    }],

    // AI Search Engines
    ['PerplexityBot', {
      pattern: /PerplexityBot/i,
      category: 'ai_search',
      severity: 'medium',
      description: 'Perplexity AI search engine',
      recommendation: 'rate_limit',
      rateLimit: 30
    }],
    ['YouBot', {
      pattern: /YouBot/i,
      category: 'ai_search',
      severity: 'medium',
      description: 'You.com search bot',
      recommendation: 'rate_limit'
    }],

    // Traditional Search Engines (Important for SEO)
    ['Googlebot', {
      pattern: /Googlebot/i,
      category: 'search_engine',
      severity: 'low',
      description: 'Google search crawler',
      recommendation: 'allow'
    }],
    ['bingbot', {
      pattern: /bingbot/i,
      category: 'search_engine',
      severity: 'low',
      description: 'Bing search crawler',
      recommendation: 'allow'
    }],
    ['Baiduspider', {
      pattern: /Baiduspider/i,
      category: 'search_engine',
      severity: 'low',
      description: 'Baidu search crawler',
      recommendation: 'rate_limit',
      rateLimit: 20
    }],
    ['YandexBot', {
      pattern: /YandexBot/i,
      category: 'search_engine',
      severity: 'low',
      description: 'Yandex search crawler',
      recommendation: 'rate_limit'
    }],
    ['DuckDuckBot', {
      pattern: /DuckDuckBot/i,
      category: 'search_engine',
      severity: 'low',
      description: 'DuckDuckGo search crawler',
      recommendation: 'allow'
    }],

    // Aggressive Scrapers (Usually Bad)
    ['CCBot', {
      pattern: /CCBot/i,
      category: 'ai_scraper',
      severity: 'critical',
      description: 'Common Crawl bot - Very aggressive',
      recommendation: 'block'
    }],
    ['Bytespider', {
      pattern: /Bytespider/i,
      category: 'ai_scraper',
      severity: 'critical',
      description: 'ByteDance aggressive crawler',
      recommendation: 'block'
    }],
    ['PetalBot', {
      pattern: /PetalBot/i,
      category: 'scraper',
      severity: 'high',
      description: 'Huawei Petal search crawler',
      recommendation: 'block'
    }],
    ['MJ12bot', {
      pattern: /MJ12bot/i,
      category: 'scraper',
      severity: 'critical',
      description: 'Majestic SEO crawler - Known for aggressive crawling',
      recommendation: 'block'
    }],
    ['DataForSeoBot', {
      pattern: /DataForSeoBot/i,
      category: 'ai_scraper',
      severity: 'high',
      description: 'SEO data scraper',
      recommendation: 'block'
    }],

    // SEO Tools (Mixed - Some Good, Some Bad)
    ['SemrushBot', {
      pattern: /SemrushBot/i,
      category: 'seo_tool',
      severity: 'medium',
      description: 'Semrush SEO analysis',
      recommendation: 'rate_limit',
      rateLimit: 15
    }],
    ['AhrefsBot', {
      pattern: /AhrefsBot/i,
      category: 'seo_tool',
      severity: 'medium',
      description: 'Ahrefs SEO crawler',
      recommendation: 'rate_limit',
      rateLimit: 15
    }],
    ['Screaming Frog', {
      pattern: /Screaming Frog SEO Spider/i,
      category: 'seo_tool',
      severity: 'medium',
      description: 'SEO audit tool',
      recommendation: 'rate_limit'
    }],

    // Social Media (Usually Allow)
    ['facebookexternalhit', {
      pattern: /facebookexternalhit/i,
      category: 'social_media',
      severity: 'low',
      description: 'Facebook link preview',
      recommendation: 'allow'
    }],
    ['Twitterbot', {
      pattern: /Twitterbot/i,
      category: 'social_media',
      severity: 'low',
      description: 'Twitter/X link preview',
      recommendation: 'allow'
    }],
    ['LinkedInBot', {
      pattern: /LinkedInBot/i,
      category: 'social_media',
      severity: 'low',
      description: 'LinkedIn link preview',
      recommendation: 'allow'
    }],
    ['WhatsApp', {
      pattern: /WhatsApp/i,
      category: 'social_media',
      severity: 'low',
      description: 'WhatsApp link preview',
      recommendation: 'allow'
    }],
    ['Slackbot', {
      pattern: /Slackbot/i,
      category: 'social_media',
      severity: 'low',
      description: 'Slack link preview',
      recommendation: 'allow'
    }],

    // Monitoring & Security (Usually Allow)
    ['UptimeRobot', {
      pattern: /UptimeRobot/i,
      category: 'monitoring',
      severity: 'low',
      description: 'Uptime monitoring service',
      recommendation: 'allow'
    }],
    ['Pingdom', {
      pattern: /Pingdom/i,
      category: 'monitoring',
      severity: 'low',
      description: 'Website monitoring',
      recommendation: 'allow'
    }]
  ])

  /**
   * Detect if a user agent is a bot
   */
  detect(userAgent: string): BotDetectionResult {
    if (!userAgent) {
      return {
        isBot: false,
        botName: null,
        category: null,
        severity: null,
        confidence: 1.0
      }
    }

    // Check against known signatures
    for (const [name, signature] of this.signatures.entries()) {
      if (signature.pattern.test(userAgent)) {
        return {
          isBot: true,
          botName: name,
          category: signature.category,
          severity: signature.severity,
          description: signature.description,
          recommendation: signature.recommendation,
          confidence: 0.95
        }
      }
    }

    // Generic bot detection patterns
    const genericPatterns = [
      { pattern: /bot|crawler|spider|scraper|crawl/i, confidence: 0.8 },
      { pattern: /python-requests|urllib|wget|curl|axios/i, confidence: 0.7 },
      { pattern: /headless|phantom|puppeteer|playwright/i, confidence: 0.9 }
    ]

    for (const { pattern, confidence } of genericPatterns) {
      if (pattern.test(userAgent)) {
        return {
          isBot: true,
          botName: 'Unknown Bot',
          category: 'scraper',
          severity: 'medium',
          description: 'Unidentified bot or scraper',
          recommendation: 'rate_limit',
          confidence
        }
      }
    }

    return {
      isBot: false,
      botName: null,
      category: null,
      severity: null,
      confidence: 1.0
    }
  }

  /**
   * Batch detect multiple user agents
   */
  detectBatch(userAgents: string[]): BotDetectionResult[] {
    return userAgents.map(ua => this.detect(ua))
  }

  /**
   * Get statistics from detection results
   */
  getStatistics(results: BotDetectionResult[]): {
    total: number
    bots: number
    humans: number
    byCategory: Record<string, number>
    bySeverity: Record<string, number>
    recommendations: Record<string, number>
  } {
    const stats = {
      total: results.length,
      bots: 0,
      humans: 0,
      byCategory: {} as Record<string, number>,
      bySeverity: {} as Record<string, number>,
      recommendations: {} as Record<string, number>
    }

    for (const result of results) {
      if (result.isBot) {
        stats.bots++
        
        if (result.category) {
          stats.byCategory[result.category] = (stats.byCategory[result.category] || 0) + 1
        }
        
        if (result.severity) {
          stats.bySeverity[result.severity] = (stats.bySeverity[result.severity] || 0) + 1
        }
        
        if (result.recommendation) {
          stats.recommendations[result.recommendation] = (stats.recommendations[result.recommendation] || 0) + 1
        }
      } else {
        stats.humans++
      }
    }

    return stats
  }

  /**
   * Generate robots.txt content based on detection results
   */
  generateRobotsTxt(
    blockedBots: string[],
    rateLimitedBots: Map<string, number>
  ): string {
    let content = '# AI Crawler Monitor - Generated robots.txt\n'
    content += '# Generated: ' + new Date().toISOString() + '\n\n'

    // Allow good bots explicitly
    content += '# Search Engines (Allowed)\n'
    content += 'User-agent: Googlebot\n'
    content += 'Allow: /\n\n'
    content += 'User-agent: bingbot\n'
    content += 'Allow: /\n\n'

    // Block bad bots
    if (blockedBots.length > 0) {
      content += '# Blocked Bots\n'
      for (const bot of blockedBots) {
        content += `User-agent: ${bot}\n`
        content += 'Disallow: /\n\n'
      }
    }

    // Rate limited bots (using crawl-delay)
    if (rateLimitedBots.size > 0) {
      content += '# Rate Limited Bots\n'
      for (const [bot, delay] of rateLimitedBots.entries()) {
        content += `User-agent: ${bot}\n`
        content += `Crawl-delay: ${delay}\n`
        content += 'Allow: /\n\n'
      }
    }

    // Default for all others
    content += '# Default\n'
    content += 'User-agent: *\n'
    content += 'Allow: /\n'
    content += 'Sitemap: /sitemap.xml\n'

    return content
  }
}

// Export singleton instance
export const botDetector = new BotDetector()