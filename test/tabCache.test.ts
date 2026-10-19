import { describe, it, expect } from 'vitest'
import { normalizeDomain, TabCache, STALE_TAB_MS } from '../src/main/server/tabCache'

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

describe('TabCache staleness', () => {
  it('returns fresh data within threshold', () => {
    const cache = new TabCache()
    cache.update({ url: 'https://github.com/x', title: 'GitHub', timestamp: 100 }, 5000)
    expect(cache.getFresh(5000 + STALE_TAB_MS)).not.toBeNull()
  })

  it('never returns stale data', () => {
    const cache = new TabCache()
    cache.update({ url: 'https://github.com/x', title: 'GitHub', timestamp: 100 }, 5000)
    expect(cache.getFresh(5000 + STALE_TAB_MS + 1)).toBeNull()
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
