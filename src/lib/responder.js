// Punto unico in cui si decide la risposta del widget.
// MVP: risposte predefinite (matcher.js), nessuna AI collegata.
// Per collegare l'AI: implementare respondWithAI() con la stessa forma di output
// e chiamarla quando settings.engine === 'ai'. Il resto del sistema non cambia.
import { buildIndex, classify, findBest, THRESHOLD } from './matcher.js';

/**
 * @param {object} p
 * @param {object} p.settings  impostazioni del widget
 * @param {Array}  p.knowledge risposte del cliente [{id, question, answer, keywords, hits}]
 * @param {string} p.message   testo del visitatore
 * @returns {{text: string, knowledgeId: number|null, outcome: string, action: string|null, suggestions: string[]}}
 */
export function respond({ settings, knowledge, message }) {
  const kind = classify(message);
  const suggestions = topQuestions(knowledge);
  const leadAction = settings.leadCapture ? 'lead_form' : null;

  if (kind === 'greeting') {
    return { text: settings.welcomeMessage, knowledgeId: null, outcome: 'greeting', action: null, suggestions };
  }
  if (kind === 'thanks') {
    return {
      text: 'Prego! Se ti serve altro, scrivimi pure qui.',
      knowledgeId: null, outcome: 'thanks', action: null, suggestions: [],
    };
  }
  if (kind === 'human') {
    return {
      text: settings.leadCapture
        ? 'Certo. Lasciami i tuoi recapiti e una persona del team ti ricontatterà al più presto.'
        : settings.fallbackMessage,
      knowledgeId: null, outcome: 'handoff', action: leadAction, suggestions: [],
    };
  }

  const best = findBest(buildIndex(knowledge), message);
  if (best && best.score >= THRESHOLD) {
    return { text: best.item.answer, knowledgeId: best.item.id, outcome: 'answered', action: null, suggestions: [] };
  }
  return {
    text: settings.fallbackMessage,
    knowledgeId: null,
    outcome: 'fallback',
    action: leadAction,
    suggestions,
  };
}

function topQuestions(knowledge, n = 3) {
  return [...knowledge]
    .sort((a, b) => b.hits - a.hits || a.id - b.id)
    .slice(0, n)
    .map((k) => k.question);
}
