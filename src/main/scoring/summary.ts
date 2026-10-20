import type { Session, Category } from '../db/types'
import { computeScore, type ScoreResult } from './score'
import { computeFocusTime } from './focusTime'

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
  const focusTimeMs = computeFocusTime(sessions, categories)
  const sessionCount = sessions.filter((s) => s.ended_at - s.started_at >= MIN_SESSION_DURATION_MS).length

  const periodLength = Math.max(1, periodEndMs - periodStartMs)
  const coveragePercent = Math.min(100, (trackedTimeMs / periodLength) * 100)

  const uncategorizedMs = sessions
    .filter((s) => !s.category_id || s.category_id === 8)
    .reduce((sum, s) => sum + (s.ended_at - s.started_at), 0)

  const byName = (key: (s: Session) => string | undefined) => {
    const map = new Map<string, { durationMs: number; cats: Map<number, number> }>()
    for (const s of sessions) {
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
    topApps: byName((s) => s.app_name),
    topSites: byName((s) => s.domain)
  }
}
