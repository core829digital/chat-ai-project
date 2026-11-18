// Configurazione centrale. Tutto ciò che cambia tra ambienti arriva da variabili d'ambiente.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const config = {
  root,
  port: Number(process.env.PORT || 3000),
  baseUrl: (process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`).replace(/\/$/, ''),
  dbPath: process.env.DB_PATH || path.join(root, 'data', 'aperto.db'),
  production: process.env.NODE_ENV === 'production',
  brand: {
    name: 'Aperto',
    company: 'CORE829 S.r.l.',
    supportEmail: process.env.SUPPORT_EMAIL || 'supporto@aperto.example',
  },
  trialDays: 14,
  sessionDays: 30,
  inviteDays: 7,
};

// Piani commerciali, allineati allo studio di fattibilità (prezzi IVA esclusa).
export const PLANS = {
  start: { id: 'start', name: 'Start', price: 29, widgets: 1, conversations: 500, branding: true },
  pro: { id: 'pro', name: 'Pro', price: 79, widgets: 3, conversations: 2000, branding: false },
  business: { id: 'business', name: 'Business', price: 199, widgets: 10, conversations: 6000, branding: false },
  agency: { id: 'agency', name: 'Agency', price: 349, widgets: 25, conversations: 10000, branding: false },
};

export const PLAN_IDS = Object.keys(PLANS);

export const ACCOUNT_STATUS = {
  trial: 'In prova',
  active: 'Attivo',
  suspended: 'Sospeso',
};
