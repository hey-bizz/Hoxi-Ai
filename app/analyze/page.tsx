"use client"

import { useState, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { CheckCircle, Circle, Activity, Bot, HardDrive, DollarSign, ArrowRight } from "lucide-react"
import Image from "next/image"

export default function AnalyzePage() {
  interface PotentialSavings {
    total: number
    monthly: number
    yearly: number
  }

  interface BotBreakdownEntry {
    requests: number
    bandwidth: number
    bots: string[]
  }

  interface AnalyzeMetrics {
    totalRequests: number
    botRequests: number
    humanRequests: number
    aiPercentage: string
    humanPercentage: string
    botBandwidth: number
    humanBandwidth: number
    potentialSavings: PotentialSavings
    botBreakdown: Record<string, BotBreakdownEntry>
  }

  interface BotCategorySummary {
    name: string
    requests: number
    percentage: string
    bandwidth: string
    icon: string
    bots: string
  }

  const searchParams = useSearchParams()
  const router = useRouter()
  const [stage, setStage] = useState<"detecting" | "analyzing" | "results">("detecting")
  const [provider, setProvider] = useState<string | null>(null)
  const [website, setWebsite] = useState("")
  const [metrics, setMetrics] = useState<AnalyzeMetrics | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const site = searchParams.get("site") || "your-website.com"
    setWebsite(site)
    
    // Call the real API endpoint
    detectAndAnalyze(site)
  }, [searchParams])

  const detectAndAnalyze = async (site: string) => {
    try {
      setLoading(true)
      setError(null)
      
      // Step 1: Detect provider
      const detectRes = await fetch(`/api/detect-provider?websiteUrl=${encodeURIComponent(site)}`)
      const detectData = await detectRes.json()
      
      if (!detectRes.ok || detectData.error) {
        throw new Error(detectData.error || "Failed to detect provider")
      }
      
      setProvider(detectData.provider)
      setStage("analyzing")
      
      // Step 2: Analyze traffic data
      const analyzeRes = await fetch(`/api/analyze?websiteUrl=${encodeURIComponent(site)}&timeRange=24h`)
      const analyzeData = await analyzeRes.json()
      
      if (!analyzeRes.ok || analyzeData.error) {
        throw new Error(analyzeData.error || "Failed to analyze traffic")
      }
      
      setMetrics(analyzeData.metrics)
      setStage("results")
    } catch (err) {
      console.error("Analysis error:", err)
      setError(err instanceof Error ? err.message : "Failed to analyze website")
      setStage("results") // Still show results page with error
    } finally {
      setLoading(false)
    }
  }

  const handleGetStarted = () => {
    // Check if provider is unsupported
    if (provider === 'cloudflare' || provider === 'aws' || provider === 'unknown' || !provider) {
      router.push("/upload")
    } else {
      router.push(`/connect/${provider}`)
    }
  }

  // Format bytes to human readable
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return "0 B"
    const k = 1024
    const sizes = ["B", "KB", "MB", "GB", "TB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  }

  // Get top bot categories for display
  const getTopBotCategories = (): BotCategorySummary[] => {
    if (!metrics) return []

    const entries = Object.entries(metrics.botBreakdown) as Array<[string, BotBreakdownEntry]>
    const categories: BotCategorySummary[] = entries.map(([category, data]) => ({
      name: category,
      requests: data.requests,
      percentage:
        metrics.totalRequests > 0 ? ((data.requests / metrics.totalRequests) * 100).toFixed(1) : "0",
      bandwidth: formatBytes(data.bandwidth),
      icon: getBotIcon(category),
      bots: data.bots.slice(0, 3).join(", ")
    }))

    return categories.sort((a, b) => b.requests - a.requests).slice(0, 5)
  }

  const getBotIcon = (category: string): string => {
    const icons: Record<string, string> = {
      "ai_training": "🤖",
      "ai_scraper": "🕷️",
      "ai_search": "🔍",
      "search_engine": "🔍",
      "social_media": "📱",
      "seo_tool": "📈",
      "scraper": "📊",
      "monitoring": "👁️",
      "security": "🛡️",
      "unknown": "❓"
    }
    return icons[category] || "🤖"
  }

  const botCategories = getTopBotCategories()

  return (
    <div className="min-h-screen bg-black relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(34,197,94,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(34,197,94,0.03)_1px,transparent_1px)] bg-[size:50px_50px] animate-pulse" />
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-gradient-to-br from-green-500/10 via-emerald-500/5 to-transparent rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-[800px] h-[800px] bg-gradient-to-tl from-green-400/8 via-green-500/4 to-transparent rounded-full blur-3xl" />
      </div>

      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-black/60 backdrop-blur-xl border-b border-green-500/20">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-green-400 to-green-600 p-0.5">
                <div className="w-full h-full rounded-xl bg-black flex items-center justify-center">
                  <Image src="/hoxi-logo.png" alt="Hoxi Logo" width={24} height={24} className="w-6 h-6" />
                </div>
              </div>
              <span className="font-bold text-2xl text-white">Hoxi</span>
            </div>
          </div>
        </div>
      </nav>

      <div className="relative flex items-center justify-center min-h-[calc(100vh-80px)] p-6">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          {stage === "detecting" && (
            <div className="space-y-8">
              <div className="animate-pulse">
                <div className="w-20 h-20 mx-auto mb-6 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
              </div>
              <h2 className="text-4xl font-bold text-white">Detecting your hosting provider...</h2>
              <p className="text-xl text-gray-400">Analyzing {website}</p>
              
              {loading && (
                <div className="text-gray-400">
                  <p>Contacting provider APIs...</p>
                </div>
              )}
            </div>
          )}

          {stage === "analyzing" && (
            <div className="space-y-8">
              <div className="flex items-center justify-center space-x-4">
                <div className="w-16 h-16 bg-orange-500/20 rounded-xl flex items-center justify-center">
                  <span className="text-3xl">☁️</span>
                </div>
                <CheckCircle className="w-8 h-8 text-green-500" />
              </div>
              <h2 className="text-4xl font-bold text-white">
                {provider === "cloudflare" ? "Cloudflare" : 
                 provider === "vercel" ? "Vercel" :
                 provider === "netlify" ? "Netlify" :
                 provider === "aws" ? "AWS" : "Provider"} Detected!
              </h2>
              <p className="text-xl text-gray-400">Fetching your traffic data...</p>

              <div className="space-y-4 text-left max-w-md mx-auto">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span className="text-white">Provider identified</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-white">Analyzing bot traffic patterns...</span>
                </div>
                <div className="flex items-center gap-3 text-gray-500">
                  <Circle className="w-5 h-5" />
                  <span>Calculating costs</span>
                </div>
              </div>
            </div>
          )}

          {stage === "results" && (
            <div className="space-y-12">
              {/* Demo Data Notice */}
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 mb-6">
                <p className="text-blue-400">ℹ️ Demo Analysis</p>
                <p className="text-gray-400 text-sm mt-2">
                  This is a sample analysis showing typical bot traffic patterns. Connect your hosting provider to see your real data.
                </p>
              </div>

              {/* Error Message */}
              {error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-6">
                  <p className="text-red-400">⚠️ {error}</p>
                  <p className="text-gray-400 text-sm mt-2">Showing demo data while we work on connecting to your provider.</p>
                </div>
              )}

              {/* Unsupported Provider Message */}
              {(provider === 'cloudflare' || provider === 'aws' || provider === 'unknown' || !provider) && (
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-6 mb-6">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-yellow-500/20 rounded-lg flex items-center justify-center flex-shrink-0 mt-1">
                      <span className="text-yellow-400">⚠️</span>
                    </div>
                    <div className="flex-1">
                      <p className="text-yellow-400 font-semibold mb-2">
                        {provider === 'cloudflare' ? 'Cloudflare' :
                         provider === 'aws' ? 'AWS' :
                         provider === 'unknown' ? 'Your hosting provider' : 'This platform'} is not yet supported
                      </p>
                      <p className="text-gray-300 text-sm mb-3">
                        Unfortunately, {provider === 'cloudflare' ? 'Cloudflare' : provider === 'aws' ? 'AWS' : 'these platforms'} are not yet supported with direct API integration. We are working very hard to get these platforms supported with Hoxi.
                      </p>
                      <p className="text-gray-300 text-sm">
                        <strong>Meanwhile, you can upload your server logs to get the analytics.</strong> The rest of the flow remains exactly the same - you'll get the same powerful insights and bot detection capabilities.
                      </p>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Shocking Discovery */}
              <div className="text-center space-y-6">
                <div className="inline-flex items-center gap-3 bg-red-500/10 border border-red-500/20 rounded-full px-6 py-3">
                  <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse" />
                  <span className="text-red-400 font-mono text-sm">CRITICAL DISCOVERY</span>
                </div>

                <h1 className="text-5xl lg:text-7xl font-black leading-tight">
                  <span className="block text-white">AI Bots are consuming</span>
                  <span className="block text-red-500">
                    {metrics ? `${metrics.aiPercentage}%` : "47%"}
                  </span>
                  <span className="block text-white">of your bandwidth</span>
                </h1>

                <p className="text-2xl lg:text-3xl text-gray-300">
                  Costing you approximately
                  <span className="text-green-500 font-bold">
                    {metrics ? ` $${metrics.potentialSavings.monthly.toFixed(0)}/month` : " $847/month"}
                  </span>
                </p>
              </div>

              {/* Key Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <Card className="bg-gray-900/40 border-gray-700 backdrop-blur-xl">
                  <CardContent className="p-6 text-center">
                    <Activity className="w-8 h-8 text-blue-400 mx-auto mb-3" />
                    <div className="text-3xl font-bold text-white mb-1">
                      {metrics ? metrics.totalRequests?.toLocaleString() : "14,523"}
                    </div>
                    <div className="text-sm text-gray-400">Total Requests</div>
                    <div className="text-xs text-blue-400 mt-1">
                      {metrics ? `+${((metrics.botRequests / metrics.totalRequests) * 100).toFixed(1)}% bots` : "+12% today"}
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gray-900/40 border-gray-700 backdrop-blur-xl">
                  <CardContent className="p-6 text-center">
                    <Bot className="w-8 h-8 text-red-400 mx-auto mb-3" />
                    <div className="text-3xl font-bold text-red-400 mb-1">
                      {metrics ? `${metrics.aiPercentage}%` : "47%"}
                    </div>
                    <div className="text-sm text-gray-400">Bot Traffic</div>
                    <div className="text-xs text-red-400 mt-1">
                      {metrics ? `${metrics.botRequests?.toLocaleString()} requests` : "6,826 requests"}
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gray-900/40 border-gray-700 backdrop-blur-xl">
                  <CardContent className="p-6 text-center">
                    <HardDrive className="w-8 h-8 text-orange-400 mx-auto mb-3" />
                    <div className="text-3xl font-bold text-orange-400 mb-1">
                      {metrics ? formatBytes(metrics.botBandwidth) : "238 GB"}
                    </div>
                    <div className="text-sm text-gray-400">Bandwidth Used</div>
                    <div className="text-xs text-orange-400 mt-1">
                      {metrics ? `$${(metrics.botBandwidth / (1024**3) * 0.15 * 30).toFixed(0)} cost` : "$95 cost"}
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gray-900/40 border-gray-700 backdrop-blur-xl">
                  <CardContent className="p-6 text-center">
                    <DollarSign className="w-8 h-8 text-green-400 mx-auto mb-3" />
                    <div className="text-3xl font-bold text-green-400 mb-1">
                      {metrics ? `$${metrics.potentialSavings.monthly.toFixed(0)}` : "$847"}
                    </div>
                    <div className="text-sm text-gray-400">Potential Savings</div>
                    <div className="text-xs text-green-400 mt-1">per month</div>
                  </CardContent>
                </Card>
              </div>

              {/* Bot Breakdown Preview */}
              <Card className="bg-gray-900/40 border-gray-700 backdrop-blur-xl">
                <CardContent className="p-8">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-2xl font-bold text-white">Bot Categories Breakdown</h3>
                    <div className="text-sm text-gray-400">Last 24 hours</div>
                  </div>

                  <div className="space-y-4">
                    {botCategories.slice(0, 3).map(category => (
                      <div
                        key={category.name}
                        className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg"
                      >
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
                    ))}

                    {/* Blurred preview of more data */}
                    <div className="space-y-2 blur-sm">
                      {botCategories.slice(3).map(category => (
                        <div
                          key={category.name}
                          className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg"
                        >
                          <div className="flex items-center gap-4">
                            <span className="text-2xl">{category.icon}</span>
                            <div>
                              <div className="font-semibold text-white">••••••</div>
                              <div className="text-sm text-gray-400">•••••••••</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-xl font-bold text-white">••••</div>
                            <div className="text-sm text-gray-400">••% • •••••</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* CTA */}
              <div className="text-center space-y-6">
                <p className="text-xl text-gray-300">Get full access to real-time monitoring and smart blocking</p>

                <Button
                  onClick={handleGetStarted}
                  size="lg"
                  className="px-12 py-6 bg-gradient-to-r from-green-500 to-emerald-600 text-white text-xl font-bold rounded-lg hover:shadow-lg transform hover:scale-105 transition-all"
                >
                  {(provider === 'cloudflare' || provider === 'aws' || provider === 'unknown' || !provider) ?
                    "Upload Server Logs & Start Monitoring" :
                    `Connect ${provider === "cloudflare" ? "Cloudflare" : provider === "vercel" ? "Vercel" : provider === "netlify" ? "Netlify" : "Provider"} & Start Monitoring`
                  }
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>

                <p className="text-sm text-gray-400">No credit card required • Setup in 45 seconds</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
