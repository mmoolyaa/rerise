export interface Category {
  id: number
  name: string
  productivity: -2 | -1 | 0 | 1 | 2
}

export interface Rule {
  id: number
  match_type: 'app' | 'domain' | 'title_regex'
  pattern: string
  category_id: number
  priority: number
}

export interface Session {
  id?: number
  started_at: number // UTC unix ms
  ended_at: number // UTC unix ms
  app_name: string
  exe_path?: string
  window_title?: string
  domain?: string
  url?: string
  category_id?: number
}

export interface Setting {
  key: string
  value: string
}
