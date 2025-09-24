// Cost Integration - Bridges detection engine with existing cost calculator
// Provides pure cost analysis based on bot detection (no recommendations)

import { BotAnalysis, DetectionResult, CostImpactAnalysis } from './types'
import { CostCalculator } from '@/lib/cost-calculator'

interface BotCostBreakdown {
  botName: string
  category: string
  subcategory?: string
  impact: string
  metrics: {
    requests: number
    bandwidth: number
    bandwidthGB: number
    timeSpan: number
  }
  costs: {
    current: number
    daily: number
    monthly: number
    yearly: number
  }
}

export class CostIntegrator {
  private costCalculator: CostCalculator

  constructor() {
    this.costCalculator = new CostCalculator()
  }

  /**
   * Calculate cost impact from bot analysis results
   */
  calculateCostImpact(
    analysis: BotAnalysis,
    provider: string,
    pricePerGB?: number
  ): CostImpactAnalysis {
    const botCosts = this.calculateBotCosts(analysis.bots, provider, pricePerGB)

    // Calculate summary totals
    const summary = {
      totalCost: botCosts.reduce((sum, bot) => sum + bot.costs.current, 0),
      totalMonthlyCost: botCosts.reduce((sum, bot) => sum + bot.costs.monthly, 0),
      totalYearlyCost: botCosts.reduce((sum, bot) => sum + bot.costs.yearly, 0),
      totalBandwidth: botCosts.reduce((sum, bot) => sum + bot.metrics.bandwidth, 0)
    }

    return {
      byBot: botCosts,
      summary
    }
  }

  /**
   * Calculate detailed cost breakdown for each detected bot
   */
  private calculateBotCosts(
    bots: DetectionResult[],
    provider: string,
    pricePerGB?: number
  ): BotCostBreakdown[] {
    return bots.map(bot => {
      const bandwidthGB = bot.bandwidth / (1024 ** 3)
      const timeSpanHours = (bot.timeRange.end.getTime() - bot.timeRange.start.getTime()) / (1000 * 60 * 60)

      // Calculate current costs
      let costBreakdown
      if (pricePerGB) {
        costBreakdown = this.costCalculator.calculateWithUnitPrice(bot.bandwidth, pricePerGB)
      } else {
        costBreakdown = this.costCalculator.calculateBandwidthCost(bot.bandwidth, provider)
      }

      return {
        botName: bot.classification.botName || 'Unknown Bot',
        category: bot.classification.category,
        subcategory: bot.classification.subcategory,
        impact: bot.classification.impact,
        metrics: {
          requests: bot.requestCount,
          bandwidth: bot.bandwidth,
          bandwidthGB,
          timeSpan: timeSpanHours
        },
        costs: {
          current: costBreakdown.total,
          daily: costBreakdown.total,
          monthly: costBreakdown.monthly,
          yearly: costBreakdown.yearly
        }
      }
    })
  }

  // Note: Removed recommendation generation methods - detection engine only provides data

  // Note: Removed ROI calculation methods - detection engine only provides raw cost data

  /**
   * Generate cost report summary (pure data, no recommendations)
   */
  generateCostReport(
    analysis: BotAnalysis,
    provider: string,
    pricePerGB?: number
  ): {
    summary: {
      totalCost: number
      totalBandwidth: number
    }
    breakdown: {
      byCategory: Record<string, { cost: number; percentage: number; bandwidth: number }>
      byImpact: Record<string, { cost: number; percentage: number; bandwidth: number }>
    }
    projections: {
      monthly: number
      yearly: number
    }
  } {
    const costImpact = this.calculateCostImpact(analysis, provider, pricePerGB)

    // Calculate by category and impact
    const byCategory: Record<string, { cost: number; percentage: number; bandwidth: number }> = {}
    const byImpact: Record<string, { cost: number; percentage: number; bandwidth: number }> = {}

    for (const bot of costImpact.byBot) {
      // By category
      const category = bot.category
      if (!byCategory[category]) byCategory[category] = { cost: 0, percentage: 0, bandwidth: 0 }
      byCategory[category].cost += bot.costs.current
      byCategory[category].bandwidth += bot.metrics.bandwidth

      // By impact
      const impact = bot.impact
      if (!byImpact[impact]) byImpact[impact] = { cost: 0, percentage: 0, bandwidth: 0 }
      byImpact[impact].cost += bot.costs.current
      byImpact[impact].bandwidth += bot.metrics.bandwidth
    }

    // Calculate percentages
    const totalCost = costImpact.summary.totalCost
    for (const category of Object.keys(byCategory)) {
      byCategory[category].percentage = totalCost > 0 ? (byCategory[category].cost / totalCost) * 100 : 0
    }
    for (const impact of Object.keys(byImpact)) {
      byImpact[impact].percentage = totalCost > 0 ? (byImpact[impact].cost / totalCost) * 100 : 0
    }

    return {
      summary: {
        totalCost: costImpact.summary.totalCost,
        totalBandwidth: costImpact.summary.totalBandwidth
      },
      breakdown: {
        byCategory,
        byImpact
      },
      projections: {
        monthly: costImpact.summary.totalMonthlyCost,
        yearly: costImpact.summary.totalYearlyCost
      }
    }
  }

  /**
   * Update cost calculator configuration
   */
  updateCostCalculator(config: any): void {
    // If the cost calculator has an update method
    // this.costCalculator.updateConfig(config)
  }
}

// Export singleton instance
export const costIntegrator = new CostIntegrator()