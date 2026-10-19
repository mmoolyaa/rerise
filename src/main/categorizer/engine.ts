import type { Rule, Category } from '../db/types'
import { basename } from 'path'
import type { MatchableSession } from './types'

/**
 * Categorization engine.
 * Rules are sorted by priority DESC; first match wins.
 * No match -> Neutral category (id 8).
 */
export const UNCATEGORIZED_ID = 8

// Cached regex objects for title_regex rules
const regexCache = new Map<number, RegExp>()

function getRegex(rule: Rule): RegExp | null {
  let regex = regexCache.get(rule.id)
  if (!regex) {
    try {
      regex = new RegExp(rule.pattern, 'i')
      regexCache.set(rule.id, regex)
    } catch {
      // Invalid user-supplied pattern - skip rule
      return null
    }
  }
  return regex
}

function getAppNameFromPath(exePath: string): string {
  const name = basename(exePath)
  return name
}

// 'code.exe' and 'CODE.EXE' both normalize to 'code'
function normalizePattern(pattern: string): string {
  return pattern.toLowerCase().replace(/\.exe$/, '')
}

/**
 * App matching is bidirectional substring: app names from the OS are either
 * process names ('Code.exe') or display names ('Brave Browser'), so we compare
 * flexibly. Domain matching stays exact.
 */
function appMatches(appLower: string, pattern: string): boolean {
  const p = normalizePattern(pattern)
  if (!p) return false
  return appLower.includes(p) || p.includes(appLower)
}

export function matchRule(session: MatchableSession, rules: Rule[]): Category['id'] {
  const appLower = session.app_name.toLowerCase()
  const exeLower = session.exe_path ? getAppNameFromPath(session.exe_path).toLowerCase() : null
  const domainLower = session.domain?.toLowerCase() ?? null
  const sessionTitle = session.window_title ?? ''

  for (const rule of rules) {
    switch (rule.match_type) {
      case 'app': {
        if (appMatches(appLower, rule.pattern)) return rule.category_id
        if (exeLower && appMatches(exeLower, rule.pattern)) return rule.category_id
        break
      }
      case 'domain': {
        if (domainLower && domainLower === rule.pattern.toLowerCase()) return rule.category_id
        break
      }
      case 'title_regex': {
        const regex = getRegex(rule)
        if (regex && regex.test(sessionTitle)) return rule.category_id
        break
      }
    }
  }

  return UNCATEGORIZED_ID
}

export function createCategorizer(rules: Rule[]) {
  // Sort once by priority descending
  const sorted = [...rules].sort((a, b) => b.priority - a.priority)

  return {
    categorize(session: MatchableSession): number {
      return matchRule(session, sorted)
    }
  }
}
