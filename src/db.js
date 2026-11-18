// Database SQLite integrato in Node (node:sqlite): nessuna dipendenza esterna.
// In produzione si può sostituire con PostgreSQL mantenendo le stesse funzioni in models.js.
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { config } from './config.js';

let db;

const SCHEMA = `
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

export function openDb(file = config.dbPath) {
  if (db) return db;
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec(SCHEMA);
  return db;
}

export function getDb() {
  if (!db) openDb();
  return db;
}

export function closeDb() {
  if (db) db.close();
  db = undefined;
}

// Esegue fn dentro una transazione; annulla tutto in caso di errore.
export function tx(fn) {
  const d = getDb();
  d.exec('BEGIN');
  try {
    const out = fn();
    d.exec('COMMIT');
    return out;
  } catch (err) {
    d.exec('ROLLBACK');
    throw err;
  }
}

// node:sqlite restituisce oggetti senza prototipo: li normalizziamo in oggetti semplici.
export const one = (sql, ...params) => {
  const row = getDb().prepare(sql).get(...params);
  return row ? { ...row } : undefined;
};
export const all = (sql, ...params) => getDb().prepare(sql).all(...params).map((r) => ({ ...r }));
export const run = (sql, ...params) => getDb().prepare(sql).run(...params);
