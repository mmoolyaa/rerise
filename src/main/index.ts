import { app, BrowserWindow, powerMonitor } from 'electron'
import { join } from 'path'
import { createTray } from './tray'
import { Tracker } from './tracker/tracker'
import { getDatabase, closeDatabase } from './db'
import { registerIpcHandlers } from './ipc'
import { startExtensionServer } from './server'
import { setupFileLogging } from './logging'
import { getIconPath } from './appIcon'
import { initTheme } from './theme'
import type { TrackingState } from './tracker/types'

let mainWindow: BrowserWindow | null = null
let tracker: Tracker | null = null

// Mirror console output to <userData>/logs/tempo.log
setupFileLogging()

// Catch uncaught errors
process.on('uncaughtException', (error) => {
  console.error('UNCAUGHT EXCEPTION:', error)
})

process.on('unhandledRejection', (reason) => {
  console.error('UNHANDLED REJECTION:', reason)
})

// Single instance lock
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    // Focus window if user tries to open second instance
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show()
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  app.whenReady().then(async () => {
    console.log('=== TEMPO APP READY ===')

    // Start tracking automatically after login - only for the PACKAGED app.
    // Dev runs must not repoint the startup registry entry at the dev electron.
    if (app.isPackaged) {
      app.setLoginItemSettings({ openAtLogin: true, path: process.execPath })
      console.log('Auto-start on login enabled (packaged)')
    }

    // Initialize database
    try {
    console.log('Initializing database...')
    getDatabase()
    console.log('Database initialized')
    } catch (error) {
      console.error('Database init failed:', error)
    }

    // Theme preference (system/dark/light) drives renderer class from now on
    initTheme()

    console.log('Creating window...')
    createWindow()

    // Localhost server for the browser extension
    const extension = await startExtensionServer()

    // Create tracker + register IPC handlers immediately so the renderer
    // never calls an unregistered channel; polling starts after a short delay.
    tracker = new Tracker()
    if (tracker) tracker.getFreshTab = (now) => extension.getFreshTab(now)

    // Renderer tracking-state indicator
    tracker.addStateListener((state) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('tempo:tracking-state-changed', { state })
      }
    })

    registerIpcHandlers(tracker)

    console.log('Creating tray...')
    if (mainWindow) createTray(mainWindow, tracker)

    console.log('Window and tray created, starting tracker in 2s...')
    setTimeout(() => {
      console.log('Starting tracker...')
      if (tracker) tracker.start()
    }, 2000)
  })
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    show: true, // Explicitly show window
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      // ESM preloads (.mjs) require sandbox: false - contextIsolation still
      // protects the renderer from the preload's Node access.
      sandbox: false,
      preload: join(__dirname, '../preload/index.mjs')
    },
    icon: getIconPath()
  })

  console.log('Window created, loading renderer...')

  // Closing the window hides it (tray keeps the app alive). Without this the
  // BrowserWindow is DESTROYED on close and "Show Dashboard" does nothing.
  mainWindow.on('close', (event) => {
    if (!(app as { quitting?: boolean }).quitting) {
      event.preventDefault()
      mainWindow?.hide()
      console.log('Window hidden to tray (not destroyed)')
    }
  })

  // Theme is applied reactively by the renderer via tempo:theme-changed;
  // nothing to patch here on load or on OS theme changes.

  // Load renderer
  if (process.env.VITE_DEV_SERVER_URL) {
    console.log('Loading dev server:', process.env.VITE_DEV_SERVER_URL)
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
    mainWindow.webContents.openDevTools()
  } else {
    console.log('Loading production renderer')
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow.webContents.on('did-finish-load', () => {
    console.log('Renderer loaded successfully')
  })

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Failed to load renderer:', errorCode, errorDescription)
  })
}

// Prevent app from quitting when window is closed (keep in tray)
app.on('window-all-closed', () => {
  // Don't quit, just hide window
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

// Cleanup on quit
app.on('before-quit', () => {
  console.log('App quitting - stopping tracker')
  // Let close events through so windows actually destroy on quit
  ;(app as { quitting?: boolean }).quitting = true
  if (tracker) {
    tracker.stop()
  }
  closeDatabase()
})

// Power monitor events
powerMonitor.on('lock-screen', () => {
  if (tracker) {
    tracker.handleLock()
  }
})

powerMonitor.on('unlock-screen', () => {
  if (tracker) {
    tracker.handleUnlock()
  }
})

powerMonitor.on('suspend', () => {
  if (tracker) {
    tracker.handleSuspend()
  }
})

powerMonitor.on('resume', () => {
  if (tracker) {
    tracker.handleResume()
  }
})
