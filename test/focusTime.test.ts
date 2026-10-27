import { describe, it, expect } from 'vitest'
import {
  computeFocusTime,
  longestFocusSessionMs,
  FOCUS_WINDOW_MS,
  FOCUS_WINDOW_MIN_MS,
  FOCUS_BRIDGE_MAX_MS,
  FOCUS_THRESHOLD
} from '../src/main/scoring/focusTime'
import type { Session, Category } from '../src/main/db/types'

const categories: Category[] = [
  { id: 1, name: 'Coding', productivity: 2 },
  { id: 3, name: 'AI Research', productivity: 1 },
  { id: 4, name: 'YouTube', productivity: 1 },
  { id: 6, name: 'Music', productivity: 0 },
  { id: 7, name: 'Communication', productivity: 0 },
  { id: 9, name: 'Social Media', productivity: -2 }
]

const min = 60 * 1000
const WIN = FOCUS_WINDOW_MS
const MINQ = FOCUS_WINDOW_MIN_MS // 11:15 exact

function session(start: number, duration: number, categoryId?: number, app = 'app', domain?: string): Session {
  return { started_at: start, ended_at: start + duration, app_name: app, category_id: categoryId, domain }
}

// All tests use period [0, 60min) unless noted — wall-clock-free.
const T0 = 0
const T1 = 60 * min

describe('constants', () => {
  it('expose the documented, derived values', () => {
    expect(WIN).toBe(15 * min)
    expect(FOCUS_THRESHOLD).toBe(0.75)
    expect(MINQ).toBe(11 * min + 15 * 1000)
    expect(FOCUS_BRIDGE_MAX_MS).toBe(5 * min)
  })
})

describe('window thresholds', () => {
  it('exactly 11:15 productive qualifies and awards productive time only', () => {
    const s = [session(0, MINQ, 1), session(MINQ, 3.75 * min, 6)]
    expect(computeFocusTime(s, categories, T0, T1)).toBe(MINQ)
    // span excludes trailing neutral (approved definition)
    expect(longestFocusSessionMs(s, categories, T0, T1)).toBe(MINQ)
  })

  it('one millisecond below the threshold does not qualify', () => {
    const s = [session(0, MINQ - 1, 1), session(MINQ - 1, 3.75 * min + 1, 6)]
    expect(computeFocusTime(s, categories, T0, T1)).toBe(0)
    expect(longestFocusSessionMs(s, categories, T0, T1)).toBeNull()
  })

  it('a fully productive 15-minute window qualifies', () => {
    const s = [session(0, 15 * min, 1)]
    expect(computeFocusTime(s, categories, T0, T1)).toBe(15 * min)
    expect(longestFocusSessionMs(s, categories, T0, T1)).toBe(15 * min)
  })

  it('a window below the threshold does not qualify (8 productive + 7 distracting)', () => {
    const s = [session(0, 8 * min, 1), session(8 * min, 7 * min, 9)]
    expect(computeFocusTime(s, categories, T0, T1)).toBe(0)
    expect(longestFocusSessionMs(s, categories, T0, T1)).toBeNull()
  })

  it('P6:00 → N3:45 → P5:15: Focus 11:15, Longest 15:00 (bridged window)', () => {
    const s = [
      session(0, 6 * min, 1),
      session(6 * min, 3.75 * min, 6),
      session(9.75 * min, 5.25 * min, 1)
    ]
    expect(computeFocusTime(s, categories, T0, T1)).toBe(11.25 * min)
    expect(longestFocusSessionMs(s, categories, T0, T1)).toBe(15 * min)
  })
})

describe('cross-app behavior and boundaries', () => {
  it('22 minutes of continuous productive work crossing a clock quarter credits fully', () => {
    // The motivating case: 10:04–10:26 would fail fixed windows (11:00/11:00).
    const s = [session(4 * min, 22 * min, 1)]
    expect(computeFocusTime(s, categories, T0, T1)).toBe(22 * min)
    expect(longestFocusSessionMs(s, categories, T0, T1)).toBe(22 * min)
  })

  it('frequent switching between productive apps stays one session', () => {
    const s = [
      session(0, 5 * min, 1, 'Code.exe'),
      session(5 * min, 5 * min, 3, 'Terminal.exe'),
      session(10 * min, 5 * min, 4, 'Docs.exe'),
      session(15 * min, 5 * min, 1, 'Code.exe')
    ]
    expect(computeFocusTime(s, categories, T0, T1)).toBe(20 * min)
    expect(longestFocusSessionMs(s, categories, T0, T1)).toBe(20 * min)
  })

  it('a session starting/ending exactly at a window edge qualifies', () => {
    const s = [session(0, MINQ, 1), session(MINQ, WIN - MINQ, 6)]
    // re-checked via anchor at chain end
    expect(computeFocusTime(s, categories, T0, T1)).toBe(MINQ)
  })

  it('overlapping productive intervals are counted once', () => {
    const s = [session(0, 10 * min, 1), session(5 * min, 10 * min, 3)]
    expect(computeFocusTime(s, categories, T0, T1)).toBe(15 * min)
    expect(longestFocusSessionMs(s, categories, T0, T1)).toBe(15 * min)
  })

  it('untracked gaps reduce productive coverage below the threshold', () => {
    // 8min P + 4min gap + 8min P: any window holds at most 11min? anchors:
    // [8-15, 12): P = 11min < 11:15 -> no qualify.
    const s = [session(0, 8 * min, 1), session(12 * min, 8 * min, 1)]
    expect(computeFocusTime(s, categories, T0, T1)).toBe(0)
    expect(longestFocusSessionMs(s, categories, T0, T1)).toBeNull()
  })

  it('missing or neutral categories contribute no productive time', () => {
    const s = [session(0, 12 * min, undefined), session(12 * min, 8 * min, 8), session(20 * min, 10 * min, 1)]
    // chain: N12+N8 neutral run 20min > 5min -> no bridge; session is [20,30): 10min < 11:15
    expect(computeFocusTime(s, categories, T0, T1)).toBe(0)
    expect(longestFocusSessionMs(s, categories, T0, T1)).toBeNull()
  })
})

describe('interruption rules', () => {
  it('neutral exactly 5:00 bridges one session', () => {
    const s = [
      session(0, MINQ, 1),
      session(MINQ, 5 * min, 6),
      session(5 * min + MINQ, MINQ, 1)
    ]
    expect(computeFocusTime(s, categories, T0, T1)).toBe(2 * MINQ) // productive-only
    expect(longestFocusSessionMs(s, categories, T0, T1)).toBe(16.25 * min + 11.25 * min) // includes the bridge
  })

  it('neutral of 5:01 breaks the session', () => {
    const s = [
      session(0, MINQ, 1),
      session(MINQ, 5 * min + 1000, 6),
      session(MINQ + 5 * min + 1000, MINQ, 1)
    ]
    // two separate sessions, each qualifies
    expect(computeFocusTime(s, categories, T0, T1)).toBe(2 * MINQ)
    expect(longestFocusSessionMs(s, categories, T0, T1)).toBe(MINQ)
  })

  it('an untracked gap of any length breaks the session immediately', () => {
    const s = [
      session(0, 15 * min, 1),
      session(15 * min + 10 * min, 15 * min, 1) // 10-min untracked gap
    ]
    expect(computeFocusTime(s, categories, T0, T1)).toBe(30 * min)
    expect(longestFocusSessionMs(s, categories, T0, T1)).toBe(15 * min)
  })

  it('a 1-second untracked gap still breaks (gaps are never neutral)', () => {
    const s = [session(0, 15 * min, 1), session(15 * min + 1000, 15 * min, 1)]
    expect(computeFocusTime(s, categories, T0, T1)).toBe(30 * min)
    expect(longestFocusSessionMs(s, categories, T0, T1)).toBe(15 * min)
  })

  it('distracting activity of any duration breaks the session', () => {
    const s = [
      session(0, 20 * min, 1),
      session(20 * min, 1000, 9), // 1s distraction
      session(20 * min + 1000, 19.98 * min, 1)
    ]
    expect(computeFocusTime(s, categories, T0, T1)).toBe(20 * min + 19.98 * min)
    expect(longestFocusSessionMs(s, categories, T0, T1)).toBe(20 * min)
  })
})

describe('session-level qualification (approved behavior)', () => {
  it('once a session qualifies, ALL its productive time counts — even later stretches below threshold', () => {
    // P20min (qualifies) -> N5:00 -> P8min (8min < 11:15 alone, but still in the session)
    const s = [
      session(0, 20 * min, 1),
      session(20 * min, 5 * min, 6),
      session(25 * min, 8 * min, 3)
    ]
    expect(computeFocusTime(s, categories, T0, T1)).toBe(28 * min)
    // longest = start -> last productive end (bridge included)
    expect(longestFocusSessionMs(s, categories, T0, T1)).toBe(33 * min)
  })

  it('multiple qualifying runs: longest is reported, total sums both', () => {
    const s = [
      session(0, 30 * min, 1),
      // real untracked gap between 30min and 36min (no session rows)
      session(36 * min, 15 * min, 1)
    ]
    expect(computeFocusTime(s, categories, T0, T1)).toBe(45 * min)
    expect(longestFocusSessionMs(s, categories, T0, T1)).toBe(30 * min)
  })

  it('scattered low-density productivity never qualifies despite >11:15 total', () => {
    // 14 x P1min + N3min: best 15-min window holds ~4min productive
    const s: Session[] = []
    for (let i = 0; i < 14; i++) {
      s.push(session(4 * min * i, 1 * min, 1))
      s.push(session(4 * min * i + min, 3 * min, 6))
    }
    expect(computeFocusTime(s, categories, T0, T1)).toBe(0)
    expect(longestFocusSessionMs(s, categories, T0, T1)).toBeNull()
  })

  it('distracting-heavy mixes produce no focus', () => {
    const s = [
      session(0, 8 * min, 1), session(8 * min, 7 * min, 9),
      session(15 * min, 8 * min, 1), session(23 * min, 7 * min, 9)
    ]
    expect(computeFocusTime(s, categories, T0, T1)).toBe(0)
    expect(longestFocusSessionMs(s, categories, T0, T1)).toBeNull()
  })
})

describe('date and period boundaries', () => {
  it('incomplete live period: credit is clipped to the period, never beyond now', () => {
    const T1Live = 45 * min
    const s = [session(30 * min, 16 * min, 1)] // ends at 46min, beyond now
    expect(computeFocusTime(s, categories, T0, T1Live)).toBe(15 * min)
    expect(longestFocusSessionMs(s, categories, T0, T1Live)).toBe(15 * min)
  })

  it('sessions from the previous day do not leak into a later period', () => {
    const day2Start = 24 * 60 * min
    const s = [session(-10 * min, 20 * min, 1)] // started yesterday, ends 10min into "today"
    // row clipped to [day2Start+0?] — started before day2 -> filtered by query upstream;
    // defensive: computeFocusTime must not count it for day2
    expect(computeFocusTime(s, categories, day2Start, day2Start + T1)).toBe(0)
  })

  it('a row crossing the period end contributes only its in-period part', () => {
    const s = [session(0, 16 * min, 1)]
    const periodEnd = 15 * min
    expect(computeFocusTime(s, categories, T0, periodEnd)).toBe(15 * min)
    expect(longestFocusSessionMs(s, categories, T0, periodEnd)).toBe(15 * min)
  })

  it('empty periods never fabricate values', () => {
    expect(computeFocusTime([], categories, T0, T1)).toBe(0)
    expect(longestFocusSessionMs([], categories, T0, T1)).toBeNull()
  })
})
