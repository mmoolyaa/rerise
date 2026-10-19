import * as http from 'http'
import { upsertSetting } from '../db'
import { getOrCreateToken } from './token'
import { TabCache, type CachedTab } from './tabCache'

export const DEFAULT_PORT = 47321
const EXTENSION_PORT_KEY = 'extension_port'

const cache = new TabCache()

/** Pairing info for the dashboard UI (token + actually bound port). */
let currentPairing = { token: '', port: 0 }
export function getPairing(): { token: string; port: number } {
  return currentPairing
}

/**
 * Localhost-only HTTP server for the browser extension.
 * - binds 127.0.0.1 only
 * - all /tab requests need Authorization: Bearer <token>
 * - handles CORS preflight (OPTIONS) for the extension origin
 * Returns the actually bound port (falls back if the default is taken).
 */
export function startExtensionServer(): Promise<{ port: number; getFreshTab: (now: number) => CachedTab | null }> {
  const token = getOrCreateToken()

  function createHandler(): http.RequestListener {
    return (req, res) => {
      // CORS: generic echo of origin; extension service workers send chrome-extension://<id>
      const origin = req.headers.origin ?? '*'
      res.setHeader('Access-Control-Allow-Origin', origin)
      res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
      res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
      res.setHeader('Vary', 'Origin')

      if (req.method === 'OPTIONS') {
        res.writeHead(204)
        res.end()
        return
      }

      if (req.method !== 'POST' || !req.url?.startsWith('/tab')) {
        res.writeHead(404, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'not found' }))
        return
      }

      // Token check - reject before reading body
      const auth = req.headers.authorization ?? ''
      if (auth !== `Bearer ${token}`) {
        res.writeHead(401, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'unauthorized' }))
        return
      }

      let body = ''
      req.on('data', (chunk) => {
        body += chunk
        if (body.length > 64_000) req.destroy() // hard cap body size
      })

      req.on('end', () => {
        try {
          const report = JSON.parse(body)
          if (
            typeof report.url !== 'string' ||
            typeof report.title !== 'string' ||
            typeof report.timestamp !== 'number'
          ) {
            res.writeHead(400, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: 'invalid payload' }))
            return
          }
          const cached = cache.update(report, Date.now())
          console.log(`[extension] tab: ${cached?.domain ?? '(n/a)'}`)
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ ok: true }))
        } catch {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'bad json' }))
        }
      })
    }
  }

  return new Promise((resolve) => {
    let port = DEFAULT_PORT

    const tryListen = (attemptsLeft: number) => {
      const server = http.createServer(createHandler())

      server.on('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE' && attemptsLeft > 0) {
          port += 1
          tryListen(attemptsLeft - 1)
        } else {
          console.error('Extension server failed to start:', err.message)
          // Still resolve with getFreshTab so nothing crashes - just no data
          resolve({ port: 0, getFreshTab: () => null })
        }
      })

      // Bind localhost only - never expose to the network
      server.listen(port, '127.0.0.1', () => {
        console.log(`Extension server listening on 127.0.0.1:${port}`)
        upsertPort(port)
        currentPairing = { token, port }
        resolve({ port, getFreshTab: (now) => cache.getFresh(now) })
      })
    }

    tryListen(5)
  })
}

function upsertPort(port: number) {
  upsertSetting(EXTENSION_PORT_KEY, String(port))
}
