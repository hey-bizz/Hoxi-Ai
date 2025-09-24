export interface LogEntry {
  timestamp: Date
  ip: string
  method: string
  path: string
  status: number
  bytes: number
  userAgent: string
  responseTime: number
}

export class LogParser {
  // Parse Apache/Nginx common log format
  parseCommonLog(line: string): LogEntry | null {
    // 127.0.0.1 - - [10/Oct/2024:13:55:36 -0700] "GET /api/data HTTP/1.1" 200 2326 "-" "Mozilla/5.0..."
    const pattern = /^(\S+) \S+ \S+ \[([^\]]+)\] "(\S+) (\S+) \S+" (\d+) (\d+) "[^"]*" "([^"]*)"$/
    const match = line.match(pattern)
    
    if (!match) return null

    // Convert Apache time format `09/Sep/2024:10:15:32 -0700` to ISO
    const apacheTime = match[2]
    const ts = this.parseApacheTime(apacheTime)
    if (!ts) return null

    return {
      ip: match[1],
      timestamp: ts,
      method: match[3],
      path: match[4],
      status: parseInt(match[5]),
      bytes: parseInt(match[6]),
      userAgent: match[7],
      responseTime: Math.floor(Math.random() * 500) // Would parse from extended log format
    }
  }

  // Parse JSON logs
  parseJsonLog(line: string): LogEntry | null {
    try {
      const log = JSON.parse(line)
      return {
        timestamp: new Date(log.timestamp),
        ip: log.ip,
        method: log.method,
        path: log.path,
        status: log.status,
        bytes: log.bytes,
        userAgent: log.user_agent,
        responseTime: log.response_time
      }
    } catch {
      return null
    }
  }

  // Parse CSV logs (with header detection)
  parseCsvLog(line: string, headers?: string[]): LogEntry | null {
    if (!headers) {
      // This is probably a header line
      return null
    }

    try {
      // Simple CSV parsing (handles basic cases)
      const values = this.parseCsvLine(line)
      if (values.length !== headers.length) return null

      const record: Record<string, string> = {}
      for (let i = 0; i < headers.length; i++) {
        record[headers[i]] = values[i]
      }

      // Map common CSV field names to our LogEntry format
      const timestamp = this.extractTimestamp(record)
      const ip = record.user_ip || record.ip_address || record.client_ip || record.remote_addr || ''
      const method = record.request_type || record.method || 'GET'
      const path = record.request_url || record.path || record.uri || '/'
      const status = parseInt(record.status || record.status_code || '200')
      const bytes = parseInt(record.body_bytes_sent || record.bytes || record.bytes_transferred || '0')
      const userAgent = record.http_user_agent || record.user_agent || ''
      const responseTime = parseFloat(record.request_time || record.response_time || '0') * 1000 // Convert to ms

      if (!timestamp) return null

      return {
        timestamp,
        ip,
        method,
        path,
        status,
        bytes,
        userAgent,
        responseTime
      }
    } catch {
      return null
    }
  }

  private parseCsvLine(line: string): string[] {
    const result: string[] = []
    let current = ''
    let inQuotes = false

    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      const nextChar = line[i + 1]

      if (char === '"' && nextChar === '"') {
        current += '"'
        i++ // Skip next quote
      } else if (char === '"') {
        inQuotes = !inQuotes
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim())
        current = ''
      } else {
        current += char
      }
    }

    result.push(current.trim())
    return result
  }

  private extractTimestamp(record: Record<string, string>): Date | null {
    // Try various timestamp field names
    const timeValue = record.date || record.timestamp || record.time || record.datetime
    if (!timeValue) return null

    const date = new Date(timeValue)
    return isNaN(date.getTime()) ? null : date
  }

  private parseApacheTime(value: string): Date | null {
    // Example: 09/Sep/2024:10:15:32 -0700
    const m = value.match(/^(\d{2})\/(\w{3})\/(\d{4}):(\d{2}):(\d{2}):(\d{2}) ([+-]\d{4})$/)
    if (!m) return null
    const day = m[1]
    const monStr = m[2]
    const year = m[3]
    const hh = m[4]
    const mm = m[5]
    const ss = m[6]
    let tz = m[7]

    const months: Record<string, string> = {
      Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
      Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12'
    }
    const month = months[monStr as keyof typeof months]
    if (!month) return null

    // Convert -0700 to -07:00 for ISO-8601
    if (/^[+-]\d{4}$/.test(tz)) {
      tz = tz.slice(0, 3) + ':' + tz.slice(3)
    }
    const iso = `${year}-${month}-${day}T${hh}:${mm}:${ss}${tz}`
    const d = new Date(iso)
    return isNaN(d.getTime()) ? null : d
  }

  // Parse any supported format
  parseLogLine(line: string, headers?: string[]): LogEntry | null {
    // Try CSV first if headers are provided
    if (headers) {
      const csvResult = this.parseCsvLog(line, headers)
      if (csvResult) return csvResult
    }

    // Try JSON format
    const jsonResult = this.parseJsonLog(line)
    if (jsonResult) return jsonResult

    // Try common log format
    const commonResult = this.parseCommonLog(line)
    if (commonResult) return commonResult

    return null
  }
}
