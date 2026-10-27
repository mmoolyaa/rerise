import activeWin from 'active-win'
import type { PlatformProvider, ActiveWindow } from './types'

export class WindowsPlatform implements PlatformProvider {
  async getActiveWindow(): Promise<ActiveWindow | null> {
    try {
      const win = await activeWin()
      
      if (!win) return null
      
      return {
        appName: win.owner.name,
        exePath: win.owner.path,
        title: win.title,
        pid: win.owner.processId
      }
    } catch (error) {
      console.error('Error getting active window:', error)
      return null
    }
  }
  
  isBrowser(appName: string): boolean {
    // active-win reports display names ('Brave Browser', 'ego (lite)') OR exe
    // names ('brave.exe') depending on the window, so match tokens at word
    // start: the name begins with the token, or the token follows a separator.
    // Plain substring matching is too loose for short tokens (e.g. 'ego').
    const browserTokens = [
      'brave', 'chrome', 'chromium', 'msedge', 'edge', 'firefox', 'waterfox',
      'opera', 'vivaldi', 'zen', 'thorium', 'librewolf', 'floorp',
      'whale', 'ecosia', 'duckduckgo', 'ego'
    ]
    const normalized = appName.toLowerCase().replace(/\.exe$/, '').replace(/_/g, ' ')
    return browserTokens.some(
      (t) => normalized.startsWith(t) || normalized.includes(` ${t}`)
    )
  }
}
