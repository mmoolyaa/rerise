// Embedded migrations - no file I/O needed

// Default categories + rules, shared by migration 2 and "Reset to defaults".
// Canonical model: exactly 3 categories on a -2..+2 productivity scale.
//   8 = Neutral (0), 9 = Unproductive (-2), 10 = Productive (+2)
// Unmatched activity falls back to id 8 (Neutral).
export const DEFAULT_SEED_SQL = `-- Default categories and rules for productivity tracking

INSERT INTO categories (id, name, productivity) VALUES
  (8, 'Neutral', 0),
  (9, 'Unproductive', -2),
  (10, 'Productive', 2);

INSERT INTO rules (match_type, pattern, category_id, priority) VALUES
  -- Music overrides YouTube's productive default
  ('domain', 'music.youtube.com', 8, 100),

  -- Productive domains
  ('domain', 'docs.google.com', 10, 90),
  ('domain', 'mail.google.com', 10, 90),
  ('domain', 'notion.so', 10, 90),
  ('domain', 'github.com', 10, 90),
  ('domain', 'chatgpt.com', 10, 90),
  ('domain', 'claude.ai', 10, 90),
  ('domain', 'gemini.google.com', 10, 90),
  ('domain', 'perplexity.ai', 10, 90),
  ('domain', 'youtube.com', 10, 90),

  -- Neutral domains
  ('domain', 'google.com', 8, 90),
  ('domain', 'spotify.com', 8, 90),

  -- Unproductive domains
  ('domain', 'instagram.com', 9, 90),
  ('domain', 'tiktok.com', 9, 90),
  ('domain', 'threads.net', 9, 90),
  ('domain', 'x.com', 9, 90),
  ('domain', 'twitter.com', 9, 90),
  ('domain', 'facebook.com', 9, 90),
  ('domain', 'reddit.com', 9, 90),
  ('domain', 'pinterest.com', 9, 90),
  ('domain', 'netflix.com', 9, 90),

  -- App-based rules
  ('app', 'Code.exe', 10, 50),
  ('app', 'devenv.exe', 10, 50),
  ('app', 'Obsidian.exe', 10, 50),
  ('app', 'WINWORD.EXE', 10, 50),
  ('app', 'Figma.exe', 10, 50),
  ('app', 'WindowsTerminal.exe', 8, 50),
  ('app', 'powershell.exe', 8, 50),
  ('app', 'cmd.exe', 8, 50),
  ('app', 'Spotify.exe', 8, 50),
  ('app', 'Slack.exe', 8, 50),
  ('app', 'Discord.exe', 8, 50),
  ('app', 'Windows Explorer', 8, 40),
  ('app', 'Task Switching', 8, 40),
  ('app', 'brave.exe', 8, 30),
  ('app', 'chrome.exe', 8, 30),
  ('app', 'msedge.exe', 8, 30);`

// Migration 3: consolidate to the 3-category model.
// Old categories (1-9) are mapped onto Productive/Neutral/Unproductive by their
// old productivity value, then removed. Rules are replaced with the new defaults.
// Ids 8 and 9 are reused; 10 is new.
export const MIGRATION3_SQL = `
UPDATE categories SET name = 'Neutral' WHERE id = 8;
UPDATE categories SET name = 'Unproductive' WHERE id = 9;
INSERT OR IGNORE INTO categories (id, name, productivity) VALUES (10, 'Productive', 2);

-- Remap historical sessions by old category productivity (must run BEFORE
-- deleting old categories, since sessions FK is ON DELETE SET NULL)
UPDATE sessions
SET category_id = 10
WHERE category_id IS NOT NULL
  AND category_id NOT IN (8, 9, 10)
  AND category_id IN (SELECT id FROM categories WHERE productivity > 0);

UPDATE sessions
SET category_id = 9
WHERE category_id IS NOT NULL
  AND category_id NOT IN (8, 9, 10)
  AND category_id IN (SELECT id FROM categories WHERE productivity < 0);

UPDATE sessions
SET category_id = 8
WHERE category_id IS NULL
   OR category_id NOT IN (8, 9, 10);

DELETE FROM rules;
DELETE FROM categories WHERE id NOT IN (8, 9, 10);
DELETE FROM sqlite_sequence WHERE name = 'categories';

INSERT INTO rules (match_type, pattern, category_id, priority) VALUES
  ('domain', 'music.youtube.com', 8, 100),
  ('domain', 'docs.google.com', 10, 90),
  ('domain', 'mail.google.com', 10, 90),
  ('domain', 'notion.so', 10, 90),
  ('domain', 'github.com', 10, 90),
  ('domain', 'chatgpt.com', 10, 90),
  ('domain', 'claude.ai', 10, 90),
  ('domain', 'gemini.google.com', 10, 90),
  ('domain', 'perplexity.ai', 10, 90),
  ('domain', 'youtube.com', 10, 90),
  ('domain', 'google.com', 8, 90),
  ('domain', 'spotify.com', 8, 90),
  ('domain', 'instagram.com', 9, 90),
  ('domain', 'tiktok.com', 9, 90),
  ('domain', 'threads.net', 9, 90),
  ('domain', 'x.com', 9, 90),
  ('domain', 'twitter.com', 9, 90),
  ('domain', 'facebook.com', 9, 90),
  ('domain', 'reddit.com', 9, 90),
  ('domain', 'pinterest.com', 9, 90),
  ('domain', 'netflix.com', 9, 90),
  ('app', 'Code.exe', 10, 50),
  ('app', 'devenv.exe', 10, 50),
  ('app', 'Obsidian.exe', 10, 50),
  ('app', 'WINWORD.EXE', 10, 50),
  ('app', 'Figma.exe', 10, 50),
  ('app', 'WindowsTerminal.exe', 8, 50),
  ('app', 'powershell.exe', 8, 50),
  ('app', 'cmd.exe', 8, 50),
  ('app', 'Spotify.exe', 8, 50),
  ('app', 'Slack.exe', 8, 50),
  ('app', 'Discord.exe', 8, 50),
  ('app', 'Windows Explorer', 8, 40),
  ('app', 'Task Switching', 8, 40),
  ('app', 'brave.exe', 8, 30),
  ('app', 'chrome.exe', 8, 30),
  ('app', 'msedge.exe', 8, 30);`

export const migrations = {
  1: `-- Initial schema for Tempo
-- Timestamps stored as UTC unix milliseconds

CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  applied_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  productivity INTEGER NOT NULL CHECK(productivity >= -2 AND productivity <= 2)
);

CREATE TABLE IF NOT EXISTS rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  match_type TEXT NOT NULL CHECK(match_type IN ('app', 'domain', 'title_regex')),
  pattern TEXT NOT NULL,
  category_id INTEGER NOT NULL,
  priority INTEGER NOT NULL DEFAULT 50,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at INTEGER NOT NULL,
  ended_at INTEGER NOT NULL,
  app_name TEXT NOT NULL,
  exe_path TEXT,
  window_title TEXT,
  domain TEXT,
  url TEXT,
  category_id INTEGER,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_sessions_started_at ON sessions(started_at);
CREATE INDEX IF NOT EXISTS idx_sessions_category_id ON sessions(category_id);
CREATE INDEX IF NOT EXISTS idx_rules_priority ON rules(priority DESC);`,

  2: DEFAULT_SEED_SQL,

  3: MIGRATION3_SQL
}
