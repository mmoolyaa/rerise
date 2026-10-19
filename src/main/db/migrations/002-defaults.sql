-- Default categories and rules for productivity tracking

-- Categories: productivity scale -2 (very distracting) to +2 (very productive)
INSERT INTO categories (id, name, productivity) VALUES
  (1, 'Coding', 2),
  (2, 'Docs & Writing', 2),
  (3, 'AI Research & Chatbots', 1),
  (4, 'YouTube', 1),
  (5, 'Design', 1),
  (6, 'Music', 0),
  (7, 'Communication', 0),
  (8, 'Uncategorized', 0),
  (9, 'Social Media', -2);

-- Rules: higher priority = matched first
-- Domain rules (high priority to override app rules)
INSERT INTO rules (match_type, pattern, category_id, priority) VALUES
  -- Music domain overrides YouTube
  ('domain', 'music.youtube.com', 6, 100),
  
  -- Productive domains
  ('domain', 'youtube.com', 4, 90),
  ('domain', 'claude.ai', 3, 90),
  ('domain', 'chatgpt.com', 3, 90),
  ('domain', 'gemini.google.com', 3, 90),
  ('domain', 'perplexity.ai', 3, 90),
  ('domain', 'docs.google.com', 2, 90),
  ('domain', 'notion.so', 2, 90),
  ('domain', 'github.com', 1, 90),
  
  -- Social media (distracting)
  ('domain', 'instagram.com', 9, 90),
  ('domain', 'tiktok.com', 9, 90),
  ('domain', 'threads.net', 9, 90),
  ('domain', 'x.com', 9, 90),
  ('domain', 'twitter.com', 9, 90),
  ('domain', 'facebook.com', 9, 90),
  ('domain', 'reddit.com', 9, 90),
  
  -- Music
  ('domain', 'spotify.com', 6, 90),
  
  -- App-based rules (lower priority)
  ('app', 'Code.exe', 1, 50),
  ('app', 'devenv.exe', 1, 50),
  ('app', 'WindowsTerminal.exe', 1, 50),
  ('app', 'powershell.exe', 1, 50),
  ('app', 'cmd.exe', 1, 50),
  ('app', 'Obsidian.exe', 2, 50),
  ('app', 'WINWORD.EXE', 2, 50),
  ('app', 'Figma.exe', 5, 50),
  ('app', 'Spotify.exe', 6, 50),
  ('app', 'Slack.exe', 7, 50),
  ('app', 'Discord.exe', 7, 50),
  ('app', 'brave.exe', 8, 30),
  ('app', 'chrome.exe', 8, 30),
  ('app', 'msedge.exe', 8, 30);
