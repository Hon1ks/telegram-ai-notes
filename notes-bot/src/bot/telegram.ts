import type { Env } from '../types';

const BASE = (token: string) => `https://api.telegram.org/bot${token}`;

async function call(token: string, method: string, body: object): Promise<unknown> {
  const res = await fetch(`${BASE(token)}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

export async function sendMessage(
  env: Env,
  chatId: number,
  text: string,
  extra: object = {}
): Promise<void> {
  await call(env.TELEGRAM_TOKEN, 'sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    ...extra,
  });
}

export async function editMessageText(
  env: Env,
  chatId: number,
  messageId: number,
  text: string,
  extra: object = {}
): Promise<void> {
  await call(env.TELEGRAM_TOKEN, 'editMessageText', {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: 'HTML',
    ...extra,
  });
}

export async function sendChatAction(
  env: Env,
  chatId: number,
  action: 'typing' | 'record_audio' | 'upload_audio'
): Promise<void> {
  await call(env.TELEGRAM_TOKEN, 'sendChatAction', {
    chat_id: chatId,
    action,
  });
}

export async function answerCallbackQuery(
  env: Env,
  callbackQueryId: string,
  text?: string
): Promise<void> {
  await call(env.TELEGRAM_TOKEN, 'answerCallbackQuery', {
    callback_query_id: callbackQueryId,
    ...(text ? { text } : {}),
  });
}

export async function getFileUrl(env: Env, fileId: string): Promise<string> {
  const res = await call(env.TELEGRAM_TOKEN, 'getFile', { file_id: fileId }) as {
    ok: boolean;
    result: { file_path: string };
  };

  if (!res.ok) throw new Error('getFile failed');

  return `https://api.telegram.org/file/bot${env.TELEGRAM_TOKEN}/${res.result.file_path}`;
}

export async function downloadFile(env: Env, fileId: string): Promise<ArrayBuffer> {
  const url = await getFileUrl(env, fileId);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download file: ${res.status}`);
  return res.arrayBuffer();
}
