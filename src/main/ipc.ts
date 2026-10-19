import { ipcMain, app, dialog } from 'electron'
import { join } from 'path'
import { writeFileSync } from 'fs'
import {
  getDatabase,
  getSessionsInRange,
  getAllCategories,
  getAllRules,
  insertRule,
  updateRule,
  deleteRule,
  updateSessionCategory,
  upsertSetting,
  deleteAllSessions,
  resetRulesToDefaults
} from './db'
import { summarizeSessions, type TodaySummary } from './scoring/summary'
import { computeDailyTrend, computeCategoryBreakdown } from './scoring/range'
import { createCategorizer } from './categorizer/engine'
import {
  getStoreTitlesSetting,
  setStoreTitlesSetting,
  getIdleThresholdMs,
  setIdleThresholdSeconds,
  getExcludedApps,
  setExcludedApps,
  getExcludedDomains,
  setExcludedDomains
} from './settings/settings'
import { sessionsToCsv, sessionsToJson } from './export/exportData'
import { getPairing } from './server'
import { createThemeStore, type ThemeSetting } from './theme'
import type { Session, Category, Rule } from './db/types'
import type { Tracker } from './tracker/tracker'
import type { TrackingState } from './tracker/types'

// Local-time day boundaries (local time for dashboard boundaries per spec)
const DAY_MS = 24 * 60 * 60 * 1000

export function startOfTodayLocal(): number {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
}

function dayOffset(raw: number): number {
  const n = Number(raw)
  if (!Number.isFinite(n)) return 0
  return Math.min(30, Math.max(0, Math.trunc(n)))
}

export function todayRange(): [number, number] {
  const start = startOfTodayLocal()
  return [start, Date.now()]
}

export function lastNDaysRange(n: number): { startMs: number; endMs: number; days: number } {
  const dayMs = 24 * 60 * 60 * 1000
  const startMs = startOfTodayLocal() - (n - 1) * dayMs
  return { startMs, endMs: Date.now(), days: n }
}

export function registerIpcHandlers(tracker: Tracker) {
  const themeStore = createThemeStore()

  // ---- theme ----
  ipcMain.handle('tempo:getTheme', () => {
    return themeStore.get()
  })
  ipcMain.handle('tempo:setTheme', (_e, theme: unknown) => {
    const allowed: ThemeSetting[] = ['system', 'dark', 'light']
    if (!allowed.includes(theme as ThemeSetting)) throw new Error('Invalid theme')
    themeStore.set(theme as ThemeSetting)
  })

  // ---- summaries ----
  ipcMain.handle('tempo:getTodaySummary', (): SummaryReply => {
    const [start, end] = todayRange()
    return {
      summary: summarizeSessions(getSessionsInRange(start, end), getAllCategories(), start, end)
    }
  })

  ipcMain.handle('tempo:getRangeSummary', (_e, days: number): RangeSummaryReply => {
    const { startMs, endMs, days: d } = lastNDaysRange(clampDays(days))
    const sessions = getSessionsInRange(startMs, endMs)
    const categories = getAllCategories()
    return {
      summary: summarizeSessions(sessions, categories, startMs, endMs),
      trend: computeDailyTrend(sessions, categories, startMs, d),
      categoryBreakdown: computeCategoryBreakdown(sessions, categories)
    }
  })

  ipcMain.handle('tempo:getSessionsToday', (): SessionsReply => {
    const [start, end] = todayRange()
    return { sessions: getSessionsInRange(start, end), categories: getAllCategories() }
  })

  // Data for an arbitrary LOCAL day: offsetDays = 0 (today), 1 (yesterday), ... 30
  ipcMain.handle('tempo:getDayData', (_e, offsetDays: number): DayDataReply => {
    const o = dayOffset(offsetDays)
    const start = startOfTodayLocal() - o * DAY_MS
    const end = o === 0 ? Date.now() : start + DAY_MS
    const categories = getAllCategories()
    return {
      summary: summarizeSessions(getSessionsInRange(start, end), categories, start, end),
      sessions: getSessionsInRange(start, end),
      categories,
      dayStartMs: start,
      state: tracker.getState()
    }
  })

  ipcMain.handle('tempo:getTrackingState', (): TrackingState => tracker.getState())

  ipcMain.on('tempo:pauseTracking', () => tracker.pause())
  ipcMain.on('tempo:resumeTracking', () => tracker.resume())

  // ---- privacy ----
  ipcMain.handle('tempo:setStoreTitles', (_e, enabled: boolean) => setStoreTitlesSetting(enabled))
  ipcMain.handle('tempo:getStoreTitles', (): boolean => getStoreTitlesSetting())

  // ---- rules CRUD ----
  ipcMain.handle('tempo:getRules', (): RulesReply => {
    return { rules: getAllRules(), categories: getAllCategories() }
  })

  ipcMain.handle('tempo:saveRule', (_e, rule: RuleRequest): { id: number; replaced: boolean } => {
    const clean = sanitizeRule(rule)
    // Upsert semantics: same type + pattern (case-insensitive) updates instead
    // of silently stacking duplicates.
    const existing = getAllRules().find(
      (r) => r.match_type === clean.match_type && r.pattern.toLowerCase() === clean.pattern.toLowerCase()
    )
    if (existing) {
      updateRule(existing.id, clean)
      return { id: existing.id, replaced: true }
    }
    if (clean.id) {
      updateRule(clean.id, clean)
      return { id: clean.id, replaced: false }
    }
    return { id: insertRule(clean), replaced: false }
  })

  ipcMain.handle('tempo:deleteRule', (_e, id: number) => {
    deleteRule(id)
  })

  // Bulk re-categorize: re-run current rules across ALL stored sessions
  ipcMain.handle('tempo:recategorizeAll', (): { updated: number } => {
    const rules = getAllRules()
    const categorizer = createCategorizer(rules)
    const db = getDatabase()
    // Materialize rows first: better-sqlite3 forbids running another statement
    // on the same connection while an .iterate() cursor is still open.
    let updated = 0
    db.transaction(() => {
      for (const row of db.prepare('SELECT * FROM sessions').all() as (Session & { id: number })[]) {
        const cat = categorizer.categorize(row)
        if (row.category_id !== cat) {
          updateSessionCategory(row.id, cat)
          updated++
        }
      }
    })()
    return { updated }
  })

  ipcMain.handle('tempo:setSessionCategory', (_e, sessionId: number, categoryId: number | null) => {
    updateSessionCategory(sessionId, categoryId)
  })

  // ---- settings ----
  ipcMain.handle('tempo:getGeneralSettings', () => ({
    idleThresholdSeconds: Math.round(getIdleThresholdMs() / 1000),
    excludedApps: getExcludedApps(),
    excludedDomains: getExcludedDomains(),
    storeTitles: getStoreTitlesSetting(),
    pairing: getPairing()
  }))

  ipcMain.handle('tempo:setIdleThreshold', (_e, seconds: number) => {
    setIdleThresholdSeconds(Number(seconds))
  })

  ipcMain.handle('tempo:setExcluded', (_e, apps: string[], domains: string[]) => {
    setExcludedApps(apps.map((s) => s.trim()).filter(Boolean))
    setExcludedDomains(domains.map((s) => s.trim()).filter(Boolean))
  })

  // ---- data export / deletion ----
  ipcMain.handle(
    'tempo:exportData',
    async (_e, format: 'csv' | 'json'): Promise<{ savedPath: string | null }> => {
      const { startMs, endMs } = lastNDaysRange(90)
      const sessions = getSessionsInRange(startMs, endMs)
      const categories = getAllCategories()
      const content =
        format === 'csv' ? sessionsToCsv(sessions, categories) : sessionsToJson(sessions, categories)
      const ext = format === 'csv' ? 'csv' : 'json'

      const result = await dialog.showSaveDialog({
        title: `Export sessions (${ext.toUpperCase()})`,
        defaultPath: join(app.getPath('documents'), `tempo-sessions-${Date.now()}.${ext}`),
        filters: [{ name: ext.toUpperCase(), extensions: [ext] }]
      })
      if (result.canceled || !result.filePath) return { savedPath: null }
      writeFileSync(result.filePath, content, 'utf-8')
      return { savedPath: result.filePath }
    }
  )

  ipcMain.handle('tempo:deleteAllData', (): { ok: true } => {
    deleteAllSessions()
    resetRulesToDefaults()
    return { ok: true }
  })

  ipcMain.handle('tempo:getExtensionPairing', (): { token: string; port: number } => getPairing())

  // ---- auto-start (Windows login item) ----
  ipcMain.handle('tempo:getAutoStart', (): boolean => app.getLoginItemSettings().openAtLogin)
  ipcMain.handle('tempo:setAutoStart', (_e, enabled: boolean) => {
    app.setLoginItemSettings({ openAtLogin: Boolean(enabled), path: process.execPath })
    console.log(`auto-start on login: ${enabled}`)
  })
}

// ---- helpers ----

function clampDays(n: number): number {
  return Math.min(90, Math.max(1, Math.trunc(Number(n) || 1)))
}

/** Rejects invalid rule payloads - the IPC boundary is untrusted input. */
function sanitizeRule(rule: RuleRequest): Omit<Rule, 'id'> & { id?: number } {
  const matchTypes = ['app', 'domain', 'title_regex'] as const
  if (!matchTypes.includes(rule.match_type)) throw new Error('Invalid match_type')
  if (typeof rule.pattern !== 'string' || rule.pattern.trim() === '') throw new Error('Invalid pattern')
  if (!Number.isInteger(Number(rule.category_id))) throw new Error('Invalid category_id')
  if (!Number.isFinite(Number(rule.priority))) throw new Error('Invalid priority')

  return {
    id: Number.isInteger(rule.id) ? rule.id : undefined,
    match_type: rule.match_type,
    pattern: (rule.pattern ?? '').trim(),
    category_id: Number(rule.category_id),
    priority: Math.trunc(Math.min(1000, Math.max(0, Number(rule.priority) || 0)))
  }
}

// ---- reply types (plain TS, no zod) ----
export interface SummaryReply {
  summary: TodaySummary
}

export interface SessionsReply {
  sessions: Session[]
  categories: Category[]
}

export interface DayDataReply {
  summary: TodaySummary
  sessions: Session[]
  categories: Category[]
  /** Local midnight (ms) of the requested day */
  dayStartMs: number
  state: TrackingState
}

export interface RangeSummaryReply {
  summary: TodaySummary
  trend: ReturnType<typeof computeDailyTrend>
  categoryBreakdown: ReturnType<typeof computeCategoryBreakdown>
}

export interface RulesReply {
  rules: Rule[]
  categories: Category[]
}

export interface RuleRequest {
  id?: number
  match_type: 'app' | 'domain' | 'title_regex'
  pattern: string
  category_id: number
  priority: number
}
