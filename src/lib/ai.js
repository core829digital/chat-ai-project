// Risposte generate con il Neon AI Gateway (endpoint compatibile OpenAI Chat Completions).
// Variabili scritte da "neon deploy" / "neon env pull": NEON_AI_GATEWAY_BASE_URL (host senza percorso)
// e NEON_AI_GATEWAY_TOKEN. Il modello si sceglie con AI_MODEL (ID del catalogo Neon).
// L'AI risponde SOLO con le informazioni inserite dal cliente; se non le trova restituisce null
// e il widget si comporta come con le risposte predefinite (dice che non sa e propone il contatto).

export const AI_MODEL = process.env.AI_MODEL || 'claude-haiku-4-5';
const NO_ANSWER = 'NESSUNA_RISPOSTA';

export function aiConfigured() {
  return Boolean(process.env.NEON_AI_GATEWAY_BASE_URL && process.env.NEON_AI_GATEWAY_TOKEN);
}

export class AiError extends Error {
  constructor(status, message, reason = '') {
    super(message);
    this.status = status;
    this.reason = reason;
  }
}

function systemPrompt(settings, knowledge) {
  const facts = knowledge
    .map((k, i) => `${i + 1}. Domanda: ${k.question}\n   Risposta: ${k.answer}`)
    .join('\n');
  return [
    `Sei l'assistente del sito "${settings.title || 'questa attività'}". Rispondi in italiano, in modo breve e cortese (massimo 3 frasi).`,
    'Usa SOLO le informazioni qui sotto. Non inventare prezzi, orari, disponibilità o servizi.',
    `Se la risposta non è nelle informazioni, rispondi esattamente con: ${NO_ANSWER}`,
    'Non dare pareri medici, legali o finanziari.',
    '',
    'Informazioni dell\'attività:',
    facts || '(nessuna informazione inserita)',
  ].join('\n');
}

async function call(path, body, { timeoutMs = 12_000 } = {}) {
  const base = process.env.NEON_AI_GATEWAY_BASE_URL.replace(/\/+$/, '');
  const res = await fetch(`${base}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { authorization: `Bearer ${process.env.NEON_AI_GATEWAY_TOKEN}`, 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(timeoutMs),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const reason = data?.unavailable_reason || data?.error?.code || data?.error?.type || '';
    const message = data?.error?.message || data?.message || `HTTP ${res.status}`;
    throw new AiError(res.status, message, reason);
  }
  return data;
}

/** Elenco dei modelli disponibili per questo branch (per la diagnostica). */
export async function listModels() {
  const data = await call('/v1/models');
  return (data.data || data.models || []).map((m) => ({
    id: m.id, enabled: m.enabled !== false, reason: m.unavailable_reason || '',
  }));
}

/**
 * @returns {Promise<string|null>} il testo della risposta, oppure null se l'informazione non c'è
 * @throws {AiError} se il gateway non risponde o rifiuta la richiesta
 */
export async function aiAnswer({ settings, knowledge, message }) {
  const data = await call('/v1/chat/completions', {
    model: AI_MODEL,
    max_tokens: 300,
    messages: [
      { role: 'system', content: systemPrompt(settings, knowledge) },
      { role: 'user', content: message },
    ],
  });
  const text = String(data?.choices?.[0]?.message?.content || '').trim();
  if (!text || text.includes(NO_ANSWER)) return null;
  return text;
}
