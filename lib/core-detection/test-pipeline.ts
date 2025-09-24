// Test Pipeline - Comprehensive testing of the Core Detection Engine
// Validates all components with realistic sample data

import { NormalizedLog } from '@/lib/integrations/base'
import { coreDetectionEngine, DetectionUtils } from './index'

interface TestResult {
  success: boolean
  message: string
  details?: any
  performance?: {
    duration: number
    memoryUsed: number
  }
}

export class PipelineTestSuite {
  /**
   * Generate realistic sample data for testing
   */
  static generateSampleLogs(count: number = 1000): NormalizedLog[] {
    const logs: NormalizedLog[] = []
    const now = new Date()

    // Bot user agents for testing
    const botUserAgents = [
      'GPTBot/1.0',
      'ChatGPT-User/1.0',
      'CCBot/2.0 (https://commoncrawl.org/faq/)',
      'Googlebot/2.1 (+http://www.google.com/bot.html)',
      'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
      'anthropic-ai/1.0',
      'PerplexityBot/1.0',
      'python-requests/2.28.1',
      'curl/7.68.0'
    ]

    // Human user agents
    const humanUserAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
    ]

    // Common paths
    const paths = [
      '/',
      '/about',
      '/contact',
      '/products',
      '/blog',
      '/api/data',
      '/robots.txt',
      '/sitemap.xml',
      '/page/1',
      '/page/2',
      '/page/3',
      '/product/123',
      '/product/456',
      '/article/789',
      '/assets/css/style.css',
      '/assets/js/app.js',
      '/images/logo.png'
    ]

    // Generate logs
    for (let i = 0; i < count; i++) {
      const isBot = Math.random() < 0.3 // 30% bots
      const userAgent = isBot
        ? botUserAgents[Math.floor(Math.random() * botUserAgents.length)]
        : humanUserAgents[Math.floor(Math.random() * humanUserAgents.length)]

      // Generate IP addresses
      const ip = this.generateRandomIP()

      // Generate timestamp within last 48 hours
      const timestamp = new Date(now.getTime() - Math.random() * 48 * 60 * 60 * 1000)

      // Select path (bots more likely to access certain paths)
      let path: string
      if (isBot && Math.random() < 0.3) {
        path = Math.random() < 0.5 ? '/robots.txt' : '/sitemap.xml'
      } else if (isBot && Math.random() < 0.4) {
        // Sequential access pattern for bots
        path = `/page/${Math.floor(Math.random() * 10) + 1}`
      } else {
        path = paths[Math.floor(Math.random() * paths.length)]
      }

      logs.push({
        timestamp,
        ip_address: ip,
        user_agent: userAgent,
        method: 'GET',
        path,
        status_code: Math.random() < 0.95 ? 200 : 404,
        bytes_transferred: Math.floor(Math.random() * 1000000) + 1000, // 1KB to 1MB
        response_time_ms: Math.floor(Math.random() * 2000) + 10, // 10ms to 2s
        is_bot: false // Will be determined by detection engine
      })
    }

    return logs.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
  }

  private static generateRandomIP(): string {
    // Generate realistic IP addresses (some from known bot ranges)
    const knownBotRanges = [
      '66.249.64', // Google
      '20.171.0',  // OpenAI
      '54.36.148'  // Common Crawl
    ]

    if (Math.random() < 0.2) {
      // 20% from known bot ranges
      const range = knownBotRanges[Math.floor(Math.random() * knownBotRanges.length)]
      return `${range}.${Math.floor(Math.random() * 256)}`
    } else {
      // Random IP
      return [
        Math.floor(Math.random() * 256),
        Math.floor(Math.random() * 256),
        Math.floor(Math.random() * 256),
        Math.floor(Math.random() * 256)
      ].join('.')
    }
  }

  /**
   * Test signature matching
   */
  static async testSignatureMatching(): Promise<TestResult> {
    try {
      const startTime = Date.now()
      const startMemory = this.getMemoryUsage()

      const logs = this.generateSampleLogs(100)
      const result = await coreDetectionEngine.analyze(logs, 'test-website-1')

      const endTime = Date.now()
      const endMemory = this.getMemoryUsage()

      // Validate results
      const { botAnalysis } = result
      const hasKnownBots = botAnalysis.bots.some(bot =>
        ['GPTBot', 'Googlebot', 'CCBot'].includes(bot.classification.botName || '')
      )

      return {
        success: hasKnownBots,
        message: hasKnownBots
          ? 'Signature matching detected known bots correctly'
          : 'Signature matching may have missed known bots',
        details: {
          totalBots: botAnalysis.bots.length,
          knownBots: botAnalysis.bots.filter(bot =>
            ['GPTBot', 'Googlebot', 'CCBot'].includes(bot.classification.botName || '')
          ).map(bot => bot.classification.botName)
        },
        performance: {
          duration: endTime - startTime,
          memoryUsed: endMemory - startMemory
        }
      }
    } catch (error) {
      return {
        success: false,
        message: `Signature matching test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { error }
      }
    }
  }

  /**
   * Test velocity analysis
   */
  static async testVelocityAnalysis(): Promise<TestResult> {
    try {
      const startTime = Date.now()

      // Generate logs with rapid requests from same IP
      const logs: NormalizedLog[] = []
      const rapidIP = '192.168.1.100'
      const baseTime = new Date()

      // Create 50 rapid requests within 10 seconds
      for (let i = 0; i < 50; i++) {
        logs.push({
          timestamp: new Date(baseTime.getTime() + i * 200), // 200ms intervals
          ip_address: rapidIP,
          user_agent: 'RapidBot/1.0',
          method: 'GET',
          path: `/page/${i}`,
          status_code: 200,
          bytes_transferred: 5000,
          response_time_ms: 50,
          is_bot: false
        })
      }

      // Add some normal requests
      const normalLogs = this.generateSampleLogs(50)
      logs.push(...normalLogs)

      const result = await coreDetectionEngine.analyze(logs, 'test-website-2')
      const endTime = Date.now()

      // Check if rapid IP was detected as bot
      const rapidIPBot = result.botAnalysis.bots.find(bot => bot.ip === rapidIP)
      const detected = rapidIPBot && rapidIPBot.analysis.velocity.isBot

      return {
        success: detected || false,
        message: detected
          ? 'Velocity analysis correctly detected rapid requests'
          : 'Velocity analysis may have missed rapid request pattern',
        details: {
          rapidIPDetected: !!rapidIPBot,
          velocityData: rapidIPBot?.analysis.velocity,
          totalBots: result.botAnalysis.bots.length
        },
        performance: {
          duration: endTime - startTime,
          memoryUsed: 0
        }
      }
    } catch (error) {
      return {
        success: false,
        message: `Velocity analysis test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { error }
      }
    }
  }

  /**
   * Test pattern detection
   */
  static async testPatternDetection(): Promise<TestResult> {
    try {
      const startTime = Date.now()

      // Generate logs with sequential access pattern
      const logs: NormalizedLog[] = []
      const sequentialIP = '10.0.0.50'
      const baseTime = new Date()

      // Create sequential page access
      for (let i = 1; i <= 20; i++) {
        logs.push({
          timestamp: new Date(baseTime.getTime() + i * 5000), // 5 second intervals
          ip_address: sequentialIP,
          user_agent: 'SequentialBot/1.0',
          method: 'GET',
          path: `/page/${i}`,
          status_code: 200,
          bytes_transferred: 10000,
          response_time_ms: 100,
          is_bot: false
        })
      }

      // Add sitemap access
      logs.push({
        timestamp: new Date(baseTime.getTime()),
        ip_address: sequentialIP,
        user_agent: 'SequentialBot/1.0',
        method: 'GET',
        path: '/sitemap.xml',
        status_code: 200,
        bytes_transferred: 5000,
        response_time_ms: 50,
        is_bot: false
      })

      // Add normal logs
      const normalLogs = this.generateSampleLogs(30)
      logs.push(...normalLogs)

      const result = await coreDetectionEngine.analyze(logs, 'test-website-3')
      const endTime = Date.now()

      // Check if sequential pattern was detected
      const sequentialBot = result.botAnalysis.bots.find(bot => bot.ip === sequentialIP)
      const sequentialPattern = sequentialBot?.analysis.pattern.type === 'sequential'
      const systematicPattern = sequentialBot?.analysis.pattern.indicators.sitemapAccess

      return {
        success: sequentialPattern || systematicPattern || false,
        message: (sequentialPattern || systematicPattern)
          ? 'Pattern detection correctly identified systematic access'
          : 'Pattern detection may have missed systematic patterns',
        details: {
          sequentialDetected: sequentialPattern,
          sitemapAccess: systematicPattern,
          patternData: sequentialBot?.analysis.pattern,
          totalBots: result.botAnalysis.bots.length
        },
        performance: {
          duration: endTime - startTime,
          memoryUsed: 0
        }
      }
    } catch (error) {
      return {
        success: false,
        message: `Pattern detection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { error }
      }
    }
  }

  /**
   * Test cost analysis integration
   */
  static async testCostAnalysis(): Promise<TestResult> {
    try {
      const startTime = Date.now()

      const logs = this.generateSampleLogs(200)
      const result = await coreDetectionEngine.analyze(logs, 'test-website-4', {
        provider: 'cloudflare',
        includesCosts: true,
        pricePerGB: 0.045
      })

      const endTime = Date.now()

      const hasCostAnalysis = !!result.costAnalysis
      const hasSummary = !!result.costAnalysis?.summary

      return {
        success: hasCostAnalysis && hasSummary,
        message: (hasCostAnalysis && hasSummary)
          ? 'Cost analysis integration working correctly'
          : 'Cost analysis integration may be missing',
        details: {
          costAnalysisPresent: hasCostAnalysis,
          summaryPresent: hasSummary,
          botCostsCount: result.costAnalysis?.byBot?.length || 0,
          totalCost: result.costAnalysis?.summary?.totalCost || 0,
          totalBandwidth: result.costAnalysis?.summary?.totalBandwidth || 0
        },
        performance: {
          duration: endTime - startTime,
          memoryUsed: 0
        }
      }
    } catch (error) {
      return {
        success: false,
        message: `Cost analysis test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { error }
      }
    }
  }

  /**
   * Test pipeline performance with large dataset
   */
  static async testPerformance(): Promise<TestResult> {
    try {
      const startTime = Date.now()
      const startMemory = this.getMemoryUsage()

      // Generate large dataset
      const logs = this.generateSampleLogs(5000)

      const result = await coreDetectionEngine.analyze(logs, 'test-website-performance', {
        provider: 'vercel',
        includesCosts: true
      })

      const endTime = Date.now()
      const endMemory = this.getMemoryUsage()

      const duration = endTime - startTime
      const memoryUsed = endMemory - startMemory

      // Performance thresholds
      const maxDuration = 30000 // 30 seconds
      const maxMemory = 100 // 100MB

      const performanceOK = duration < maxDuration && memoryUsed < maxMemory

      return {
        success: performanceOK,
        message: performanceOK
          ? 'Performance test passed within acceptable limits'
          : 'Performance test exceeded acceptable limits',
        details: {
          duration,
          memoryUsed,
          logsProcessed: logs.length,
          botsDetected: result.botAnalysis.bots.length,
          throughput: Math.round(logs.length / (duration / 1000)), // logs per second
          summary: DetectionUtils.getStatsSummary(result.botAnalysis)
        },
        performance: {
          duration,
          memoryUsed
        }
      }
    } catch (error) {
      return {
        success: false,
        message: `Performance test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { error }
      }
    }
  }

  /**
   * Run comprehensive test suite
   */
  static async runFullTestSuite(): Promise<{
    overall: boolean
    results: Record<string, TestResult>
    summary: {
      passed: number
      failed: number
      totalDuration: number
    }
  }> {
    console.log('Starting Core Detection Engine Test Suite...')

    const tests = {
      signatureMatching: () => this.testSignatureMatching(),
      velocityAnalysis: () => this.testVelocityAnalysis(),
      patternDetection: () => this.testPatternDetection(),
      costAnalysis: () => this.testCostAnalysis(),
      performance: () => this.testPerformance()
    }

    const results: Record<string, TestResult> = {}
    let totalDuration = 0
    let passed = 0
    let failed = 0

    for (const [testName, testFn] of Object.entries(tests)) {
      console.log(`Running ${testName} test...`)
      const result = await testFn()
      results[testName] = result

      if (result.success) {
        passed++
        console.log(`✓ ${testName}: ${result.message}`)
      } else {
        failed++
        console.log(`✗ ${testName}: ${result.message}`)
      }

      if (result.performance) {
        totalDuration += result.performance.duration
      }
    }

    const overall = failed === 0

    console.log(`\nTest Suite Complete: ${passed} passed, ${failed} failed`)
    console.log(`Total Duration: ${totalDuration}ms`)

    return {
      overall,
      results,
      summary: {
        passed,
        failed,
        totalDuration
      }
    }
  }

  private static getMemoryUsage(): number {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const usage = process.memoryUsage()
      return Math.round(usage.heapUsed / 1024 / 1024)
    }
    return 0
  }
}

// Export for use in testing
export { PipelineTestSuite }