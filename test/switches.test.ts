import { describe, it, expect } from 'vitest'
import { countContextSwitches, switchesPerProductiveHour } from '../src/main/scoring/switches'
import type { Session } from '../src/main/db/types'

const min = 60 * 1000

function session(start: number, end: number, app: string, domain?: string): Session {
  return { started_at: start, ended_at: end, app_name: app, domain }
}

describe('countContextSwitches', () => {
  it('counts each genuine app change exactly once', () => {
    const s = [
      session(0, 10 * min, 'Code.exe'),
      session(10 * min, 20 * min, 'Calc.exe'),
      session(20 * min, 30 * min, 'Code.exe')
    ]
    expect(countContextSwitches(s)).toBe(2)
  })

  it('repeated observations of the same app do not inflate the count', () => {
    // The tracker merges same-window polls upstream; even if duplicates
    // existed, consecutive same-identity rows must collapse to zero switches.
    const s = [
      session(0, 5 * min, 'Code.exe'),
      session(5 * min, 9 * min, 'Code.exe'),
      session(9 * min, 15 * min, 'Code.exe')
    ]
    expect(countContextSwitches(s)).toBe(0)
  })

  it('domain changes switch context, app stays browser-level otherwise', () => {
    const s = [
      session(0, 5 * min, 'brave.exe', 'github.com'),
      session(5 * min, 8 * min, 'brave.exe', 'github.com'), // merged duplicate upstream
      session(8 * min, 12 * min, 'brave.exe', 'instagram.com'), // domain switch
      session(12 * min, 20 * min, 'brave.exe') // extension tab cache went cold
    ]
    expect(countContextSwitches(s)).toBe(2)
  })

  it('same app with different domains in browser counts both switches', () => {
    const s = [
      session(0, 5 * min, 'brave.exe', 'docs.google.com'),
      session(5 * min, 10 * min, 'brave.exe', 'news.ycombinator.com'),
      session(10 * min, 15 * min, 'brave.exe', 'docs.google.com')
    ]
    expect(countContextSwitches(s)).toBe(2)
  })

  it('ignores sub-3-second flickers consistently with other metrics', () => {
    const s = [
      session(0, 10 * min, 'Code.exe'),
      session(10 * min, 10 * min + 2000, 'popup'), // 2s, below discard threshold
      session(10 * min + 10 * 1000, 20 * min, 'Code.exe')
    ]
    expect(countContextSwitches(s)).toBe(0)
  })

  it('sorts unsorted input before counting', () => {
    const s = [
      session(20 * min, 30 * min, 'Calc.exe'),
      session(0, 10 * min, 'Code.exe')
    ]
    expect(countContextSwitches(s)).toBe(1)
  })

  it('handles empty and single-session periods', () => {
    expect(countContextSwitches([])).toBe(0)
    expect(countContextSwitches([session(0, 10 * min, 'Code.exe')])).toBe(0)
  })
})

describe('switchesPerProductiveHour', () => {
  it('divides switches by productive hours', () => {
    // 6 switches across 2 productive hours => 3.0
    expect(switchesPerProductiveHour(6, 2 * 60 * 60 * 1000)).toBe(3)
  })

  it('returns null at zero productive hours instead of a fabricated number', () => {
    expect(switchesPerProductiveHour(12, 0)).toBeNull()
  })

  it('handles fractional productive hours', () => {
    // 5 switches across 1.5 productive hours => 3.333...
    expect(switchesPerProductiveHour(5, 1.5 * 60 * 60 * 1000)).toBeCloseTo(3.333, 3)
  })
})
