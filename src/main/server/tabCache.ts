export interface TabReport {
  url: string
  title: string
  timestamp: number
}

export interface CachedTab {
  domain: string
  title: string
  reportedAt: number // server receive time - used for staleness (client clocks can skew)
}

export const STALE_TAB_MS = 10_000 // ~10s since last heartbeat

/**
 * Normalizes a URL to its domain:
 * - strips protocol, path, port
 * - lowercases
 * - strips leading 'www.'
 */
export function normalizeDomain(url: string): string | null {
  try {
    const parsed = new URL(url)
    // Only http(s) - skip file:// about: chrome:// etc.
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
    let host = parsed.hostname.toLowerCase()
    // Keep IP addresses or localhost as-is (but not useful categories anyway)
    if (host.startsWith('www.')) host = host.slice(4)
    if (!host) return null
    return host
  } catch {
    return null
  }
}

export class TabCache {
  private latest: CachedTab | null = null

  update(report: TabReport, receivedAt: number): CachedTab | null {
    const domain = normalizeDomain(report.url)
    if (!domain) return null
    this.latest = {
      domain,
      title: report.title,
      reportedAt: receivedAt
    }
    return this.latest
  }

  /**
   * Returns tab data only if it is fresh (within stale threshold).
   * The tracker MUST ignore stale data - never attribute it to the active session.
   */
  getFresh(now: number, maxAgeMs = STALE_TAB_MS): CachedTab | null {
    if (!this.latest) return null
    if (now - this.latest.reportedAt > maxAgeMs) return null
    return this.latest
  }
}
