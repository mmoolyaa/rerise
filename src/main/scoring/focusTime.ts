import type { Session, Category } from '../db/types'

// ---- Tunable constants (documented, deterministic) ----

/** Rolling qualification window. */
export const FOCUS_WINDOW_MS = 15 * 60 * 1000 // 15 minutes
/** Required productive proportion inside a window. */
export const FOCUS_THRESHOLD = 0.75
/** Productive coverage a rolling window must reach (15 min * 75% = 11 min 15 s). */
export const FOCUS_WINDOW_MIN_MS = FOCUS_WINDOW_MS * FOCUS_THRESHOLD
/**
 * Neutral interruption tolerance: an unbroken neutral run of up to AND
 * including this length bridges a focus session; anything longer ends it.
 * Applies to neutral runs BETWEEN productive stretches, inside a session.
 */
export const FOCUS_BRIDGE_MAX_MS = 5 * 60 * 1000

export const MIN_SESSION_DURATION_MS = 3000

/** A candidate focus session produced by the chain builder. */
export interface FocusSession {
  /** First productive row start (neutral wind-in excluded). */
  startMs: number
  /** Last productive row end (neutral wind-out excluded; bridges included). */
  endMs: number
  /** Productive union time inside the session, clipped to the period. */
  productiveMs: number
  /** Whether some rolling 15-min window reaches >= 75% productive coverage. */
  qualifies: boolean
}

type ProductivityMap = Map<number, number>

function productivityOf(
  categoryId: number | undefined | null,
  map: ProductivityMap
): number {
  return categoryId ? (map.get(categoryId) ?? 0) : 0
}

/**
 * Builds focus sessions from raw session rows for one reporting period.
 *
 * Session (chain) rules, in evaluation order per row:
 *  - rows shorter than MIN_SESSION_DURATION_MS (after period clipping) are noise;
 *  - a DISTRACTING row (productivity < 0) of ANY duration ends the session;
 *  - an UNTRACKED GAP of ANY length (next row starts after the chain's last
 *    row ends) ends the session - gaps are never treated as neutral;
 *  - a NEUTRAL run inside the session may bridge up to AND INCLUDING
 *    FOCUS_BRIDGE_MAX_MS; a run that pushes past the limit ends the
 *    session at the last productive row (neutral wind-in/-out is no part of
 *    a session, so neutral before the first / after the last productive row
 *    is simply not part of it);
 *  - productive rows continue or start sessions.
 *
 * Rows are clipped to [periodStartMs, periodEndMs) first.
 * Pure: input is not mutated.
 */
export function buildFocusSessions(
  sessions: Session[],
  categories: Category[],
  periodStartMs: number,
  periodEndMs: number
): FocusSession[] {
  const efficiency: ProductivityMap = new Map()
  for (const c of categories) efficiency.set(c.id, c.productivity)

  const rows = sessions
    .map((s) => ({
      started_at: Math.max(s.started_at, periodStartMs),
      ended_at: Math.min(s.ended_at, periodEndMs),
      category_id: s.category_id ?? null
    }))
    .filter((r) => r.ended_at - r.started_at >= MIN_SESSION_DURATION_MS)
    .sort((a, b) => a.started_at - b.started_at)

  interface Chain {
    startMs: number          // first productive row start
    lastProductiveEnd: number // last productive row end (session span end)
    lastRowEnd: number       // incl. attached neutral rows (adjacency reference)
    neutralRunMs: number     // accumulated duration of the current neutral run
    pieces: Array<[number, number]> // productive row extents (union-merged at close)
  }

  return assemble(rows, efficiency)
    // helper indirection keeps the walk readable
  function assemble(
    rows: Array<{ started_at: number; ended_at: number; category_id: number | null }>,
    eff: ProductivityMap
  ): FocusSession[] {
    const result: FocusSession[] = []
    let chain: Chain | null = null

    const closeChain = () => {
      if (!chain) return
      const pieces = union(chain.pieces)
      const qualifies =
        maxRollingCoverage(pieces) >= FOCUS_WINDOW_MIN_MS
      result.push({
        startMs: chain.startMs,
        endMs: chain.lastProductiveEnd,
        productiveMs: pieces.reduce((sum, [s, e]) => sum + (e - s), 0),
        qualifies
      })
      chain = null
    }

    for (const row of rows) {
      const p = productivityOf(row.category_id, eff)

      if (p < 0) {
        // Distracting: ends the session immediately, any duration.
        closeChain()
        continue
      }

      // Untracked gap of any length ends the session.
      if (chain && row.started_at > chain.lastRowEnd) closeChain()

      if (p === 0) {
        // Neutral: bridge only within an open session.
        if (!chain) continue
        const runMs = chain.neutralRunMs + (row.ended_at - row.started_at)
        if (runMs > FOCUS_BRIDGE_MAX_MS) {
          // Longer than tolerated: session ends at the last productive row.
          closeChain()
          continue
        }
        chain.neutralRunMs = runMs
        chain.lastRowEnd = Math.max(chain.lastRowEnd, row.ended_at)
        continue
      }

      // Productive: start or continue (adjacency was ensured above).
      if (!chain) {
        chain = {
          startMs: row.started_at,
          lastProductiveEnd: row.ended_at,
          lastRowEnd: row.ended_at,
          neutralRunMs: 0,
          pieces: [[row.started_at, row.ended_at]]
        }
      } else {
        chain.neutralRunMs = 0 // the productive row ends any bridge run
        chain.pieces.push([row.started_at, row.ended_at])
        chain.lastProductiveEnd = Math.max(chain.lastProductiveEnd, row.ended_at)
        chain.lastRowEnd = Math.max(chain.lastRowEnd, row.ended_at)
      }
    }
    closeChain()
    return result
  }
}

/** Merges overlapping/adjacent intervals and sorts by start. */
function union(pieces: Array<[number, number]>): Array<[number, number]> {
  const sorted = [...pieces].sort((a, b) => a[0] - b[0])
  const merged: Array<[number, number]> = []
  for (const [s, e] of sorted) {
    const last = merged[merged.length - 1]
    if (last && s <= last[1]) {
      last[1] = Math.max(last[1], e)
    } else {
      merged.push([s, e])
    }
  }
  return merged
}

/**
 * Maximum productive coverage of the rolling FOCUS_WINDOW_MS window over the
 * session's merged pieces. Coverage changes only when the window's left or
 * right edge crosses a piece boundary (piecewise-linear, so the maximum is
 * attained with the window anchored at a piece edge or shifted by the window
 * length from one - a complete, deterministic anchor set).
 */
function maxRollingCoverage(pieces: Array<[number, number]>): number {
  if (pieces.length === 0) return 0

  const anchors = new Set<number>()
  for (const [s, e] of pieces) {
    anchors.add(s)          // left edge on a piece start
    anchors.add(e - FOCUS_WINDOW_MS) // right edge on a piece end
  }

  const prefix: number[] = [0]
  for (const [s, e] of pieces) prefix.push(prefix[prefix.length - 1] + (e - s))
  const starts = pieces.map(([s]) => s)
  const ends = pieces.map(([, e]) => e)

  let best = 0
  for (const t of anchors) {
    const wStart = t
    const wEnd = t + FOCUS_WINDOW_MS
    // first piece with end > wStart
    let lo = 0
    let hi = pieces.length - 1
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (ends[mid] > wStart) hi = mid
      else lo = mid + 1
    }
    if (ends[lo] <= wStart) continue
    // for coverage, we need pieces with start < wEnd as well
    let right = lo
    while (right + 1 < pieces.length && starts[right + 1] < wEnd) right++
    if (starts[right] >= wEnd) continue

    let cov = prefix[right + 1] - prefix[lo]
    // clip partially covered boundary pieces
    cov -= Math.max(0, wStart - starts[lo])
    cov -= Math.max(0, ends[right] - wEnd)
    if (cov > best) best = cov
  }
  return best
}

/**
 * Focus Time (Rize-inspired window model) = total productive time inside
 * QUALIFYING focus sessions for the period.
 *
 * A session qualifies when some rolling 15-minute window reaches >= 75%
 * productive coverage (>= 11 min 15 s). Once it qualifies, ALL productive
 * time in the session counts - even later stretches that would not
 * independently qualify - because the session is the unit of focus.
 * Frequency of app switching between productive apps never affects this.
 * Neutral runs (<= 5 min each) inside a session contribute no focus minutes
 * but preserve the session; distracting time, longer neutral runs, and
 * untracked gaps terminate sessions.
 */
export function computeFocusTime(
  sessions: Session[],
  categories: Category[],
  periodStartMs: number,
  periodEndMs: number
): number {
  const all = buildFocusSessions(sessions, categories, periodStartMs, periodEndMs)
  return all
    .filter((fs) => fs.qualifies)
    .reduce((sum, fs) => sum + fs.productiveMs, 0)
}

/**
 * Longest Focus Session = span (startMs..endMs) of the longest QUALIFYING
 * focus session. The span includes tolerated neutral bridges (<= 5 min)
 * that sit strictly between the first and last productive row; leading or
 * trailing neutral activity is NOT part of the span. Returns null when no
 * session qualifies - the dashboard shows '--', never a fabricated value.
 */
export function longestFocusSessionMs(
  sessions: Session[],
  categories: Category[],
  periodStartMs: number,
  periodEndMs: number
): number | null {
  const all = buildFocusSessions(sessions, categories, periodStartMs, periodEndMs)
  const qualifying = all
    .filter((fs) => fs.qualifies)
    .sort((a, b) => b.endMs - b.startMs - (a.endMs - a.startMs))
  if (qualifying.length === 0) return null
  const fs = qualifying[0]
  return fs.endMs - fs.startMs
}
