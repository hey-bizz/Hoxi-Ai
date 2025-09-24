"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { CheckCircle, Lock, Shield, RefreshCw, ExternalLink, ArrowRight } from "lucide-react"
import Image from "next/image"
import Link from "next/link"

export default function VercelSetupPage() {
  const router = useRouter()
  const [apiToken, setApiToken] = useState("")
  const [isConnecting, setIsConnecting] = useState(false)

  const handleConnect = async () => {
    if (!apiToken.trim()) return

    setIsConnecting(true)

    // Simulate API connection
    setTimeout(() => {
      setIsConnecting(false)
      router.push("/dashboard")
    }, 3000)
  }

  const steps = [
    {
      number: 1,
      title: "Open Vercel Settings",
      description: "Go to your Vercel account settings",
      action: (
        <Button
          variant="outline"
          size="sm"
          className="border-green-500/30 text-green-400 hover:bg-green-500/10 bg-transparent"
          onClick={() => window.open("https://vercel.com/account/tokens", "_blank")}
        >
          Open Settings
          <ExternalLink className="w-4 h-4 ml-2" />
        </Button>
      ),
    },
    {
      number: 2,
      title: "Create New Token",
      description: "Click 'Create' and give it a name like 'Hoxi Monitor'",
      action: null,
    },
    {
      number: 3,
      title: "Copy Your Token",
      description: "Copy the generated token and paste it below",
      action: null,
    },
  ]

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(34,197,94,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(34,197,94,0.03)_1px,transparent_1px)] bg-[size:50px_50px] animate-pulse" />
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-gradient-to-br from-green-500/10 via-emerald-500/5 to-transparent rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-[800px] h-[800px] bg-gradient-to-tl from-green-400/8 via-green-500/4 to-transparent rounded-full blur-3xl" />
      </div>

      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-background/60 backdrop-blur-xl border-b border-green-500/20">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3">
              <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-green-400 to-green-600 p-0.5">
                <div className="w-full h-full rounded-xl bg-background flex items-center justify-center">
                  <Image src="/hoxi-logo.png" alt="Hoxi Logo" width={24} height={24} className="w-6 h-6" />
                </div>
              </div>
              <span className="font-bold text-2xl text-white">Hoxi</span>
            </Link>
          </div>
        </div>
      </nav>

      <div className="relative max-w-4xl mx-auto p-6 pt-12">
        {/* Progress Bar */}
        <div className="mb-12">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-gray-400">Step 2 of 3</span>
            <span className="text-sm text-gray-400">66% complete</span>
          </div>
          <div className="w-full bg-gray-800 rounded-full h-2">
            <div
              className="bg-gradient-to-r from-green-500 to-emerald-500 h-2 rounded-full transition-all duration-500"
              style={{ width: "66%" }}
            />
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-12 items-start">
          {/* Left Column - Instructions */}
          <div className="space-y-8">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-black rounded-xl flex items-center justify-center border border-gray-700">
                <span className="text-white font-bold text-2xl">▲</span>
              </div>
              <div>
                <h2 className="text-3xl font-bold text-white">Connect Vercel</h2>
                <p className="text-gray-400 text-lg">Quick setup for Vercel projects</p>
              </div>
            </div>

            {/* Setup Steps */}
            <div className="space-y-6">
              {steps.map((step, index) => (
                <div key={step.number} className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-green-500/20 rounded-full flex items-center justify-center">
                    <span className="text-green-400 font-bold text-sm">{step.number}</span>
                  </div>
                  <div className="flex-1 space-y-2">
                    <h3 className="font-semibold text-white">{step.title}</h3>
                    <p className="text-gray-400 text-sm">{step.description}</p>
                    {step.action && <div>{step.action}</div>}
                  </div>
                </div>
              ))}
            </div>

            {/* Trust Signals */}
            <div className="flex items-center gap-6 text-sm text-gray-500 pt-6 border-t border-gray-800">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-green-400" />
                <span>Encrypted</span>
              </div>
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-green-400" />
                <span>Read-only access</span>
              </div>
              <div className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-green-400" />
                <span>Revoke anytime</span>
              </div>
            </div>
          </div>

          {/* Right Column - Connection Form */}
          <div className="space-y-6">
            <Card className="bg-gray-900/40 border-gray-700 backdrop-blur-xl">
              <CardContent className="p-8 space-y-6">
                <div className="text-center space-y-2">
                  <h3 className="text-xl font-bold text-white">API Token</h3>
                  <p className="text-gray-400 text-sm">Paste your Vercel API token below</p>
                </div>

                <div className="space-y-4">
                  <div className="relative">
                    <Input
                      type="password"
                      placeholder="Paste your API token here..."
                      value={apiToken}
                      onChange={(e) => setApiToken(e.target.value)}
                      className="h-12 bg-gray-800/50 border-gray-600 text-white placeholder:text-gray-500 focus:border-green-500 focus:ring-green-500/20 pr-12"
                    />
                    {apiToken && (
                      <CheckCircle className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-green-400" />
                    )}
                  </div>

                  <Button
                    onClick={handleConnect}
                    disabled={!apiToken.trim() || isConnecting}
                    className="w-full h-12 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-semibold"
                  >
                    {isConnecting ? (
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Connecting...
                      </div>
                    ) : (
                      <>
                        Connect & Start Monitoring
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* What We'll Monitor */}
            <Card className="bg-gray-900/40 border-gray-700 backdrop-blur-xl">
              <CardContent className="p-6">
                <h4 className="font-semibold text-white mb-4">What we'll monitor:</h4>
                <div className="space-y-3 text-sm">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-4 h-4 text-green-400" />
                    <span className="text-gray-300">Edge function analytics</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-4 h-4 text-green-400" />
                    <span className="text-gray-300">Bot traffic patterns</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-4 h-4 text-green-400" />
                    <span className="text-gray-300">Bandwidth optimization</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-4 h-4 text-green-400" />
                    <span className="text-gray-300">Performance insights</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
