import { getDatabase, getSessionsInRange, getAllCategories } from '../db'
import { ymdKey } from '../scoring/streak'
import { buildDayFacts } from './facts'
import { renderDigest } from './template'
import type { DayFacts, DigestRow } from './types'

const DAY_MS = 24 * 60 * 60 * 1000

/** Local midnight for the current moment. */
function startOfTodayLocal(now = Date.now()): number {
  const d = new Date(now)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

/** Compute (facts + prose) for one local day. null when the day has no data. */
export function computeDayDigest(
  dayStartMs: number,
  endOverride?: number
): { day: string; text: string; facts: DayFacts } | null {
  const start = Math.trunc(dayStartMs)
  const end = endOverride ?? start + DAY_MS
  const sessions = getSessionsInRange(start, end)
  const categories = getAllCategories()
  const facts = buildDayFacts(sessions, categories, start, end, ymdKey(start))
  if (facts.trackedTimeMs <= 0) return null
  return { day: facts.day, text: renderDigest(facts), facts }
}

/** Upsert a finalized digest row for a local day. */
function upsertDigest(computed: { day: string; text: string; facts: DayFacts }, isFinal: number) {
  const db = getDatabase()
  const now = Date.now()
  const factsJson = JSON.stringify(computed.facts)
  db.prepare(
    `INSERT INTO daily_summaries (day, created_at, updated_at, summary_text, facts_json, is_final)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(day) DO UPDATE SET
       updated_at = excluded.updated_at,
       summary_text = excluded.summary_text,
       facts_json = excluded.facts_json,
       is_final = excluded.is_final`
  ).run(computed.day, now, now, computed.text, factsJson, isFinal)
}

function rowToDigest(row: Record<string, unknown>): DigestRow {
  return {
    day: row.day as string,
    createdAt: row.created_at as number,
    updatedAt: row.updated_at as number,
    summaryText: row.summary_text as string,
    factsJson: row.facts_json as string,
    isFinal: row.is_final as number
  }
}

export function getStoredDigest(day: string): DigestRow | null {
  const row = getDatabase().prepare('SELECT * FROM daily_summaries WHERE day = ?').get(day) as
    | Record<string, unknown>
    | undefined
  return row ? rowToDigest(row) : null
}

export function listStoredDigests(limit = 30): DigestRow[] {
  const rows = getDatabase()
    .prepare('SELECT * FROM daily_summaries WHERE is_final = 1 ORDER BY day DESC LIMIT ?')
    .all(limit) as Record<string, unknown>[]
  return rows.map(rowToDigest)
}

/**
 * Nightly finalization for a past day: end-of-day facts, stored permanently.
 * Overwrites any existing row (also the manual-regenerate path).
 */
export function generateDigestForDay(dayStartMs: number): DigestRow | null {
  const start = Math.trunc(dayStartMs)
  const end = start + DAY_MS
  if (end > Date.now()) return null // future days have no data to close yet
  const computed = computeDayDigest(start, end)
  if (!computed) return null
  upsertDigest(computed, 1)
  return getStoredDigest(computed.day)
}

/**
 * Live draft for TODAY: computed from current data on every open, never
 * stored - the day only becomes official at local midnight (or on backfill).
 */
export function renderTodayDigest(): { day: string; text: string; facts: DayFacts | null } {
  const start = startOfTodayLocal()
  const computed = computeDayDigest(start)
  return computed ?? { day: ymdKey(Date.now()), text: '', facts: null }
}

/**
 * Boot/interval maintenance: any PAST day within the backfill window that has
 * tracked data but no stored digest gets closed. This is what makes digests
 * survive the app being off at midnight - and backfills history on first run.
 */
export function ensureDigestsUpToDate(backfillDays = 30): number {
  const db = getDatabase()
  const todayStart = startOfTodayLocal()
  const horizon = todayStart - (backfillDays + 1) * DAY_MS
  const daysWithData = db
    .prepare(
      `SELECT DISTINCT CAST(started_at / ? AS INTEGER) * ? AS day_start
       FROM sessions WHERE ended_at - started_at >= 3000 AND started_at >= ?`
    )
    .all(DAY_MS, DAY_MS, horizon) as { day_start: number }[]

  let added = 0
  for (const { day_start } of daysWithData) {
    if (day_start >= todayStart) continue // today stays a draft
    if (getStoredDigest(ymdKey(day_start))) continue
    if (generateDigestForDay(day_start)) added++
  }
  return added
}

const MAINTENANCE_INTERVAL_MS = 60 * 60 * 1000

/**
 * Hourly digest maintenance: a midnight rollover (or app run started later)
 * closes yesterday within the hour. Returns the timer for tests/custom use.
 */
export function scheduleDigestMaintenance(firstDelayMs = 30_000): NodeJS.Timeout {
  let lastKnownDay = ymdKey(Date.now())
  const tick = () => {
    try {
      const today = ymdKey(Date.now())
      if (today !== lastKnownDay) {
        console.log('[digest] day rolled over, closing digests')
        lastKnownDay = today
      }
      ensureDigestsUpToDate()
    } catch (err) {
      console.error('[digest] maintenance failed:', err)
    }
  }
  const timer = setInterval(tick, MAINTENANCE_INTERVAL_MS)
  timer.unref?.()
  const first = setTimeout(tick, firstDelayMs)
  first.unref?.()
  return timer
}
