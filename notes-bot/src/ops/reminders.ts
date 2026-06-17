import type { Env } from '../types';
import { getDueReminders, clearReminder } from '../db/queries';
import { sendMessage } from '../bot/telegram';
import { escapeHtml } from '../bot/html';
import { logService, errorKind } from '../util/logger';

export interface ReminderRunResult {
  sent: number;
  failed: number;
}

export async function processDueReminders(env: Env): Promise<ReminderRunResult> {
  const due = await getDueReminders(env);
  let sent = 0;
  let failed = 0;

  for (const reminder of due) {
    const chatId = Number(reminder.telegram_id);
    if (!Number.isFinite(chatId)) {
      failed += 1;
      continue;
    }

    try {
      await sendMessage(
        env,
        chatId,
        `⏰ <b>Напоминание</b>\n\n${escapeHtml(reminder.text.slice(0, 500))}`
      );
      await clearReminder(env, reminder.note_id, reminder.user_id);
      sent += 1;
    } catch (err) {
      failed += 1;
      logService('error', 'reminders', 'reminder_send_failed', {
        noteId: reminder.note_id,
        userId: reminder.user_id,
        outcome: 'error',
        kind: errorKind(err),
      });
    }
  }

  logService('info', 'reminders', 'reminders_processed', {
    due: due.length,
    sent,
    failed,
    outcome: failed > 0 ? 'partial' : 'ok',
  });

  return { sent, failed };
}