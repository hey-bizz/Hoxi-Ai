interface HostingProvider {
    name: string
    costPerGB?: number
    freeGBIncluded?: number
    tieredPricing?: TierPrice[]
  }
  
  interface TierPrice {
    upToGB: number
    costPerGB: number
  }
  
  interface CostBreakdown {
    bandwidth: {
      gb: number
      cost: number
    }
    requests?: {
      count: number
      cost: number
    }
    total: number
    monthly: number
    yearly: number
  }
  
  export class CostCalculator {
    private providers: Map<string, HostingProvider> = new Map([
      ['aws', {
        name: 'Amazon Web Services',
        freeGBIncluded: 1, // First 1GB free
        tieredPricing: [
          { upToGB: 10, costPerGB: 0.09 },
          { upToGB: 40, costPerGB: 0.085 },
          { upToGB: 100, costPerGB: 0.07 },
          { upToGB: 150, costPerGB: 0.05 },
          { upToGB: Infinity, costPerGB: 0.03 }
        ]
      }],
      ['cloudflare', {
        name: 'Cloudflare',
        costPerGB: 0.045,
        freeGBIncluded: 0
      }],
      ['vercel', {
        name: 'Vercel',
        costPerGB: 0.40,
        freeGBIncluded: 100 // 100GB included in free tier
      }],
      ['netlify', {
        name: 'Netlify',
        costPerGB: 0.55,
        freeGBIncluded: 100
      }],
      ['gcp', {
        name: 'Google Cloud Platform',
        tieredPricing: [
          { upToGB: 1, costPerGB: 0 }, // First 1GB free
          { upToGB: 10, costPerGB: 0.12 },
          { upToGB: 150, costPerGB: 0.11 },
          { upToGB: Infinity, costPerGB: 0.08 }
        ]
      }],
      ['azure', {
        name: 'Microsoft Azure',
        tieredPricing: [
          { upToGB: 5, costPerGB: 0.087 },
          { upToGB: 10, costPerGB: 0.083 },
          { upToGB: 50, costPerGB: 0.07 },
          { upToGB: 150, costPerGB: 0.05 },
          { upToGB: Infinity, costPerGB: 0.03 }
        ]
      }],
      ['digitalocean', {
        name: 'DigitalOcean',
        costPerGB: 0.01,
        freeGBIncluded: 1000 // 1TB included in droplet
      }],
      ['generic', {
        name: 'Generic Provider',
        costPerGB: 0.10, // Industry average
        freeGBIncluded: 0
      }]
    ])
  
    // Bot category cost multipliers (how expensive each type is)
    private botCostMultipliers: Record<string, number> = {
      'ai_training': 1.5,    // Heavy crawling, multiple passes
      'ai_scraper': 1.8,     // Aggressive, often ignores robots.txt
      'ai_search': 1.2,      // Moderate crawling
      'search_engine': 0.5,  // Beneficial, optimized crawling
      'social_media': 0.3,   // Light, only previews
      'seo_tool': 1.0,       // Regular crawling
      'scraper': 1.5,        // Heavy, unoptimized
      'unknown': 1.0         // Default multiplier
    }
  
    /**
     * Calculate bandwidth cost for a specific provider
     */
    calculateBandwidthCost(
      bytesTransferred: number,
      provider: string = 'generic'
    ): CostBreakdown {
      const gb = bytesTransferred / (1024 ** 3)
      const providerConfig = this.providers.get(provider) || this.providers.get('generic')!
      
      let cost = 0
      let billableGB = gb
  
      // Account for free tier
      if (providerConfig.freeGBIncluded) {
        billableGB = Math.max(0, gb - providerConfig.freeGBIncluded)
      }
  
      // Calculate based on pricing model
      if (providerConfig.tieredPricing) {
        cost = this.calculateTieredCost(billableGB, providerConfig.tieredPricing)
      } else {
        cost = billableGB * (providerConfig.costPerGB || 0)
      }
  
      return {
        bandwidth: {
          gb: gb,
          cost: cost
        },
        total: cost,
        monthly: cost * 30,  // Assuming daily data
        yearly: cost * 365
      }
    }

    /**
     * Calculate bandwidth cost with explicit price per GB (USD)
     */
    calculateWithUnitPrice(bytesTransferred: number, pricePerGB: number): CostBreakdown {
      const gb = bytesTransferred / (1024 ** 3)
      const cost = gb * pricePerGB
      return {
        bandwidth: { gb, cost },
        total: cost,
        monthly: cost * 30,
        yearly: cost * 365
      }
    }
  
    /**
     * Calculate cost with tiered pricing
     */
    private calculateTieredCost(gb: number, tiers: TierPrice[]): number {
      let remainingGB = gb
      let totalCost = 0
      let previousTierLimit = 0
  
      for (const tier of tiers) {
        const tierGB = Math.min(remainingGB, tier.upToGB - previousTierLimit)
        
        if (tierGB > 0) {
          totalCost += tierGB * tier.costPerGB
          remainingGB -= tierGB
          previousTierLimit = tier.upToGB
        }
  
        if (remainingGB <= 0) break
      }
  
      return totalCost
    }
  
    /**
     * Calculate potential savings by blocking specific bot categories
     */
    calculateSavingsByCategory(
      botTraffic: Array<{
        category: string
        bytesTransferred: number
        requestCount: number
      }>,
      provider: string = 'generic'
    ): {
      total: number
      monthly: number
      yearly: number
      byCategory: Record<string, CostBreakdown>
    } {
      const breakdown: Record<string, CostBreakdown> = {}
      let totalSavings = 0
  
      for (const bot of botTraffic) {
        const multiplier = this.botCostMultipliers[bot.category] || 1.0
        const adjustedBytes = bot.bytesTransferred * multiplier
        
        const cost = this.calculateBandwidthCost(adjustedBytes, provider)
        breakdown[bot.category] = cost
        totalSavings += cost.total
      }
  
      return {
        total: totalSavings,
        monthly: totalSavings * 30,
        yearly: totalSavings * 365,
        byCategory: breakdown
      }
    }
  
    /**
     * Calculate ROI of implementing bot blocking
     */
    calculateROI(
      currentBotTraffic: number, // bytes per day
      provider: string,
      implementationCost: number = 0
    ): {
      breakEvenDays: number
      monthlySavings: number
      yearlySavings: number
      roi: number
    } {
      const dailyCost = this.calculateBandwidthCost(currentBotTraffic, provider)
      const monthlySavings = dailyCost.monthly
      const yearlySavings = dailyCost.yearly
      
      const breakEvenDays = implementationCost > 0 
        ? Math.ceil(implementationCost / dailyCost.total)
        : 0
  
      const roi = implementationCost > 0
        ? ((yearlySavings - implementationCost) / implementationCost) * 100
        : Infinity
  
      return {
        breakEvenDays,
        monthlySavings,
        yearlySavings,
        roi
      }
    }
  
    /**
     * Smart recommendations based on traffic patterns
     */
    generateRecommendations(
      botTraffic: Array<{
        botName: string
        category: string
        bytesTransferred: number
        requestCount: number
      }>,
      provider: string = 'generic'
    ): Array<{
      action: 'block' | 'rate_limit' | 'allow'
      target: string
      reason: string
      savingsPerMonth: number
      confidence: number
    }> {
      const recommendations: Array<{
        action: 'block' | 'rate_limit' | 'allow'
        target: string
        reason: string
        savingsPerMonth: number
        confidence: number
      }> = []
  
      for (const bot of botTraffic) {
        const cost = this.calculateBandwidthCost(bot.bytesTransferred, provider)
        const monthlyCost = cost.monthly
  
        // Decision logic based on bot category and cost
        if (bot.category === 'ai_scraper' && monthlyCost > 10) {
          recommendations.push({
            action: 'block',
            target: bot.botName,
            reason: `Aggressive scraper costing $${monthlyCost.toFixed(2)}/month with minimal SEO benefit`,
            savingsPerMonth: monthlyCost,
            confidence: 0.95
          })
        } else if (bot.category === 'ai_training' && monthlyCost > 50) {
          recommendations.push({
            action: 'rate_limit',
            target: bot.botName,
            reason: `AI training bot consuming excessive bandwidth. Rate limiting can reduce costs by 70%`,
            savingsPerMonth: monthlyCost * 0.7,
            confidence: 0.85
          })
        } else if (bot.category === 'search_engine') {
          recommendations.push({
            action: 'allow',
            target: bot.botName,
            reason: 'Essential for SEO and organic traffic',
            savingsPerMonth: 0,
            confidence: 1.0
          })
        } else if (bot.category === 'seo_tool' && monthlyCost > 20) {
          recommendations.push({
            action: 'rate_limit',
            target: bot.botName,
            reason: `SEO tool with high bandwidth usage. Consider rate limiting to reduce costs`,
            savingsPerMonth: monthlyCost * 0.5,
            confidence: 0.75
          })
        }
      }
  
      // Sort by potential savings
      return recommendations.sort((a, b) => b.savingsPerMonth - a.savingsPerMonth)
    }
  
    /**
     * Format bytes to human readable string
     */
    formatBytes(bytes: number): string {
      if (bytes === 0) return '0 B'
      
      const k = 1024
      const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
      const i = Math.floor(Math.log(bytes) / Math.log(k))
      
      return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
    }
  
    /**
     * Format currency
     */
    formatCurrency(amount: number): string {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(amount)
    }
  
    /**
     * Get all supported providers
     */
    getSupportedProviders(): Array<{ value: string; label: string }> {
      return Array.from(this.providers.entries()).map(([key, provider]) => ({
        value: key,
        label: provider.name
      }))
    }
  }
  
  // Export singleton instance
  export const costCalculator = new CostCalculator()
