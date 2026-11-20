// Prepara il database locale con: amministratore, assistente demo della landing page
// e alcuni clienti di esempio con conversazioni realistiche.
// Uso: npm run seed            (aggiunge solo ciò che manca)
//      npm run seed -- --reset (cancella il database e ricomincia)
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../src/config.js';
import { closeDb, openDb, one } from '../src/db.js';
import { seedDatabase } from '../src/seed.js';

const reset = process.argv.includes('--reset');
if (reset) {
  for (const suffix of ['', '-wal', '-shm']) fs.rmSync(config.dbPath + suffix, { force: true });
  console.log('Database cancellato.');
}
await openDb();

const credFile = path.join(path.dirname(config.dbPath), 'credenziali-demo.txt');
const lines = await seedDatabase({ admin: 'auto', sampleClients: true });

if (lines.length) {
  fs.mkdirSync(path.dirname(credFile), { recursive: true });
  const header = `# Credenziali di prova generate da "npm run seed" il ${new Date().toISOString()}\n# File escluso da git (cartella data/). Non usare queste password in produzione.\n`;
  const existing = fs.existsSync(credFile) && !reset ? fs.readFileSync(credFile, 'utf8') : header;
  fs.writeFileSync(credFile, existing + lines.map((l) => `${l}\n`).join(''));
  console.log(`Fatto. Credenziali salvate in ${credFile}`);
} else {
  console.log('Niente da aggiungere: il database è già pronto.');
}
console.log(`Clienti: ${(await one('SELECT COUNT(*) AS n FROM accounts')).n} · Assistenti: ${(await one('SELECT COUNT(*) AS n FROM widgets')).n}`);
await closeDb();
