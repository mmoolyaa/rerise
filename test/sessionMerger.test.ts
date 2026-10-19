import { describe, it, expect } from 'vitest'
import { shouldMergeSession, closeSession } from '../src/main/tracker/sessionMerger'
import type { TrackedSession } from '../src/main/tracker/types'

describe('sessionMerger', () => {
  describe('shouldMergeSession', () => {
    it('should merge when app and domain match', () => {
      const current: TrackedSession = {
        started_at: 1000,
        app_name: 'Code.exe',
        domain: undefined
      }
      
      expect(shouldMergeSession(current, 'Code.exe', undefined)).toBe(true)
    })
    
    it('should merge when app matches and both domains are undefined', () => {
      const current: TrackedSession = {
        started_at: 1000,
        app_name: 'Code.exe'
      }
      
      expect(shouldMergeSession(current, 'Code.exe', undefined)).toBe(true)
    })
    
    it('should not merge when app name differs', () => {
      const current: TrackedSession = {
        started_at: 1000,
        app_name: 'Code.exe'
      }
      
      expect(shouldMergeSession(current, 'brave.exe', undefined)).toBe(false)
    })
    
    it('should not merge when domain differs', () => {
      const current: TrackedSession = {
        started_at: 1000,
        app_name: 'brave.exe',
        domain: 'github.com'
      }
      
      expect(shouldMergeSession(current, 'brave.exe', 'youtube.com')).toBe(false)
    })
    
    it('should merge when browser app and domain both match', () => {
      const current: TrackedSession = {
        started_at: 1000,
        app_name: 'brave.exe',
        domain: 'github.com'
      }
      
      expect(shouldMergeSession(current, 'brave.exe', 'github.com')).toBe(true)
    })
  })
  
  describe('closeSession', () => {
    it('should return session when duration >= 3 seconds', () => {
      const tracked: TrackedSession = {
        started_at: 1000,
        app_name: 'Code.exe',
        window_title: 'main.ts'
      }
      
      const result = closeSession(tracked, 4000)
      
      expect(result).toEqual({
        started_at: 1000,
        ended_at: 4000,
        app_name: 'Code.exe',
        exe_path: undefined,
        window_title: 'main.ts',
        domain: undefined,
        url: undefined
      })
    })
    
    it('should discard session when duration < 3 seconds', () => {
      const tracked: TrackedSession = {
        started_at: 1000,
        app_name: 'Code.exe'
      }
      
      const result = closeSession(tracked, 3999)
      
      expect(result).toBeNull()
    })
    
    it('should accept session at exactly 3 seconds', () => {
      const tracked: TrackedSession = {
        started_at: 1000,
        app_name: 'Code.exe'
      }
      
      const result = closeSession(tracked, 4000)
      
      expect(result).not.toBeNull()
      expect(result?.ended_at).toBe(4000)
    })
    
    it('should preserve all session fields', () => {
      const tracked: TrackedSession = {
        started_at: 1000,
        app_name: 'brave.exe',
        exe_path: 'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
        window_title: 'GitHub - microsoft/vscode',
        domain: 'github.com',
        url: 'https://github.com/microsoft/vscode'
      }
      
      const result = closeSession(tracked, 10000)
      
      expect(result).toEqual({
        started_at: 1000,
        ended_at: 10000,
        app_name: 'brave.exe',
        exe_path: 'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
        window_title: 'GitHub - microsoft/vscode',
        domain: 'github.com',
        url: 'https://github.com/microsoft/vscode'
      })
    })
  })
})
