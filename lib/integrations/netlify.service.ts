/**
 * Netlify API Service
 * Handles interactions with Netlify's API for sites and log drain configuration
 */

export interface NetlifySite {
  id: string
  name: string
  url: string
  admin_url: string
  ssl_url?: string
  account_name?: string
  account_slug?: string
  plan?: string
}

export interface NetlifyLogDrain {
  id: string
  service_name: string
  endpoint_url: string
  log_types: string[]
  status: 'active' | 'inactive'
  created_at: string
}

export interface NetlifyUser {
  id: string
  email: string
  full_name?: string
  avatar_url?: string
}

export class NetlifyService {
  private accessToken: string
  private baseUrl = 'https://api.netlify.com/api/v1'

  constructor(accessToken: string) {
    this.accessToken = accessToken
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Netlify API error: ${response.status} ${response.statusText} - ${errorText}`)
    }

    return response.json() as T
  }

  /**
   * Get current user information
   */
  async getCurrentUser(): Promise<NetlifyUser> {
    return this.request<NetlifyUser>('/user')
  }

  /**
   * Get all sites for the authenticated user
   */
  async getSites(): Promise<NetlifySite[]> {
    return this.request<NetlifySite[]>('/sites')
  }

  /**
   * Get a specific site by ID
   */
  async getSite(siteId: string): Promise<NetlifySite> {
    return this.request<NetlifySite>(`/sites/${siteId}`)
  }

  /**
   * Find sites by domain name
   */
  async findSitesByDomain(domain: string): Promise<NetlifySite[]> {
    const sites = await this.getSites()
    return sites.filter(site =>
      site.name.includes(domain) ||
      site.url?.includes(domain) ||
      site.ssl_url?.includes(domain)
    )
  }

  /**
   * Configure log drain for a site
   * Note: This requires Enterprise plan and may need to be done via Netlify UI
   * This method provides the webhook URL that should be configured manually
   */
  async getLogDrainConfiguration(siteId: string, webhookUrl: string) {
    // Netlify log drains are typically configured via UI for Enterprise customers
    // Return configuration details that need to be set up manually
    return {
      siteId,
      webhookUrl,
      instructions: [
        'Log into your Netlify account',
        'Navigate to your site settings',
        'Go to Logs > Log Drains',
        'Select "Enable a log drain"',
        'Choose "General HTTP endpoint" as the service',
        'Select log types: "Traffic logs" for bot detection',
        'Enter the webhook URL provided',
        'Set log drain format to "JSON"',
        'Click "Connect" to enable the drain'
      ],
      requiredPlan: 'Enterprise',
      supportedLogTypes: [
        'traffic', // Main focus for bot detection
        'functions',
        'edge-functions',
        'deploys',
        'waf'
      ],
      webhookEndpoint: webhookUrl,
      authHeaders: {
        'x-ai-monitor-secret': process.env.WEBHOOK_SECRET || 'your-webhook-secret'
      }
    }
  }

  /**
   * Get log drains for a site (if API supports it)
   * Note: This may not be available via public API
   */
  async getLogDrains(siteId: string): Promise<NetlifyLogDrain[]> {
    try {
      return this.request<NetlifyLogDrain[]>(`/sites/${siteId}/log_drains`)
    } catch (error) {
      // Log drains API may not be publicly available
      console.warn('Log drains API not available:', error)
      return []
    }
  }

  /**
   * Test the connection to Netlify API
   */
  async testConnection(): Promise<{
    success: boolean
    user?: NetlifyUser
    sites?: NetlifySite[]
    error?: string
  }> {
    try {
      const user = await this.getCurrentUser()
      const sites = await this.getSites()

      return {
        success: true,
        user,
        sites: sites.slice(0, 5) // Return first 5 sites for testing
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Connection test failed'
      }
    }
  }

  /**
   * Generate webhook URL for the given site
   */
  generateWebhookUrl(baseUrl: string, siteId?: string, websiteUrl?: string): string {
    const params = new URLSearchParams()

    if (siteId) {
      params.append('websiteId', siteId)
    } else if (websiteUrl) {
      params.append('websiteUrl', websiteUrl)
    }

    return `${baseUrl}/api/webhooks/netlify?${params.toString()}`
  }
}

/**
 * Create a new Netlify service instance
 */
export function createNetlifyService(accessToken: string): NetlifyService {
  return new NetlifyService(accessToken)
}
