import { app } from 'electron'
import { appendFileSync, mkdirSync, renameSync, statSync, existsSync } from 'fs'
import { join } from 'path'

/**
 * Minimal file logger: mirrors console output into <userData>/logs/tempo.log
 * so a tray-hidden packaged app stays debuggable. Size-capped with a single
 * .1 backup file.
 */
const MAX_LOG_BYTES = 512 * 1024

let logFile: string | null = null

function timestamp(): string {
  return new Date().toISOString()
}

function append(line: string): void {
  try {
    if (!logFile) return
    if (existsSync(logFile) && statSync(logFile).size > MAX_LOG_BYTES) {
      renameSync(logFile, logFile + '.1')
    }
    appendFileSync(logFile, line)
  } catch {
    // Logging must never crash the app
  }
}

function write(level: string, args: unknown[]): void {
  append(`${timestamp()} [${level}] ${args.map((a) => String(a)).join(' ')}\n`)
}

export function setupFileLogging(): void {
  const dir = join(app.getPath('userData'), 'logs')
  try {
    mkdirSync(dir, { recursive: true })
    logFile = join(dir, 'tempo.log')
  } catch (err) {
    console.error('file logging unavailable:', err)
    return
  }

  const orig = {
    log: console.log.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console)
  }
  console.log = (...args: unknown[]) => { orig.log(...args); write('info', args) }
  console.warn = (...args: unknown[]) => { orig.warn(...args); write('warn', args) }
  console.error = (...args: unknown[]) => { orig.error(...args); write('error', args) }

  console.log(`logging to ${logFile}`)
}
