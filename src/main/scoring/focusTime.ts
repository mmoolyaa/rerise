import type { Session, Category } from '../db/types'

export const FOCUS_BLOCK_MIN_MS = 25 * 60 * 1000 // 25 minutes
const NEUTRAL_BRIDGE_MAX_MS = 2 * 60 * 1000 // 2 minutes
const MIN_SESSION_DURATION_MS = 3000

/**
 * Focus time = total time in uninterrupted blocks (>= 25 min) where all
 * sessions have productivity >= 1 (+1 / +2 categories).
 *
 * Block rules:
 * - Switching between productive categories keeps the block alive.
 * - A neutral (0) session under 2 minutes bridges the block (not counted as focus time).
 * - Any distracting session (< 0), a neutral session >= 2 minutes, or an
 *   untracked gap breaks the block immediately.
 */
export function computeFocusTime(sessions: Session[], categories: Category[]): number {
  const productivityById = new Map<number, number>()
  for (const c of categories) {
    productivityById.set(c.id, c.productivity)
  }

  // Sort chronologically, discard short sessions up front
  const ordered = sessions
    .filter((s) => s.ended_at - s.started_at >= MIN_SESSION_DURATION_MS)
    .sort((a, b) => a.started_at - b.started_at)

  let focusTotalMs = 0
  let blockStartMs: number | null = null
  let prevEndMs: number | null = null

  for (const s of ordered) {
    // Untracked gap breaks the block (idle, pause, lock, or missed app switch)
    if (prevEndMs !== null && s.started_at > prevEndMs) {
      if (blockStartMs !== null) {
        const blockLen = prevEndMs - blockStartMs
        if (blockLen >= FOCUS_BLOCK_MIN_MS) focusTotalMs += blockLen
        blockStartMs = null
      }
    }

    // Sessions default to neutral when they have no category
    const productivity = s.category_id ? (productivityById.get(s.category_id) ?? 0) : 0
    const duration = s.ended_at - s.started_at

    if (productivity >= 1) {
      // Productive: start or extend the block
      if (blockStartMs === null) blockStartMs = s.started_at
    } else if (productivity < 0) {
      // Distracting: always breaks the block
      if (blockStartMs !== null) {
        const blockLen = prevEndMs !== null ? prevEndMs - blockStartMs : 0
        if (blockLen >= FOCUS_BLOCK_MIN_MS) focusTotalMs += blockLen
        blockStartMs = null
      }
    } else {
      // Neutral: breaks block only if it lasts >= 2 minutes
      if (blockStartMs !== null && duration >= NEUTRAL_BRIDGE_MAX_MS) {
        const blockLen = prevEndMs !== null ? prevEndMs - blockStartMs : 0
        if (blockLen >= FOCUS_BLOCK_MIN_MS) focusTotalMs += blockLen
        blockStartMs = null
      }
      // Neutral under 2 min: bridge, block continues (gap time not counted)
    }

    prevEndMs = s.ended_at
  }

  // Close trailing block
  if (blockStartMs !== null && prevEndMs !== null) {
    const blockLen = prevEndMs - blockStartMs
    if (blockLen >= FOCUS_BLOCK_MIN_MS) focusTotalMs += blockLen
  }

  return focusTotalMs
}
