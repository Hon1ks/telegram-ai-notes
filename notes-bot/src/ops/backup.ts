import type { Env } from '../types';
import { logService, errorKind } from '../util/logger';

const BACKUP_TABLES = [
  'users',
  'folders',
  'categories',
  'notes',
  'processed_updates',
] as const;

export interface BackupResult {
  prefix: string;
  tables: number;
  rows: number;
}

export async function backupD1ToR2(env: Env): Promise<BackupResult | null> {
  if (!env.BACKUP_BUCKET) {
    logService('info', 'backup', 'backup_skipped', { outcome: 'skipped', reason: 'no_bucket' });
    return null;
  }

  const started = Date.now();
  const date = new Date().toISOString().slice(0, 10);
  const prefix = `d1-backups/${date}/${Date.now()}`;
  let totalRows = 0;

  try {
    for (const table of BACKUP_TABLES) {
      const result = await env.NOTES_DB
        .prepare(`SELECT * FROM ${table}`)
        .all<Record<string, unknown>>();

      totalRows += result.results.length;

      await env.BACKUP_BUCKET.put(
        `${prefix}/${table}.json`,
        JSON.stringify(result.results),
        { httpMetadata: { contentType: 'application/json' } }
      );
    }

    await env.BACKUP_BUCKET.put(
      `${prefix}/manifest.json`,
      JSON.stringify({
        created_at: new Date().toISOString(),
        tables: BACKUP_TABLES,
        row_count: totalRows,
      }),
      { httpMetadata: { contentType: 'application/json' } }
    );

    logService('info', 'backup', 'backup_completed', {
      outcome: 'ok',
      duration_ms: Date.now() - started,
      tables: BACKUP_TABLES.length,
      rows: totalRows,
      prefix,
    });

    return { prefix, tables: BACKUP_TABLES.length, rows: totalRows };
  } catch (err) {
    logService('error', 'backup', 'backup_failed', {
      outcome: 'error',
      duration_ms: Date.now() - started,
      kind: errorKind(err),
    });
    throw err;
  }
}