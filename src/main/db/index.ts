import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import type { Session, Category, Rule, Setting } from './types'
import { migrations, DEFAULT_SEED_SQL } from './migrations'

let db: Database.Database | null = null

export function getDatabase(): Database.Database {
  if (!db) {
    const dbPath = join(app.getPath('userData'), 'tempo.db')
    db = new Database(dbPath)
    
    // Enable foreign keys
    db.pragma('foreign_keys = ON')
    
    // Set busy timeout to 5 seconds
    db.pragma('busy_timeout = 5000')
    
    // Run migrations
    runMigrations(db)
  }
  
  return db
}

function runMigrations(database: Database.Database) {
  // Ensure schema_migrations table exists
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at INTEGER NOT NULL
    )
  `)
  
  // Get applied migrations
  const applied = new Set(
    database.prepare('SELECT version FROM schema_migrations').all().map((r: any) => r.version)
  )
  
  // Apply pending migrations in transaction
  for (const [versionStr, sql] of Object.entries(migrations)) {
    const version = parseInt(versionStr)
    
    if (applied.has(version)) continue
    
    database.transaction(() => {
      database.exec(sql)
      database.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(version, Date.now())
    })()
    
    console.log(`Applied migration ${version}`)
  }
}

// Query helpers
export function insertSession(session: Session): number {
  const db = getDatabase()
  const result = db.prepare(`
    INSERT INTO sessions (started_at, ended_at, app_name, exe_path, window_title, domain, url, category_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    session.started_at,
    session.ended_at,
    session.app_name,
    session.exe_path ?? null,
    session.window_title ?? null,
    session.domain ?? null,
    session.url ?? null,
    session.category_id ?? null
  )
  
  return result.lastInsertRowid as number
}

export function getSessionsInRange(startMs: number, endMs: number): Session[] {
  const db = getDatabase()
  return db.prepare(`
    SELECT * FROM sessions
    WHERE started_at >= ? AND started_at < ?
    ORDER BY started_at ASC
  `).all(startMs, endMs) as Session[]
}

export function getAllRules(): Rule[] {
  const db = getDatabase()
  return db.prepare('SELECT * FROM rules ORDER BY priority DESC').all() as Rule[]
}

export function getCategory(id: number): Category | undefined {
  const db = getDatabase()
  return db.prepare('SELECT * FROM categories WHERE id = ?').get(id) as Category | undefined
}

export function getAllCategories(): Category[] {
  const db = getDatabase()
  return db.prepare('SELECT * FROM categories').all() as Category[]
}

export function getSetting(key: string): string | undefined {
  const db = getDatabase()
  const result = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as Setting | undefined
  return result?.value
}

export function upsertSetting(key: string, value: string): void {
  const db = getDatabase()
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value)
}

export function closeDatabase(): void {
  if (db) {
    db.close()
    db = null
  }
}

// ---- Phase 6 additions ----

export function updateSessionCategory(sessionId: number, categoryId: number | null): void {
  const db = getDatabase()
  db.prepare('UPDATE sessions SET category_id = ? WHERE id = ?').run(categoryId, sessionId)
}

export function insertRule(rule: Omit<Rule, 'id'>): number {
  const db = getDatabase()
  const result = db
    .prepare('INSERT INTO rules (match_type, pattern, category_id, priority) VALUES (?, ?, ?, ?)')
    .run(rule.match_type, rule.pattern, rule.category_id, rule.priority)
  return result.lastInsertRowid as number
}

export function updateRule(id: number, rule: Omit<Rule, 'id'>): void {
  const db = getDatabase()
  db.prepare('UPDATE rules SET match_type = ?, pattern = ?, category_id = ?, priority = ? WHERE id = ?').run(
    rule.match_type,
    rule.pattern,
    rule.category_id,
    rule.priority,
    id
  )
}

export function deleteRule(id: number): void {
  const db = getDatabase()
  db.prepare('DELETE FROM rules WHERE id = ?').run(id)
}

export function deleteAllSessions(): void {
  const db = getDatabase()
  db.prepare('DELETE FROM sessions').run()
}

/** Wipes rules + categories and re-seeds the defaults (used by "Delete all data"). */
export function resetRulesToDefaults(): void {
  const db = getDatabase()
  db.transaction(() => {
    db.prepare('DELETE FROM rules').run()
    db.prepare('DELETE FROM categories').run()
    db.prepare('DELETE FROM sqlite_sequence WHERE name IN (?, ?)').run('rules', 'categories')
  })()
  db.exec(DEFAULT_SEED_SQL)
}
