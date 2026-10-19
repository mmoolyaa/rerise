import { useEffect, useState, useCallback } from 'react'
import type { DayDataReply } from '../types'

/**
 * Loads summary + sessions + categories for a given LOCAL day offset
 * (0 = today, 1 = yesterday, ... up to 30), auto-refreshing every minute
 * and on window focus.
 */
export function useDayData(offsetDays: number) {
  const [data, setData] = useState<DayDataReply | null>(null)

  const refresh = useCallback(async () => {
    try {
      setData(await window.tempoAPI.getDayData(offsetDays))
    } catch (err) {
      console.error('Failed to load day data:', err)
    }
  }, [offsetDays])

  useEffect(() => {
    refresh()
    const interval = setInterval(refresh, 60_000)
    window.addEventListener('focus', refresh)
    return () => {
      clearInterval(interval)
      window.removeEventListener('focus', refresh)
    }
  }, [refresh])

  return { data, refresh }
}
