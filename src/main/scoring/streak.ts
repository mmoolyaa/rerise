const DAY_MS = 24 * 60 * 60 * 1000

/** Local YYYY-MM-DD key for an epoch ms value */
export function ymdKey(ms: number): string {
  const d = new Date(ms)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Longest run of consecutive ACTIVE days ending at today (grace: if today has
 * no tracked time yet, the streak can still be alive counting from yesterday).
 * activeDays: set of local YYYY-MM-DD keys with >= minimum tracked time.
 */
export function computeStreak(activeDays: Set<string>, todayKey: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(todayKey)) return 0
  // Anchor cursor at local midnight of todayKey
  const cursor = new Date(`${todayKey}T00:00:00`)
  if (isNaN(cursor.getTime())) return 0
  if (!activeDays.has(todayKey)) cursor.setDate(cursor.getDate() - 1)

  let streak = 0
  for (let i = 0; i < 400; i++) {
    if (!activeDays.has(ymdKey(cursor.getTime()))) break
    streak++
    cursor.setTime(cursor.getTime() - DAY_MS)
  }
  return streak
}
