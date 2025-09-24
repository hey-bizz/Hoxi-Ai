// Test Enhanced Detection Engine with Bot Signatures
// Validates the detection engine with loaded bot signatures

import { coreDetectionEngine, signatureLoader } from '../lib/core-detection'
import { NormalizedLog } from '../lib/integrations/base'

async function testEnhancedDetection() {
  console.log('🚀 Testing Enhanced Detection Engine with Bot Signatures...\n')

  // Test 1: Load and verify signatures
  console.log('📋 Loading bot signatures...')
  await signatureLoader.loadSignatures()

  const stats = signatureLoader.getStatistics()
  console.log(`✅ Loaded ${stats.total} signatures`)
  console.log(`   Categories:`, stats.byCategory)
  console.log(`   High-impact bots: ${stats.byImpact.high || 0} high + ${stats.byImpact.extreme || 0} extreme`)
  console.log(`   With IP verification: ${stats.withIPRanges}`)
  console.log('')

  // Test 2: Test known bot detection
  console.log('🤖 Testing known bot detection...')

  const testUserAgents = [
    'GPTBot/1.0',
    'ChatGPT-User/1.0',
    'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    'CCBot/2.0 (https://commoncrawl.org/faq/)',
    'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
    'Bytespider/1.0',
    'anthropic-ai/1.0',
    'PerplexityBot/1.0',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'  // Human
  ]

  const testLogs: NormalizedLog[] = testUserAgents.map((ua, i) => ({
    timestamp: new Date(Date.now() - i * 60000), // 1 minute apart
    ip_address: `192.168.1.${100 + i}`,
    user_agent: ua,
    method: 'GET',
    path: i === 0 ? '/robots.txt' : `/page/${i}`,
    status_code: 200,
    bytes_transferred: 5000 + i * 1000,
    response_time_ms: 100 + i * 10,
    is_bot: false // Will be determined by detection engine
  }))

  const result = await coreDetectionEngine.analyze(testLogs, 'test-website', {
    provider: 'cloudflare',
    includesCosts: true,
    pricePerGB: 0.045
  })

  console.log(`Detected ${result.botAnalysis.bots.length} bots out of ${testLogs.length} requests`)

  result.botAnalysis.bots.forEach(bot => {
    console.log(`   🤖 ${bot.classification.botName} (${bot.classification.category})`)
    console.log(`      Confidence: ${Math.round(bot.classification.confidence * 100)}%`)
    console.log(`      Impact: ${bot.classification.impact}`)
    console.log(`      Verified: ${bot.classification.verified ? '✓' : '✗'}`)
    console.log('')
  })

  // Test 3: Performance test with larger dataset
  console.log('⚡ Performance test with 1000 logs...')

  const largeLogs: NormalizedLog[] = []
  const botUAs = [
    'GPTBot/1.0', 'Googlebot/2.1', 'CCBot/2.0', 'bingbot/2.0',
    'YandexBot/3.0', 'AhrefsBot/7.0', 'SemrushBot/7.0'
  ]

  for (let i = 0; i < 1000; i++) {
    const isBot = Math.random() < 0.3 // 30% bots
    largeLogs.push({
      timestamp: new Date(Date.now() - i * 1000),
      ip_address: `10.0.${Math.floor(i / 256)}.${i % 256}`,
      user_agent: isBot
        ? botUAs[Math.floor(Math.random() * botUAs.length)]
        : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      method: 'GET',
      path: `/page/${i}`,
      status_code: 200,
      bytes_transferred: Math.floor(Math.random() * 50000) + 1000,
      response_time_ms: Math.floor(Math.random() * 500) + 50,
      is_bot: false
    })
  }

  const startTime = Date.now()
  const largeResult = await coreDetectionEngine.analyze(largeLogs, 'performance-test', {
    provider: 'vercel',
    includesCosts: true
  })
  const processingTime = Date.now() - startTime

  console.log(`✅ Processed 1000 logs in ${processingTime}ms`)
  console.log(`   Detected ${largeResult.botAnalysis.bots.length} bots`)
  console.log(`   Throughput: ${Math.round(largeLogs.length / (processingTime / 1000))} logs/second`)

  if (largeResult.costAnalysis) {
    const totalCost = largeResult.costAnalysis.summary.totalMonthlyCost
    console.log(`   Monthly cost impact: $${totalCost.toFixed(2)}`)
    console.log(`   Total bandwidth: ${Math.round(largeResult.costAnalysis.summary.totalBandwidth / (1024 ** 3))}GB`)
  }

  // Test 4: Test specific bot categories
  console.log('\n📊 Testing bot categories...')

  const categoryTests = [
    { category: 'beneficial', bots: signatureLoader.getSignaturesByCategory('beneficial').slice(0, 5) },
    { category: 'extractive', bots: signatureLoader.getSignaturesByCategory('extractive').slice(0, 5) },
    { category: 'malicious', bots: signatureLoader.getSignaturesByCategory('malicious').slice(0, 5) }
  ]

  for (const test of categoryTests) {
    console.log(`\n${test.category.toUpperCase()} bots (${test.bots.length} tested):`)
    test.bots.forEach(bot => {
      console.log(`   • ${bot.name} - ${bot.metadata.purpose} (${bot.impact} impact)`)
    })
  }

  console.log('\n🎉 Enhanced Detection Engine test completed!')
}

// Run the test
testEnhancedDetection().catch(console.error)