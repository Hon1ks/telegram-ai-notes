export interface Env {
  NOTES_DB: D1Database;
  RATE_LIMIT?: KVNamespace;
  TELEGRAM_TOKEN: string;
  TELEGRAM_WEBHOOK_SECRET?: string;
  OPENROUTER_API_KEY: string;
  STT_API_KEY: string;
  MINIAPP_ORIGIN?: string;
  MINIAPP_URL?: string;
  LLM_MODEL?: string;
  LLM_TIMEOUT_MS?: string;
}

// ─── Telegram Types ───────────────────────────────────────────────────────────

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
}

export interface TelegramMessage {
  message_id: number;
  from?: TelegramUser;
  chat: TelegramChat;
  date: number;
  text?: string;
  voice?: TelegramVoice;
}

export interface TelegramCallbackQuery {
  id: string;
  from: TelegramUser;
  message?: TelegramMessage;
  data?: string;
}

export interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  username?: string;
}

export interface TelegramChat {
  id: number;
  type: string;
}

export interface TelegramVoice {
  file_id: string;
  file_unique_id: string;
  duration: number;
  mime_type?: string;
  file_size?: number;
}

// ─── Notes / LLM Types ───────────────────────────────────────────────────────

export type NoteType = string;

export interface NoteItem {
  text: string;
  type: string;
  category: string;
  tags: string[];
}

export interface DbCategory {
  id: number;
  user_id: number;
  slug: string;
  name: string;
  emoji: string;
  color: string;
  llm_hint: string | null;
  is_system: number;
  sort_order: number;
  note_count?: number;
  created_at: string;
}

// ─── DB Types ────────────────────────────────────────────────────────────────

export interface DbUser {
  id: number;
  telegram_id: string;
  state: string;
  created_at: string;
}

export interface DbFolder {
  id: number;
  user_id: number;
  name: string;
  category: string | null;
  sort_order: number;
  note_count: number;
  created_at: string;
}

export interface DbNote {
  id: number;
  user_id: number;
  folder_id: number | null;
  type: string;
  text: string;
  tags: string; // JSON string: '["#работа","#личное"]'
  done: number;
  created_at: string;
}
