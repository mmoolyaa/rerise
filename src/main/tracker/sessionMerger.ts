import type { TrackedSession } from './types'
import type { Session } from '../db/types'

const MIN_SESSION_DURATION_MS = 3000 // 3 seconds

export interface MergeResult {
  action: 'extend' | 'close' | 'discard'
  sessionToSave?: Session
}

/**
 * Session merging logic:
 * - Same app + domain (or both null) -> extend
 * - Different app/domain -> close and start new
 * - Duration < 3s -> discard
 */
export function shouldMergeSession(
  current: TrackedSession,
  newAppName: string,
  newDomain: string | undefined
): boolean {
  // App name must match
  if (current.app_name !== newAppName) return false
  
  // Domain must match (or both null/undefined)
  if (current.domain !== newDomain) return false
  
  return true
}

export function closeSession(
  session: TrackedSession,
  endedAt: number
): Session | null {
  const duration = endedAt - session.started_at
  
  // Discard sessions shorter than 3 seconds
  if (duration < MIN_SESSION_DURATION_MS) {
    return null
  }
  
  return {
    started_at: session.started_at,
    ended_at: endedAt,
    app_name: session.app_name,
    exe_path: session.exe_path,
    window_title: session.window_title,
    domain: session.domain,
    url: session.url
  }
}
