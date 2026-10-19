import { useEffect, useState, useCallback } from 'react'
import type { SummaryReply, SessionsReply, TrackingState, TodaySummary, Session, Category } from '../types'

export function useTodayData() {
  const [summary, setSummary] = useState<TodaySummary | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [state, setState] = useState<TrackingState>('TRACKING')
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const [sumReply, sessReply] = await Promise.all([
        window.tempoAPI.getTodaySummary(),
        window.tempoAPI.getSessionsToday()
      ])
      setSummary(sumReply.summary)
      setSessions(sessReply.sessions)
      setCategories(sessReply.categories)
      setState((await window.tempoAPI.getTrackingState()) as TrackingState)
      setError(null)
    } catch (err) {
      // Never crash the UI on IPC failures - show the stale/empty view
      console.error('Failed to load today data:', err)
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [])

  useEffect(() => {
    refresh()

    const interval = setInterval(refresh, 60_000)
    window.addEventListener('focus', refresh)

    // Optional subscription; guard if preload failed to expose the API
    let unsubscribe: (() => void) | undefined
    try {
      unsubscribe = window.tempoAPI.onTrackingStateChanged((s) => setState(s as TrackingState))
    } catch {
      console.warn('tempoAPI not available (preload failed?)')
    }

    return () => {
      clearInterval(interval)
      window.removeEventListener('focus', refresh)
      unsubscribe?.()
    }
  }, [refresh])

  return { summary, sessions, categories, state, error, refresh }
}
