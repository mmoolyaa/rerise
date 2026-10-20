import { app, nativeTheme, BrowserWindow } from 'electron'
import { getSetting, upsertSetting } from './db'

export type ThemeSetting = 'system' | 'dark' | 'light'

export interface ThemeState {
  theme: ThemeSetting
  dark: boolean // effective - what the renderer should apply as its class
}

export interface ThemeStore {
  get: () => ThemeState
  set: (theme: ThemeSetting) => void
  init: () => void
}

const KEY = 'theme'

function setting(): ThemeSetting {
  const raw = getSetting(KEY)
  return raw === 'light' || raw === 'dark' || raw === 'system' ? raw : 'light'
}

function state(): ThemeState {
  const theme = setting()
  nativeTheme.themeSource = theme
  return { theme, dark: nativeTheme.shouldUseDarkColors }
}

function broadcast(): void {
  const s: ThemeState = { theme: setting(), dark: nativeTheme.shouldUseDarkColors }
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send('tempo:theme-changed', s)
  }
}

/** Applies themeSource so shouldUseDarkColors force-follows the setting. */
export function createThemeStore(): ThemeStore {
  return {
    get: () => {
      const theme = setting()
      // Reflect stored preference into nativeTheme (idempotent)
      nativeTheme.themeSource = theme
      return { theme, dark: nativeTheme.shouldUseDarkColors }
    },
    set: (theme) => {
      upsertSetting(KEY, theme)
      nativeTheme.themeSource = theme
      console.log(`theme set to ${theme} (dark=${nativeTheme.shouldUseDarkColors})`)
      broadcast()
    },
    init: () => {
      const theme = setting()
      nativeTheme.themeSource = theme
      console.log(`theme initialized to ${theme}`)
      // Fires when the effective colors change, e.g. OS switch while set to 'system'
      nativeTheme.on('updated', broadcast)
    }
  }
}

export function initTheme(): void {
  createThemeStore().init()
}
