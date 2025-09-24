// Behavioral Analysis Engine - Analyzes session behavior patterns
// Identifies human vs automated behavior based on browsing patterns

import { DetectionLogEntry, SessionBehavior, DetectionConfig } from './types'

interface SessionData {
  sessionId: string
  ip: string
  userAgent: string
  entries: DetectionLogEntry[]
  startTime: Date
  endTime: Date
}

export class BehaviorAnalyzer {
  private sessionConfig: DetectionConfig['sessionWindows']

  constructor(config?: Partial<DetectionConfig['sessionWindows']>) {
    this.sessionConfig = {
      maxGapMinutes: 30,      // Max time gap between requests in same session
      maxDurationHours: 8,    // Max session duration
      ...config
    }
  }

  /**
   * Analyze session behavior patterns
   */
  analyzeBehavior(entries: DetectionLogEntry[]): SessionBehavior[] {
    if (entries.length === 0) return []

    // Group entries into sessions
    const sessions = this.groupIntoSessions(entries)

    // Analyze each session
    return sessions.map(session => this.analyzeSession(session))
  }

  /**
   * Group log entries into sessions based on IP, User Agent, and time gaps
   */
  private groupIntoSessions(entries: DetectionLogEntry[]): SessionData[] {
    // Sort by timestamp
    const sorted = entries.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())

    // Group by IP + User Agent
    const groups = new Map<string, DetectionLogEntry[]>()

    for (const entry of sorted) {
      const key = `${entry.ip_address || 'unknown'}|${entry.user_agent || 'unknown'}`
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(entry)
    }

    // Split groups into sessions based on time gaps
    const sessions: SessionData[] = []

    for (const [key, groupEntries] of groups) {
      const [ip, userAgent] = key.split('|')
      const groupSessions = this.splitIntoSessions(groupEntries, ip, userAgent)
      sessions.push(...groupSessions)
    }

    return sessions
  }

  /**
   * Split a group of entries into individual sessions based on time gaps
   */
  private splitIntoSessions(entries: DetectionLogEntry[], ip: string, userAgent: string): SessionData[] {
    if (entries.length === 0) return []

    const sessions: SessionData[] = []
    let currentSession: DetectionLogEntry[] = [entries[0]]
    let sessionCounter = 1

    for (let i = 1; i < entries.length; i++) {
      const prevTime = entries[i - 1].timestamp.getTime()
      const currTime = entries[i].timestamp.getTime()
      const gapMinutes = (currTime - prevTime) / (1000 * 60)

      // Check if this belongs to the same session
      if (gapMinutes <= this.sessionConfig.maxGapMinutes) {
        currentSession.push(entries[i])
      } else {
        // End current session and start new one
        sessions.push(this.createSessionData(currentSession, ip, userAgent, sessionCounter++))
        currentSession = [entries[i]]
      }
    }

    // Add the last session
    if (currentSession.length > 0) {
      sessions.push(this.createSessionData(currentSession, ip, userAgent, sessionCounter))
    }

    return sessions
  }

  /**
   * Create session data object
   */
  private createSessionData(
    entries: DetectionLogEntry[],
    ip: string,
    userAgent: string,
    sessionNum: number
  ): SessionData {
    const startTime = entries[0].timestamp
    const endTime = entries[entries.length - 1].timestamp
    const sessionId = `${ip}_${sessionNum}_${startTime.getTime()}`

    return {
      sessionId,
      ip,
      userAgent,
      entries: [...entries], // Clone array
      startTime,
      endTime
    }
  }

  /**
   * Analyze individual session behavior
   */
  private analyzeSession(session: SessionData): SessionBehavior {
    const sessionDuration = session.endTime.getTime() - session.startTime.getTime()
    const pagesViewed = session.entries.length
    const avgTimePerPage = pagesViewed > 1 ? sessionDuration / (pagesViewed - 1) : sessionDuration

    // Analyze different behavioral aspects
    const assetsLoaded = this.checkAssetsLoaded(session.entries)
    const hasReferer = this.checkRefererPresence(session.entries)
    const patterns = this.analyzeSessionPatterns(session)

    // Calculate human score
    const humanScore = this.calculateHumanScore({
      sessionDuration,
      pagesViewed,
      avgTimePerPage,
      assetsLoaded,
      hasReferer,
      ...patterns
    })

    return {
      sessionId: session.sessionId,
      sessionDuration,
      pagesViewed,
      avgTimePerPage,
      assetsLoaded,
      hasReferer,
      humanScore,
      patterns
    }
  }

  /**
   * Check if session includes asset loading (CSS, JS, images)
   */
  private checkAssetsLoaded(entries: DetectionLogEntry[]): boolean {
    const assetExtensions = /\.(css|js|jpg|jpeg|png|gif|svg|woff2?|ttf|ico|webp)$/i

    return entries.some(entry => {
      const path = entry.path || ''
      return assetExtensions.test(path) || path.includes('/assets/') || path.includes('/static/')
    })
  }

  /**
   * Check if session has referer information
   */
  private checkRefererPresence(entries: DetectionLogEntry[]): boolean {
    return entries.some(entry => entry.referer && entry.referer !== '')
  }

  /**
   * Analyze session patterns for human-like behavior
   */
  private analyzeSessionPatterns(session: SessionData): SessionBehavior['patterns'] {
    const paths = session.entries.map(e => e.path || '/')

    return {
      viewsHomepage: this.checkHomepageVisit(paths),
      varyingResponseTimes: this.checkVaryingResponseTimes(session.entries),
      realisticSessionLength: this.checkRealisticSessionLength(session)
    }
  }

  /**
   * Check if session includes homepage visit
   */
  private checkHomepageVisit(paths: string[]): boolean {
    return paths.some(path => path === '/' || path === '' || path === '/index.html')
  }

  /**
   * Check for varying response times (indicates real network conditions)
   */
  private checkVaryingResponseTimes(entries: DetectionLogEntry[]): boolean {
    const responseTimes = entries
      .map(e => e.response_time_ms)
      .filter(rt => rt !== undefined && rt > 0) as number[]

    if (responseTimes.length < 3) return false

    const mean = responseTimes.reduce((sum, rt) => sum + rt, 0) / responseTimes.length
    const variance = responseTimes.reduce((sum, rt) => sum + Math.pow(rt - mean, 2), 0) / responseTimes.length

    // Human browsing typically has more variable response times
    return variance > 100 // More than 100ms variance
  }

  /**
   * Check if session length is realistic for human behavior
   */
  private checkRealisticSessionLength(session: SessionData): boolean {
    const durationMinutes = (session.endTime.getTime() - session.startTime.getTime()) / (1000 * 60)

    // Too short (< 1 minute) or too long (> 4 hours) is suspicious
    return durationMinutes >= 1 && durationMinutes <= 240
  }

  /**
   * Calculate human behavior score (0-1, higher = more human-like)
   */
  private calculateHumanScore(factors: {
    sessionDuration: number
    pagesViewed: number
    avgTimePerPage: number
    assetsLoaded: boolean
    hasReferer: boolean
    viewsHomepage: boolean
    varyingResponseTimes: boolean
    realisticSessionLength: boolean
  }): number {
    let score = 0.5 // Base score

    // Asset loading indicates real browser
    if (factors.assetsLoaded) score += 0.15

    // Referer indicates natural navigation
    if (factors.hasReferer) score += 0.1

    // Homepage visit is common for humans
    if (factors.viewsHomepage) score += 0.1

    // Varying response times indicate real network conditions
    if (factors.varyingResponseTimes) score += 0.1

    // Realistic session length
    if (factors.realisticSessionLength) score += 0.1

    // Reasonable time per page (not too fast, not too slow)
    const timePerPageSeconds = factors.avgTimePerPage / 1000
    if (timePerPageSeconds >= 5 && timePerPageSeconds <= 300) {
      score += 0.1
    } else if (timePerPageSeconds < 1) {
      score -= 0.2 // Very fast page views are suspicious
    }

    // Page diversity (not just crawling similar pages)
    if (factors.pagesViewed >= 3 && factors.pagesViewed <= 20) {
      score += 0.05
    } else if (factors.pagesViewed > 50) {
      score -= 0.15 // Too many pages in one session
    }

    // Session duration factors
    const sessionMinutes = factors.sessionDuration / (1000 * 60)
    if (sessionMinutes >= 2 && sessionMinutes <= 60) {
      score += 0.1
    } else if (sessionMinutes < 0.5) {
      score -= 0.2 // Very short sessions are suspicious
    }

    return Math.max(0, Math.min(1, score))
  }

  /**
   * Analyze behavior for a specific IP
   */
  analyzeIPBehavior(ip: string, entries: DetectionLogEntry[]): SessionBehavior[] {
    const ipEntries = entries.filter(e => e.ip_address === ip)
    return this.analyzeBehavior(ipEntries)
  }

  /**
   * Get aggregated behavior statistics
   */
  getAggregatedStats(behaviors: SessionBehavior[]): {
    avgHumanScore: number
    totalSessions: number
    humanSessions: number
    botSessions: number
    avgSessionDuration: number
    avgPagesPerSession: number
  } {
    if (behaviors.length === 0) {
      return {
        avgHumanScore: 0,
        totalSessions: 0,
        humanSessions: 0,
        botSessions: 0,
        avgSessionDuration: 0,
        avgPagesPerSession: 0
      }
    }

    const avgHumanScore = behaviors.reduce((sum, b) => sum + b.humanScore, 0) / behaviors.length
    const humanSessions = behaviors.filter(b => b.humanScore > 0.6).length
    const botSessions = behaviors.length - humanSessions
    const avgSessionDuration = behaviors.reduce((sum, b) => sum + b.sessionDuration, 0) / behaviors.length
    const avgPagesPerSession = behaviors.reduce((sum, b) => sum + b.pagesViewed, 0) / behaviors.length

    return {
      avgHumanScore,
      totalSessions: behaviors.length,
      humanSessions,
      botSessions,
      avgSessionDuration,
      avgPagesPerSession
    }
  }

  /**
   * Update session configuration
   */
  updateConfig(config: Partial<DetectionConfig['sessionWindows']>): void {
    this.sessionConfig = { ...this.sessionConfig, ...config }
  }
}

// Export singleton instance
export const behaviorAnalyzer = new BehaviorAnalyzer()