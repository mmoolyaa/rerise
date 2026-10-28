import { describe, it, expect } from 'vitest'
import { normalizeDomain, TabCache, TAB_MAX_AGE_MS } from '../src/main/server/tabCache'

describe('normalizeDomain', () => {
  it('extracts domain from full URL', () => {
    expect(normalizeDomain('https://github.com/microsoft/vscode')).toBe('github.com')
  })

  it('strips www.', () => {
    expect(normalizeDomain('https://www.youtube.com/watch?v=x')).toBe('youtube.com')
  })

  it('lowercases hostname', () => {
    expect(normalizeDomain('https://WWW.Example.COM')).toBe('example.com')
  })

  it('strips port', () => {
    expect(normalizeDomain('http://example.com:8080/path')).toBe('example.com')
  })

  it('returns null for non-http protocols', () => {
    expect(normalizeDomain('chrome://extensions')).toBeNull()
    expect(normalizeDomain('about:blank')).toBeNull()
    expect(normalizeDomain('file:///C:/doc.pdf')).toBeNull()
  })

  it('returns null for invalid input', () => {
    expect(normalizeDomain('not a url')).toBeNull()
    expect(normalizeDomain('')).toBeNull()
  })

  it('keeps nested subdomains for rule matching', () => {
    expect(normalizeDomain('https://music.youtube.com/')).toBe('music.youtube.com')
  })
})

describe('TabCache: chain-scoped last-known attribution', () => {
  it('keeps attributing a static tab far beyond a 10s window (long video)', () => {
    const cache = new TabCache()
    cache.update({ url: 'https://youtube.com/watch?v=x', title: 'Video', timestamp: 100 }, 5000)
    // 25 minutes later, still the same active browser window, no events
    expect(cache.getFresh(5000 + 25 * 60_000)?.domain).toBe('youtube.com')
  })

  it('invalidate() stops attribution for non-browser windows', () => {
    const cache = new TabCache()
    cache.update({ url: 'https://youtube.com/watch?v=x', title: 'Video', timestamp: 100 }, 5000)
    cache.invalidate()
    expect(cache.getFresh(6000)).toBeNull()
  })

  it('a fresh report re-arms attribution after invalidation', () => {
    const cache = new TabCache()
    cache.update({ url: 'https://youtube.com/x', title: 'YT', timestamp: 0 }, 1000)
    cache.invalidate()
    cache.update({ url: 'https://github.com/x', title: 'GH', timestamp: 0 }, 2000)
    expect(cache.getFresh(3000)?.domain).toBe('github.com')
  })

  it('hard age cap still guards against zombie reports', () => {
    const cache = new TabCache()
    cache.update({ url: 'https://github.com/x', title: 'GitHub', timestamp: 100 }, 5000)
    expect(cache.getFresh(5000 + TAB_MAX_AGE_MS)).not.toBeNull()
    expect(cache.getFresh(5000 + TAB_MAX_AGE_MS + 1)).toBeNull()
  })

  it('uses the last report received', () => {
    const cache = new TabCache()
    cache.update({ url: 'https://github.com/x', title: 'GitHub', timestamp: 100 }, 1000)
    cache.update({ url: 'https://youtube.com/x', title: 'YT', timestamp: 200 }, 2000)
    expect(cache.getFresh(3000)?.domain).toBe('youtube.com')
  })

  it('empty cache returns null safely', () => {
    expect(new TabCache().getFresh(Date.now())).toBeNull()
  })

  it('skips non-http reports entirely', () => {
    const cache = new TabCache()
    cache.update({ url: 'chrome://newtab', title: 'New Tab', timestamp: 0 }, 1000)
    expect(cache.getFresh(1100)).toBeNull()
  })
})
