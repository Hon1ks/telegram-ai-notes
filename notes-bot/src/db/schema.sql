CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  telegram_id TEXT UNIQUE NOT NULL,
  state TEXT DEFAULT 'idle',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS folders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  category TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS processed_updates (
  update_id INTEGER PRIMARY KEY,
  processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  folder_id INTEGER,
  type TEXT NOT NULL DEFAULT 'notes',
  text TEXT NOT NULL,
  tags TEXT DEFAULT '[]',
  done INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (folder_id) REFERENCES folders(id)
);

-- Full-text search
CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
  text,
  tags,
  content=notes,
  content_rowid=id
);

CREATE INDEX IF NOT EXISTS idx_folders_user_id
  ON folders(user_id);

CREATE INDEX IF NOT EXISTS idx_notes_user_created_at
  ON notes(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notes_user_folder
  ON notes(user_id, folder_id);

CREATE INDEX IF NOT EXISTS idx_notes_user_type
  ON notes(user_id, type);

CREATE INDEX IF NOT EXISTS idx_processed_updates_at
  ON processed_updates(processed_at);
