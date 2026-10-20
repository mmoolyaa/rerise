import { describe, it, expect } from 'vitest'
import { summarizeSessions } from '../src/main/scoring/summary'
import type { Session, Category } from '../src/main/db/types'

const categories: Category[] = [
  { id: 1, name: 'Coding', productivity: 2 },
  { id: 8, name: 'Uncategorized', productivity: 0 },
  { id: 9, name: 'Social Media', productivity: -2 }
]

const min = 60 * 1000

function session(start: number, end: number, categoryId?: number, app = 'app', domain?: string): Session {
  return { started_at: start, ended_at: end, app_name: app, category_id: categoryId, domain }
}

describe('summarizeSessions', () => {
  it('computes score, tracked time, focus and coverage', () => {
    const dayStart = 0
    const dayEnd = 60 * min // 60-minute period
    const sessions = [
      session(6 * min, 20 * min, 1, 'Code.exe'), // 14min productive
      session(20 * min, 26 * min, 8, 'Calc.exe') // 6min neutral
    ]
    const r = summarizeSessions(sessions, categories, dayStart, dayEnd)
    // score: (14*2 + 6*0)/20 -> avg 1.4 -> (1.4+2)/4*100 = 85
    expect(r.score).toBe(85)
    expect(r.trackedTimeMs).toBe(20 * min)
    expect(r.focusTimeMs).toBe(0) // under 25min
    expect(r.coveragePercent).toBe(Math.round((20 * min / (60 * min)) * 100))
  })

  it('aggregates top apps by duration', () => {
    const sessions = [
      session(0, 30 * min, 1, 'Code.exe'),
      session(30 * min, 40 * min, 1, 'Code.exe'),
      session(40 * min, 50 * min, 8, 'Calc.exe')
    ]
    const r = summarizeSessions(sessions, categories, 0, 50 * min)
    expect(r.topApps[0]).toMatchObject({ name: 'Code.exe', durationMs: 40 * min })
    expect(r.topApps[1]).toMatchObject({ name: 'Calc.exe', durationMs: 10 * min })
  })

  it('aggregates top sites by domain and keeps site time out of the app split', () => {
    const sessions = [
      session(0, 10 * min, 1, 'brave.exe', 'github.com'),
      session(10 * min, 14 * min, 1, 'brave.exe', 'github.com'),
      session(14 * min, 20 * min, 9, 'brave.exe', 'instagram.com'),
      session(20 * min, 30 * min, 10, 'Code.exe') // no domain -> counts as app time
    ]
    const r = summarizeSessions(sessions, categories, 0, 30 * min)
    expect(r.topApps).toEqual([{ name: 'Code.exe', durationMs: 10 * min, category_id: 10 }])
    expect(r.topSites[0]).toMatchObject({ name: 'github.com', durationMs: 14 * min, category_id: 1 })
    expect(r.topSites[1]).toMatchObject({ name: 'instagram.com', durationMs: 6 * min, category_id: 9 })
  })

  it('counts uncategorized time including null category', () => {
    const sessions = [
      session(0, 10 * min, 8),
      session(10 * min, 15 * min, undefined),
      session(15 * min, 20 * min, 1)
    ]
    const r = summarizeSessions(sessions, categories, 0, 20 * min)
    expect(r.uncategorizedMs).toBe(15 * min)
  })

  it('handles empty session list', () => {
    const r = summarizeSessions([], categories, 0, 60 * min)
    expect(r.score).toBeNull()
    expect(r.trackedTimeMs).toBe(0)
    expect(r.coveragePercent).toBe(0)
    expect(r.topApps).toHaveLength(0)
  })
})
