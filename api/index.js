// Punto di ingresso per Vercel: tutte le richieste arrivano qui (vedi vercel.json)
// e vengono gestite dalla stessa applicazione usata in locale con "npm start".
//
// Con DATABASE_URL (Neon Postgres) i dati sono permanenti; senza, si usa SQLite in /tmp,
// che è temporanea (solo per dimostrazioni). All'avvio vengono creati, se mancano,
// l'assistente demo della landing e, se ADMIN_PASSWORD è impostata, l'amministratore.
import { openDb } from '../src/db.js';
import { seedDatabase } from '../src/seed.js';
import { createApp } from '../src/server.js';

await openDb();
await seedDatabase({ admin: 'env-only', sampleClients: process.env.SEED_SAMPLE_CLIENTS === '1' });

const app = createApp();

export default function handler(req, res) {
  return app(req, res);
}
