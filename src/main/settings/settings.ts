import { getSetting, upsertSetting } from '../db'

// Settings keys
export const IDLE_THRESHOLD_KEY = 'idle_threshold_seconds'
export const EXCLUDED_APPS_KEY = 'excluded_apps'
export const EXCLUDED_DOMAINS_KEY = 'excluded_domains'
export const STORE_TITLES_KEY = 'store_window_titles'

/** Titles are local by default; opting out blanks them at save time. */
export function getStoreTitlesSetting(): boolean {
  return getSetting(STORE_TITLES_KEY) !== 'false'
}

export function setStoreTitlesSetting(enabled: boolean): void {
  upsertSetting(STORE_TITLES_KEY, enabled ? 'true' : 'false')
}

const DEFAULT_IDLE_SECONDS = 120

/**
 * Reads the idle threshold every poll so changes apply without restart.
 * Stored as seconds in the settings table; falls back to 120s.
 */
export function getIdleThresholdMs(): number {
  const raw = getSetting(IDLE_THRESHOLD_KEY)
  const seconds = raw ? parseInt(raw, 10) : NaN
  if (!Number.isFinite(seconds) || seconds < 1) return DEFAULT_IDLE_SECONDS * 1000
  return seconds * 1000
}

export function setIdleThresholdSeconds(seconds: number): void {
  upsertSetting(IDLE_THRESHOLD_KEY, String(clamp(seconds, 30, 600)))
}

/**
 * Exclusion lists are stored as comma-separated strings.
 * Matching is normalized like the categorizer: lowercase, no '.exe' suffix,
 * bidirectional substring so 'Code.exe' matches 'Visual Studio Code' names.
 */
export function getExcludedApps(): string[] {
  return splitList(getSetting(EXCLUDED_APPS_KEY))
}

export function getExcludedDomains(): string[] {
  return splitList(getSetting(EXCLUDED_DOMAINS_KEY))
}

export function setExcludedApps(items: string[]): void {
  upsertSetting(EXCLUDED_APPS_KEY, items.join(','))
}

export function setExcludedDomains(items: string[]): void {
  upsertSetting(EXCLUDED_DOMAINS_KEY, items.join(','))
}

export function isExcludedApp(appName: string, exePath?: string): boolean {
  const sources = [appName.toLowerCase()]
  if (exePath) {
    const base = exePath.split(/[\\/]/).pop() ?? ''
    sources.push(base.toLowerCase().replace(/\.exe$/, ''))
  }
  return getExcludedApps().some((excluded) => {
    const e = excluded.toLowerCase().replace(/\.exe$/, '')
    if (!e) return false
    return sources.some((s) => s.includes(e) || e.includes(s))
  })
}

export function isExcludedDomain(domain: string): boolean {
  const d = domain.toLowerCase()
  return getExcludedDomains().some((excluded) => d === excluded.toLowerCase())
}

function splitList(raw: string | undefined): string[] {
  if (!raw) return []
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}
