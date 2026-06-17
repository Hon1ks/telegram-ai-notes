type LogFields = Record<string, string | number | boolean | undefined>;

export function logInfo(event: string, fields: LogFields = {}): void {
  console.log(JSON.stringify({ level: 'info', event, ...fields }));
}

export function logError(event: string, fields: LogFields = {}): void {
  console.error(JSON.stringify({ level: 'error', event, ...fields }));
}

export function errorKind(err: unknown): string {
  if (err instanceof Error) return err.name;
  return 'UnknownError';
}