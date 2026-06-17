-- Run: npx wrangler d1 execute notes-bot-db --remote --file=./migrations/0002_fts_backfill.sql
-- Rebuild FTS index from existing notes (safe to run multiple times).

DELETE FROM notes_fts;

INSERT INTO notes_fts(rowid, text, tags)
SELECT
  n.id,
  n.text,
  COALESCE(
    (SELECT group_concat(value, ' ') FROM json_each(n.tags)),
    ''
  )
FROM notes n;