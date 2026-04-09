export interface Env {
  NOTES_DB: D1Database;
  TELEGRAM_TOKEN: string;
  OPENROUTER_API_KEY: string;
  STT_API_KEY: string;
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

export type NoteType = 'tasks' | 'ideas' | 'shopping' | 'notes';

export interface NoteItem {
  text: string;
  type: NoteType;
  category: string;
  tags: string[];
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
