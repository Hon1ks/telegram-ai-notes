-- Run: npx wrangler d1 execute notes-bot-db --remote --file=./migrations/0003_categories.sql

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  emoji TEXT DEFAULT '📝',
  color TEXT DEFAULT '#8b5cf6',
  llm_hint TEXT,
  is_system INTEGER DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE(user_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_categories_user_id ON categories(user_id);
CREATE INDEX IF NOT EXISTS idx_categories_user_slug ON categories(user_id, slug);

INSERT INTO categories (user_id, slug, name, emoji, color, llm_hint, is_system, sort_order)
SELECT u.id, 'tasks', 'Задачи', '✅', '#3b82f6', 'задачи, дела, что нужно сделать', 1, 0
FROM users u
WHERE NOT EXISTS (SELECT 1 FROM categories c WHERE c.user_id = u.id AND c.slug = 'tasks');

INSERT INTO categories (user_id, slug, name, emoji, color, llm_hint, is_system, sort_order)
SELECT u.id, 'ideas', 'Идеи', '💡', '#f59e0b', 'идеи, мысли, планы', 1, 1
FROM users u
WHERE NOT EXISTS (SELECT 1 FROM categories c WHERE c.user_id = u.id AND c.slug = 'ideas');

INSERT INTO categories (user_id, slug, name, emoji, color, llm_hint, is_system, sort_order)
SELECT u.id, 'shopping', 'Покупки', '🛒', '#22c55e', 'покупки, что купить', 1, 2
FROM users u
WHERE NOT EXISTS (SELECT 1 FROM categories c WHERE c.user_id = u.id AND c.slug = 'shopping');

INSERT INTO categories (user_id, slug, name, emoji, color, llm_hint, is_system, sort_order)
SELECT u.id, 'notes', 'Заметки', '📝', '#8b5cf6', 'всё остальное', 1, 3
FROM users u
WHERE NOT EXISTS (SELECT 1 FROM categories c WHERE c.user_id = u.id AND c.slug = 'notes');