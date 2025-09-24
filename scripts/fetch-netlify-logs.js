/**
 * Script to fetch real Netlify logs for testing
 * This requires a valid Netlify access token
 */

const NETLIFY_API_URL = 'https://api.netlify.com/api/v1'

// You'll need to provide a valid Netlify access token
// This can be obtained through OAuth or personal access token
const NETLIFY_ACCESS_TOKEN = process.env.NETLIFY_ACCESS_TOKEN || 'your-token-here'

async function findSiteByDomain(domain) {
  try {
    const response = await fetch(`${NETLIFY_API_URL}/sites`, {
      headers: {
        'Authorization': `Bearer ${NETLIFY_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const sites = await response.json()

    // Find site by domain
    const site = sites.find(site =>
      site.url === `https://${domain}` ||
      site.ssl_url === `https://${domain}` ||
      site.name.includes(domain.split('.')[0])
    )

    return site
  } catch (error) {
    console.error('Error finding site:', error.message)
    return null
  }
}

async function fetchSiteLogs(siteId) {
  try {
    // Note: Netlify's log API endpoints are limited
    // Most log access requires Enterprise plan and log drains
    console.log('⚠️  Note: Netlify API has limited log access')
    console.log('   Real-time logs typically require:')
    console.log('   1. Enterprise plan')
    console.log('   2. Log drains configured')
    console.log('   3. Third-party log aggregation service')

    // Try to get basic site info instead
    const response = await fetch(`${NETLIFY_API_URL}/sites/${siteId}`, {
      headers: {
        'Authorization': `Bearer ${NETLIFY_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const site = await response.json()
    return site
  } catch (error) {
    console.error('Error fetching site logs:', error.message)
    return null
  }
}

async function main() {
  console.log('🔍 Fetching logs for aryanb.netlify.app...')

  if (NETLIFY_ACCESS_TOKEN === 'your-token-here') {
    console.log('❌ No Netlify access token provided')
    console.log('   Set NETLIFY_ACCESS_TOKEN environment variable')
    console.log('   Or obtain one from: https://app.netlify.com/user/applications#personal-access-tokens')
    process.exit(1)
  }

  // Find the site
  const site = await findSiteByDomain('aryanb.netlify.app')

  if (!site) {
    console.log('❌ Site not found or no access')
    console.log('   This could mean:')
    console.log('   1. Site is not in your Netlify account')
    console.log('   2. Access token lacks permissions')
    console.log('   3. Site domain doesn\'t match exactly')
    return
  }

  console.log('✅ Found site:', site.name)
  console.log('   ID:', site.id)
  console.log('   URL:', site.url || site.ssl_url)
  console.log('   Plan:', site.plan || 'Unknown')

  // Try to get logs (this will likely fail without Enterprise plan)
  const logs = await fetchSiteLogs(site.id)

  if (logs) {
    console.log('📊 Site information retrieved')
    // Note: Actual log data is not available via standard API
  }
}

if (require.main === module) {
  main().catch(console.error)
}

module.exports = { findSiteByDomain, fetchSiteLogs }