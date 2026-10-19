import { contextBridge, ipcRenderer } from 'electron'

type SummaryReply = import('../main/ipc').SummaryReply
type SessionsReply = import('../main/ipc').SessionsReply
type RangeSummaryReply = import('../main/ipc').RangeSummaryReply
type RulesReply = import('../main/ipc').RulesReply
type RuleRequest = import('../main/ipc').RuleRequest
type ThemeState = import('../main/theme').ThemeState

export interface RendererAPI {
  getTodaySummary: () => Promise<SummaryReply>
  getRangeSummary: (days: number) => Promise<RangeSummaryReply>
  getSessionsToday: () => Promise<SessionsReply>
  getTrackingState: () => Promise<string>
  pauseTracking: () => void
  resumeTracking: () => void
  setStoreTitles: (enabled: boolean) => Promise<void>
  getStoreTitles: () => Promise<boolean>
  getExtensionPairing: () => Promise<{ token: string; port: number }>

  // auto-start on login
  getAutoStart: () => Promise<boolean>
  setAutoStart: (enabled: boolean) => Promise<void>

  // theme
  getTheme: () => Promise<ThemeState>
  setTheme: (theme: 'system' | 'dark' | 'light') => Promise<void>
  onThemeChanged: (callback: (state: ThemeState) => void) => () => void

  getRules: () => Promise<RulesReply>
  saveRule: (rule: RuleRequest) => Promise<{ id: number }>
  deleteRule: (id: number) => Promise<void>
  recategorizeAll: () => Promise<{ updated: number }>
  setSessionCategory: (sessionId: number, categoryId: number | null) => Promise<void>

  getGeneralSettings: () => Promise<{
    idleThresholdSeconds: number
    excludedApps: string[]
    excludedDomains: string[]
    storeTitles: boolean
    pairing: { token: string; port: number }
  }>
  setIdleThreshold: (seconds: number) => Promise<void>
  setExcluded: (apps: string[], domains: string[]) => Promise<void>

  exportData: (format: 'csv' | 'json') => Promise<{ savedPath: string | null }>
  deleteAllData: () => Promise<{ ok: boolean }>

  onTrackingStateChanged: (callback: (state: string) => void) => () => void
}

const api = {
  getTodaySummary: () => ipcRenderer.invoke('tempo:getTodaySummary'),
  getRangeSummary: (days: number) => ipcRenderer.invoke('tempo:getRangeSummary', days),
  getSessionsToday: () => ipcRenderer.invoke('tempo:getSessionsToday'),
  getTrackingState: () => ipcRenderer.invoke('tempo:getTrackingState'),
  pauseTracking: () => ipcRenderer.send('tempo:pauseTracking'),
  resumeTracking: () => ipcRenderer.send('tempo:resumeTracking'),
  setStoreTitles: (enabled: boolean) => ipcRenderer.invoke('tempo:setStoreTitles', enabled),
  getStoreTitles: () => ipcRenderer.invoke('tempo:getStoreTitles'),
  getExtensionPairing: () => ipcRenderer.invoke('tempo:getExtensionPairing'),

  getAutoStart: () => ipcRenderer.invoke('tempo:getAutoStart'),
  setAutoStart: (enabled: boolean) => ipcRenderer.invoke('tempo:setAutoStart', enabled),

  getTheme: () => ipcRenderer.invoke('tempo:getTheme'),
  setTheme: (theme: 'system' | 'dark' | 'light') => ipcRenderer.invoke('tempo:setTheme', theme),
  onThemeChanged: (callback: (state: ThemeState) => void) => {
    const handler = (_event: unknown, state: ThemeState) => callback(state)
    ipcRenderer.on('tempo:theme-changed', handler)
    return () => ipcRenderer.removeListener('tempo:theme-changed', handler)
  },

  getRules: () => ipcRenderer.invoke('tempo:getRules'),
  saveRule: (rule: unknown) => ipcRenderer.invoke('tempo:saveRule', rule),
  deleteRule: (id: number) => ipcRenderer.invoke('tempo:deleteRule', id),
  recategorizeAll: () => ipcRenderer.invoke('tempo:recategorizeAll'),
  setSessionCategory: (sessionId: number, categoryId: number | null) =>
    ipcRenderer.invoke('tempo:setSessionCategory', sessionId, categoryId),

  getGeneralSettings: () => ipcRenderer.invoke('tempo:getGeneralSettings'),
  setIdleThreshold: (seconds: number) => ipcRenderer.invoke('tempo:setIdleThreshold', seconds),
  setExcluded: (apps: string[], domains: string[]) =>
    ipcRenderer.invoke('tempo:setExcluded', apps, domains),

  exportData: (format: 'csv' | 'json') => ipcRenderer.invoke('tempo:exportData', format),
  deleteAllData: () => ipcRenderer.invoke('tempo:deleteAllData'),

  onTrackingStateChanged: (callback: (state: string) => void) => {
    const handler = (_event: unknown, data: { state: string }) => callback(data.state)
    ipcRenderer.on('tempo:tracking-state-changed', handler)
    return () => ipcRenderer.removeListener('tempo:tracking-state-changed', handler)
  }
}

contextBridge.exposeInMainWorld('tempoAPI', api)
