export interface ActiveWindow {
  appName: string
  exePath?: string
  title: string
  pid: number
}

export interface PlatformProvider {
  getActiveWindow(): Promise<ActiveWindow | null>
  isBrowser(appName: string): boolean
}
