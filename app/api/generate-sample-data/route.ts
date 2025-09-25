import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// Generate sample bot traffic data for demo purposes
export async function POST(request: NextRequest) {
  try {
    const { websiteId, timeRange = '24h' } = await request.json()

    if (!websiteId) {
      return NextResponse.json({ error: 'Missing websiteId' }, { status: 400 })
    }

    console.log(`🔄 Generating sample data for website: ${websiteId}`)

    // Create or ensure website exists
    const { data: existingWebsite } = await supabaseAdmin
      .from('websites')
      .select('id')
      .eq('id', websiteId)
      .single()

    if (!existingWebsite) {
      const { error: websiteError } = await supabaseAdmin
        .from('websites')
        .insert({
          id: websiteId,
          domain: 'demo.example.com',
          url: 'https://demo.example.com',
          name: 'Demo Website',
          provider: 'demo',
          user_id: null // Allow null for demo purposes
        })

      if (websiteError) {
        console.error('Failed to create website:', websiteError)
        throw websiteError
      }
      console.log(`✅ Created website record for ${websiteId}`)
    }

    // Clear existing data for this website
    await supabaseAdmin
      .from('traffic_logs')
      .delete()
      .eq('website_id', websiteId)

    // Generate realistic sample logs directly
    const sampleTrafficLogs = generateSampleTrafficLogs(websiteId)

    // Insert traffic logs
    const { error: trafficError } = await supabaseAdmin
      .from('traffic_logs')
      .insert(sampleTrafficLogs)

    if (trafficError) {
      console.error('Failed to insert traffic logs:', trafficError)
      throw trafficError
    }

    const botLogs = sampleTrafficLogs.filter(log => log.is_bot)
    const humanLogs = sampleTrafficLogs.filter(log => !log.is_bot)

    console.log(`✅ Generated sample data: ${sampleTrafficLogs.length} traffic logs (${botLogs.length} bot, ${humanLogs.length} human)`)

    return NextResponse.json({
      success: true,
      message: `Generated ${sampleTrafficLogs.length} traffic logs`,
      stats: {
        totalRequests: sampleTrafficLogs.length,
        botRequests: botLogs.length,
        humanRequests: humanLogs.length,
        totalLogs: sampleTrafficLogs.length
      },
      websiteId
    })

  } catch (error) {
    console.error('Error generating sample data:', error)
    return NextResponse.json(
      { error: 'Failed to generate sample data' },
      { status: 500 }
    )
  }
}

function generateSampleTrafficLogs(websiteId: string) {
  const logs: any[] = []
  const now = new Date()

  // Sample bot user agents with varying activity levels
  const botConfigs = [
    {
      userAgent: 'Mozilla/5.0 (compatible; GPTBot/1.0; +https://openai.com/gptbot)',
      name: 'GPTBot',
      requests: 45,
      avgBytes: 15000,
      category: 'ai_training'
    },
    {
      userAgent: 'CCBot/2.0 (https://commoncrawl.org/faq/)',
      name: 'CCBot',
      requests: 78,
      avgBytes: 25000,
      category: 'ai_scraper'
    },
    {
      userAgent: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      name: 'Googlebot',
      requests: 32,
      avgBytes: 8000,
      category: 'search_engine'
    },
    {
      userAgent: 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
      name: 'bingbot',
      requests: 28,
      avgBytes: 7500,
      category: 'search_engine'
    },
    {
      userAgent: 'Claude-Web/1.0',
      name: 'Claude-Web',
      requests: 38,
      avgBytes: 12000,
      category: 'ai_training'
    },
    {
      userAgent: 'Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)',
      name: 'AhrefsBot',
      requests: 55,
      avgBytes: 18000,
      category: 'seo_tool'
    }
  ]

  // Generate human traffic
  const humanUserAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  ]

  // Generate bot logs
  botConfigs.forEach((botConfig, botIndex) => {
    for (let i = 0; i < botConfig.requests; i++) {
      const timestamp = new Date(now.getTime() - Math.random() * 24 * 60 * 60 * 1000)
      const bytesVariation = 0.5 + Math.random()
      const bytes = Math.round(botConfig.avgBytes * bytesVariation)

      logs.push({
        website_id: websiteId,
        timestamp: timestamp.toISOString(),
        user_agent: botConfig.userAgent,
        bot_name: botConfig.name,
        is_bot: true,
        bot_category: botConfig.category,
        bytes_transferred: bytes,
        response_time_ms: Math.round(50 + Math.random() * 200),
        path: getRandomPath()
      })
    }
  })

  // Generate human logs (fewer, mixed in)
  for (let i = 0; i < 120; i++) {
    const timestamp = new Date(now.getTime() - Math.random() * 24 * 60 * 60 * 1000)
    const userAgent = humanUserAgents[Math.floor(Math.random() * humanUserAgents.length)]

    logs.push({
      website_id: websiteId,
      timestamp: timestamp.toISOString(),
      user_agent: userAgent,
      bot_name: null,
      is_bot: false,
      bot_category: null,
      bytes_transferred: Math.round(2000 + Math.random() * 8000),
      response_time_ms: Math.round(20 + Math.random() * 100),
      path: getRandomPath()
    })
  }

  // Sort by timestamp
  return logs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
}

function getRandomPath(): string {
  const paths = [
    '/',
    '/about',
    '/products',
    '/api/data',
    '/blog',
    '/contact',
    '/sitemap.xml',
    '/robots.txt',
    '/api/users',
    '/dashboard',
    '/login',
    '/signup',
    '/pricing',
    '/docs',
    '/help',
    '/search'
  ]
  return paths[Math.floor(Math.random() * paths.length)]
}
