// Livello dati con due motori dietro la stessa interfaccia asincrona:
//  - Neon Postgres quando DATABASE_URL è impostata (produzione, Vercel)
//  - SQLite integrato in Node (node:sqlite) in locale e nei test, senza servizi esterni
// Le query si scrivono una volta sola, con segnaposto "?" e datetime('now'):
// per Postgres vengono tradotte in $1, $2… e nell'orario UTC equivalente.
import fs from 'node:fs';
import path from 'node:path';
import { AsyncLocalStorage } from 'node:async_hooks';
import { config } from './config.js';

export const dialect = process.env.DATABASE_URL ? 'postgres' : 'sqlite';

// Le date restano testo 'YYYY-MM-DD HH:MM:SS' in UTC su entrambi i motori:
// stessi confronti, stessi formati, nessuna sorpresa con i fusi orari.
const PG_NOW = "to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS')";

const SQLITE_SCHEMA = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS accounts (
  id            INTEGER PRIMARY KEY,
  name          TEXT NOT NULL,
  plan          TEXT NOT NULL DEFAULT 'pro',
  status        TEXT NOT NULL DEFAULT 'trial',
  sector        TEXT NOT NULL DEFAULT 'generico',
  trial_ends_at TEXT,
  notes         TEXT NOT NULL DEFAULT '',
  created_by    TEXT NOT NULL DEFAULT 'self',
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name          TEXT NOT NULL DEFAULT '',
  password_hash TEXT,
  role          TEXT NOT NULL CHECK (role IN ('admin','client')),
  account_id    INTEGER REFERENCES accounts(id) ON DELETE CASCADE,
  last_login_at TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash       TEXT PRIMARY KEY,
  user_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  impersonator_id  INTEGER REFERENCES users(id) ON DELETE CASCADE,
  expires_at       TEXT NOT NULL,
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS invites (
  token_hash  TEXT PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at  TEXT NOT NULL,
  used_at     TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS widgets (
  id              INTEGER PRIMARY KEY,
  public_id       TEXT NOT NULL UNIQUE,
  account_id      INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  site_url        TEXT NOT NULL DEFAULT '',
  allowed_domains TEXT NOT NULL DEFAULT '[]',
  settings        TEXT NOT NULL DEFAULT '{}',
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused')),
  last_seen_at    TEXT,
  last_seen_url   TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS knowledge (
  id          INTEGER PRIMARY KEY,
  widget_id   INTEGER NOT NULL REFERENCES widgets(id) ON DELETE CASCADE,
  question    TEXT NOT NULL,
  answer      TEXT NOT NULL,
  keywords    TEXT NOT NULL DEFAULT '',
  hits        INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS conversations (
  id            INTEGER PRIMARY KEY,
  public_id     TEXT NOT NULL UNIQUE,
  widget_id     INTEGER NOT NULL REFERENCES widgets(id) ON DELETE CASCADE,
  visitor_id    TEXT NOT NULL,
  page_url      TEXT NOT NULL DEFAULT '',
  is_test       INTEGER NOT NULL DEFAULT 0,
  message_count INTEGER NOT NULL DEFAULT 0,
  unanswered    INTEGER NOT NULL DEFAULT 0,
  has_lead      INTEGER NOT NULL DEFAULT 0,
  started_at    TEXT NOT NULL DEFAULT (datetime('now')),
  last_at       TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS messages (
  id              INTEGER PRIMARY KEY,
  conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role            TEXT NOT NULL CHECK (role IN ('visitor','bot')),
  body            TEXT NOT NULL,
  knowledge_id    INTEGER REFERENCES knowledge(id) ON DELETE SET NULL,
  outcome         TEXT NOT NULL DEFAULT '',
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS leads (
  id              INTEGER PRIMARY KEY,
  widget_id       INTEGER NOT NULL REFERENCES widgets(id) ON DELETE CASCADE,
  conversation_id INTEGER REFERENCES conversations(id) ON DELETE SET NULL,
  name            TEXT NOT NULL DEFAULT '',
  email           TEXT NOT NULL DEFAULT '',
  phone           TEXT NOT NULL DEFAULT '',
  message         TEXT NOT NULL DEFAULT '',
  status          TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','contacted','closed')),
  is_test         INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_widgets_account ON widgets(account_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_widget ON knowledge(widget_id);
CREATE INDEX IF NOT EXISTS idx_conv_widget ON conversations(widget_id, started_at);
CREATE INDEX IF NOT EXISTS idx_msg_conv ON messages(conversation_id, id);
CREATE INDEX IF NOT EXISTS idx_leads_widget ON leads(widget_id, created_at);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
`;

let sqlite;
let pool;
const txStore = new AsyncLocalStorage();

// ---------------- Apertura ----------------
export async function openDb() {
  if (dialect === 'postgres') {
    if (pool) return;
    const pg = (await import('pg')).default;
    // COUNT/SUM arrivano da Postgres come testo (int8/numeric): li riportiamo a numeri.
    pg.types.setTypeParser(20, (v) => Number.parseInt(v, 10));
    pg.types.setTypeParser(1700, (v) => Number.parseFloat(v));
    pool = new pg.Pool({
      // Connessione "pooled" (PgBouncer) per il traffico dell'app, come raccomanda Neon.
      // verify-full mantiene i controlli TLS di sslmode=require ed evita l'avviso del driver.
      connectionString: process.env.DATABASE_URL.replace('sslmode=require', 'sslmode=verify-full'),
      max: config.onVercel ? 5 : 10,
      idleTimeoutMillis: 30_000,
    });
    // Un errore su una connessione inattiva (es. compute sospeso per inattività) non deve far cadere l'app.
    pool.on('error', (err) => console.error('[db] connessione inattiva chiusa:', err.message));
    if (config.onVercel) {
      // Vercel Fluid compute: chiude le connessioni inattive prima che la funzione venga sospesa.
      const { attachDatabasePool } = await import('@vercel/functions');
      attachDatabasePool(pool);
    }
    return;
  }
  if (sqlite) return;
  const { DatabaseSync } = await import('node:sqlite');
  if (config.dbPath !== ':memory:') fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });
  sqlite = new DatabaseSync(config.dbPath);
  sqlite.exec('PRAGMA journal_mode = WAL;');
  sqlite.exec(SQLITE_SCHEMA);
}

export async function closeDb() {
  if (pool) await pool.end();
  if (sqlite) sqlite.close();
  pool = undefined;
  sqlite = undefined;
}

// ---------------- Esecuzione ----------------
const toPg = (sql) => {
  let i = 0;
  return sql.replaceAll("datetime('now')", PG_NOW).replace(/\?/g, () => `$${++i}`);
};

async function exec(sql, params) {
  if (dialect === 'postgres') {
    if (!pool) await openDb();
    const client = txStore.getStore() || pool;
    const res = await client.query(toPg(sql), params);
    return { rows: res.rows, changes: res.rowCount };
  }
  if (!sqlite) await openDb();
  const stmt = sqlite.prepare(sql);
  if (/^\s*(select|with)\b/i.test(sql) || /\breturning\b/i.test(sql)) {
    return { rows: stmt.all(...params).map((r) => ({ ...r })), changes: 0 };
  }
  const r = stmt.run(...params);
  return { rows: [], changes: Number(r.changes), lastId: Number(r.lastInsertRowid) };
}

export const one = async (sql, ...params) => (await exec(sql, params)).rows[0];
export const all = async (sql, ...params) => (await exec(sql, params)).rows;
export const run = async (sql, ...params) => exec(sql, params);

// INSERT che restituisce l'id della riga creata, su entrambi i motori.
export async function insert(sql, ...params) {
  if (dialect === 'postgres') return (await exec(`${sql} RETURNING id`, params)).rows[0].id;
  return (await exec(sql, params)).lastId;
}

// Transazione: tutte le query dentro fn usano la stessa connessione.
let sqliteLock = Promise.resolve();
export async function tx(fn) {
  if (dialect === 'postgres') {
    if (!pool) await openDb();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const out = await txStore.run(client, fn);
      await client.query('COMMIT');
      return out;
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }
  if (!sqlite) await openDb();
  // SQLite ha una sola connessione: le transazioni si mettono in fila.
  const previous = sqliteLock;
  let release;
  sqliteLock = new Promise((r) => { release = r; });
  await previous;
  try {
    sqlite.exec('BEGIN');
    const out = await fn();
    sqlite.exec('COMMIT');
    return out;
  } catch (err) {
    sqlite.exec('ROLLBACK');
    throw err;
  } finally {
    release();
  }
}

// Per le migrazioni e i controlli di salute.
export async function rawPool() {
  if (dialect !== 'postgres') return null;
  if (!pool) await openDb();
  return pool;
}
