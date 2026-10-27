import { describe, it, expect } from 'vitest'
import { WindowsPlatform } from '../src/main/platform/windows'

describe('WindowsPlatform.isBrowser', () => {
  const platform = new WindowsPlatform()

  it('matches display names of commonly tracked browsers', () => {
    expect(platform.isBrowser('Brave Browser')).toBe(true)
    expect(platform.isBrowser('Google Chrome')).toBe(true)
    expect(platform.isBrowser('Microsoft Edge')).toBe(true)
    expect(platform.isBrowser('Firefox')).toBe(true)
    expect(platform.isBrowser('Opera')).toBe(true)
    expect(platform.isBrowser('Vivaldi')).toBe(true)
  })

  it('matches exe-style names', () => {
    expect(platform.isBrowser('brave.exe')).toBe(true)
    expect(platform.isBrowser('chrome.exe')).toBe(true)
    expect(platform.isBrowser('msedge.exe')).toBe(true)
    expect(platform.isBrowser('firefox.exe')).toBe(true)
  })

  it('matches Chromium forks reportad by active-win as custom display names', () => {
    // observed in the wild: active-win reports the window title's owner name
    expect(platform.isBrowser('ego (lite)')).toBe(true)
    expect(platform.isBrowser('ego')).toBe(true)
    expect(platform.isBrowser('Zen Browser')).toBe(true)
    expect(platform.isBrowser('Thorium')).toBe(true)
    expect(platform.isBrowser('LibreWolf')).toBe(true)
    expect(platform.isBrowser('Waterfox')).toBe(true)
  })

  it('does not match non-browser apps', () => {
    expect(platform.isBrowser('Windows Explorer')).toBe(false)
    expect(platform.isBrowser('Windows Terminal Host')).toBe(false)
    expect(platform.isBrowser('Obsidian')).toBe(false)
    expect(platform.isBrowser('Notepad.exe')).toBe(false)
    expect(platform.isBrowser('VALORANT')).toBe(false)
    expect(platform.isBrowser('')).toBe(false)
  })

  it('avoids substring false positives between short tokens and app names', () => {
    // 'ego'/'zen' must not light up on e.g. 'Legobricks' / 'Zendesk' style names
    expect(platform.isBrowser('Legoeditor')).toBe(false)
    expect(platform.isBrowser('Negocio Manager')).toBe(false)
    // 'arc' was dropped as a token: too many non-browser prefixes (Archive, ...)
    expect(platform.isBrowser('Archive Explorer')).toBe(false)
  })
})
