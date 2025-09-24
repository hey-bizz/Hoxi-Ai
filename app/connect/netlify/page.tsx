"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { CheckCircle, ExternalLink, Shield, Zap, Upload, FileText, AlertTriangle, Loader2 } from "lucide-react"
import Image from "next/image"

export default function NetlifyConnect() {
  const router = useRouter()
  const [stage, setStage] = useState<"intro" | "redirecting" | "connecting" | "success" | "error">("intro")
  const [error, setError] = useState<string | null>(null)
  const [connecting, setConnecting] = useState(false)

  const connectNetlify = async () => {
    setStage("connecting")
    setError(null)
    setConnecting(true)

    try {
      // Get OAuth URL from the API
      const response = await fetch('/api/integrations/netlify/authorize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({})
      })

      const result = await response.json()

      if (!response.ok || !result.url) {
        throw new Error(result.error || 'Failed to get authorization URL')
      }

      setStage("redirecting")

      // Store return URL
      if (typeof window !== "undefined") {
        sessionStorage.setItem("return_url", window.location.href)
      }

      // Redirect to Netlify OAuth
      window.location.href = result.url
    } catch (err) {
      console.error('Netlify connection error:', err)
      setError(err instanceof Error ? err.message : 'Failed to connect to Netlify')
      setStage("error")
    } finally {
      setConnecting(false)
    }
  }

  const handleUploadOption = () => {
    router.push("/upload")
  }

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

      <div className="relative p-8">
        <div className="max-w-2xl mx-auto">
          {/* Progress Bar */}
          <div className="mb-8">
            <div className="flex items-center justify-between text-sm text-gray-400 mb-2">
              <span>Step 2 of 3</span>
              <span>66% complete</span>
            </div>
            <div className="w-full bg-gray-800 rounded-full h-2">
              <div className="bg-green-500 h-2 rounded-full transition-all duration-300" style={{ width: "66%" }} />
            </div>
          </div>

          {stage === "intro" && (
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-gradient-to-r from-teal-500 to-cyan-500 rounded-xl flex items-center justify-center">
                  <svg className="w-8 h-8" viewBox="0 0 24 24" fill="white">
                    <path d="M16.934 8.519a1.044 1.044 0 0 1 .303.23c.199.199.303.461.303.744v5.014c0 .283-.104.545-.303.744s-.461.303-.744.303H7.507a1.044 1.044 0 0 1-.744-.303A1.044 1.044 0 0 1 6.46 14.507V9.493c0-.283.104-.545.303-.744s.461-.303.744-.303h8.986c.283 0 .545.104.744.303z"/>
                  </svg>
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-white">Connect Netlify</h1>
                  <p className="text-gray-400">One-click authorization</p>
                </div>
              </div>

              <Card className="bg-gray-900/40 border-gray-700 backdrop-blur-xl">
                <CardContent className="p-6">
                  <h3 className="font-semibold mb-4 text-white">What will happen:</h3>
                  <ol className="space-y-3 text-sm">
                    <li className="flex gap-3">
                      <span className="text-green-500 font-bold">1.</span>
                      <span className="text-gray-300">You&apos;ll be redirected to Netlify</span>
                    </li>
                    <li className="flex gap-3">
                      <span className="text-green-500 font-bold">2.</span>
                      <span className="text-gray-300">Approve Hoxi access (read-only)</span>
                    </li>
                    <li className="flex gap-3">
                      <span className="text-green-500 font-bold">3.</span>
                      <span className="text-gray-300">Automatically return here</span>
                    </li>
                  </ol>

                  <div className="mt-4 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                    <div className="flex gap-3">
                      <Zap className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-green-400">Fully Automatic</p>
                        <p className="text-xs text-gray-400 mt-1">
                          No manual steps required - complete setup in 10 seconds!
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                    <div className="flex gap-3">
                      <Shield className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-blue-400">Read-only Access</p>
                        <p className="text-xs text-gray-400 mt-1">
                          We only request permission to read your deployment analytics. No changes to your sites.
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Button
                onClick={connectNetlify}
                disabled={connecting}
                size="lg"
                className="w-full px-6 py-4 bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-bold rounded-lg hover:shadow-lg transform hover:scale-105 transition-all disabled:opacity-50 disabled:transform-none"
              >
                {connecting ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-3 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M16.934 8.519a1.044 1.044 0 0 1 .303.23c.199.199.303.461.303.744v5.014c0 .283-.104.545-.303.744s-.461.303-.744.303H7.507a1.044 1.044 0 0 1-.744-.303A1.044 1.044 0 0 1 6.46 14.507V9.493c0-.283.104-.545.303-.744s.461-.303.744-.303h8.986c.283 0 .545.104.744.303z"/>
                    </svg>
                    Continue with Netlify
                    <ExternalLink className="w-5 h-5 ml-2" />
                  </>
                )}
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-700"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-black text-gray-400">or</span>
                </div>
              </div>

              <Card className="bg-gray-900/40 border-gray-700 backdrop-blur-xl">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center">
                      <Upload className="w-6 h-6 text-blue-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white">Upload Server Logs</h3>
                      <p className="text-sm text-gray-400">Alternative if OAuth connection fails</p>
                    </div>
                  </div>
                  <p className="text-sm text-gray-300 mb-4">
                    Can&apos;t connect via OAuth? Upload your Netlify logs directly and our AI will analyze them for bot
                    detection patterns.
                  </p>
                  <Button
                    onClick={handleUploadOption}
                    variant="outline"
                    className="w-full border-gray-600 text-gray-300 hover:bg-gray-800 bg-transparent"
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    Upload Logs Instead
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}

          {stage === "connecting" && (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
              <h2 className="text-xl font-bold text-white">Setting up connection...</h2>
              <p className="text-gray-400 mt-2">Preparing OAuth authorization</p>
            </div>
          )}

          {stage === "redirecting" && (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
              <h2 className="text-xl font-bold text-white">Redirecting to Netlify...</h2>
              <p className="text-gray-400 mt-2">You&apos;ll be back in a few seconds</p>

              <div className="mt-8 space-y-3 text-left max-w-md mx-auto">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span className="text-gray-300">Opening Netlify authorization</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-gray-300">Waiting for approval...</span>
                </div>
              </div>
            </div>
          )}

          {stage === "error" && (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 bg-red-500/20 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-8 h-8 text-red-400" />
              </div>
              <h2 className="text-xl font-bold text-white">Connection Failed</h2>
              <p className="text-gray-400 mt-2">Unable to connect to Netlify</p>

              {error && (
                <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg max-w-md mx-auto">
                  <p className="text-sm text-red-400">{error}</p>
                </div>
              )}

              <div className="mt-8 space-x-4">
                <Button
                  onClick={() => setStage("intro")}
                  variant="outline"
                  className="border-gray-600 text-gray-300 hover:bg-gray-800 bg-transparent"
                >
                  Try Again
                </Button>
                <Button
                  onClick={handleUploadOption}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Upload Logs Instead
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}