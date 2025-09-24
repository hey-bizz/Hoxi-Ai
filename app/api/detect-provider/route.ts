import { NextRequest, NextResponse } from 'next/server'
import { detectProvider } from '@/lib/integrations/detect-provider'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const websiteUrl = searchParams.get('websiteUrl')

  if (!websiteUrl) {
    return NextResponse.json({ error: 'Missing websiteUrl' }, { status: 400 })
  }

  try {
    const provider = await detectProvider(websiteUrl)
    return NextResponse.json({ provider })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : undefined
    return NextResponse.json({ provider: 'unknown', error: message }, { status: 200 })
  }
}