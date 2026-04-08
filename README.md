# 🧠 AI Notes Bot + Mini App

Telegram bot with AI-powered note classification and a web interface for managing notes.

**Features:**
- 🎤 Voice-to-text transcription (Groq Whisper API)
- 📝 Text notes support
- 🤖 Automatic classification into categories (tasks, shopping, ideas, notes)
- 📂 Organize by folders
- ⚡ Fast LLM processing (StepFun Step 3.5 Flash)
- 📱 React Mini App with swipe-to-delete, tap-to-edit
- ☁️ Serverless architecture (Cloudflare Workers + D1 + Pages)

---

## 🏗️ Architecture

```
Telegram → Cloudflare Worker → Groq STT + StepFun LLM → D1 Database
                                                             ↓
                                                      React Mini App
                                                  (Cloudflare Pages)
```

**Tech Stack:**
- **Backend:** Cloudflare Workers (TypeScript)
- **Database:** Cloudflare D1 (SQLite)
- **Frontend:** React 18 + Vite
- **Hosting:** Cloudflare Pages
- **STT:** Groq Whisper API
- **LLM:** OpenRouter (StepFun Step 3.5 Flash:free)

---

## 📂 Project Structure

```
.
├── notes-bot/              # Cloudflare Worker
│   ├── src/
│   │   ├── index.ts        # Webhook + API router
│   │   ├── types.ts        # TypeScript types
│   │   ├── db/             # D1 queries
│   │   ├── bot/            # Telegram handlers
│   │   ├── pipeline/       # STT, guard, LLM, parser
│   │   └── api/            # REST API endpoints
│   └── wrangler.jsonc      # D1 binding
│
├── miniapp/                # React Mini App
│   ├── src/
│   │   ├── App.tsx         # Main component
│   │   ├── api/            # API client
│   │   └── components/     # UI components
│   └── vite.config.ts
│
├── TT.md                   # Technical specification
└── plan.md                 # Development plan
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Cloudflare account
- Telegram bot (from [@BotFather](https://t.me/BotFather))
- API keys:
  - **Telegram Bot Token** - from @BotFather
  - **OpenRouter API Key** - from [openrouter.ai](https://openrouter.ai)
  - **Groq API Key** - from [groq.com](https://console.groq.com)

### 1. Deploy Worker

```bash
cd notes-bot

# Install dependencies
npm install

# Add secrets
npx wrangler secret put TELEGRAM_TOKEN
npx wrangler secret put OPENROUTER_API_KEY
npx wrangler secret put STT_API_KEY

# Deploy
npx wrangler deploy
```

### 2. Set Webhook

Replace `<TOKEN>` with your bot token:
```
https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://notes-bot-simple.goorbunoov95.workers.dev/webhook
```

### 3. Deploy Mini App

```bash
cd miniapp
npm install
npm run build
npx wrangler pages deploy dist --project-name notes-miniapp
```

### 4. Register Mini App in BotFather

```
/newapp
```

Select your bot and register:
- **Short Name:** `notes_app`
- **Description:** `Manage AI-powered notes`
- **URL:** `https://notes-miniapp.pages.dev`

---

## 📖 How It Works

### Telegram Bot Flow

1. **User sends voice/text** → Bot receives via webhook
2. **Voice → Text:** Groq Whisper API (STT)
3. **Guard Filter:** Check if it's actually a note (cheap filter + LLM)
4. **Classification:** StepFun LLM classifies into categories
5. **Storage:** Save to D1 database
6. **Response:** Show formatted summary to user

### REST API

- `GET /api/notes` — List notes (filters: `?type=tasks`, `?folder_id=1`)
- `POST /api/notes` — Create note
- `PUT /api/notes/:id` — Update note
- `DELETE /api/notes/:id` — Delete note
- `GET/POST/PUT/DELETE /api/folders` — Folder management

**Auth:** Telegram WebApp `initData` with HMAC-SHA256 validation

---

## 🎯 MVP Features

✅ Voice transcription (Groq)
✅ Text note processing
✅ AI classification
✅ Database persistence
✅ Mini App UI
✅ Folder management
✅ Note editing & deletion

---

## 🔮 Future Improvements

- [ ] Full-text search
- [ ] Tags (#work, #personal)
- [ ] Reminders & notifications
- [ ] Export notes (JSON, Markdown)
- [ ] Analytics dashboard
- [ ] Dark mode

---

## 📝 Environment Variables

### Worker (`notes-bot`)

```bash
TELEGRAM_TOKEN=      # Telegram bot token
OPENROUTER_API_KEY=  # OpenRouter API key
STT_API_KEY=         # Groq API key
```

### Mini App (`miniapp`)

```env
VITE_API_URL=https://notes-bot-simple.goorbunoov95.workers.dev
```

---

## 🛠️ Development

### Local Development

**Worker:**
```bash
cd notes-bot
npm run dev  # Runs on localhost:8787
```

**Mini App:**
```bash
cd miniapp
npm run dev  # Runs on localhost:5173
# Proxies /api to localhost:8787
```

### Database Management

```bash
# Execute SQL
npx wrangler d1 execute notes-bot-db --remote --command "SELECT * FROM notes LIMIT 10"

# Access local DB
npx wrangler d1 execute notes-bot-db --command "SELECT * FROM notes LIMIT 10"
```

---

## 📞 Support

For issues or questions:
- Check the `plan.md` for architecture details
- Review `TT.md` for requirements
- See `.claude/launch.json` for dev server configs

---

**Status:** MVP Ready ✅
**Last Updated:** April 8, 2026
