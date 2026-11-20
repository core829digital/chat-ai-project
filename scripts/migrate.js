// Applica le migrazioni in /migrations a Neon Postgres, in ordine, una volta sola ciascuna.
// Usa la connessione DIRETTA (DATABASE_URL_UNPOOLED): le migrazioni non passano dal pooler,
// come raccomanda Neon. Ogni file viene applicato in una transazione.
// Uso: npm run migrate        (legge le variabili da .env.local)
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';

const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!url) {
  console.error('Manca DATABASE_URL_UNPOOLED (o DATABASE_URL). Esegui "neon env pull" oppure usa npm run migrate.');
  process.exit(1);
}
if (/-pooler\./.test(url) && process.env.DATABASE_URL_UNPOOLED === undefined) {
  console.warn('Attenzione: stai migrando sulla connessione pooled. Preferisci DATABASE_URL_UNPOOLED.');
}

const dir = path.resolve('migrations');
const files = fs.readdirSync(dir).filter((f) => /^\d+_.*\.sql$/.test(f)).sort();
const client = new pg.Client({ connectionString: url.replace('sslmode=require', 'sslmode=verify-full') });
await client.connect();
try {
  await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);
  const done = new Set((await client.query('SELECT name FROM schema_migrations')).rows.map((r) => r.name));
  let applied = 0;
  for (const file of files) {
    if (done.has(file)) continue;
    const sql = fs.readFileSync(path.join(dir, file), 'utf8');
    process.stdout.write(`Applico ${file}… `);
    await client.query('BEGIN');
    try {
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
      await client.query('COMMIT');
      console.log('ok');
      applied++;
    } catch (err) {
      await client.query('ROLLBACK');
      console.log('ERRORE');
      throw err;
    }
  }
  console.log(applied ? `${applied} migrazioni applicate.` : 'Database già aggiornato: nessuna migrazione da applicare.');
} finally {
  await client.end();
}
