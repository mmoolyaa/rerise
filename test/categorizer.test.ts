import { describe, it, expect } from 'vitest'
import { createCategorizer, UNCATEGORIZED_ID } from '../src/main/categorizer/engine'
import type { Rule } from '../src/main/db/types'

const rules: Rule[] = [
  { id: 1, match_type: 'domain', pattern: 'music.youtube.com', category_id: 6, priority: 100 },
  { id: 2, match_type: 'domain', pattern: 'youtube.com', category_id: 4, priority: 90 },
  { id: 3, match_type: 'domain', pattern: 'github.com', category_id: 1, priority: 90 },
  { id: 4, match_type: 'domain', pattern: 'instagram.com', category_id: 9, priority: 90 },
  { id: 5, match_type: 'app', pattern: 'code.exe', category_id: 1, priority: 50 },
  { id: 6, match_type: 'app', pattern: 'brave.exe', category_id: 8, priority: 30 },
  { id: 7, match_type: 'title_regex', pattern: 'vscode', category_id: 1, priority: 10 }
]

const categorizer = createCategorizer(rules)

describe('categorizer engine', () => {
  it('prioritizes music.youtube.com over youtube.com', () => {
    expect(categorizer.categorize({ app_name: 'brave.exe', domain: 'music.youtube.com' })).toBe(6)
  })

  it('matches youtube.com normally', () => {
    expect(categorizer.categorize({ app_name: 'brave.exe', domain: 'youtube.com' })).toBe(4)
  })

  it('matches github.com domain', () => {
    expect(categorizer.categorize({ app_name: 'brave.exe', domain: 'github.com' })).toBe(1)
  })

  it('matches app rule case-insensitively', () => {
    expect(categorizer.categorize({ app_name: 'Code' })).toBe(1)
    expect(categorizer.categorize({ app_name: 'CODE.EXE' })).toBe(1)
  })

  it('domain rules beat lower-priority app rules', () => {
    // instagram.com (-2) over brave.exe (8)
    expect(categorizer.categorize({ app_name: 'brave.exe', domain: 'instagram.com' })).toBe(9)
  })

  it('falls back to Uncategorized when nothing matches', () => {
    expect(categorizer.categorize({ app_name: 'Calculator.exe' })).toBe(UNCATEGORIZED_ID)
  })

  it('browsers without extension data are Uncategorized (app rule brave.exe)', () => {
    expect(categorizer.categorize({ app_name: 'Brave Browser' })).toBe(8)
  })

  it('title_regex matches window title', () => {
    expect(categorizer.categorize({ app_name: 'Editor.exe', window_title: 'My vscode project' })).toBe(1)
  })

  it('domain match without domain does not fire', () => {
    expect(categorizer.categorize({ app_name: 'notepad.exe' })).toBe(UNCATEGORIZED_ID)
  })

  it('skips invalid regex patterns safely', () => {
    const bad: Rule[] = [
      { id: 10, match_type: 'title_regex', pattern: '([invalid', category_id: 2, priority: 99 }
    ]
    const c = createCategorizer(bad)
    expect(c.categorize({ app_name: 'app.exe', window_title: 'test' })).toBe(UNCATEGORIZED_ID)
  })
})
