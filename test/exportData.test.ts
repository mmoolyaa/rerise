import { describe, it, expect } from 'vitest'
import { sessionsToCsv, sessionsToJson } from '../src/main/export/exportData'
import type { Session, Category } from '../src/main/db/types'

const categories: Category[] = [
  { id: 1, name: 'Coding', productivity: 2 },
  { id: 8, name: 'Uncategorized', productivity: 0 }
]

function session(start: number, end: number, categoryId?: number, title?: string): Session {
  return { started_at: start, ended_at: end, app_name: 'Code.exe', category_id: categoryId, window_title: title }
}

describe('sessionsToCsv', () => {
  it('produces header and one row per session', () => {
    const csv = sessionsToCsv([session(1000, 60000, 1, 'main.ts')], categories)
    const lines = csv.split('\n')
    expect(lines[0]).toContain('started_at,ended_at,app_name')
    expect(lines).toHaveLength(2)
    expect(lines[1]).toContain('Code.exe')
    expect(lines[1]).toContain('Coding')
    expect(lines[1]).toContain('59000') // duration
  })

  it('escapes commas and quotes in titles', () => {
    const csv = sessionsToCsv([session(1000, 60000, 8, 'Hello, "world"')], categories)
    expect(csv).toContain('"Hello, ""world"""')
  })

  it('discards short sessions', () => {
    const csv = sessionsToCsv([session(0, 500, 1)], categories)
    expect(csv).not.toContain('\n') // header only, no data rows
  })
})

describe('sessionsToJson', () => {
  it('includes category + productivity', () => {
    const json = JSON.parse(sessionsToJson([session(0, 60000, 1)], categories))
    expect(json).toHaveLength(1)
    expect(json[0].category).toBe('Coding')
    expect(json[0].productivity).toBe(2)
    expect(json[0].duration_ms).toBe(60000)
  })

  it('null title/domain become null not undefined', () => {
    const json = JSON.parse(sessionsToJson([session(0, 60000, 1, undefined)], categories))
    expect(json[0].window_title).toBeNull()
  })
})
