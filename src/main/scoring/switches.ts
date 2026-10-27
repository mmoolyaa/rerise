import type { Session } from '../db/types'
import { MIN_SESSION_DURATION_MS } from './focusTime'

/**
 * Context switches = genuine transitions between consecutive distinct
 * activity contexts within the period.
 *
 * A context is one of:
 * - a website (sessions carrying a domain: switching domain switches context,
 *   even inside the same browser)
 * - an app (sessions without domain data)
 *
 * The tracker already merges repeated observations of the same window into a
 * single session (see sessionMerger), so stored rows transition exactly when
 * the active context changes. Collapsing consecutive same-identity rows here is
 * pure defense against hand-edited/imported history - it must never change
 * counts for data produced by the tracker.
 *
 * Deliberately NOT counted as switches:
 * - polling snapshots or repeated observations (merged away upstream)
 * - navigation within the same domain (the data does not record URLs, so we
 *   do not invent tab-level granularity we cannot measure)
 */
export function countContextSwitches(sessions: Session[]): number {
  const ordered = sessions
    .filter((s) => s.ended_at - s.started_at >= MIN_SESSION_DURATION_MS)
    .sort((a, b) => a.started_at - b.started_at)

  const identity = (s: Session): string => `${s.domain ?? ''}\u0000${s.app_name}`

  let switches = 0
  let prevIdentity: string | null = null
  for (const s of ordered) {
    const id = identity(s)
    if (prevIdentity !== null && id !== prevIdentity) {
      switches++
    }
    prevIdentity = id
  }
  return switches
}

/**
 * Context switches per productive hour. Returns null when there is no
 * productive time in the period (zero division is not a number, and the
 * dashboard never shows a fabricated 0).
 *
 * Productive time = total duration of sessions whose category productivity
 * is >= 1 - the same qualification focus blocks use.
 */
export function switchesPerProductiveHour(
  switches: number,
  productiveMs: number
): number | null {
  if (productiveMs <= 0) return null
  return switches / (productiveMs / (60 * 60 * 1000))
}
