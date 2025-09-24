import { NextRequest, NextResponse } from 'next/server'
import { createNetlifyService } from '@/lib/integrations/netlify.service'

export async function GET(_request: NextRequest) {
  try {
    // This would normally require a valid access token from OAuth flow
    // For testing, we'll simulate what would happen

    console.log('🔍 Attempting to fetch real Netlify logs for aryanb.netlify.app')

    // Check if we have environment variables for direct API access
    const testToken = process.env.NETLIFY_TEST_TOKEN

    if (!testToken) {
      return NextResponse.json({
        message: 'No Netlify access token available',
        explanation: [
          'To fetch real logs from aryanb.netlify.app, you need:',
          '1. Valid Netlify access token (OAuth or Personal Access Token)',
          '2. Access to the specific site (must be owner/collaborator)',
          '3. Enterprise plan for log drain access',
          '',
          'Alternative approaches:',
          '- Use Netlify Analytics API (limited data)',
          '- Set up log drains to external service',
          '- Upload server logs manually via /upload endpoint',
          '',
          'The site appears active but logs require proper authentication.'
        ]
      })
    }

    // If we have a token, try to fetch site info
    const netlifyService = createNetlifyService(testToken)

    console.log('🔗 Testing Netlify API connection...')
    const connectionTest = await netlifyService.testConnection()

    if (!connectionTest.success) {
      return NextResponse.json({
        error: 'Failed to connect to Netlify API',
        details: connectionTest.error,
        note: 'This is expected if you don\'t have access to aryanb.netlify.app'
      })
    }

    console.log('✅ Connected to Netlify API')
    console.log('📊 Available sites:', connectionTest.sites?.length || 0)

    // Try to find the specific site
    const sites = await netlifyService.getSites()
    const targetSite = sites.find(site =>
      site.url?.includes('aryanb.netlify.app') ||
      site.name?.includes('aryanb')
    )

    if (!targetSite) {
      return NextResponse.json({
        message: 'Site not found in accessible sites',
        explanation: [
          'aryanb.netlify.app was not found in your Netlify account.',
          'This means either:',
          '1. You don\'t have access to this site',
          '2. Site is in a different Netlify account',
          '3. Site name/domain doesn\'t match exactly',
          '',
          `Found ${sites.length} sites in your account:`,
          ...sites.slice(0, 3).map(s => `- ${s.name} (${s.url})`),
          sites.length > 3 ? '- ...' : ''
        ]
      })
    }

    console.log('🎯 Found target site:', targetSite.name)

    // Generate webhook configuration for log drains
    const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/webhooks/netlify`
    const logDrainConfig = await netlifyService.getLogDrainConfiguration(
      targetSite.id,
      `${webhookUrl}?websiteUrl=https://aryanb.netlify.app/`
    )

    return NextResponse.json({
      success: true,
      site: {
        id: targetSite.id,
        name: targetSite.name,
        url: targetSite.url,
        plan: targetSite.plan
      },
      logDrainConfig,
      note: 'Real logs require Enterprise plan and manual log drain setup via Netlify UI'
    })

  } catch (error) {
    console.error('Error testing Netlify logs:', error)
    return NextResponse.json({
      error: 'Failed to fetch Netlify logs',
      details: error instanceof Error ? error.message : 'Unknown error',
      suggestion: 'Try the manual upload option at /upload if you have log files'
    }, { status: 500 })
  }
}
