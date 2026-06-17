-- Run: npx wrangler d1 execute notes-bot-db --remote --file=./migrations/0001_add_folder_category.sql

ALTER TABLE folders ADD COLUMN category TEXT;

CREATE TABLE IF NOT EXISTS processed_updates (
  update_id INTEGER PRIMARY KEY,
  processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_processed_updates_at
  ON processed_updates(processed_at);