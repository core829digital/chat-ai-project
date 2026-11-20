// Punto unico in cui si decide la risposta del widget.
// Due motori, scelti per assistente (settings.engine):
//  - 'faq' (predefinito): risposte predefinite scritte dal cliente, scelte con matcher.js
//  - 'ai': Neon AI Gateway, vincolato alle stesse informazioni (src/lib/ai.js)
// Se l'AI non è disponibile (niente crediti, errore, tempo scaduto) si usa automaticamente 'faq':
// il visitatore riceve sempre una risposta.
import { aiAnswer, aiConfigured } from './ai.js';
import { buildIndex, classify, findBest, THRESHOLD } from './matcher.js';

/**
 * @param {object} p
 * @param {object} p.settings  impostazioni del widget
 * @param {Array}  p.knowledge risposte del cliente [{id, question, answer, keywords, hits}]
 * @param {string} p.message   testo del visitatore
 * @returns {Promise<{text: string, knowledgeId: number|null, outcome: string, action: string|null, suggestions: string[], engine: string, aiError?: string}>}
 */
export async function respond({ settings, knowledge, message }) {
  const kind = classify(message);
  const suggestions = topQuestions(knowledge);
  const leadAction = settings.leadCapture ? 'lead_form' : null;

  if (kind === 'greeting') {
    return { text: settings.welcomeMessage, knowledgeId: null, outcome: 'greeting', action: null, suggestions, engine: 'faq' };
  }
  if (kind === 'thanks') {
    return { text: 'Prego! Se ti serve altro, scrivimi pure qui.', knowledgeId: null, outcome: 'thanks', action: null, suggestions: [], engine: 'faq' };
  }
  if (kind === 'human') {
    return {
      text: settings.leadCapture
        ? 'Certo. Lasciami i tuoi recapiti e una persona del team ti ricontatterà al più presto.'
        : settings.fallbackMessage,
      knowledgeId: null, outcome: 'handoff', action: leadAction, suggestions: [], engine: 'faq',
    };
  }

  let aiError;
  if (settings.engine === 'ai' && aiConfigured()) {
    try {
      const text = await aiAnswer({ settings, knowledge, message });
      if (text) return { text, knowledgeId: null, outcome: 'answered', action: null, suggestions: [], engine: 'ai' };
      return { text: settings.fallbackMessage, knowledgeId: null, outcome: 'fallback', action: leadAction, suggestions, engine: 'ai' };
    } catch (err) {
      // Nessuna interruzione per il visitatore: si passa alle risposte predefinite.
      aiError = `${err.status || ''} ${err.reason || err.message}`.trim();
      console.warn(`[ai] risposta AI non disponibile, uso le risposte predefinite: ${aiError}`);
    }
  }

  const best = findBest(buildIndex(knowledge), message);
  if (best && best.score >= THRESHOLD) {
    return { text: best.item.answer, knowledgeId: best.item.id, outcome: 'answered', action: null, suggestions: [], engine: 'faq', aiError };
  }
  return { text: settings.fallbackMessage, knowledgeId: null, outcome: 'fallback', action: leadAction, suggestions, engine: 'faq', aiError };
}

function topQuestions(knowledge, n = 3) {
  return [...knowledge]
    .sort((a, b) => b.hits - a.hits || a.id - b.id)
    .slice(0, n)
    .map((k) => k.question);
}
