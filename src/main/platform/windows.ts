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
    // active-win reports display names ('Brave Browser') OR exe names
    // ('brave.exe') depending on the window, so match loosely on browser
    // tokens and strip any .exe suffix first.
    const browserTokens = ['brave', 'chrome', 'msedge', 'edge', 'firefox', 'opera', 'vivaldi']
    const normalized = appName.toLowerCase().replace(/\.exe$/, '')
    return browserTokens.some((t) => normalized.includes(t))
  }
}
