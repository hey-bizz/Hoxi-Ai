import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Supabase environment variables are required for the MCP Supabase server.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

const server = new McpServer({
  name: 'hoxi-supabase-mcp',
  version: '1.0.0'
})

const FetchLatestAnalysisSchema = z.object({
  websiteId: z.string(),
  limit: z.number().int().positive().max(100).optional().default(5),
  sinceHours: z.number().int().positive().max(720).optional().default(168)
})

type FetchLatestAnalysisInput = z.infer<typeof FetchLatestAnalysisSchema>

server.registerTool(
  'fetch-latest-analysis',
  {
    title: 'Fetch latest bot detection analysis from Supabase',
    description: 'Returns recent bot detection rows and aggregate cost data for a website.',
    inputSchema: FetchLatestAnalysisSchema
  },
  async ({ websiteId, limit, sinceHours }: FetchLatestAnalysisInput) => {
    const cutoff = new Date(Date.now() - sinceHours * 60 * 60 * 1000)

    const { data: detections, error: detectionError } = await supabase
      .from('bot_detections')
      .select('*')
      .eq('website_id', websiteId)
      .gte('detected_at', cutoff.toISOString())
      .order('detected_at', { ascending: false })
      .limit(limit ?? 5)

    if (detectionError) {
      throw new Error(`Supabase bot_detections error: ${detectionError.message}`)
    }

    const { data: latestCost, error: costError } = await supabase
      .from('cost_analyses')
      .select('*')
      .eq('website_id', websiteId)
      .order('analysis_date', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (costError && costError.code !== 'PGRST116') {
      throw new Error(`Supabase cost_analyses error: ${costError.message}`)
    }

    const payload = {
      detections: detections ?? [],
      costAnalysis: latestCost ?? null,
      fetchedAt: new Date().toISOString()
    }

    return {
      content: [
        {
          type: 'json',
          json: payload
        }
      ]
    }
  }
)

const transport = new StdioServerTransport()
await server.connect(transport)
