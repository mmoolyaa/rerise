import { Tray, Menu, BrowserWindow, nativeImage, app } from 'electron'
import type { Tracker } from './tracker/tracker'
import { getIconPath } from './appIcon'

let tray: Tray | null = null

export function createTray(window: BrowserWindow, tracker: Tracker) {
  // Tray icons must be raster on Windows; SVG never renders there.
  const icon = nativeImage.createFromPath(getIconPath()).resize({ width: 16, height: 16 })

  tray = new Tray(icon)

  const buildMenu = () => {
    const isPaused = tracker.getState() === 'PAUSED'

    const menu = Menu.buildFromTemplate([
      {
        label: 'Show Dashboard',
        click: () => {
          window.show()
          if (window.isMinimized()) window.restore()
          window.focus()
        }
      },
      {
        label: isPaused ? 'Resume Tracking' : 'Pause Tracking',
        click: () => {
          if (tracker.getState() === 'PAUSED') {
            tracker.resume()
          } else {
            tracker.pause()
          }
          buildMenu()
        }
      },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => app.quit()
      }
    ])
    tray?.setContextMenu(menu)
    tray?.setToolTip(`Tempo - tracking ${tracker.getState().toLowerCase()}`)
  }

  buildMenu()
  tracker.addStateListener((state) => {
    tray?.setToolTip(`Tempo - tracking ${state.toLowerCase()}`)
    buildMenu()
  })
}
