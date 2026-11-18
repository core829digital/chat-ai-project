// Motore di risposta senza AI: confronta la domanda del visitatore con le risposte
// inserite dal cliente (domanda + parole chiave) usando normalizzazione dell'italiano,
// parole vuote, una radice semplificata e un peso per parola (IDF).
// È volutamente prevedibile: risponde solo quando è abbastanza sicuro, altrimenti
// ammette di non sapere e propone di lasciare un contatto.

const STOPWORDS = new Set(`
a ad al allo ai agli all agl alla alle con col coi da dal dallo dai dagli dall dagl dalla dalle di del dello dei degli
dell degl della delle in nel nello nei negli nell negl nella nelle su sul sullo sui sugli sull sugl sulla sulle per tra
fra il lo la i gli le l un uno una un e ed o od ma se che chi cui non piu più anche come quando quanto quanta quanti
quante qual quale quali cosa cos è e' sono sei siamo siete ho hai ha abbiamo avete hanno mi ti si ci vi ne lo li me te se ce ve
io tu lui lei noi voi loro mio mia miei mie tuo tua vostro vostra nostro nostra suo sua questo questa questi queste quello
quella quelli quelle c v vorrei volevo voglio posso potrei puoi può puo potete possiamo fare fate fa sapere sapete sai
info informazione informazioni domanda chiedere chiedo gentilmente grazie ciao salve buongiorno buonasera per favore
favore prego essere stato stata ok okay allora poi già gia ancora molto tanto tutto tutti tutte vostri vostre vostro
the is are do does what how can you your i to of and or for on in at it
`.split(/\s+/).filter(Boolean));

// Sinonimi frequenti: portano parole diverse sulla stessa radice concettuale.
const SYNONYMS = {
  costo: 'prezz', costa: 'prezz', costano: 'prezz', costi: 'prezz', tariffa: 'prezz', tariffe: 'prezz',
  listino: 'prezz', quotazione: 'prezz', preventivo: 'prezz', spesa: 'prezz',
  aperti: 'orar', aperto: 'orar', apertura: 'orar', chiusura: 'orar', chiusi: 'orar', chiuso: 'orar', orario: 'orar',
  prenotare: 'prenot', prenotazione: 'prenot', prenotazioni: 'prenot', riservare: 'prenot', appuntamento: 'prenot',
  appuntamenti: 'prenot', booking: 'prenot', disponibilita: 'prenot', disponibile: 'prenot',
  spedizione: 'sped', spedizioni: 'sped', consegna: 'sped', consegne: 'sped', spedite: 'sped', spedire: 'sped',
  reso: 'res', resi: 'res', recesso: 'res',
  pagare: 'pagam', pagamento: 'pagam', pagamenti: 'pagam', bonifico: 'pagam', carta: 'pagam', contanti: 'pagam',
  satispay: 'pagam', pagate: 'pagam', pagabile: 'pagam',
  parcheggiare: 'parchegg', parcheggio: 'parchegg', parcheggi: 'parchegg', posteggio: 'parchegg',
  dove: 'indirizz', indirizzo: 'indirizz', trovate: 'indirizz', raggiungervi: 'indirizz', sede: 'indirizz',
  telefono: 'contatt', email: 'contatt', mail: 'contatt', chiamare: 'contatt', whatsapp: 'contatt',
  contatto: 'contatt', contatti: 'contatt', recapito: 'contatt', recapiti: 'contatt',
};

const HUMAN = /\b(operatore|operatrice|persona|umano|essere umano|parlare con|richiamat|richiamare|ricontatt|assistenza umana|qualcuno)\b/;
const GREETING = /^(ciao|salve|buongiorno|buonasera|buon pomeriggio|hey|hello|hi|ehi)\b[\s!.,]*$/;
const THANKS = /^(grazie|grazie mille|perfetto grazie|ok grazie|molte grazie|thanks|thank you)\b[\s!.,]*$/;

export function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[’']/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Radici di concetto: qualsiasi forma che inizia così (disdico, disdetta, disdire…)
// viene ricondotta allo stesso concetto, così verbi e sostantivi si incontrano.
const CONCEPT_ROOTS = [
  ['disdi', 'cancell'], ['disdett', 'cancell'], ['cancell', 'cancell'], ['annull', 'cancell'],
  ['rimbors', 'res'], ['restitu', 'res'], ['rendere', 'res'],
  ['prenot', 'prenot'], ['spedi', 'sped'], ['spediz', 'sped'], ['consegn', 'sped'],
  ['pagam', 'pagam'], ['pagar', 'pagam'], ['parchegg', 'parchegg'], ['posteg', 'parchegg'],
  ['prezz', 'prezz'], ['tariff', 'prezz'], ['orari', 'orar'], ['apertur', 'orar'],
  ['telefon', 'contatt'], ['contatt', 'contatt'], ['indirizz', 'indirizz'],
  ['animal', 'animal'], ['cagnol', 'animal'], ['gatt', 'animal'],
];

const SUFFIXES = ['azioni', 'azione', 'amenti', 'amento', 'imenti', 'imento', 'mente', 'abile', 'ibile',
  'ando', 'endo', 'ammo', 'iamo', 'ato', 'ata', 'ati', 'ate', 'uto', 'uta', 'uti', 'ute', 'ito', 'ita', 'iti', 'ite',
  'are', 'ere', 'ire', 'ano', 'ono', 'chi', 'ghi', 'che', 'ghe', 'i', 'e', 'a', 'o'];

// Radice semplificata per l'italiano: toglie le desinenze più comuni.
export function stem(word) {
  if (SYNONYMS[word]) return SYNONYMS[word];
  for (const [root, concept] of CONCEPT_ROOTS) if (word.startsWith(root)) return concept;
  if (word === 'cane' || word === 'cani') return 'animal';
  if (word.length <= 4) return word;
  for (const s of SUFFIXES) {
    if (word.endsWith(s) && word.length - s.length >= 4) {
      const base = word.slice(0, -s.length);
      return SYNONYMS[base] || base;
    }
  }
  return word;
}

export function tokens(text) {
  return normalize(text)
    .split(' ')
    .filter((w) => w && !STOPWORDS.has(w) && (w.length > 1 || /\d/.test(w)))
    .map(stem);
}

// Prepara l'indice una volta per richiesta: per poche centinaia di risposte è istantaneo.
export function buildIndex(items) {
  const docs = items.map((item) => {
    const q = new Set(tokens(item.question));
    const k = new Set(tokens(item.keywords || ''));
    return { item, terms: new Set([...q, ...k]), keyTerms: k };
  });
  const df = new Map();
  for (const d of docs) for (const t of d.terms) df.set(t, (df.get(t) || 0) + 1);
  const n = Math.max(docs.length, 1);
  const idf = (t) => Math.log(1 + n / (df.get(t) || 0.5));
  return { docs, idf };
}

const termMatches = (a, b) => a === b || (a.length >= 5 && b.length >= 5 && a.slice(0, 5) === b.slice(0, 5));

export function findBest(index, message) {
  const q = [...new Set(tokens(message))];
  if (!q.length || !index.docs.length) return null;
  let best = null;
  for (const d of index.docs) {
    let matched = 0;
    let total = 0;
    let keyHit = false;
    for (const t of q) {
      const w = index.idf(t);
      total += w;
      for (const term of d.terms) {
        if (termMatches(t, term)) {
          matched += w;
          if (d.keyTerms.has(term)) keyHit = true;
          break;
        }
      }
    }
    if (!matched) continue;
    const coverage = matched / total; // quanta parte della domanda è coperta
    const precision = matched / Array.from(d.terms).reduce((s, t) => s + index.idf(t), 0); // quanto la risposta è specifica
    const score = 0.7 * coverage + 0.3 * Math.min(precision * 2, 1) + (keyHit ? 0.15 : 0);
    if (!best || score > best.score) best = { item: d.item, score, coverage };
  }
  return best;
}

export const THRESHOLD = 0.45;

export function classify(message) {
  const n = normalize(message);
  if (!n) return 'empty';
  if (GREETING.test(n)) return 'greeting';
  if (THANKS.test(n)) return 'thanks';
  if (HUMAN.test(n)) return 'human';
  return 'question';
}
