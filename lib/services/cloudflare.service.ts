import axios, { AxiosInstance } from 'axios';
import { botDetector } from '../bot-detector';

interface CloudflareZone {
  id: string;
  name: string;
  status: string;
  plan: {
    name: string;
  };
}

interface CloudflareAnalyticsData {
  viewer: {
    zones: [{
      httpRequests1mGroups: Array<{
        dimensions: {
          datetime: string;
          clientRequestHTTPHost: string;
          clientRequestHTTPMethodName: string;
          clientRequestPath: string;
          clientRequestUserAgent: string;
          clientIP: string;
        };
        sum: {
          requests: number;
          bytes: number;
          cachedBytes: number;
          responseStatusClass: string;
        };
        avg: {
          originResponseDurationMs: number;
        };
      }>;
    }];
  };
}

export class CloudflareService {
  private api: AxiosInstance;
  private graphqlApi: AxiosInstance;
  private apiToken: string;

  constructor(apiToken: string) {
    this.apiToken = apiToken;
    
    // REST API client
    this.api = axios.create({
      baseURL: 'https://api.cloudflare.com/client/v4',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json'
      }
    });

    // GraphQL API client
    this.graphqlApi = axios.create({
      baseURL: 'https://api.cloudflare.com/client/v4/graphql',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json'
      }
    });
  }

  /**
   * Validate API token and get account info
   */
  async validateToken(): Promise<{ valid: boolean; email?: string; zones?: CloudflareZone[] }> {
    try {
      // Test token by fetching user details
      const userResponse = await this.api.get('/user');
      
      if (!userResponse.data.success) {
        return { valid: false };
      }

      // Get zones (websites)
      const zonesResponse = await this.api.get('/zones');
      
      return {
        valid: true,
        email: userResponse.data.result.email,
        zones: zonesResponse.data.result
      };
    } catch (error: any) {
      console.error('Token validation failed:', error.response?.data || error.message);
      return { valid: false };
    }
  }

  /**
   * Get all zones (websites) for the account
   */
  async getZones(): Promise<CloudflareZone[]> {
    try {
      const response = await this.api.get('/zones');
      
      if (!response.data.success) {
        throw new Error('Failed to fetch zones');
      }

      return response.data.result;
    } catch (error) {
      console.error('Error fetching zones:', error);
      throw error;
    }
  }

  /**
   * Get analytics for a specific zone using GraphQL
   */
  async getZoneAnalytics(zoneId: string, since: Date, until: Date = new Date()) {
    const query = `
      query GetZoneAnalytics($zoneTag: string!, $since: Time!, $until: Time!) {
        viewer {
          zones(filter: { zoneTag: $zoneTag }) {
            httpRequests1mGroups(
              filter: { 
                datetime_geq: $since,
                datetime_lt: $until
              }
              orderBy: [datetime_DESC]
              limit: 1000
            ) {
              dimensions {
                datetime
                clientRequestHTTPHost
                clientRequestHTTPMethodName
                clientRequestPath
                clientRequestUserAgent
                clientIP
              }
              sum {
                requests
                bytes
                cachedBytes
              }
              avg {
                originResponseDurationMs
              }
            }
          }
        }
      }
    `;

    try {
      const response = await this.graphqlApi.post('', {
        query,
        variables: {
          zoneTag: zoneId,
          since: since.toISOString(),
          until: until.toISOString()
        }
      });

      if (response.data.errors) {
        throw new Error(response.data.errors[0].message);
      }

      const data: CloudflareAnalyticsData = response.data;
      return this.processAnalyticsData(data);
    } catch (error) {
      console.error('Error fetching analytics:', error);
      throw error;
    }
  }

  /**
   * Get real-time analytics (last 5 minutes)
   */
  async getRealTimeAnalytics(zoneId: string) {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    return this.getZoneAnalytics(zoneId, fiveMinutesAgo);
  }

  /**
   * Process raw Cloudflare data into our format
   */
  private processAnalyticsData(data: CloudflareAnalyticsData) {
    const logs = data.viewer.zones[0]?.httpRequests1mGroups || [];
    
    const processed = logs.map(log => {
      const userAgent = log.dimensions.clientRequestUserAgent || '';
      const botInfo = botDetector.detect(userAgent);
      
      return {
        timestamp: new Date(log.dimensions.datetime),
        host: log.dimensions.clientRequestHTTPHost,
        method: log.dimensions.clientRequestHTTPMethodName,
        path: log.dimensions.clientRequestPath,
        userAgent: userAgent,
        clientIP: log.dimensions.clientIP,
        requests: log.sum.requests,
        bytes: log.sum.bytes,
        cachedBytes: log.sum.cachedBytes,
        responseTime: log.avg.originResponseDurationMs,
        isBot: botInfo.isBot,
        botName: botInfo.botName,
        botCategory: botInfo.category,
        severity: botInfo.severity
      };
    });

    // Calculate summary metrics
    const summary = {
      totalRequests: processed.reduce((sum, log) => sum + log.requests, 0),
      totalBytes: processed.reduce((sum, log) => sum + log.bytes, 0),
      cachedBytes: processed.reduce((sum, log) => sum + log.cachedBytes, 0),
      botRequests: processed.filter(log => log.isBot).reduce((sum, log) => sum + log.requests, 0),
      humanRequests: processed.filter(log => !log.isBot).reduce((sum, log) => sum + log.requests, 0),
      uniqueBots: [...new Set(processed.filter(log => log.isBot).map(log => log.botName))],
      botsByCategory: this.groupByCategory(processed.filter(log => log.isBot))
    };

    return {
      logs: processed,
      summary
    };
  }

  /**
   * Group bot traffic by category
   */
  private groupByCategory(botLogs: any[]) {
    const grouped: Record<string, any> = {};
    
    for (const log of botLogs) {
      if (!grouped[log.botCategory]) {
        grouped[log.botCategory] = {
          requests: 0,
          bytes: 0,
          bots: new Set()
        };
      }
      
      grouped[log.botCategory].requests += log.requests;
      grouped[log.botCategory].bytes += log.bytes;
      grouped[log.botCategory].bots.add(log.botName);
    }

    // Convert Sets to arrays
    Object.keys(grouped).forEach(key => {
      grouped[key].bots = Array.from(grouped[key].bots);
    });

    return grouped;
  }

  /**
   * Get bandwidth usage for cost calculation
   */
  async getBandwidthUsage(zoneId: string, period: 'day' | 'week' | 'month' = 'day') {
    const since = new Date();
    
    switch (period) {
      case 'day':
        since.setDate(since.getDate() - 1);
        break;
      case 'week':
        since.setDate(since.getDate() - 7);
        break;
      case 'month':
        since.setMonth(since.getMonth() - 1);
        break;
    }

    const analytics = await this.getZoneAnalytics(zoneId, since);
    
    return {
      period,
      totalBandwidth: analytics.summary.totalBytes,
      cachedBandwidth: analytics.summary.cachedBytes,
      originBandwidth: analytics.summary.totalBytes - analytics.summary.cachedBytes,
      botBandwidth: analytics.logs
        .filter(log => log.isBot)
        .reduce((sum, log) => sum + log.bytes, 0),
      humanBandwidth: analytics.logs
        .filter(log => !log.isBot)
        .reduce((sum, log) => sum + log.bytes, 0)
    };
  }

  /**
   * Set up Logpush for real-time streaming (Enterprise only)
   */
  async setupLogpush(zoneId: string, destinationUrl: string) {
    // Note: Logpush is only available for Enterprise plans
    try {
      const response = await this.api.post(`/zones/${zoneId}/logpush/jobs`, {
        name: 'ai-crawler-monitor',
        destination_conf: destinationUrl,
        dataset: 'http_requests',
        logpull_options: 'fields=ClientIP,ClientRequestHost,ClientRequestMethod,ClientRequestURI,EdgeEndTimestamp,EdgeResponseBytes,EdgeResponseStatus,EdgeStartTimestamp,ClientRequestUserAgent',
        enabled: true
      });

      return response.data.result;
    } catch (error: any) {
      if (error.response?.status === 403) {
        throw new Error('Logpush requires Enterprise plan. Using polling method instead.');
      }
      throw error;
    }
  }
}