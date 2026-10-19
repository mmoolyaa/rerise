import { describe, it, expect } from 'vitest'
import { computeFocusTime } from '../src/main/scoring/focusTime'
import type { Session, Category } from '../src/main/db/types'

const categories: Category[] = [
  { id: 1, name: 'Coding', productivity: 2 },
  { id: 3, name: 'AI Research', productivity: 1 },
  { id: 4, name: 'YouTube', productivity: 1 },
  { id: 6, name: 'Music', productivity: 0 },
  { id: 7, name: 'Communication', productivity: 0 },
  { id: 9, name: 'Social Media', productivity: -2 }
]

const min25 = 25 * 60 * 1000
const min = 60 * 1000

function session(start: number, duration: number, categoryId?: number): Session {
  return { started_at: start, ended_at: start + duration, app_name: 'app', category_id: categoryId }
}

describe('computeFocusTime', () => {
  const fs = `${20}min`

  it('counts 20min Code + 10min GitHub as 30min focus', () => {
    // Change 1 approved: switching between productive categories continues block
    const s = [session(0, 20 * min, 1), session(20 * min, 10 * min, 1)]
    expect(computeFocusTime(s, categories)).toBe(30 * min)
  })

  it('20min Code + 3min Instagram + 30min Docs = 30min focus (20min block discarded)', () => {
    const s = [
      session(0, 20 * min, 1),
      session(20 * min, 3 * min, 9), // distracting breaks block
      session(23 * min, 30 * min, 1)
    ]
    expect(computeFocusTime(s, categories)).toBe(30 * min)
  })

  it('blocks under 25 minutes are discarded entirely', () => {
    const s = [session(0, 24 * min, 1)]
    expect(computeFocusTime(s, categories)).toBe(0)
  })

  it('block at exactly 25 minutes counts', () => {
    const s = [session(0, min25, 1)]
    expect(computeFocusTime(s, categories)).toBe(min25)
  })

  it('neutral session under 2 minutes bridges the block', () => {
    const s = [
      session(0, 20 * min, 1),
      session(20 * min, 90 * 1000, 6), // 1.5min neutral bridge
      session(20 * min + 90 * 1000 + 0, 20 * min - 90 * 1000 + 10 * min, 1)
    ]
    // Total productive span = 50min; block length = productive edges only.
    // Span from block start (0) to last productive end = 20 + 10 = 50min counted via prevEnd.
    expect(computeFocusTime(s, categories)).toBe(50 * min)
  })

  it('neutral session of 2+ minutes breaks the block', () => {
    const s = [
      session(0, 20 * min, 1),
      session(20 * min, 3 * min, 6), // 3min neutral breaks it
      session(23 * min, 30 * min, 1)
    ]
    expect(computeFocusTime(s, categories)).toBe(30 * min)
  })

  it('an untracked gap breaks the block', () => {
    const gap = 10 * min
    const s = [
      session(0, 20 * min, 1),
      session(20 * min + gap, 30 * min, 1) // 10min untracked gap in between
    ]
    expect(computeFocusTime(s, categories)).toBe(30 * min)
  })

  it('switching productive categories (+1/+2 mixed) keeps block alive', () => {
    const s = [
      session(0, 10 * min, 1),
      session(10 * min, 8 * min, 4), // +1
      session(18 * min, 12 * min, 3), // +1
      session(30 * min, 5 * min, 1) // total 35min productive
    ]
    expect(computeFocusTime(s, categories)).toBe(35 * min)
  })

  it('distracting session of any length breaks the block', () => {
    const s = [
      session(0, 20 * min, 1),
      session(20 * min, 30 * 1000, 9), // 30sec distracting
      session(20 * min + 30 * 1000, 30 * min, 1)
    ]
    expect(computeFocusTime(s, categories)).toBe(30 * min)
  })

  it('sessions without category are neutral for focus purposes', () => {
    const s = [session(0, 30 * min)]
    expect(computeFocusTime(s, categories)).toBe(0)
  })

  it('multiple valid blocks sum up', () => {
    const s = [
      session(0, 30 * min, 1),
      session(30 * min, 5 * min, 9), // break
      session(35 * min, 28 * min, 1)
    ]
    expect(computeFocusTime(s, categories)).toBe(30 * min + 28 * min)
  })

  it('handles empty input', () => {
    expect(computeFocusTime([], categories)).toBe(0)
  })
})
