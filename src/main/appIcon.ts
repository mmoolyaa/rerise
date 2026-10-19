import { app } from 'electron'
import { join } from 'path'

/**
 * App icon path.
 * - dev:  <project>/resources/icon.png (app.getAppPath() = project root)
 * - prod: bundled via extraResources into <install>/resources/
 * Windows tray/window icons must be raster; SVG never renders there.
 */
export function getIconPath(): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, 'resources', 'icon.png')
  }
  return join(app.getAppPath(), 'resources', 'icon.png')
}
