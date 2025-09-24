"use client"

import { useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { CheckCircle } from "lucide-react"
import Image from "next/image"

export default function GitHubCallback() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const code = searchParams.get("code")

    if (code) {
      // Exchange code for token (simulated)
      setTimeout(() => {
        // In a real implementation, this would make an API call to exchange the code
        // fetch('/api/auth/github', {
        //   method: 'POST',
        //   body: JSON.stringify({ code, state: searchParams.get('state') })
        // }).then(() => {
        //   router.push('/dashboard')
        // })

        // For demo, just redirect to dashboard
        router.push("/dashboard")
      }, 1500)
    } else {
      // No code received, redirect back to connection page
      router.push("/connect/github-pages")
    }
  }, [router, searchParams])

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
            <div className="flex items-center gap-3">
              <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-green-400 to-green-600 p-0.5">
                <div className="w-full h-full rounded-xl bg-background flex items-center justify-center">
                  <Image src="/hoxi-logo.png" alt="Hoxi Logo" width={24} height={24} className="w-6 h-6" />
                </div>
              </div>
              <span className="font-bold text-2xl text-white">Hoxi</span>
            </div>
          </div>
        </div>
      </nav>

      <div className="relative flex items-center justify-center min-h-[calc(100vh-80px)]">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
          <h2 className="text-xl font-bold text-white">Completing GitHub setup...</h2>
          <p className="text-gray-400 mt-2">Scanning your repositories for GitHub Pages sites</p>

          <div className="mt-8 space-y-3 text-left max-w-md mx-auto">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <span className="text-gray-300">GitHub authorization received</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-gray-300">Detecting GitHub Pages sites...</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
