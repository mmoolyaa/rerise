import { useEffect, useState, useCallback } from 'react'
import type { RangeSummaryReply } from '../types'

export type RangeDays = 1 | 7 | 30 | 90

/**
 * Range-level analytics: summary (focus time, count, top apps/sites),
 * per-day trend and category breakdown, plus the active-day streak.
 */
export function useRangeData(days: RangeDays) {
  const [data, setData] = useState<RangeSummaryReply | null>(null)
  const [streak, setStreak] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const [summary, streakDays] = await Promise.all([
        window.tempoAPI.getRangeSummary(days),
        window.tempoAPI.getStreak()
      ])
      setData(summary)
      setStreak(streakDays)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [days])

  useEffect(() => {
    refresh()
    const interval = setInterval(refresh, 60_000)
    window.addEventListener('focus', refresh)
    return () => {
      clearInterval(interval)
      window.removeEventListener('focus', refresh)
    }
  }, [refresh])

  return { data, streak, error, refresh }
}
