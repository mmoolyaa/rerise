import type { Session, Category } from '../db/types'
import { computeScore } from './score'

const MIN_SESSION_DURATION_MS = 3000

export interface DayTrend {
  date: string // YYYY-MM-DD (local)
  score: number | null
  trackedTimeMs: number
}

export interface CategorySlice {
  categoryId: number
  name: string
  productivity: Category['productivity']
  durationMs: number
}

/**
 * Builds a per-day trend for the given range of LOCAL days.
 * sessions must all fall within [rangeStartMs, rangeEndMs).
 */
export function computeDailyTrend(
  sessions: Session[],
  categories: Category[],
  rangeStartMs: number,
  days: number
): DayTrend[] {
  const dayMs = 24 * 60 * 60 * 1000

  // Bucket sessions per local day
  const byDay = new Map<string, Session[]>()
  for (const s of sessions) {
    if (s.ended_at - s.started_at < MIN_SESSION_DURATION_MS) continue
    const date = new Date(s.started_at)
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    const list = byDay.get(key)
    if (list) list.push(s)
    else byDay.set(key, [s])
  }

  const trend: DayTrend[] = []
  for (let i = 0; i < days; i++) {
    const dayStart = rangeStartMs + i * dayMs
    const dayEnd = dayStart + dayMs
    const date = new Date(dayStart)
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    const daySessions = byDay.get(key) ?? []
    const { score, trackedTimeMs } = computeScore(daySessions, categories)
    trend.push({ date: key, score, trackedTimeMs })
  }
  return trend
}

/** Aggregates tracked time per category for a breakdown chart. */
export function computeCategoryBreakdown(
  sessions: Session[],
  categories: Category[]
): CategorySlice[] {
  const byCat = new Map<number | 'none', number>()
  for (const s of sessions) {
    const dur = s.ended_at - s.started_at
    if (dur < MIN_SESSION_DURATION_MS) continue
    const key = s.category_id ?? 'none'
    byCat.set(key, (byCat.get(key) ?? 0) + dur)
  }

  // Sessions without a category fold into Neutral (8); merge with any explicit 8 time
  const noneMs = byCat.get('none')
  if (noneMs !== undefined) {
    byCat.set(8, (byCat.get(8) ?? 0) + noneMs)
    byCat.delete('none')
  }

  const slices: CategorySlice[] = []
  for (const [key, durationMs] of byCat) {
    const cat = categories.find((c) => c.id === key)
    if (!cat) continue
    slices.push({ categoryId: cat.id, name: cat.name, productivity: cat.productivity, durationMs })
  }
  return slices.sort((a, b) => b.durationMs - a.durationMs)
}
