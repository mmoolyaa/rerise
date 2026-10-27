import type { Session, Category } from '../db/types'
import { summarizeSessions } from '../scoring/summary'
import type { DayFacts, TopName } from './types'

const MIN_SESSION_DURATION_MS = 3000

/**
 * Builds the fact sheet one digest paragraph-set is written from.
 * Pure function over the day's sessions + categories (same data the
 * dashboard computes from), so digests can never disagree with Stats.
 */
export function buildDayFacts(
  sessions: Session[],
  categories: Category[],
  periodStartMs: number,
  periodEndMs: number,
  day: string
): DayFacts {
  const summary = summarizeSessions(sessions, categories, periodStartMs, periodEndMs)

  const productivityById = new Map<number, number>()
  for (const c of categories) productivityById.set(c.id, c.productivity)
  const catOf = (s: { category_id?: number | null }) =>
    s.category_id ? (productivityById.get(s.category_id) ?? 0) : 0

  let productiveMs = 0
  let neutralMs = 0
  let unproductiveMs = 0
  let firstActivityMs: number | null = null
  let lastActivityMs: number | null = null
  for (const s of sessions) {
    const dur = s.ended_at - s.started_at
    if (dur < MIN_SESSION_DURATION_MS) continue
    const p = catOf(s)
    if (p > 0) productiveMs += dur
    else if (p < 0) unproductiveMs += dur
    else neutralMs += dur
    const st = s.started_at
    const en = s.ended_at
    if (firstActivityMs == null || st < firstActivityMs) firstActivityMs = st
    if (lastActivityMs == null || en > lastActivityMs) lastActivityMs = en
  }

  // Busiest local hour: overlap of each session with each hour bucket
  const hourBuckets = new Array<number>(24).fill(0)
  for (const s of sessions) {
    const dur = s.ended_at - s.started_at
    if (dur < MIN_SESSION_DURATION_MS) continue
    const dayEnd = periodStartMs + 24 * 60 * 60 * 1000
    for (let h = 0; h < 24; h++) {
      const hStart = periodStartMs + h * 3600_000
      const hEnd = Math.min(hStart + 3600_000, dayEnd)
      const overlap = Math.min(hEnd, s.ended_at) - Math.max(hStart, s.started_at)
      if (overlap > 0) hourBuckets[h] += overlap
    }
  }
  let busiestHour: number | null = null
  let busiestHourMs = 0
  hourBuckets.forEach((ms, h) => {
    if (ms > busiestHourMs) {
      busiestHourMs = ms
      busiestHour = h
    }
  })

  // Derailers: time under unproductive categories, grouped by name
  const derailMap = new Map<string, number>()
  for (const s of sessions) {
    const dur = s.ended_at - s.started_at
    if (dur < MIN_SESSION_DURATION_MS) continue
    if (catOf(s) >= 0) continue
    const k = s.domain ?? s.app_name
    derailMap.set(k, (derailMap.get(k) ?? 0) + dur)
  }
  const derailers: TopName[] = [...derailMap.entries()]
    .map(([name, durationMs]) => ({ name, durationMs }))
    .sort((a, b) => b.durationMs - a.durationMs)
    .map((e) => ({ name: e.name, durationMs: Math.round(e.durationMs) }))
    .slice(0, 2)

  const round = (t: TopName[]) => t.map((e) => ({ ...e, durationMs: Math.round(e.durationMs) }))

  return {
    day,
    periodStartMs,
    periodEndMs,
    trackedTimeMs: summary.trackedTimeMs,
    sessionCount: summary.sessionCount,
    score: summary.score,
    productiveMs: Math.round(productiveMs),
    neutralMs: Math.round(neutralMs),
    unproductiveMs: Math.round(unproductiveMs),
    focusTimeMs: summary.focusTimeMs,
    longestFocusMs: summary.longestFocusMs,
    contextSwitches: summary.contextSwitches,
    switchesPerProductiveHour: summary.switchesPerProductiveHour,
    firstActivityMs,
    lastActivityMs,
    busiestHour,
    busiestHourMs: Math.round(busiestHourMs),
    topApps: round(summary.topApps).slice(0, 3),
    topSites: round(summary.topSites).slice(0, 3),
    derailers
  }
}
