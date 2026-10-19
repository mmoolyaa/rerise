import { describe, it, expect } from 'vitest'
import { computeScore } from '../src/main/scoring/score'
import type { Session, Category } from '../src/main/db/types'

const categories: Category[] = [
  { id: 1, name: 'Coding', productivity: 2 },
  { id: 4, name: 'YouTube', productivity: 1 },
  { id: 8, name: 'Uncategorized', productivity: 0 },
  { id: 9, name: 'Social Media', productivity: -2 }
]

const hr = 60 * 60 * 1000
const base = 1000000

function session(start: number, end: number, categoryId?: number): Session {
  return { started_at: start, ended_at: end, app_name: 'app', category_id: categoryId }
}

describe('computeScore', () => {
  it('all productive (+2) time scores 100', () => {
    const r = computeScore([session(0, hr, 1)], categories)
    expect(r.score).toBe(100)
    expect(r.trackedTimeMs).toBe(hr)
  })

  it('all distracting (-2) time scores 0', () => {
    const r = computeScore([session(0, hr, 9)], categories)
    expect(r.score).toBe(0)
  })

  it('50% +2 and 50% neutral scores 75', () => {
    const r = computeScore(
      [session(0, hr / 2, 1), session(hr / 2, hr, 8)],
      categories
    )
    expect(r.score).toBe(75)
  })

  it('50% +2 and 50% -2 scores 50', () => {
    const r = computeScore(
      [session(0, hr / 2, 1), session(hr / 2, hr, 9)],
      categories
    )
    expect(r.score).toBe(50)
  })

  it('title counts uncategorized time in denominator', () => {
    // 30min uncategorized (0) + 30min youtube (+1): avg 0.5 -> 62.5
    const r = computeScore(
      [session(0, hr / 2), session(hr / 2, hr, 4)],
      categories
    )
    expect(r.score).toBe(62.5)
  })

  it('discards sessions under 3 seconds', () => {
    const r = computeScore(
      [session(0, 1000, 9), session(2000, 10000, 1), session(11000, 11000 + hr, 1)],
      categories
    )
    expect(r.score).toBe(100)
    expect(r.trackedTimeMs).toBe(8000 + hr)
  })

  it('handles zero tracked time safely', () => {
    const r = computeScore([], categories)
    expect(r.score).toBeNull()
    expect(r.trackedTimeMs).toBe(0)
  })

  it('handles all sessions shorter than 3 seconds', () => {
    const r = computeScore([session(0, 1000, 1), session(1000, 2900, 9)], categories)
    expect(r.score).toBeNull()
    expect(r.trackedTimeMs).toBe(0)
  })

  it('unknown category id counts as neutral', () => {
    const r = computeScore([session(0, hr, 999)], categories)
    expect(r.score).toBe(50)
  })
})
