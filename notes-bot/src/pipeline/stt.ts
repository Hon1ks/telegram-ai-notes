import type { Env } from '../types';
import { downloadFile } from '../bot/telegram';
import { consumeUsage, UsageCapExceeded } from '../util/usageCap';
import { timed } from '../util/logger';

/**
 * Transcribes a Telegram voice message using Groq Whisper API.
 * Same request format as OpenAI — accepts .ogg directly, no conversion needed.
 */
export async function transcribeVoice(
  env: Env,
  fileId: string,
  userId?: number
): Promise<string> {
  if (userId !== undefined && !(await consumeUsage(env, userId, 'stt'))) {
    throw new UsageCapExceeded('stt');
  }

  return timed('stt', 'stt_transcribe', async () => {
    const audioBuffer = await downloadFile(env, fileId);

    const formData = new FormData();
    formData.append('file', new Blob([audioBuffer], { type: 'audio/ogg' }), 'voice.ogg');
    formData.append('model', 'whisper-large-v3-turbo');
    formData.append('language', 'ru');

    const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.STT_API_KEY}`,
      },
      body: formData,
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`STT API error ${res.status}: ${err}`);
    }

    const data = await res.json() as { text: string };
    return data.text.trim();
  }, userId !== undefined ? { userId } : {});
}