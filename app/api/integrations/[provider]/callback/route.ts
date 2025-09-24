import { NextRequest, NextResponse } from 'next/server'
import type { Provider } from '@/lib/integrations/base'

export const runtime = 'nodejs'

export async function GET(request: NextRequest, context: { params: Promise<{ provider: string }> | { provider: string } }) {
  const p = await Promise.resolve(context.params as { provider: string } | Promise<{ provider: string }>)
  const provider = ((p?.provider as string) || 'unknown') as Provider
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')

  try {
    switch (provider) {
      case 'vercel': {
        if (!code) return NextResponse.json({ error: 'Missing code' }, { status: 400 })
        const token = await exchangeVercelCode(code)
        return NextResponse.json({ success: true, credentials: { accessToken: token } })
      }
      case 'netlify': {
        if (!code) return NextResponse.json({ error: 'Missing code' }, { status: 400 })
        const token = await exchangeNetlifyCode(code)
        return NextResponse.json({ success: true, credentials: { accessToken: token } })
      }
      default:
        return NextResponse.json({ error: 'Unsupported provider' }, { status: 400 })
    }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Authorization failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

async function exchangeVercelCode(code: string): Promise<string> {
  const client_id = process.env.VERCEL_CLIENT_ID
  const client_secret = process.env.VERCEL_CLIENT_SECRET
  const redirect_uri = process.env.VERCEL_REDIRECT_URI
  if (!client_id || !client_secret || !redirect_uri) throw new Error('Vercel OAuth env vars missing')
  const res = await fetch('https://api.vercel.com/v2/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id, client_secret, code, redirect_uri })
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json?.error_description || 'Token exchange failed')
  return json.access_token as string
}

async function exchangeNetlifyCode(code: string): Promise<string> {
  const client_id = process.env.NETLIFY_CLIENT_ID
  const client_secret = process.env.NETLIFY_CLIENT_SECRET
  const redirect_uri = process.env.NETLIFY_REDIRECT_URI
  if (!client_id || !client_secret || !redirect_uri) throw new Error('Netlify OAuth env vars missing')
  const res = await fetch('https://api.netlify.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ grant_type: 'authorization_code', code, client_id, client_secret, redirect_uri })
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json?.error || 'Token exchange failed')
  return json.access_token as string
}