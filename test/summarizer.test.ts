import { describe, it, expect } from 'vitest'
import { buildDayFacts } from '../src/main/summarizer/facts'
import { renderDigest, fmtDuration } from '../src/main/summarizer/template'
import type { Session, Category } from '../src/main/db/types'

const MIN = 60 * 1000
const DAY = 24 * 60 * MIN
/** Fixed epoch (days since epoch = whole, so boundaries line up with hour buckets). */
const DAY_START = Math.floor(1_800_000_000_000 / DAY) * DAY

const categories: Category[] = [
  { id: 8, name: 'Neutral', productivity: 0 },
  { id: 9, name: 'Unproductive', productivity: -2 },
  { id: 10, name: 'Productive', productivity: 2 }
]

const DAY_STR = '2026-10-27'

/** Session starting at offset min into the local day. */
function at(started_min: number, dur_min: number, categoryId?: number, app = 'App', domain?: string): Session {
  return {
    started_at: DAY_START + started_min * MIN,
    ended_at: DAY_START + (started_min + dur_min) * MIN,
    app_name: app,
    domain,
    category_id: categoryId
  }
}

function factsOf(sessions: Session[]) {
  return buildDayFacts(sessions, categories, DAY_START, DAY_START + DAY, DAY_STR)
}

describe('buildDayFacts', () => {
  it('splits the canonical 3-way mix by category productivity', () => {
    const f = factsOf([
      at(100, 30, 10),
      at(130, 20, 8),
      at(150, 15, 9)
    ])
    expect(f.productiveMs).toBe(30 * MIN)
    expect(f.neutralMs).toBe(20 * MIN)
    expect(f.unproductiveMs).toBe(15 * MIN)
    expect(f.trackedTimeMs).toBe(65 * MIN)
    // same math as computeScore
    const avg = (30 * 2 + 20 * 0 + 15 * -2) / 65
    expect(f.score).toBeCloseTo(((avg + 2) / 4) * 100, 1)
  })

  it('captures activity span, busiest hour, and derailers', () => {
    const f = factsOf([
      at(9 * 60, 5, 10, 'Code'),
      at(10 * 60 + 30, 25, 9, 'Browser', 'instagram.com'),
      at(4 * 60, 20, 10, 'Code'),
      at(4 * 60 + 25, 10, 10, 'Code')
    ])
    expect(f.busiestHour).toBe(4) // hour 4 has 30min of activity
    expect(f.firstActivityMs).toBe(DAY_START + 4 * 60 * MIN) // earliest start
    expect(f.lastActivityMs).toBe(DAY_START + (10 * 60 + 55) * MIN) // latest end
    expect(f.derailers.map((d) => d.name)).toEqual(['instagram.com'])
    expect(f.derailers[0].durationMs).toBe(25 * MIN)
  })

  it('exposes focus aggregates via the shared summary builder', () => {
    const f = factsOf([at(120, 20, 10)])
    expect(f.longestFocusMs).toBe(20 * MIN)
    expect(f.focusTimeMs).toBe(20 * MIN)
  })

  it('empty day is honest: zeros and null span', () => {
    const f = factsOf([])
    expect(f.trackedTimeMs).toBe(0)
    expect(f.firstActivityMs).toBeNull()
    expect(f.busiestHour).toBeNull()
    expect(f.score).toBeNull()
  })
})

describe('renderDigest', () => {
  it('is deterministic per day key: same facts -> same text', () => {
    const f = factsOf([at(100, 30, 10), at(130, 90, 10, 'Code')])
    const a = renderDigest(f)
    const b = renderDigest(f)
    expect(a).toBe(b)
  })

  it('keeps numbers the stat cards already show out of the text', () => {
    // 20min productive + 20min neutral -> score 75; sessions split across
    // hours so no rendered duration coincides with the tracked total.
    const f = factsOf([at(60, 20, 10, 'Code'), at(180, 20, 8, 'Terminal')])
    const text = renderDigest(f)
    expect(text.toLowerCase()).not.toContain('score')
    expect(text).not.toContain('75/100')
    expect(text).not.toContain(fmtDuration(f.trackedTimeMs)) // tracked total lives in cards
    // switch count is card data; the text may only carry the per-hour pace
    expect(text).not.toMatch(/context switches/i)
    expect(text).not.toMatch(/ {2}/) // clean single-spacing between sentences
    expect(text).toContain(f.sessionCount.toString())
  })

  it('mentions what the cards do not: longest stretch, share, span, peak, usage', () => {
    const f = factsOf([at(60, 45, 10, 'Code'), at(105, 30, 9, 'Browser', 'instagram.com')])
    const text = renderDigest(f)
    expect(text).toContain(fmtDuration(f.longestFocusMs as number))
    expect(text).toContain('%')
    expect(text).toMatch(/active \d{2}:\d{2}–\d{2}:\d{2}/i)
    expect(text).toContain('Code')
    expect(text).toContain('instagram.com')
  })

  it('non-qualifying day names the missed threshold honestly', () => {
    const f = factsOf([at(10, 10, 10), at(20, 8, 9), at(28, 10, 10)])
    expect(renderDigest(f)).toMatch(/no 15-minute window|none qualified/i)
  })

  it('empty day gets a single calm line and no crash', () => {
    const text = renderDigest(factsOf([]))
    expect(text.split('\n\n')).toHaveLength(1)
    expect(text).toMatch(/no tracked time/i)
  })

  it('reports derailers when unproductive time is meaningful', () => {
    const f = factsOf([at(0, 60, 10, 'Code'), at(60, 25, 9, 'Browser', 'instagram.com'), at(85, 20, 9, 'Browser', 'tiktok.com')])
    const text = renderDigest(f)
    expect(text).toContain('instagram.com')
  })
})
