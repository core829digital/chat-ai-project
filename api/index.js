// Punto di ingresso per Vercel: tutte le richieste arrivano qui (vedi vercel.json)
// e vengono gestite dalla stessa applicazione usata in locale con "npm start".
//
// Attenzione: su Vercel il database SQLite vive in /tmp, che è temporanea.
// All'avvio di ogni istanza vengono ricreati l'assistente demo della landing e,
// se ADMIN_PASSWORD è impostata, l'amministratore. Registrazioni e conversazioni
// NON sono permanenti finché non si collega un database esterno (vedi README).
import { openDb } from '../src/db.js';
import { seedDatabase } from '../src/seed.js';
import { createApp } from '../src/server.js';

openDb();
seedDatabase({ admin: 'env-only', sampleClients: process.env.SEED_SAMPLE_CLIENTS === '1' });

const app = createApp();

export default function handler(req, res) {
  return app(req, res);
}
