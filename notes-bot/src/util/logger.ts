type LogFields = Record<string, string | number | boolean | undefined>;

export type ServiceName = 'webhook' | 'api' | 'llm' | 'stt' | 'cron' | 'backup';

export type Outcome = 'ok' | 'error' | 'skipped';

export function logInfo(event: string, fields: LogFields = {}): void {
  console.log(JSON.stringify({ level: 'info', event, ...fields }));
}

export function logError(event: string, fields: LogFields = {}): void {
  console.error(JSON.stringify({ level: 'error', event, ...fields }));
}

export function logService(
  level: 'info' | 'error',
  service: ServiceName,
  event: string,
  fields: LogFields & { outcome?: Outcome; duration_ms?: number } = {}
): void {
  const payload = { level, service, event, ...fields };
  if (level === 'info') console.log(JSON.stringify(payload));
  else console.error(JSON.stringify(payload));
}

export async function timed<T>(
  service: ServiceName,
  event: string,
  fn: () => Promise<T>,
  extra: LogFields = {}
): Promise<T> {
  const started = Date.now();
  try {
    const result = await fn();
    logService('info', service, event, {
      ...extra,
      outcome: 'ok',
      duration_ms: Date.now() - started,
    });
    return result;
  } catch (err) {
    logService('error', service, event, {
      ...extra,
      outcome: 'error',
      duration_ms: Date.now() - started,
      kind: errorKind(err),
    });
    throw err;
  }
}

export function errorKind(err: unknown): string {
  if (err instanceof Error) return err.name;
  return 'UnknownError';
}