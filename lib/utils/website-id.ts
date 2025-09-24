import crypto from 'crypto'

// Namespace for UUIDv5 derivation. You can override via env.
const DEFAULT_NAMESPACE = '6ba7b811-9dad-11d1-80b4-00c04fd430c8'

export function canonicalizeHost(input: string): string {
  let host = input.trim()
  try {
    const u = new URL(/^https?:\/\//i.test(host) ? host : `https://${host}`)
    host = u.hostname
  } catch {
    // If it's not a full URL, treat it as a hostname
    host = host.replace(/^www\./i, '')
  }
  return host.toLowerCase()
}

export function uuidv5FromHost(host: string, namespace?: string): string {
  const ns = (namespace || process.env.WEBSITE_NAMESPACE_UUID || DEFAULT_NAMESPACE).replace(/-/g, '')
  const nsBytes = Buffer.from(ns, 'hex')
  const nameBytes = Buffer.from(host.toLowerCase(), 'utf8')

  const hash = crypto.createHash('sha1')
  hash.update(nsBytes)
  hash.update(nameBytes)
  const bytes = Buffer.from(hash.digest())

  // Set version (5) and variant (RFC 4122)
  bytes[6] = (bytes[6] & 0x0f) | 0x50
  bytes[8] = (bytes[8] & 0x3f) | 0x80

  const hex = bytes.slice(0, 16).toString('hex')
  return [
    hex.substring(0, 8),
    hex.substring(8, 12),
    hex.substring(12, 16),
    hex.substring(16, 20),
    hex.substring(20)
  ].join('-')
}

