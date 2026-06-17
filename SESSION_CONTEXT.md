# Контекст сессии — AI Notes Bot

> Этот файл сохраняет ключевые решения и историю обсуждения, чтобы при новом чате (после перезагрузки ПК) агент мог быстро войти в контекст.  
> **Обновляй этот файл** после каждой значимой сессии работы над проектом.

**Последнее обновление:** 17 июня 2026 (Фаза 7 + dev:web превью)

---

## О проекте (кратко)

**Telegram AI Notes Bot + Mini App** — умный блокнот в Telegram.

- Пользователь пишет или надиктовывает заметку в боте
- Groq Whisper (STT) + StepFun LLM (OpenRouter) классифицируют
- Cloudflare Workers + D1 (SQLite) + FTS5
- React Mini App на Cloudflare Pages

**Стек:** TypeScript, Cloudflare Workers/D1/Pages, React 18 + Vite, Groq, OpenRouter.

**Статус:** v1.0 feature-complete на ветке `feature/mvp-hardening`. Осталось: smoke/e2e, миграция `0004`, деплой.

---

## История переписки (17.06.2026)

### Сообщение 1 — Анализ проекта

Пользователь попросил проанализировать проект, рассказать что это и высказать мнение.

**Выводы агента:**
- Качественный MVP с продуманной архитектурой (serverless, guard-фильтр для экономии LLM, security)
- Сильная сторона: голос + AI-классификация + Mini App
- Слабые места: in-memory rate limit, узкое покрытие тестами, нет пагинации в UI, FTS не в batch при create
- Активная работа по IMPROVEMENT_ROADMAP.md

### Сообщение 2 — Что улучшить?

Пользователь спросил, что бы я улучшил/исправил/доработал.

**Ответ:** составлен приоритизированный план из 7 фаз (см. [PRODUCT_PLAN.md](./PRODUCT_PLAN.md)).

**Уточнение цели:** выпуск **полного готового продукта** (не только стабильный MVP).

### Сообщение 3 — Кастомные категории

Пользователь указал: кастомные категории **нужны** (в первоначальном плане они были в «не трогать»).

**Решение:** кастомные категории — **обязательная фича v1.0**, фаза 3 плана:
- Таблица `categories` per user
- CRUD API `/api/categories`
- Динамический LLM prompt
- CategoryManager в Mini App
- 4 системные категории по умолчанию (можно переименовать, нельзя удалить)

### Сообщение 4 — Сохранить план и переписку

Пользователь попросил сохранить план и контекст переписки (чат теряется при перезагрузке ПК).

**Сделано:**
- [PRODUCT_PLAN.md](./PRODUCT_PLAN.md) — полный план доработки
- [SESSION_CONTEXT.md](./SESSION_CONTEXT.md) — этот файл

---

## Ключевые решения (зафиксировано)

| Решение | Детали |
|---------|--------|
| Цель | Полный готовый продукт, не pet-проект |
| Кастомные категории | Must-have v1.0 |
| Приоритет фаз | Блокеры → категории → UX → ops → напоминания/экспорт |
| Семантический поиск | Отложить |
| Микросервисы | Не нужны, Worker-монолит ок |

---

## Текущие открытые задачи

См. чеклист в [PRODUCT_PLAN.md](./PRODUCT_PLAN.md). Все 7 фаз кода готовы. Следующий шаг — **smoke/e2e** из `SMOKE_TEST.md` и production-деплой.

**Перед production-деплоем:** применить миграцию `0004_phase7.sql` на remote D1 (`wrangler d1 migrations apply notes-bot-db`).

---

## Как восстановить контекст в новом чате

Напиши агенту:

```
Прочитай SESSION_CONTEXT.md и PRODUCT_PLAN.md в корне репозитория.
Мы работаем над AI Notes Bot, ветка feature/mvp-hardening.
Продолжи с [укажи фазу/задачу].
```

Или добавь в `.cursor/rules` (User Rules):

```
Перед работой над проектом читай SESSION_CONTEXT.md и PRODUCT_PLAN.md.
```

---

## Альтернативы сохранению контекста

1. **Файлы в репозитории** (рекомендуется) — `SESSION_CONTEXT.md` + `PRODUCT_PLAN.md`, коммит в git
2. **Cursor User Rules** — краткая инструкция «читай SESSION_CONTEXT.md»
3. **IMPROVEMENT_ROADMAP.md** — детальный чеклист P0–P3 (уже есть, дополняет план)
4. **Git-ветки и коммиты** — каждая фаза = отдельная ветка с понятными сообщениями
5. **Новый чат + @ файлы** — прикрепи `SESSION_CONTEXT.md` в первом сообщении

> У агента нет памяти между сессиями автоматически. Файлы в репо — самый надёжный способ.

---

## Шаблон для следующих сессий

```markdown
### 17.06.2026 — Фаза 1: блокеры запуска

**Сделано:**
- Async webhook через `ctx.waitUntil` — Telegram получает `200 OK` сразу
- Fallback: при сбое LLM заметка сохраняется как `notes` с предупреждением
- `createNote`/`updateNote` — атомарный batch с FTS
- Миграция `0002_fts_backfill.sql`
- Cron cleanup `processed_updates` (7 дней)
- KV rate limit (с fallback на memory; KV — после `wrangler login`)
- Тесты: webhook async, FTS create, cleanup; D1 schema setup

**Следующий шаг:** Фаза 3 — кастомные категории

### 17.06.2026 — Фаза 2: API и integration тесты

**Сделано:**
- `test/helpers/` — auth, apiFetch, fetch mocks
- `test/api-notes.spec.ts` — CRUD, фильтры, поиск, изоляция
- `test/api-folders.spec.ts` — CRUD, reorder, изоляция
- `test/integration.spec.ts` — mock LLM/Telegram/Groq, webhook text/voice/fallback
- 40 тестов проходят

**Следующий шаг:** Фаза 3 — кастомные категории

### 17.06.2026 — Фаза 3: кастомные категории

**Сделано:**
- Таблица `categories`, миграция `0003_categories.sql`, seed для существующих users
- CRUD API `/api/categories` (лимит 20, системные нельзя удалить)
- Динамический LLM prompt и parser с валидацией slug
- `CategoryManager` в Mini App, динамические FilterBar/NoteComposer/NoteCard/NoteList
- `api-categories.spec.ts` — 7 тестов; всего **47/47** тестов проходят
- Mini App build успешен

**Следующий шаг:** Фаза 4 — Mini App UX

### 17.06.2026 — Фаза 4: Mini App UX

**Сделано:**
- `NoteEditor` — полное редактирование (текст, категория, папка, теги)
- Пагинация (limit/offset, infinite scroll)
- Поиск с активными фильтрами (категория, тег, папка)
- Undo при удалении (toast + восстановление через createNote)
- Pull-to-refresh в списке заметок
- Тёмная тема: `--divider` через `color-mix`, адаптивные баннеры
- Safe area insets, aria-label на ключевых элементах
- CI fix: `package-lock.json` добавлен в репозиторий

**Следующий шаг:** Фаза 5 — UX Telegram-бота

### 17.06.2026 — Фаза 5: UX Telegram-бота

**Сделано:**
- Кнопки «Отменить» / «Mini App» / «Переместить» после сохранения
- Undo последнего сохранения через inline callback
- Подтверждение STT-текста перед сохранением (Сохранить / Отменить)
- Inline перемещение: категория → папка
- `bot/processNote.ts`, `bot/actions.ts`, `bot/session.ts`
- 48/48 тестов (STT confirm + undo integration)

**Следующий шаг:** Фаза 6 — эксплуатация и CI/CD

### 17.06.2026 — Фаза 6: эксплуатация и CI/CD

**Сделано:**
- Structured logs: `logService`, `timed()` с `service`/`outcome`/`duration_ms`
- D1 backup → R2 (`ops/backup.ts`), cron вместе с cleanup; `RESTORE.md`
- Staging env в `wrangler.jsonc`, `migrations_dir`
- ESLint + `npm run lint` в CI; deploy workflow на `main`
- Per-user daily cap: LLM 50, STT 20 (`usageCap.ts`)
- 51/51 тестов

**Ручные шаги в Cloudflare:** создать R2 `notes-bot-backups`, staging D1, secrets для deploy

**Следующий шаг:** Фаза 7 — напоминания, экспорт, корзина

### 17.06.2026 — Фаза 7: напоминания, экспорт, корзина

**Сделано:**
- Миграция `0004_phase7.sql`: `deleted_at`, `remind_at` на `notes`
- Корзина: soft delete API, `?trash=1`, restore, permanent delete, purge 30 дней
- Экспорт: `GET /api/export?format=json|md`
- Напоминания: `remind_at` в API, cron `*/15 * * * *`, `ops/reminders.ts`
- Mini App: корзина (🗑), экспорт (⬇), напоминание в `NoteEditor`
- Тесты: `api-trash`, `api-export`, `api-reminders`, `trash-queries` — **63/63**

**Следующий шаг:** smoke/e2e, `wrangler d1 migrations apply`, деплой

### 17.06.2026 — Dev-превью Mini App в браузере

**Сделано:**
- `npm run dev:web` / `gen:auth` — Mini App без Telegram (`46a42b4`)
- Мок `Telegram.WebApp` + прокси `/api` → `localhost:8787`
- Корневой `package.json`: `dev:api`, `dev:web`, `gen:auth`
- Тёмная тема и phone-frame в dev-превью (локально, не в prod build)

**Заметка:** локальная D1 пустая — заметок нет; для 1:1 с prod открывать через бота или указать production `VITE_API_URL`.

**Следующий шаг:** smoke/e2e, деплой

### [Дата] — [Тема сессии]

**Сделано:**
- ...

**Решения:**
- ...

**Следующий шаг:**
- ...
```

Добавляй новые блоки выше в раздел «История переписки».