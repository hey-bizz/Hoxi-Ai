import { NextRequest, NextResponse } from 'next/server'
import type { Provider } from '@/lib/integrations/base'

export const runtime = 'nodejs'

export async function POST(request: NextRequest, context: { params: Promise<{ provider: string }> | { provider: string } }) {
  const p = await Promise.resolve(context.params as { provider: string } | Promise<{ provider: string }>)
  const provider = ((p?.provider as string) || 'unknown') as Provider

  try {
    const body: Record<string, unknown> = await request.json().catch(() => ({} as Record<string, unknown>))

    switch (provider) {
      case 'cloudflare': {
        // Accept token from JSON body, Authorization header (Bearer), or x-cf-api-token header
        const authHeader = request.headers.get('authorization') || ''
        const bearer = authHeader.toLowerCase().startsWith('bearer ')
          ? authHeader.slice(7).trim()
          : ''
        const headerToken = request.headers.get('x-cf-api-token') || ''
        const bodyToken = (body?.apiToken as string | undefined) || ''
        const apiToken = bodyToken || bearer || headerToken
        return await handleCloudflare(apiToken)
      }
      case 'vercel':
        return NextResponse.json({
          url: buildOAuthUrl('vercel'),
        })
      case 'netlify':
        return NextResponse.json({
          url: buildOAuthUrl('netlify'),
        })
      case 'aws':
        return NextResponse.json({
          instructions: 'Create cross-account role with sts:AssumeRole and CloudWatch Logs read permissions.',
          policyExamples: ['logs:FilterLogEvents', 'logs:GetLogEvents', 'logs:DescribeLogGroups', 'logs:DescribeLogStreams']
        })
      default:
        return NextResponse.json({ error: 'Unsupported provider' }, { status: 400 })
    }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to initialize authorization'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

async function handleCloudflare(apiToken?: string) {
  if (!apiToken) {
    return NextResponse.json({ error: 'apiToken is required' }, { status: 400 })
  }

  const headers = {
    Authorization: `Bearer ${apiToken}`,
    'Content-Type': 'application/json'
  }

  // 1) Verify token (does not require broad scopes)
  let verifyOk = false
  try {
    let verifyRes = await fetch('https://api.cloudflare.com/client/v4/user/tokens/verify', { headers })
    let verifyJson: unknown = await verifyRes.json().catch(() => ({}))
    verifyOk = verifyRes.ok && !!(verifyJson as { success?: boolean })?.success
    if (!verifyOk) {
      // fallback to POST as per Cloudflare docs
      verifyRes = await fetch('https://api.cloudflare.com/client/v4/user/tokens/verify', {
        method: 'POST',
        headers,
        body: JSON.stringify({})
      })
      verifyJson = await verifyRes.json().catch(() => ({}))
      verifyOk = verifyRes.ok && !!(verifyJson as { success?: boolean })?.success
    }
  } catch {
    verifyOk = false
  }
  if (!verifyOk) return NextResponse.json({ error: 'Invalid Cloudflare API token' }, { status: 401 })

  // 2) Try to get user email (optional; some tokens may not allow this)
  let email: string | null = null
  try {
    const userRes = await fetch('https://api.cloudflare.com/client/v4/user', { headers })
    const userJson: unknown = await userRes.json().catch(() => ({}))
    if (userRes.ok && (userJson as { success?: boolean })?.success) {
      email = (userJson as { result?: { email?: string } })?.result?.email || null
    }
  } catch {
    // ignore
  }

  // 3) Try to list zones (optional; requires Zone.Read). If denied, return success with empty zones and a warning.
  let zones: Array<{ id?: string; name?: string; plan?: string }> = []
  let warning: string | undefined
  try {
    const zonesRes = await fetch('https://api.cloudflare.com/client/v4/zones', { headers })
    const zonesJson: unknown = await zonesRes.json().catch(() => ({}))
    const ok = zonesRes.ok && (zonesJson as { success?: boolean })?.success
    if (ok && Array.isArray((zonesJson as { result?: unknown[] })?.result)) {
      zones = ((zonesJson as { result?: unknown[] }).result as unknown[]).map((z) => {
        const obj = z as { id?: string; name?: string; plan?: { name?: string } }
        return { id: obj.id, name: obj.name, plan: obj.plan?.name }
      })
    } else if (!ok) {
      warning = 'Token verified, but lacks permission to list zones (add Zone:Read)'
    }
  } catch {
    warning = 'Token verified, but zone listing failed'
  }

  return NextResponse.json({
    success: true,
    email,
    zones,
    warning
  })
}

function buildOAuthUrl(provider: 'vercel' | 'netlify'): string | undefined {
  if (provider === 'vercel') {
    const id = process.env.VERCEL_CLIENT_ID
    const redirect = process.env.VERCEL_REDIRECT_URI
    if (!id || !redirect) return undefined
    const scope = encodeURIComponent('read:projects read:logs')
    return `https://vercel.com/integrations/oauth/authorize?client_id=${encodeURIComponent(id)}&redirect_uri=${encodeURIComponent(redirect)}&scope=${scope}`
  }
  if (provider === 'netlify') {
    const id = process.env.NETLIFY_CLIENT_ID
    const redirect = process.env.NETLIFY_REDIRECT_URI
    if (!id || !redirect) return undefined
    return `https://app.netlify.com/authorize?response_type=code&client_id=${encodeURIComponent(id)}&redirect_uri=${encodeURIComponent(redirect)}`
  }
}