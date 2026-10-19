import { randomBytes } from 'crypto'
import { getSetting, upsertSetting } from '../db'

export const EXTENSION_TOKEN_KEY = 'extension_token'
export const EXTENSION_PORT_KEY = 'extension_port'

/** Token is generated once and shown in the dashboard for pairing. */
export function getOrCreateToken(): string {
  let token = getSetting(EXTENSION_TOKEN_KEY)
  if (!token) {
    token = randomBytes(24).toString('hex')
    upsertSetting(EXTENSION_TOKEN_KEY, token)
  }
  return token
}
