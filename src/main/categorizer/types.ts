import type { Rule, Category } from '../db/types'

export type { Rule, Category }

export interface MatchableSession {
  app_name: string
  exe_path?: string
  window_title?: string
  domain?: string
}
