# 📋 План разработки: Telegram AI Notes Bot + Mini App

---

## Стек технологий

| Слой | Технология |
|------|-----------|
| Backend | Cloudflare Workers (TypeScript) |
| Database | Cloudflare D1 (SQLite) |
| Frontend | React + Vite + TypeScript |
| Hosting (frontend) | Cloudflare Pages |
| STT | OpenAI Whisper API |
| LLM | OpenRouter API |
| Bot Framework | Telegram Bot API (raw webhook) |

---

## Структура проекта

```
telegram-ai-notes/
├── worker/                  # Cloudflare Worker
│   ├── src/
│   │   ├── index.ts         # Entry point, webhook router
│   │   ├── bot/
│   │   │   ├── handlers.ts  # Telegram message handlers
│   │   │   ├── onboarding.ts
│   │   │   └── keyboard.ts
│   │   ├── pipeline/
│   │   │   ├── stt.ts       # Speech-to-text
│   │   │   ├── guard.ts     # Guard фильтр
│   │   │   ├── llm.ts       # LLM обработка (split + classify)
│   │   │   └── parser.ts    # JSON парсер с retry
│   │   ├── db/
│   │   │   ├── schema.sql
│   │   │   └── queries.ts   # D1 запросы
│   │   └── api/
│   │       ├── notes.ts     # REST API для Mini App
│   │       └── folders.ts
│   ├── wrangler.toml
│   └── package.json
│
└── miniapp/                 # React Mini App
    ├── src/
    │   ├── App.tsx
    │   ├── api/             # Клиент для worker API
    │   ├── components/
    │   │   ├── NoteList.tsx
    │   │   ├── NoteCard.tsx
    │   │   ├── FilterBar.tsx
    │   │   └── FolderManager.tsx
    │   └── pages/
    │       ├── Notes.tsx
    │       └── Folders.tsx
    ├── vite.config.ts
    └── package.json
```

---

## Фазы разработки

---

### Фаза 1 — Инфраструктура и база данных

**Задачи:**
- [ ] Создать Cloudflare Worker проект (`wrangler init`)
- [ ] Создать Cloudflare D1 базу данных
- [ ] Написать `schema.sql` и применить миграцию

```sql
-- schema.sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  telegram_id TEXT UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE folders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  name TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  folder_id INTEGER,
  type TEXT,
  text TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

- [ ] Настроить `wrangler.toml` (D1 binding, переменные окружения)
- [ ] Добавить переменные окружения: `TELEGRAM_TOKEN`, `OPENROUTER_API_KEY`, `STT_API_KEY`
- [ ] Зарегистрировать webhook: `setWebhook`

**Результат:** Worker запущен, база создана, webhook принимает запросы.

---

### Фаза 2 — Telegram Bot (базовый)

**Задачи:**
- [ ] `index.ts` — роутер входящих запросов по типу (message, callback_query)
- [ ] Команда `/start`:
  - приветственное сообщение
  - кнопки: `🚀 Начать настройку` / `⏭ Пропустить`
- [ ] Онбординг — Вариант 1 (быстрый):
  - создать дефолтные папки: `разработка`, `дом`, `покупки`, `личное`
- [ ] Онбординг — Вариант 2 (ручной):
  - пошаговый ввод названий папок через FSM-состояния (хранить state в D1 или KV)
- [ ] `sendChatAction("typing")` / `sendChatAction("record_audio")` при обработке

**Результат:** Бот отвечает на `/start`, создаёт папки пользователю.

---

### Фаза 3 — Pipeline обработки заметок

#### 3.1 Guard-фильтр (`guard.ts`)

```typescript
// BEFORE LLM — дешёвый фильтр
function cheapGuard(text: string): boolean {
  if (text.includes('?')) return false;   // вопрос
  if (text.trim().length < 5) return false; // слишком короткое
  return true;
}

// LLM Guard — отправить текст в LLM, ожидать { "ignore": true/false }
async function llmGuard(text: string): Promise<boolean>
```

#### 3.2 STT (`stt.ts`)

```typescript
// Поток:
// 1. Получить file_id из Telegram message
// 2. getFile → file_path
// 3. Скачать .ogg (без конвертации)
// 4. Отправить multipart/form-data в Whisper API
// 5. Вернуть text
async function transcribeVoice(fileId: string, token: string): Promise<string>
```

- Требования: русский язык, ≤ 5 секунд

#### 3.3 LLM обработка (`llm.ts`)

**Этап 1 — Разбиение:**
```
Вход: "Купить молоко и проверить сервер"
Выход: ["Купить молоко", "проверить сервер"]
```

**Этап 2 — Классификация:**
```json
{
  "items": [
    { "text": "Купить молоко", "type": "shopping", "category": "покупки" },
    { "text": "проверить сервер", "type": "tasks", "category": "задачи" }
  ]
}
```

Категории: `tasks`, `ideas`, `shopping`, `notes`

#### 3.4 Парсер с retry (`parser.ts`)

```typescript
async function parseWithRetry(llmFn: () => Promise<string>): Promise<NoteItem[]> {
  try {
    const raw = await llmFn();
    return JSON.parse(raw).items;
  } catch {
    // retry с промптом "Ты вернул невалидный JSON. Исправь формат"
    try {
      const raw2 = await retryLlm();
      return JSON.parse(raw2).items;
    } catch {
      // fallback
      return [{ text: originalText, type: 'notes', category: 'notes' }];
    }
  }
}
```

**Задачи:**
- [ ] Реализовать `stt.ts`
- [ ] Реализовать `guard.ts` (cheap + LLM)
- [ ] Реализовать `llm.ts` (split + classify, temperature=0, strict JSON)
- [ ] Реализовать `parser.ts` (retry + fallback)
- [ ] Связать pipeline в `handlers.ts`

**Результат:** Голосовые и текстовые заметки полностью обрабатываются и сохраняются в D1.

---

### Фаза 4 — Ответ пользователю и UX

**Задачи:**
- [ ] Форматировать ответ в виде:
  ```
  🧠 Разобрал:

  Покупки:
  - молоко

  Задачи:
  - проверить сервер
  ```
- [ ] `sendChatAction` перед каждым этапом обработки
- [ ] Ограничение длины ответа (обрезка + "...")
- [ ] Обработка ошибок API (Telegram, STT, LLM) с понятными сообщениями

**Результат:** Пользователь получает структурированный ответ, UX плавный.

---

### Фаза 5 — REST API для Mini App (`api/`)

**Эндпоинты:**

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/notes` | Список заметок (с фильтром по type/folder) |
| POST | `/notes` | Создать заметку |
| DELETE | `/notes/:id` | Удалить заметку |
| GET | `/folders` | Список папок |
| POST | `/folders` | Создать папку |
| PUT | `/folders/:id` | Редактировать папку |
| DELETE | `/folders/:id` | Удалить папку |

**Задачи:**
- [ ] Реализовать роутинг в `index.ts` (разделить webhook от `/api/*`)
- [ ] Авторизация по `telegram_id` из Telegram WebApp `initData`
- [ ] Реализовать `notes.ts` и `folders.ts`
- [ ] CORS заголовки для Cloudflare Pages домена

**Результат:** API работает, готово к подключению Mini App.

---

### Фаза 6 — Mini App (React + Vite)

**Задачи:**
- [ ] Инициализировать проект (`npm create vite@latest miniapp -- --template react-ts`)
- [ ] Подключить Telegram WebApp SDK (`@twa-dev/sdk`)
- [ ] Настроить `vite.config.ts` для Cloudflare Pages

**Компоненты:**

- [ ] `FilterBar` — фильтры: Все / Задачи / Покупки / Идеи
- [ ] `NoteCard` — карточка заметки с чекбоксом
  - тап → редактирование (inline или модалка)
  - свайп → удаление
  - чекбокс → отметить выполненным
- [ ] `NoteList` — список с виртуализацией (если много заметок)
- [ ] `FolderManager` — создание, редактирование, удаление, reorder папок
- [ ] `api/client.ts` — fetch-клиент к Worker API с авторизацией

**Развёртывание:**
- [ ] Подключить Cloudflare Pages к репозиторию
- [ ] Настроить переменную `VITE_API_URL` = URL воркера

**Результат:** Mini App открывается в Telegram, показывает заметки, работают все действия.

---

### Фаза 7 — Тестирование и деплой MVP

**Задачи:**
- [ ] End-to-end тест: голос → текст → категории → DB → Mini App
- [ ] Проверить лимиты Cloudflare Workers (CPU time ≤ 50ms для free tier, учесть внешние fetch)
- [ ] Проверить задержку STT ≤ 5 секунд
- [ ] Задеплоить Worker: `wrangler deploy`
- [ ] Задеплоить Mini App: `wrangler pages deploy dist`
- [ ] Зарегистрировать Mini App в BotFather (`/newapp`)

**MVP критерии:**
- [ ] voice → text работает
- [ ] text → категории работает
- [ ] заметки сохраняются в D1
- [ ] Mini App отображает заметки
- [ ] базовые папки создаются при онбординге

---

## Порядок разработки (рекомендуемый)

```
Фаза 1 (инфраструктура)
    ↓
Фаза 2 (бот + онбординг)
    ↓
Фаза 3 (pipeline: STT → Guard → LLM → DB)
    ↓
Фаза 4 (UX ответов)
    ↓
Фаза 5 (REST API)
    ↓
Фаза 6 (Mini App)
    ↓
Фаза 7 (тесты + деплой)
```

---

## Переменные окружения (wrangler.toml)

```toml
name = "telegram-ai-notes"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[[d1_databases]]
binding = "DB"
database_name = "notes-db"
database_id = "<your-d1-id>"

[vars]
# Секреты добавлять через: wrangler secret put <KEY>
# TELEGRAM_TOKEN
# OPENROUTER_API_KEY
# STT_API_KEY
```

---

## Дальнейшее развитие (post-MVP)

- Поиск по заметкам (full-text search в D1)
- Теги (#работа, #личное)
- Напоминания (Cloudflare Cron Triggers)
- Экспорт данных (JSON / Markdown)
- Аналитика использования
