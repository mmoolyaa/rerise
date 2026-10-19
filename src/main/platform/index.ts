import type { PlatformProvider } from './types'
import { WindowsPlatform } from './windows'

export function getProvider(): PlatformProvider {
  // Only Windows for now, macOS/Linux in phase 8
  return new WindowsPlatform()
}

export type { PlatformProvider, ActiveWindow } from './types'
