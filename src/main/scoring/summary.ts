import type { Session, Category } from '../db/types'
import { computeScore, type ScoreResult } from './score'
import { computeFocusTime, longestFocusSessionMs } from './focusTime'
import { countContextSwitches, switchesPerProductiveHour } from './switches'

const MIN_SESSION_DURATION_MS = 3000

export interface TopEntry {
  name: string
  durationMs: number
  // Dominant (longest) category for this app/site, if any
  category_id?: number
}

export interface TodaySummary {
  score: ScoreResult['score']
  trackedTimeMs: number
  focusTimeMs: number
  // % of the day (from local midnight to now) that has tracked activity
  coveragePercent: number
  // time categorized as Neutral (category 8 or null)
  uncategorizedMs: number
  // count of meaningful (>= MIN_SESSION_DURATION_MS) sessions in the period
  sessionCount: number
  // Longest qualifying focus session (chain whose best rolling 15-min window
  // reaches >= 75% productive coverage; span includes tolerated neutral
  // bridges, excludes wind-in/-out neutral). null when nothing qualifies.
  // null when nothing qualified in the period - shown as an empty state.
  longestFocusMs: number | null
  // Transitions between distinct consecutive apps/websites in the period.
  contextSwitches: number
  // contextSwitches per productive hour; null when productive time is 0.
  switchesPerProductiveHour: number | null
  topApps: TopEntry[]
  topSites: TopEntry[]
}

/**
 * Aggregates sessions into a dashboard summary.
 * Pure function: sessions must all fall within [periodStartMs, periodEndMs].
 */
export function summarizeSessions(
  sessions: Session[],
  categories: Category[],
  periodStartMs: number,
  periodEndMs: number
): TodaySummary {
  const { score, trackedTimeMs } = computeScore(sessions, categories)
  const focusTimeMs = computeFocusTime(sessions, categories, periodStartMs, periodEndMs)
  const sessionCount = sessions.filter((s) => s.ended_at - s.started_at >= MIN_SESSION_DURATION_MS).length

  // Context-switch metrics (kept free of hardcoded category ids: uses the
  // categories' productivity model, same qualification focus blocks use)
  const productivityById = new Map<number, number>()
  for (const c of categories) {
    productivityById.set(c.id, c.productivity)
  }
  let productiveMs = 0
  for (const s of sessions) {
    const dur = s.ended_at - s.started_at
    if (dur < MIN_SESSION_DURATION_MS) continue
    const p = s.category_id ? (productivityById.get(s.category_id) ?? 0) : 0
    if (p >= 1) productiveMs += dur
  }
  const contextSwitches = countContextSwitches(sessions)

  const periodLength = Math.max(1, periodEndMs - periodStartMs)
  const coveragePercent = Math.min(100, (trackedTimeMs / periodLength) * 100)

  const uncategorizedMs = sessions
    .filter((s) => !s.category_id || s.category_id === 8)
    .reduce((sum, s) => sum + (s.ended_at - s.started_at), 0)

  interface NameAgg {
    durationMs: number
    cats: Map<number, number>
  }

  /**
   * Aggregates durations by a name key. `filter` decides which sessions count,
   * so the app split can exclude browser sessions that already carry a domain
   * (that time belongs to the site split - no double counting).
   */
  const byName = (key: (s: Session) => string | undefined, filter: (s: Session) => boolean) => {
    const map = new Map<string, NameAgg>()
    for (const s of sessions) {
      if (!filter(s)) continue
      const dur = s.ended_at - s.started_at
      if (dur < MIN_SESSION_DURATION_MS) continue
      const k = key(s)
      if (!k) continue
      const entry = map.get(k) ?? { durationMs: 0, cats: new Map<number, number>() }
      entry.durationMs += dur
      if (s.category_id) entry.cats.set(s.category_id, (entry.cats.get(s.category_id) ?? 0) + dur)
      map.set(k, entry)
    }
    return [...map.entries()]
      .map((entry) => {
        const dominantCat = [...entry[1].cats.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
        return { name: entry[0], durationMs: entry[1].durationMs, category_id: dominantCat }
      })
      .sort((a, b) => b.durationMs - a.durationMs)
      .slice(0, 5)
  }

  return {
    score,
    trackedTimeMs,
    focusTimeMs,
    coveragePercent: Math.round(coveragePercent),
    uncategorizedMs,
    sessionCount,
    longestFocusMs: longestFocusSessionMs(sessions, categories, periodStartMs, periodEndMs),
    contextSwitches,
    switchesPerProductiveHour: switchesPerProductiveHour(contextSwitches, productiveMs),
    // Apps: only time WITHOUT site knowledge (browser activity flows to topSites)
    topApps: byName((s) => s.app_name, (s) => !s.domain),
    // Sites: only sessions the extension could attribute to a domain
    topSites: byName((s) => s.domain ?? '', (s) => Boolean(s.domain))
  }
}
