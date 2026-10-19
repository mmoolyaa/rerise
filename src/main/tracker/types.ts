export type TrackingState = 'TRACKING' | 'IDLE' | 'PAUSED' | 'LOCKED'

export interface TrackedSession {
  started_at: number
  app_name: string
  exe_path?: string
  window_title?: string
  domain?: string
  url?: string
}
