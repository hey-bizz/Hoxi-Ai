"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { CheckCircle, ExternalLink, AlertTriangle, Copy, Clock, Zap, Upload, FileText } from "lucide-react"
import Image from "next/image"

export default function AWSConnect() {
  const router = useRouter()

  // Redirect to upload page immediately for unsupported provider
  const handleUploadRedirect = () => {
    router.push('/upload')
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
          {/* Unsupported Provider Message */}
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-yellow-500/20 rounded-xl flex items-center justify-center">
                <span className="text-3xl">⚠️</span>
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">AWS Not Yet Supported</h1>
                <p className="text-gray-400">But you can still get analytics by uploading logs</p>
              </div>
            </div>

            <Card className="bg-gray-900/40 border-gray-700 backdrop-blur-xl">
              <CardContent className="p-8">
                <div className="space-y-6">
                  <div className="text-center space-y-4">
                    <div className="w-20 h-20 mx-auto bg-yellow-500/20 rounded-2xl flex items-center justify-center">
                      <span className="text-4xl">🟠</span>
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-white mb-2">AWS Support Coming Soon</h2>
                      <p className="text-gray-300 mb-4">
                        We are working very hard to get AWS supported with direct API integration.
                        Unfortunately, this platform is not yet supported.
                      </p>
                    </div>
                  </div>

                  <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-6">
                    <div className="flex items-start gap-3">
                      <Upload className="w-6 h-6 text-green-400 flex-shrink-0 mt-1" />
                      <div>
                        <h3 className="text-lg font-semibold text-green-400 mb-2">Upload Server Logs Instead</h3>
                        <p className="text-gray-300 text-sm mb-4">
                          Meanwhile, you can upload your server logs to get the same powerful analytics.
                          The rest of the flow remains exactly the same - you'll get the same bot detection
                          and insights capabilities.
                        </p>
                        <ul className="text-sm text-gray-300 space-y-1 mb-4">
                          <li>• Same AI-powered bot detection</li>
                          <li>• Complete traffic analysis</li>
                          <li>• Cost savings recommendations</li>
                          <li>• Real-time monitoring dashboard</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <Button
                      onClick={handleUploadRedirect}
                      className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white"
                      size="lg"
                    >
                      <Upload className="w-5 h-5 mr-2" />
                      Upload Server Logs
                    </Button>
                    <Button
                      onClick={() => router.push('/analyze')}
                      variant="outline"
                      className="border-gray-600 text-gray-300 hover:bg-gray-800"
                      size="lg"
                    >
                      Back to Analysis
                    </Button>
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