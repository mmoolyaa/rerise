import { powerMonitor } from 'electron'
import { getProvider } from '../platform'
import { insertSession, getAllRules } from '../db'
import { shouldMergeSession, closeSession } from './sessionMerger'
import { createCategorizer } from '../categorizer/engine'
import {
  getStoreTitlesSetting,
  getIdleThresholdMs,
  isExcludedApp,
  isExcludedDomain
} from '../settings/settings'
import type { CachedTab } from '../server/tabCache'
import type { TrackedSession, TrackingState } from './types'

const POLL_INTERVAL_MS = 3000 // 3 seconds
const IDLE_THRESHOLD_MS = 120000 // 120 seconds (2 minutes)

export class Tracker {
  private state: TrackingState = 'TRACKING'
  private currentSession: TrackedSession | null = null
  private pollTimer: NodeJS.Timeout | null = null
  private platform = getProvider()
  private categorizer = createCategorizer(getAllRules())
  private stateListeners: Array<(state: TrackingState) => void> = []

  /**
   * Subscribes to state changes (used by tray + renderer indicator).
   * Listener errors must never crash the tracker.
   */
  addStateListener(listener: (state: TrackingState) => void) {
    this.stateListeners.push(listener)
  }

  private setState(state: TrackingState) {
    if (this.state !== state) {
      this.state = state
      for (const listener of this.stateListeners) {
        try {
          listener(state)
        } catch {
          // Ignore listener errors (e.g. destroyed window)
        }
      }
    }
  }
  
  start() {
    console.log('Tracker starting...')
    this.setState('TRACKING')
    this.poll()
    this.pollTimer = setInterval(() => this.poll(), POLL_INTERVAL_MS)
  }
  pause() {
    console.log('Tracker paused')
    this.setState('PAUSED')
    this.closeCurrentSession(Date.now())
  }
  
  resume() {
    console.log('Tracker resumed')
    this.setState('TRACKING')
  }
  
  stop() {
    console.log('Tracker stopping...')
    if (this.pollTimer) {
      clearInterval(this.pollTimer)
      this.pollTimer = null
    }
    this.closeCurrentSession(Date.now())
  }
  
  handleLock() {
    console.log('Screen locked - closing session')
    this.setState('LOCKED')
    this.closeCurrentSession(Date.now())
  }

  handleUnlock() {
    // Auto-resume tracking after the screen is unlocked (poll stops while LOCKED)
    if (this.state === 'LOCKED') {
      console.log('Screen unlocked - resuming tracking')
      this.setState('TRACKING')
    }
  }
  
  handleSuspend() {
    console.log('System suspending - closing session')
    this.closeCurrentSession(Date.now())
  }
  
  handleResume() {
    console.log('System resumed')
    if (this.state === 'LOCKED') {
      // Stay locked until user unlocks, but we can't detect unlock event reliably
      // For now, next poll will resume tracking
      this.setState('TRACKING')
    }
  }
  
  private async poll() {
    // Skip if paused or locked
    if (this.state === 'PAUSED' || this.state === 'LOCKED') {
      return
    }
    
    // Check idle time
    const idleTimeMs = powerMonitor.getSystemIdleTime() * 1000
    const thresholdMs = getIdleThresholdMs()

    if (idleTimeMs >= thresholdMs) {
      if (this.state !== 'IDLE') {
        console.log(`User idle for ${Math.round(idleTimeMs / 1000)}s - closing session`)
        this.setState('IDLE')
        // Close session with adjusted end time (now - idle time)
        this.closeCurrentSession(Date.now() - idleTimeMs)
      }
      return
    }
    
    // User active again after idle
    if (this.state === 'IDLE') {
      console.log('User active again')
      this.setState('TRACKING')
    }
    
    // Get active window
    const win = await this.platform.getActiveWindow()
    
    if (!win) {
      // No active window (desktop, lock screen, etc.)
      this.closeCurrentSession(Date.now())
      return
    }

    // Privacy: excluded apps are never recorded at all
    if (isExcludedApp(win.appName, win.exePath)) {
      this.closeCurrentSession(Date.now())
      return
    }

    // Never track Tempo itself (dev runs show up as 'Electron')
    const exe = (win.exePath ?? '').toLowerCase()
    if (exe && exe === process.execPath.toLowerCase()) {
      this.closeCurrentSession(Date.now())
      return
    }
    
    const now = Date.now()
    const domain = this.platform.isBrowser(win.appName) ? this.getFreshDomain() : undefined

    // Privacy: excluded domains are never recorded
    if (domain && isExcludedDomain(domain)) {
      this.closeCurrentSession(Date.now())
      return
    }
    
    // Merge or close current session
    if (this.currentSession) {
      if (shouldMergeSession(this.currentSession, win.appName, domain)) {
        // Extend current session (just keep tracking, we'll close later)
        // No action needed
      } else {
        // Different app/domain - close and start new
        this.closeCurrentSession(now)
        this.currentSession = this.createSession(win, domain, now)
      }
    } else {
      // Start new session
      this.currentSession = this.createSession(win, domain, now)
    }
  }
  
  getFreshTab: ((now: number) => CachedTab | null) | null = null

  /** Domain from the extension's tab cache - only fresh data, never stale. */
  private getFreshDomain(): string | undefined {
    if (!this.getFreshTab) return undefined
    const fresh = this.getFreshTab(Date.now())
    if (fresh) console.log(`[tracker] extension data: domain=${fresh.domain}`)
    else console.log('[tracker] no fresh extension data for browser window')
    return fresh?.domain
  }

  private createSession(
    win: { appName: string; exePath?: string; title: string },
    domain: string | undefined,
    startedAt: number
  ): TrackedSession {
    console.log(`New session: ${win.appName} - ${win.title}${domain ? ` [${domain}]` : ''}`)
    return {
      started_at: startedAt,
      app_name: win.appName,
      exe_path: win.exePath,
      window_title: win.title,
      domain,
      url: undefined
    }
  }
  
  private closeCurrentSession(endedAt: number) {
    if (!this.currentSession) return
    
    const session = closeSession(this.currentSession, endedAt)
    
    if (session) {
      const durationSec = Math.round((session.ended_at - session.started_at) / 1000)
      
      // Assign category via rules engine
      session.category_id = this.categorizer.categorize(session)

      // Privacy: drop the window title if the user disabled storing titles
      if (!getStoreTitlesSetting()) {
        session.window_title = undefined
      }
      
      console.log(`Session closed: ${session.app_name} (${durationSec}s) -> category ${session.category_id}`)
      
      try {
        insertSession(session)
        console.log('Session saved to DB')
      } catch (error) {
        console.error('Error saving session:', error)
      }
    } else {
      console.log(`Session discarded: ${this.currentSession.app_name} (too short)`)
    }
    
    this.currentSession = null
  }
  
  getState(): TrackingState {
    return this.state
  }
}
