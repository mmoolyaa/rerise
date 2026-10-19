import type { Session, Category } from '../db/types'

const MIN_SESSION_DURATION_MS = 3000 // 3 seconds - discard short sessions consistently

export interface ScoreResult {
  // null when there is no tracked time in the period
  score: number | null
  trackedTimeMs: number
}

/**
 * Productivity score = time-weighted average of category productivity (-2..+2)
 * mapped to 0-100. Uncategorized time counts in the denominator with value 0.
 * Sessions shorter than 3 seconds are discarded.
 */
export function computeScore(sessions: Session[], categories: Category[]): ScoreResult {
  const productivityById = new Map<number, number>()
  for (const c of categories) {
    productivityById.set(c.id, c.productivity)
  }

  let weightedSum = 0
  let totalWeight = 0

  for (const s of sessions) {
    const duration = s.ended_at - s.started_at
    if (duration < MIN_SESSION_DURATION_MS) continue

    // Uncategorized (or missing category) counts as 0 (neutral)
    const value = s.category_id ? (productivityById.get(s.category_id) ?? 0) : 0
    weightedSum += value * duration
    totalWeight += duration
  }

  if (totalWeight === 0) {
    return { score: null, trackedTimeMs: 0 }
  }

  const avg = weightedSum / totalWeight
  const score = ((avg + 2) / 4) * 100

  return { score: Math.round(score * 10) / 10, trackedTimeMs: totalWeight }
}
