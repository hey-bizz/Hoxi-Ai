"use client"

import type React from "react"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import type { Session } from "@supabase/supabase-js"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Upload, FileText, CheckCircle, AlertTriangle, ArrowLeft, Zap, Loader2 } from "lucide-react"
import Image from "next/image"
import { getSupabaseBrowserClient } from "@/lib/supabase-browser"

export default function UploadPage() {
  const router = useRouter()
  const [dragActive, setDragActive] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [progress, setProgress] = useState<{ stage: string; percent: number; message: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [authChecked, setAuthChecked] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const supabase = useMemo(() => getSupabaseBrowserClient(), [])

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getSession()
      setSession(data.session)
      setAuthChecked(true)
    }

    init()

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession)
    })

    return () => {
      authListener?.subscription?.unsubscribe()
    }
  }, [supabase])

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    const droppedFiles = Array.from(e.dataTransfer.files)
    setFiles((prev) => [...prev, ...droppedFiles])
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files)
      setFiles((prev) => [...prev, ...selectedFiles])
    }
  }

  const openFileDialog = () => {
    if (uploading) return

    if (!session) {
      setError('Please sign in before selecting log files.')
      return
    }

    setError(null)
    fileInputRef.current?.click()
  }

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const handleUpload = async () => {
    if (files.length === 0) return

    if (!session) {
      setError("Please sign in before uploading logs.")
      return
    }


    setUploading(true)
    setProgress({ stage: "uploading", percent: 0, message: "Starting upload..." })
    setError(null)

    try {
      const formData = new FormData()
      // Auto-generate websiteId for uploaded logs
      formData.append("websiteId", `upload-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`)
      formData.append("dryRun", "false")

      files.forEach((file) => {
        formData.append("files", file)
      })

      const response = await fetch("/api/process-logs", {
        method: "POST",
        body: formData,
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Upload failed")
      }

      setProgress({ stage: "complete", percent: 100, message: "Upload complete!" })

      setTimeout(() => {
        setAnalyzing(true)
        setUploading(false)

        setTimeout(() => {
          router.push("/ai-analysis")
        }, 3000)
      }, 1000)
    } catch (err) {
      console.error("Upload error:", err)
      setError(err instanceof Error ? err.message : "Failed to upload files")
      setUploading(false)
    }
  }

  if (analyzing) {
    return (
      <div className="min-h-screen bg-black relative overflow-hidden">
        {/* Background Effects */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-[linear-gradient(rgba(34,197,94,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(34,197,94,0.03)_1px,transparent_1px)] bg-[size:50px_50px] animate-pulse" />
          <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-gradient-to-br from-green-500/10 via-emerald-500/5 to-transparent rounded-full blur-3xl animate-pulse" />
        </div>

        <div className="relative flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="w-20 h-20 mx-auto mb-6 relative">
              <div className="absolute inset-0 border-4 border-green-500/30 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
              <Zap className="w-8 h-8 text-green-400 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
            </div>
            <h2 className="text-3xl font-bold text-white mb-4">AI Analyzing Your Logs</h2>
            <p className="text-gray-400 text-lg">Processing server logs to detect bot patterns...</p>
            <div className="mt-8 max-w-md mx-auto">
              <div className="flex justify-between text-sm text-gray-400 mb-2">
                <span>Processing files</span>
                <span>Analyzing patterns</span>
              </div>
              <div className="w-full bg-gray-800 rounded-full h-2">
                <div className="bg-green-500 h-2 rounded-full animate-pulse" style={{ width: "75%" }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    )
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
            <Button onClick={() => router.back()} variant="ghost" size="sm" className="text-gray-400 hover:text-white">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          </div>
        </div>
      </nav>

      <div className="relative p-8">
        <div className="max-w-2xl mx-auto">
          {/* Progress Bar */}
          <div className="mb-8">
            <div className="flex items-center justify-between text-sm text-gray-400 mb-2">
              <span>Alternative Path</span>
              <span>Upload & Analyze</span>
            </div>
            <div className="w-full bg-gray-800 rounded-full h-2">
              <div className="bg-blue-500 h-2 rounded-full transition-all duration-300" style={{ width: "50%" }} />
            </div>
          </div>

          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-blue-500/20 rounded-xl flex items-center justify-center">
                <Upload className="w-8 h-8 text-blue-400" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">Upload Server Logs</h1>
                <p className="text-gray-400">Let our AI analyze your logs directly</p>
              </div>
            </div>

            {!session && authChecked && (
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
                <div className="flex items-center gap-2 text-yellow-300">
                  <AlertTriangle className="w-5 h-5" />
                  <span>
                    You need to be signed in to upload logs.{' '}
                    <Button variant="link" className="text-yellow-300 px-2" onClick={() => router.push('/auth/login')}>
                      Sign in
                    </Button>
                  </span>
                </div>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                <div className="flex items-center gap-2 text-red-400">
                  <AlertTriangle className="w-5 h-5" />
                  <span>{error}</span>
                </div>
              </div>
            )}

            <Card className="bg-gray-900/40 border-gray-700 backdrop-blur-xl">
              <CardContent className="p-6 space-y-6">

                <div
                  className={`border-2 border-dashed rounded-xl p-6 transition ${dragActive ? "border-blue-500 bg-blue-500/10" : "border-gray-700"}`}
                  role="button"
                  tabIndex={0}
                  onClick={openFileDialog}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault()
                      openFileDialog()
                    }
                  }}
                >
                  <div
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                    className="flex flex-col items-center justify-center text-center space-y-4"
                  >
                    <div className="w-16 h-16 bg-gray-800/70 rounded-full flex items-center justify-center">
                      <Upload className="w-8 h-8 text-blue-400" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-lg font-semibold text-white">Drop log files here</h3>
                      <p className="text-sm text-gray-400">CSV, JSON, or text log files up to 50MB each</p>
                    </div>
                    <div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        className="hidden"
                        multiple
                        onChange={handleFileInput}
                        accept=".csv,.json,.log,.txt"
                        disabled={uploading}
                      />
                      <Button
                        variant="outline"
                        className="border-gray-700 text-gray-300 hover:bg-gray-800"
                        onClick={openFileDialog}
                        disabled={uploading}
                      >
                        Browse files
                      </Button>
                    </div>
                  </div>
                </div>

                {files.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm text-gray-400">
                      <span>Selected Files</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-gray-400 hover:text-white"
                        onClick={() => setFiles([])}
                        disabled={uploading}
                      >
                        Clear all
                      </Button>
                    </div>
                    <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                      {files.map((file, index) => (
                        <div key={`${file.name}-${index}`} className="flex items-center justify-between bg-gray-800/60 border border-gray-700 rounded-lg px-4 py-3">
                          <div className="flex items-center gap-3 text-sm text-gray-200">
                            <FileText className="w-5 h-5 text-blue-400" />
                            <div>
                              <p className="font-medium text-white">{file.name}</p>
                              <p className="text-xs text-gray-400">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-gray-400 hover:text-white"
                            onClick={() => removeFile(index)}
                            disabled={uploading}
                          >
                            Remove
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-gray-300">
                      <CheckCircle className="w-4 h-4 text-green-400" />
                      <span>CSV exports</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-300">
                      <CheckCircle className="w-4 h-4 text-green-400" />
                      <span>JSON log streams</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-300">
                      <CheckCircle className="w-4 h-4 text-green-400" />
                      <span>NDJSON batches</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-gray-300">
                      <CheckCircle className="w-4 h-4 text-green-400" />
                      <span>Access & error logs</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-300">
                      <CheckCircle className="w-4 h-4 text-green-400" />
                      <span>Provider exports</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-300">
                      <CheckCircle className="w-4 h-4 text-green-400" />
                      <span>Custom data feeds</span>
                    </div>
                  </div>
                </div>

                {files.length > 0 && (
                  <div className="space-y-2 text-sm text-gray-400">
                    <div className="flex items-center gap-2">
                      <Loader2 className={`w-4 h-4 ${uploading ? "animate-spin text-blue-400" : "text-gray-500"}`} />
                      <span>{uploading ? "Uploading files..." : "Ready to upload"}</span>
                    </div>
                    {progress && (
                      <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
                        <div className="bg-gradient-to-r from-blue-500 to-indigo-500 h-2 rounded-full transition-all" style={{ width: `${progress.percent}%` }} />
                      </div>
                    )}
                  </div>
                )}

                <Button
                  className="w-full h-12 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600"
                  onClick={handleUpload}
                  disabled={files.length === 0 || uploading || !session}
                >
                  {uploading ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Uploading...
                    </div>
                  ) : (
                    "Upload logs"
                  )}
                </Button>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-gray-900/40 border border-gray-700 rounded-lg p-6 space-y-3">
                <h3 className="text-white font-semibold">What happens next?</h3>
                <p className="text-sm text-gray-400">
                  We normalize your logs, run them through the Core Detection Engine, and calculate cost impact instantly.
                </p>
                <ul className="text-sm text-gray-300 space-y-2">
                  <li>• Duplicate requests removed automatically</li>
                  <li>• Bot signatures matched with IP validation</li>
                  <li>• Cost model applied for your hosting provider</li>
                </ul>
              </div>

              <div className="bg-gray-900/40 border border-gray-700 rounded-lg p-6 space-y-3">
                <h3 className="text-white font-semibold">Need help?</h3>
                <p className="text-sm text-gray-400">
                  You can also connect Cloudflare, Vercel, AWS, or Netlify directly for automated streaming.
                </p>
                <Button
                  variant="outline"
                  className="border-gray-700 text-gray-300 hover:bg-gray-800"
                  onClick={() => router.push('/setup/cloudflare')}
                >
                  Explore integrations
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
