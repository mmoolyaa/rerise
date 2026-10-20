import { describe, it, expect } from 'vitest'
import { computeStreak, ymdKey } from '../src/main/scoring/streak'

const DAY_MS = 24 * 60 * 60 * 1000

// Fixed anchor far from DST risk: 2024-07-10 (Wednesday) local-ish construction
const anchor = new Date(2024, 6, 10, 12, 0, 0)
const today = ymdKey(anchor.getTime())

function keyNDaysAgo(n: number): string {
  const d = new Date(anchor.getTime() - n * DAY_MS)
  d.setHours(12, 0, 0, 0)
  return ymdKey(d.getTime())
}

describe('computeStreak', () => {
  it('returns 0 for no active days', () => {
    expect(computeStreak(new Set(), today)).toBe(0)
  })

  it('counts consecutive days ending today', () => {
    const active = new Set([today, keyNDaysAgo(1), keyNDaysAgo(2)])
    expect(computeStreak(active, today)).toBe(3)
  })

  it('breaks at the first inactive day', () => {
    const active = new Set([today, keyNDaysAgo(1), keyNDaysAgo(3), keyNDaysAgo(4)])
    expect(computeStreak(active, today)).toBe(2)
  })

  it('graces today not yet active by counting from yesterday', () => {
    const active = new Set([keyNDaysAgo(1), keyNDaysAgo(2), keyNDaysAgo(3)])
    expect(computeStreak(active, today)).toBe(3)
  })

  it('stops when the previous two days are inactive', () => {
    const active = new Set([keyNDaysAgo(5), keyNDaysAgo(6)])
    expect(computeStreak(active, today)).toBe(0)
  })

  it('rejects malformed today keys', () => {
    expect(computeStreak(new Set([today]), 'not-a-date')).toBe(0)
  })

  it('ymdKey produces zero-padded local keys', () => {
    const d = new Date(2024, 0, 5, 9, 0, 0)
    expect(ymdKey(d.getTime())).toBe('2024-01-05')
  })
})
