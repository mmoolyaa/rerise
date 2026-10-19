-- Initial schema for Tempo
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
CREATE INDEX IF NOT EXISTS idx_rules_priority ON rules(priority DESC);
