// Aggiornamenti in tempo reale della dashboard con Neon Realtime (beta).
// Il server "sigilla" una query già ristretta al singolo assistente del cliente: il browser
// riceve solo una capability cifrata e a scadenza, mai il segreto né la stringa di connessione.
// Attivo solo con Postgres (DATABASE_URL) e con NEON_REALTIME_URL + NEON_REALTIME_SECRET,
// scritte da "neon deploy" / "neon env pull". Senza, la dashboard funziona come prima.
import { dialect } from '../db.js';

let realtime;

export function realtimeConfigured() {
  return dialect === 'postgres' && Boolean(process.env.NEON_REALTIME_URL && process.env.NEON_REALTIME_SECRET);
}

/** URL WebSocket pubblico dell'endpoint Realtime (va al browser). */
export const realtimeUrl = () => (realtimeConfigured() ? process.env.NEON_REALTIME_URL : '');

/** Origine da aggiungere a connect-src nella Content-Security-Policy. */
export function realtimeOrigin() {
  if (!realtimeConfigured()) return '';
  try {
    return new URL(process.env.NEON_REALTIME_URL).origin;
  } catch {
    return '';
  }
}

async function server() {
  if (!realtime) {
    const { createRealtime } = await import('@neon/realtime/server');
    realtime = createRealtime({
      secret: process.env.NEON_REALTIME_SECRET,
      // Il nome del database è parte della capability: lo stesso della connessione dell'app.
      db: decodeURIComponent(new URL(process.env.DATABASE_URL).pathname.slice(1)) || 'neondb',
    });
  }
  return realtime;
}

/** Colonne osservate: bastano a capire che una conversazione è nuova o è cambiata. */
export const CONVERSATIONS_LIVE_SQL =
  'select id, message_count, unanswered, has_lead, is_test, last_at from conversations where widget_id = $1';

/**
 * Query sigillata sulle conversazioni di UN assistente. Chi chiama deve aver già verificato
 * che l'utente possa vedere quell'assistente (loadOwnedWidget).
 */
export async function sealWidgetConversations(widgetId) {
  const { rawSql } = await import('@neon/realtime/server');
  const rt = await server();
  return rt.seal({ query: rawSql(CONVERSATIONS_LIVE_SQL, [Number(widgetId)]) });
}
