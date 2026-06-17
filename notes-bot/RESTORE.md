# Восстановление D1 из R2-бэкапа

Бот ежедневно (03:00 UTC) сохраняет таблицы D1 в R2, если настроен `BACKUP_BUCKET`.

## Структура бэкапа

```
d1-backups/YYYY-MM-DD/<timestamp>/
  manifest.json
  users.json
  folders.json
  categories.json
  notes.json
  processed_updates.json
```

## Просмотр бэкапов

```powershell
npx wrangler r2 object list notes-bot-backups --prefix d1-backups/
```

Скачать файл:

```powershell
npx wrangler r2 object get notes-bot-backups d1-backups/2026-06-17/1718620800000/notes.json --file notes.json
```

## Восстановление (ручное)

> Перед восстановлением сделай свежий бэкап текущей базы.

1. Скачай JSON-файлы нужного бэкапа из R2.
2. На **пустой** или тестовой D1 очисти таблицы (или создай новую базу для staging).
3. Импортируй данные через скрипт или SQL.

Пример вставки заметок из JSON (Node/powershell — адаптируй под свой скрипт):

```sql
-- Очистка (только на staging / после бэкапа!)
DELETE FROM notes_fts;
DELETE FROM notes;
DELETE FROM folders;
DELETE FROM categories;
DELETE FROM users;
DELETE FROM processed_updates;
```

Затем для каждой строки из `notes.json` выполни `INSERT` с сохранением `id`, либо используй `wrangler d1 execute` с подготовленным SQL.

## Staging

```powershell
# Создать staging D1
npx wrangler d1 create notes-bot-db-staging

# Применить миграции
npx wrangler d1 migrations apply notes-bot-db-staging --env staging

# Деплой staging worker
npx wrangler deploy --env staging
```

Подставь `database_id` staging-базы в `wrangler.jsonc` → `env.staging.d1_databases`.

## Миграции (production)

```powershell
npx wrangler d1 migrations apply notes-bot-db --remote
```

Или по файлу:

```powershell
npx wrangler d1 execute notes-bot-db --remote --file=./migrations/0003_categories.sql
```