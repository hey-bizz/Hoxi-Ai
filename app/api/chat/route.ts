// Hoxi AI Chat API Route
// Connects the frontend chat interface with the Hoxi AI agent

import { streamText } from 'ai'
import { hoxiAgent } from '@/lib/hoxi-ai'
import { NextRequest } from 'next/server'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const { messages, websiteId, sessionId } = await req.json()
    
    // Validate inputs
    if (!messages || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ 
          error: 'Invalid messages format',
          success: false
        }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }
    
    if (!websiteId) {
      return new Response(
        JSON.stringify({ 
          error: 'Website ID is required',
          success: false
        }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }
    
    // Set conversation context
    hoxiAgent.setContext(sessionId, { websiteId })
    
    // Add context from latest Core Detection Engine analysis
    const contextMessage = await hoxiAgent.generateContextMessage(websiteId)
    
    // Prepare messages with context
    const messagesWithContext = [contextMessage, ...messages]
    
    // Stream the response using the Hoxi agent
    const result = streamText({
      model: hoxiAgent.getModel(),
      messages: messagesWithContext,
      tools: hoxiAgent.getTools(),
      temperature: 0.1,
      onStepFinish: async ({ toolCalls }) => {
        // Log tool usage for optimization
        if (toolCalls?.length) {
          hoxiAgent.logToolUsage(toolCalls, sessionId)
          console.log(`Hoxi AI [${sessionId}] used tools: ${toolCalls.map(t => t.toolName).join(', ')}`)
        }
      }
    })

    // Use the correct stream response method
    if (typeof result.toTextStreamResponse === 'function') {
      return result.toTextStreamResponse()
    } else {
      // Fallback for development
      return new Response(
        JSON.stringify({ 
          success: true,
          message: 'Chat request received',
          response: 'Hello! I am Hoxi AI. I can help you analyze your bot traffic and provide recommendations.'
        }),
        { 
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }
    
  } catch (error) {
    console.error('Chat API error:', error)
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Internal server error',
        success: false
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }
}

export async function GET() {
  return new Response(
    JSON.stringify({ 
      success: true,
      message: 'Hoxi AI Chat API is running',
      timestamp: new Date().toISOString()
    }),
    { 
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    }
  )
}
