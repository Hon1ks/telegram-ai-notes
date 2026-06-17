-- Phase 7: soft delete (trash) + reminders

ALTER TABLE notes ADD COLUMN deleted_at TIMESTAMP;
ALTER TABLE notes ADD COLUMN remind_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_notes_user_deleted_at
  ON notes(user_id, deleted_at);

CREATE INDEX IF NOT EXISTS idx_notes_remind_at
  ON notes(remind_at)
  WHERE remind_at IS NOT NULL AND deleted_at IS NULL;