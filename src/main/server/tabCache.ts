export interface TabReport {
  url: string
  title: string
  timestamp: number
}

export interface CachedTab {
  domain: string
  title: string
  reportedAt: number // server receive time - used for the age cap (client clocks can skew)
}

/**
 * Attribution semantics (chain-scoped last-known):
 * A static tab is STABLE, not stale: someone watching one YouTube video for
 * 30 minutes must not flip to unattributed just because the tab never fired
 * an event. So the cache keeps the last-known tab and never expires on a
 * short timer. Validity ends by:
 *   - invalidate(): the active window moved to a non-browser app (or tracking
 *     restarted a new chain) - the caller decides, and no report arrived yet
 *   - update(): any fresh report re-arms validity
 *   - TAB_MAX_AGE_MS: a hard cap against reports that no longer correspond to
 *     reality (e.g. the extension died and never refreshed)
 */
export const TAB_MAX_AGE_MS = 30 * 60 * 1000

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
  private invalid = false

  update(report: TabReport, receivedAt: number): CachedTab | null {
    const domain = normalizeDomain(report.url)
    if (!domain) return null
    this.latest = {
      domain,
      title: report.title,
      reportedAt: receivedAt
    }
    this.invalid = false // a fresh report re-arms attribution
    return this.latest
  }

  /** The attribution context ended (e.g. active window left the browser). */
  invalidate(): void {
    this.invalid = true
  }

  /**
   * Returns the last-known tab data, unless invalidated or beyond the hard
   * age cap. Callers using this while the browser window is continuously
   * active attribute reliably; the cap guards against zombie reports.
   */
  getFresh(now: number, maxAgeMs = TAB_MAX_AGE_MS): CachedTab | null {
    if (!this.latest || this.invalid) return null
    if (now - this.latest.reportedAt > maxAgeMs) return null
    return this.latest
  }
}
