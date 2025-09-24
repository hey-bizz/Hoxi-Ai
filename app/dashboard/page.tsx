"use client"

import type React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Activity,
  Bot,
  HardDrive,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  X,
  Settings,
  LogOut,
  Send,
  Sparkles,
} from "lucide-react"
import Image from "next/image"
import Link from "next/link"

interface MetricCardProps {
  title: string
  value: string
  subtitle?: string
  change?: string
  icon: React.ReactNode
  color: "blue" | "red" | "orange" | "green"
}

const formatBytes = (bytes: number): string => {
  if (!bytes) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB", "TB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

const getBotIcon = (category: string): string => {
  const icons: Record<string, string> = {
    ai_training: "🤖",
    ai_scraper: "🕷️",
    ai_search: "🔍",
    search_engine: "🔍",
    social_media: "📱",
    seo_tool: "📈",
    scraper: "📊",
    monitoring: "👁️",
    security: "🛡️",
    unknown: "❓"
  }
  return icons[category] || "🤖"
}

const generateRealtimeActivity = (): any[] => {
  const bots = ["GPTBot", "Chrome/120", "Googlebot", "CCBot", "Chrome/120", "Chrome/120"]
  const actions = ["crawled /api/data", "visited /", "indexed /sitemap.xml", "scraped /products", "visited /", "visited /about"]
  const sizes = ["11.22 KB", "2.82 KB", "2.16 KB", "220.82 KB", "10.03 KB", "8.09 KB"]
  const icons = ["🤖", "👤", "🔍", "🕷️", "👤", "👤"]

  const activity: any[] = []
  for (let i = 0; i < 6; i++) {
    const time = new Date(Date.now() - Math.floor(Math.random() * 300000))
    const hours = time.getHours().toString().padStart(2, "0")
    const minutes = time.getMinutes().toString().padStart(2, "0")
    const seconds = time.getSeconds().toString().padStart(2, "0")

    activity.push({
      bot: bots[i],
      action: actions[i],
      size: sizes[i],
      time: `${hours}:${minutes}:${seconds}`,
      icon: icons[i]
    })
  }
  return activity
}

const getMockMetrics = () => {
  return {
    totalRequests: 52029,
    humanRequests: 38100,
    botRequests: 13929,
    humanPercentage: 73.2,
    aiPercentage: 26.8,
    totalBandwidth: 1240000000,
    botBandwidth: 750000000,
    potentialSavings: {
      total: 95,
      monthly: 95,
      yearly: 1140,
    },
    botBreakdown: {
      AI_Training: {
        requests: 6800,
        bandwidth: 750000000,
        bots: ["GPTBot", "Claude-Web", "ChatGPT-User"]
      },
      Search_Engines: {
        requests: 3200,
        bandwidth: 280000000,
        bots: ["Googlebot", "Bingbot", "DuckDuckBot"]
      },
      AI_Scrapers: {
        requests: 2400,
        bandwidth: 150000000,
        bots: ["PerplexityBot", "You.com", "Diffbot"]
      },
      Social_Media: {
        requests: 900,
        bandwidth: 45000000,
        bots: ["facebookexternalhit", "Twitterbot", "LinkedInBot"]
      },
      SEO_Tools: {
        requests: 629,
        bandwidth: 15000000,
        bots: ["AhrefsBot", "SemrushBot", "MJ12bot"]
      }
    }
  }
}

const normalizeNumber = (value: unknown): number => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0
  }

  if (typeof value === "string") {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }

  return 0
}

const formatCategoryName = (key: string): string =>
  key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ")

const mapTimeRangeToParam = (label: string): string => {
  switch (label) {
    case "Last hour":
      return "1h"
    case "Last 24 hours":
      return "24h"
    case "Last 7 days":
      return "7d"
    case "Last 30 days":
      return "30d"
    default:
      return "24h"
  }
}

const formatProviderName = (provider?: string | null): string | null => {
  if (!provider) return null
  return provider
    .split(/[_-\s]+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

const buildActivityFromLogs = (logs: Array<Record<string, any>>): any[] => {
  if (!Array.isArray(logs) || logs.length === 0) {
    return []
  }

  return logs.slice(0, 6).map(entry => {
    const detectedAt = entry.detected_at ? new Date(entry.detected_at) : new Date()
    const time = detectedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    const bandwidthBytes = normalizeNumber(entry.bandwidth_bytes)
    const categoryKey = typeof entry.category === "string" ? entry.category : "unknown"
    return {
      bot: entry.bot_name || "Unknown Bot",
      action: entry.path ? `Requested ${entry.path}` : "Activity detected",
      size: formatBytes(bandwidthBytes),
      time,
      icon: getBotIcon(categoryKey)
    }
  })
}

function MetricCard({ title, value, subtitle, change, icon, color }: MetricCardProps) {
  const colorClasses = {
    blue: "text-blue-400",
    red: "text-red-400",
    orange: "text-orange-400",
    green: "text-green-400",
  }

  return (
    <Card className="bg-gray-900/40 border-gray-700 backdrop-blur-xl">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className={`w-10 h-10 rounded-lg bg-${color}-500/20 flex items-center justify-center`}>
            <div className={colorClasses[color]}>{icon}</div>
          </div>
          {change && <span className={`text-sm font-mono ${colorClasses[color]}`}>{change}</span>}
        </div>
        <div className="space-y-1">
          <div className="text-3xl font-bold text-white">{value}</div>
          <div className="text-gray-400 text-sm">{title}</div>
          {subtitle && <div className={`text-xs ${colorClasses[color]}`}>{subtitle}</div>}
        </div>
      </CardContent>
    </Card>
  )
}

export default function DashboardPage() {
  const router = useRouter()
  const [showOnboarding, setShowOnboarding] = useState(true)
  const [timeRange, setTimeRange] = useState("Last hour")
  const [chatMessages, setChatMessages] = useState([
    {
      role: "assistant",
      content:
        "👋 Hi! I'm Hoxi Intelligence. I've analyzed your site traffic and found some interesting insights. Your bot traffic is at 26.8% - would you like me to break down which categories are consuming the most resources?",
    },
    {
      role: "assistant",
      content:
        "💡 **Key Insight**: AI Training bots (GPTBot, Claude-Web) are your biggest bandwidth consumers at 752MB. That's costing you $3.31 monthly. I can help you optimize this!",
    },
  ])
  const [chatInput, setChatInput] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [websiteMeta, setWebsiteMeta] = useState<{ id: string; domain?: string | null; provider?: string | null } | null>(null)
  const [metrics, setMetrics] = useState<any>(null)
  const [botCategories, setBotCategories] = useState<any[]>([])
  const [realtimeActivity, setRealtimeActivity] = useState<any[]>([])
  const [isSending, setIsSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const searchParams = useSearchParams()

  const parseStoredWebsiteMeta = (raw: string | null): { id: string; domain?: string | null; provider?: string | null } | null => {
    if (!raw) return null
    try {
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === "object") {
        const parsedRecord = parsed as Record<string, unknown>
        const id = typeof parsedRecord.id === "string" ? parsedRecord.id : undefined
        if (id) {
          return {
            id,
            domain: typeof parsedRecord.domain === "string" ? parsedRecord.domain : null,
            provider: typeof parsedRecord.provider === "string" ? parsedRecord.provider : null
          }
        }
      }
    } catch {
      // Ignore parse errors and fall back to treating the raw value as the ID
    }

    return typeof raw === "string" && raw.length > 0 ? { id: raw } : null
  }

  useEffect(() => {
    if (typeof window === "undefined") return

    const storedRaw = window.localStorage.getItem("hoxi-active-website")
    const storedMeta = parseStoredWebsiteMeta(storedRaw)
    const paramId = searchParams?.get("websiteId")

    let nextMeta = storedMeta

    if (paramId) {
      nextMeta = nextMeta ? { ...nextMeta, id: paramId } : { id: paramId }
      try {
        window.localStorage.setItem("hoxi-active-website", JSON.stringify(nextMeta))
      } catch (storageError) {
        console.error("Failed to persist active website metadata", storageError)
      }
    }

    if (nextMeta) {
      setWebsiteMeta(nextMeta)
      setShowOnboarding(false)
    }
  }, [searchParams])

  useEffect(() => {
    // Scroll to bottom of chat when new messages are added
    scrollToBottom()
  }, [chatMessages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  const handleLogout = () => {
    sessionStorage.removeItem("user")
    router.push("/")
  }

  const generateSampleData = async () => {
    if (!websiteMeta?.id) return

    try {
      setLoading(true)
      const response = await fetch('/api/generate-sample-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          websiteId: websiteMeta.id,
          timeRange: '24h'
        })
      })

      const result = await response.json()

      if (response.ok) {
        console.log('✅ Sample data generated:', result)
        // Reload the dashboard data
        setError(null)
        // The useEffect will reload the data automatically
        setTimeout(() => {
          window.location.reload()
        }, 1000)
      } else {
        console.error('Failed to generate sample data:', result.error)
        setError(`Failed to generate sample data: ${result.error}`)
      }
    } catch (error) {
      console.error('Error generating sample data:', error)
      setError('Failed to generate sample data')
    } finally {
      setLoading(false)
    }
  }

  const handleSendMessage = async () => {
    if (!chatInput.trim() || isSending) return

    // Add user message to chat
    const userMessage = { role: "user", content: chatInput }
    setChatMessages(prev => [...prev, userMessage])
    const currentInput = chatInput
    setChatInput("")
    setIsSending(true)

    try {
      // Generate a session ID for this conversation
      const sessionId = `hoxi_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      
      // Call the Hoxi AI chat API
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [...chatMessages, userMessage],
          websiteId: websiteMeta?.id || "example-com",
          sessionId: sessionId
        }),
      })

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`)
      }

      // Create a new assistant message
      const assistantMessage = { role: "assistant", content: "" }
      setChatMessages(prev => [...prev, assistantMessage])

      // Stream the response
      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      
      if (!reader) {
        throw new Error("No response body")
      }

      let accumulatedContent = ""
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        
        const chunk = decoder.decode(value, { stream: true })
        accumulatedContent += chunk
        
        // Update the last message with the accumulated content
        setChatMessages(prev => {
          const newMessages = [...prev]
          newMessages[newMessages.length - 1] = {
            ...newMessages[newMessages.length - 1],
            content: accumulatedContent
          }
          return newMessages
        })
      }
    } catch (error) {
      console.error("Chat error:", error)
      // Add an error message to the chat
      setChatMessages(prev => [
        ...prev,
        { 
          role: "assistant", 
          content: "Sorry, I encountered an error processing your request. Please try again." 
        }
      ])
    } finally {
      setIsSending(false)
    }
  }

  useEffect(() => {
    let cancelled = false

    if (!websiteMeta?.id) {
      setLoading(false)
      return () => {
        cancelled = true
      }
    }

    const fetchDashboardData = async () => {
      try {
        setLoading(true)
        setError(null)

        const timeRangeParam = mapTimeRangeToParam(timeRange)
        const response = await fetch(
          `/api/analyze?websiteId=${encodeURIComponent(websiteMeta.id)}&timeRange=${timeRangeParam}`
        )
        const payload = await response.json()

        if (!response.ok) {
          throw new Error(payload?.error || 'Failed to load metrics')
        }

        if (!payload?.metrics) {
          throw new Error('Metrics not available yet')
        }

        const metricsPayload = payload.metrics

        const normalizedMetrics = {
          totalRequests: normalizeNumber(metricsPayload.totalRequests),
          humanRequests: normalizeNumber(metricsPayload.humanRequests),
          botRequests: normalizeNumber(metricsPayload.botRequests),
          aiPercentage:
            typeof metricsPayload.aiPercentage === 'string'
              ? metricsPayload.aiPercentage
              : normalizeNumber(metricsPayload.totalRequests)
                ? (
                    (normalizeNumber(metricsPayload.botRequests) /
                      Math.max(normalizeNumber(metricsPayload.totalRequests), 1)) *
                    100
                  ).toFixed(1)
                : '0',
          humanPercentage:
            typeof metricsPayload.humanPercentage === 'string'
              ? metricsPayload.humanPercentage
              : normalizeNumber(metricsPayload.totalRequests)
                ? (
                    (normalizeNumber(metricsPayload.humanRequests) /
                      Math.max(normalizeNumber(metricsPayload.totalRequests), 1)) *
                    100
                  ).toFixed(1)
                : '0',
          botBandwidth: normalizeNumber(metricsPayload.botBandwidth),
          humanBandwidth: normalizeNumber(metricsPayload.humanBandwidth),
          potentialSavings: {
            total: normalizeNumber(metricsPayload.potentialSavings?.total),
            monthly: normalizeNumber(metricsPayload.potentialSavings?.monthly),
            yearly: normalizeNumber(metricsPayload.potentialSavings?.yearly)
          },
          botBreakdown: metricsPayload.botBreakdown ?? {}
        }

        if (cancelled) return

        // Update all states together to prevent partial updates
        setMetrics(normalizedMetrics)

        const breakdownEntries = Object.entries(metricsPayload.botBreakdown ?? {})
        const breakdownTotal = normalizedMetrics.totalRequests

        const categories = breakdownEntries
          .map(([key, rawValue]) => {
            const data = rawValue as { requests?: unknown; bandwidth?: unknown; bots?: string[] }
            const requests = normalizeNumber(data.requests)
            const bandwidth = normalizeNumber(data.bandwidth)
            const bots = Array.isArray(data.bots) ? data.bots : []
            const percentage = breakdownTotal
              ? ((requests / breakdownTotal) * 100).toFixed(1)
              : '0.0'

            return {
              name: formatCategoryName(key),
              bots: bots.join(', ') || 'Unknown bots',
              requests,
              percentage,
              bandwidth: formatBytes(bandwidth),
              icon: getBotIcon(key)
            }
          })
          .sort((a, b) => b.requests - a.requests)

        const activity = buildActivityFromLogs(payload.logs ?? [])

        // Batch state updates to prevent timing issues
        setBotCategories(categories)
        setRealtimeActivity(activity.length ? activity : generateRealtimeActivity())

        console.log('✅ Dashboard data updated:', {
          totalRequests: normalizedMetrics.totalRequests,
          botRequests: normalizedMetrics.botRequests,
          botPercentage: normalizedMetrics.aiPercentage,
          bandwidth: normalizedMetrics.botBandwidth
        })

        // Clear any previous errors on successful data load
        setError(null)
      } catch (err) {
        console.error('Dashboard data load failed:', err)

        if (cancelled) return

        setError('Using demo data - connect your hosting provider to see real metrics')
        setMetrics(getMockMetrics())
        setBotCategories([])
        setRealtimeActivity(generateRealtimeActivity())
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    fetchDashboardData()

    return () => {
      cancelled = true
    }
  }, [websiteMeta?.id, timeRange])

  const domainLabel = websiteMeta?.domain || 'example.com'
  const providerLabel = formatProviderName(websiteMeta?.provider)

  return (
    <div className="min-h-screen bg-black relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(34,197,94,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(34,197,94,0.03)_1px,transparent_1px)] bg-[size:50px_50px] animate-pulse" />
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-gradient-to-br from-green-500/10 via-emerald-500/5 to-transparent rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-[800px] h-[800px] bg-gradient-to-tl from-green-400/8 via-green-500/4 to-transparent rounded-full blur-3xl" />
      </div>

      {/* Success Message - First Time Only */}
      {showOnboarding && (
        <div className="relative z-50 bg-green-500/10 border-b border-green-500/20">
          <div className="max-w-full mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <span className="text-white">Successfully connected! Monitoring is now active.</span>
            </div>
            <button onClick={() => setShowOnboarding(false)}>
              <X className="w-4 h-4 text-gray-400 hover:text-white" />
            </button>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="sticky top-0 z-40 bg-black/60 backdrop-blur-xl border-b border-green-500/20">
        <div className="max-w-full mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3">
              <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-green-400 to-green-600 p-0.5">
                <div className="w-full h-full rounded-xl bg-black flex items-center justify-center">
                  <Image src="/hoxi-logo.png" alt="Hoxi Logo" width={24} height={24} className="w-6 h-6" />
                </div>
              </div>
              <span className="font-bold text-2xl text-white">Hoxi</span>
            </Link>

            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" className="text-gray-300 hover:text-green-400">
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </Button>
              <Button onClick={handleLogout} variant="ghost" size="sm" className="text-gray-300 hover:text-red-400">
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </nav>

      <div className="flex h-[calc(100vh-140px)]">
        {/* Main Dashboard Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-6">
            {/* Loading/Error States */}
            {loading && (
              <div className="flex items-center justify-center h-64">
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto mb-4 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
                  <p className="text-gray-400">Loading dashboard data...</p>
                </div>
              </div>
            )}
            
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-red-400">⚠️ {error}</p>
                    <p className="text-gray-400 text-sm mt-2">Displaying sample data for demonstration purposes.</p>
                  </div>
                  <Button
                    onClick={() => generateSampleData()}
                    className="bg-green-500 hover:bg-green-600 text-white text-sm"
                    size="sm"
                  >
                    Generate Sample Data
                  </Button>
                </div>
              </div>
            )}

            {/* Header */}
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-4xl font-bold text-white">AI Crawler Monitor</h1>
                <p className="text-gray-400 text-lg">
                  {domainLabel}
                  {providerLabel ? ` • ${providerLabel}` : ""}
                </p>
                <p className="text-sm text-gray-500">Real-time traffic analysis and bot detection</p>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 px-4 py-2 bg-green-500/20 rounded-full border border-green-500/30">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-green-400 text-sm font-mono">Connected</span>
                </div>

                <select
                  value={timeRange}
                  onChange={(e) => setTimeRange(e.target.value)}
                  className="bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:border-green-500"
                >
                  <option>Last hour</option>
                  <option>Last 24 hours</option>
                  <option>Last 7 days</option>
                  <option>Last 30 days</option>
                </select>
              </div>
            </div>

            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
              <MetricCard
                title="Total Requests"
                value={loading ? "Loading..." : (metrics?.totalRequests?.toLocaleString() || "0")}
                change="+12%"
                icon={<Activity className="w-6 h-6" />}
                color="blue"
                subtitle={loading ? "Loading..." : (metrics ? `Human: ${metrics.humanPercentage}% • Bots: ${metrics.aiPercentage}%` : "No data")}
              />
              <MetricCard
                title="Bot Traffic"
                value={loading ? "Loading..." : (metrics ? `${metrics.aiPercentage}%` : "0%")}
                subtitle={loading ? "Loading..." : (metrics ? `${metrics.botRequests?.toLocaleString()} requests` : "0 requests")}
                icon={<Bot className="w-6 h-6" />}
                color="red"
                change="+2.3%"
              />
              <MetricCard
                title="Bot Bandwidth"
                value={loading ? "Loading..." : (metrics ? formatBytes(metrics.botBandwidth) : "0 B")}
                subtitle={loading ? "Loading..." : (metrics ? `$${(metrics.botBandwidth / (1024**3) * 0.15 * 30).toFixed(2)} cost` : "$0 cost")}
                icon={<HardDrive className="w-6 h-6" />}
                color="orange"
                change="+1.8%"
              />
              <MetricCard
                title="Potential Monthly Savings"
                value={loading ? "Loading..." : (metrics ? `$${metrics.potentialSavings?.monthly?.toFixed(2) || "0.00"}` : "$0.00")}
                subtitle="per month"
                icon={<DollarSign className="w-6 h-6" />}
                color="green"
                change="Optimizable"
              />
            </div>

            {/* Bot Categories Breakdown */}
            <Card className="bg-gray-900/40 border-gray-700 backdrop-blur-xl mb-8">
              <CardContent className="p-8">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <Bot className="w-6 h-6 text-purple-400" />
                    <h3 className="text-2xl font-bold text-white">Bot Categories Breakdown</h3>
                  </div>
                  <TrendingUp className="w-5 h-5 text-green-400" />
                </div>

                <div className="space-y-4">
                  {botCategories.length > 0 ? (
                    botCategories.map((category, index) => (
                      <div key={category.name} className="group">
                        <div className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg hover:bg-gray-800/70 transition-colors">
                          <div className="flex items-center gap-4">
                            <span className="text-2xl">{category.icon}</span>
                            <div>
                              <div className="font-semibold text-white">{category.name}</div>
                              <div className="text-sm text-gray-400">{category.bots}</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-xl font-bold text-white">{category.requests?.toLocaleString()}</div>
                            <div className="text-sm text-gray-400">
                              {category.percentage}% • {category.bandwidth}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    // Sample data when no real data is available
                    [
                      { name: "AI Training", bots: "GPTBot, Claude-Web, ChatGPT-User", requests: 4869, percentage: "34.9", bandwidth: "752.49 MB", icon: "🤖" },
                      { name: "AI Scrapers", bots: "CCBot, Bytespider", requests: 3478, percentage: "25.0", bandwidth: "564.37 MB", icon: "🕷️" },
                      { name: "Search Engines", bots: "Googlebot, Bingbot", requests: 2086, percentage: "15.0", bandwidth: "188.12 MB", icon: "🔍" },
                    ].map((category, index) => (
                      <div key={category.name} className="group">
                        <div className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg hover:bg-gray-800/70 transition-colors">
                          <div className="flex items-center gap-4">
                            <span className="text-2xl">{category.icon}</span>
                            <div>
                              <div className="font-semibold text-white">{category.name}</div>
                              <div className="text-sm text-gray-400">{category.bots}</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-xl font-bold text-white">{category.requests?.toLocaleString()}</div>
                            <div className="text-sm text-gray-400">
                              {category.percentage}% • {category.bandwidth}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Real-time Activity */}
            <Card className="bg-gray-900/40 border-gray-700 backdrop-blur-xl mb-8">
              <CardContent className="p-8">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <Activity className="w-6 h-6 text-blue-400" />
                    <h3 className="text-2xl font-bold text-white">Real-time Activity</h3>
                  </div>
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                </div>

                <div className="space-y-3">
                  {realtimeActivity.map((activity, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-800/30 rounded-lg">
                      <div className="flex items-center gap-3">
                        <span className="text-lg">{activity.icon}</span>
                        <div>
                          <div className="font-medium text-white">{activity.bot}</div>
                          <div className="text-sm text-gray-400">{activity.action}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-mono text-white">{activity.size}</div>
                        <div className="text-xs text-gray-500">{activity.time}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Action Bar */}
            <Card className="bg-gradient-to-r from-gray-900/60 to-gray-800/60 border-gray-700 backdrop-blur-xl">
              <CardContent className="p-8">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-yellow-500/20 rounded-xl flex items-center justify-center">
                      <AlertTriangle className="w-6 h-6 text-yellow-400" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-white mb-2">Ready to block wasteful bots?</h3>
                      <p className="text-gray-400">We've identified 5 bot categories that could save you $8.27/month</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <Button
                      variant="outline"
                      className="border-gray-600 text-gray-300 hover:bg-gray-800 bg-transparent"
                    >
                      View Details
                    </Button>
                    <Button className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-semibold">
                      Configure Blocking →
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="w-96 bg-gray-900/95 backdrop-blur-xl border-l border-gray-700 flex flex-col">
          {/* Chat Header */}
          <div className="p-6 border-b border-gray-700">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-white text-lg">Hoxi Intelligence</h3>
                <p className="text-sm text-green-400">AI Analytics Assistant • Online</p>
              </div>
            </div>
          </div>

          {/* Chat Messages */}
          <div className="flex-1 p-6 overflow-y-auto space-y-4">
            {chatMessages.map((message, index) => (
              <div key={index} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] p-4 rounded-2xl ${
                    message.role === "user"
                      ? "bg-gradient-to-r from-green-500 to-emerald-500 text-white"
                      : "bg-gray-800/80 text-gray-100 border border-gray-700"
                  }`}
                >
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Actions */}
          <div className="px-6 py-4 border-t border-gray-700">
            <div className="grid grid-cols-2 gap-2 mb-4">
              <Button
                variant="outline"
                size="sm"
                className="text-xs bg-gray-800/50 border-gray-600 text-gray-300 hover:bg-gray-700"
                onClick={() => setChatInput("Show me bot traffic trends")}
              >
                📊 Traffic Trends
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-xs bg-gray-800/50 border-gray-600 text-gray-300 hover:bg-gray-700"
                onClick={() => setChatInput("How can I save more money?")}
              >
                💰 Cost Savings
              </Button>
            </div>
          </div>

          {/* Chat Input */}
          <div className="p-6 border-t border-gray-700">
            <div className="flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
                placeholder="Ask about your analytics..."
                className="flex-1 bg-gray-800/80 border border-gray-600 rounded-xl px-4 py-3 text-white placeholder-gray-400 focus:border-green-500 focus:outline-none text-sm"
                disabled={isSending}
              />
              <Button
                onClick={handleSendMessage}
                className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 rounded-xl px-4"
                disabled={isSending}
              >
                {isSending ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
