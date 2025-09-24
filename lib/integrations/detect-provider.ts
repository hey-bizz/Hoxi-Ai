import type { Provider } from '@/lib/integrations/base'
import * as dns from 'dns'
import { promisify } from 'util'

const resolveNs = promisify(dns.resolveNs)
const resolveCname = promisify(dns.resolveCname)

export async function detectProvider(websiteUrl: string): Promise<Provider> {
  try {
    const url = new URL(websiteUrl)
    const host = url.hostname

    // DNS heuristics
    try {
      const cnames = await resolveCname(host).catch(() => [])
      const ns = await resolveNs(host).catch(() => [])

      if (cnames.some((c) => /vercel-dns\.com|cname\.vercel-dns\.com/i.test(c))) return 'vercel'
      if (cnames.some((c) => /netlify\.app|netlifydns\.com/i.test(c))) return 'netlify'
      if (cnames.some((c) => /cloudfront\.net/i.test(c))) return 'aws'
      if (ns.some((n) => /cloudflare\.com$/i.test(n))) return 'cloudflare'
    } catch {
      // ignore DNS errors
    }

    // HTTP header heuristics
    try {
      const resp = await fetch(url.toString(), { method: 'HEAD' })
      const h = resp.headers
      const server = (h.get('server') || '').toLowerCase()
      const via = (h.get('via') || '').toLowerCase()
      const cfRay = h.get('cf-ray')
      const vercelId = h.get('x-vercel-id')
      const netlifyReq = h.get('x-nf-request-id')

      if (cfRay || server.includes('cloudflare')) return 'cloudflare'
      if (vercelId || server.includes('vercel')) return 'vercel'
      if (netlifyReq) return 'netlify'
      if (via.includes('cloudfront') || server.includes('cloudfront')) return 'aws'
    } catch {
      // ignore HTTP errors
    }
  } catch {
    return 'unknown'
  }
  return 'unknown'
}
