import { describe, it, expect } from 'vitest'
import { computeDailyTrend, computeCategoryBreakdown } from '../src/main/scoring/range'
import type { Session, Category } from '../src/main/db/types'

const categories: Category[] = [
  { id: 1, name: 'Coding', productivity: 2 },
  { id: 8, name: 'Uncategorized', productivity: 0 }
]

const hour = 60 * 60 * 1000
const min = 60 * 1000

// Use a fixed local midnight: construct from Date to remain TZ-safe
const anchor = new Date()
anchor.setHours(0, 0, 0, 0)
const dayStart = anchor.getTime()
const dayMs = 24 * hour

function session(start: number, end: number, categoryId?: number): Session {
  return { started_at: start, ended_at: end, app_name: 'app', category_id: categoryId }
}

describe('computeDailyTrend', () => {
  it('produces an entry per day with correct scores', () => {
    const sessions = [
      session(dayStart, dayStart + hour, 1), // today: all +2 -> 100
      session(dayStart + dayMs, dayStart + dayMs + hour, 8) // tomorrow: all 0 -> 50
    ]
    const trend = computeDailyTrend(sessions, categories, dayStart, 2)
    expect(trend).toHaveLength(2)
    expect(trend[0].score).toBe(100)
    expect(trend[1].score).toBe(50)
  })

  it('empty days get null score', () => {
    const trend = computeDailyTrend([], categories, dayStart, 1)
    expect(trend[0].score).toBeNull()
    expect(trend[0].trackedTimeMs).toBe(0)
  })

  it('keys are local YYYY-MM-DD of the range days', () => {
    const d = new Date(dayStart)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    expect(computeDailyTrend([], categories, dayStart, 1)[0].date).toBe(key)
  })
})

describe('computeCategoryBreakdown', () => {
  it('aggregates by category', () => {
    const slices = computeCategoryBreakdown(
      [session(0, 10 * min, 1), session(10 * min, 25 * min, 8), session(25 * min, 30 * min)],
      categories
    )
    expect(slices).toHaveLength(2)
    expect(slices[0].categoryId).toBe(8) // 20min uncategorised
    expect(slices[0].durationMs).toBe(20 * min)
    expect(slices[1].categoryId).toBe(1)
    expect(slices[1].durationMs).toBe(10 * min)
  })

  it('null category folds into Uncategorized (8)', () => {
    const slices = computeCategoryBreakdown([session(0, 5 * min)], categories)
    expect(slices).toHaveLength(1)
    expect(slices[0].categoryId).toBe(8)
  })
})
