import { env } from 'cloudflare:test';
import { beforeAll } from 'vitest';
import schema from '../src/db/schema.sql?raw';

let schemaReady: Promise<void> | null = null;

function splitSqlStatements(sql: string): string[] {
  return sql
    .split(';')
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0 && !statement.startsWith('--'));
}

async function ensureFtsTable(): Promise<void> {
  const ftsStatements = [
    `CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
      text,
      tags,
      content=notes,
      content_rowid=id
    )`,
    'CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(text, tags)',
  ];

  for (const statement of ftsStatements) {
    try {
      await env.NOTES_DB.prepare(statement).run();
      return;
    } catch {
      // Try the simpler FTS schema used by some local D1 runtimes.
    }
  }

  await env.NOTES_DB
    .prepare('CREATE TABLE IF NOT EXISTS notes_fts (rowid INTEGER PRIMARY KEY, text TEXT, tags TEXT)')
    .run();
}

export function ensureTestSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      for (const statement of splitSqlStatements(schema)) {
        if (statement.includes('notes_fts')) continue;
        await env.NOTES_DB.prepare(statement).run();
      }
      await ensureFtsTable();
    })();
  }
  return schemaReady;
}

beforeAll(async () => {
  await ensureTestSchema();
});