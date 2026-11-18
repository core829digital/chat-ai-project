// Prepara il database con: amministratore, assistente demo della landing page
// e alcuni clienti di esempio con conversazioni realistiche.
// Uso: npm run seed            (aggiunge solo ciò che manca)
//      npm run seed -- --reset (cancella il database e ricomincia)
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../src/config.js';
import { openDb, run, one } from '../src/db.js';
import { randomToken } from '../src/lib/security.js';
import { respond } from '../src/lib/responder.js';
import * as M from '../src/models.js';
import { DEMO_WIDGET_ID } from '../src/routes/public.js';

const reset = process.argv.includes('--reset');
if (reset) {
  for (const suffix of ['', '-wal', '-shm']) fs.rmSync(config.dbPath + suffix, { force: true });
  console.log('Database cancellato.');
}
openDb();

const credFile = path.join(path.dirname(config.dbPath), 'credenziali-demo.txt');
const lines = [];

// ---------- Amministratore ----------
const adminEmail = (process.env.ADMIN_EMAIL || 'admin@sportello.local').toLowerCase();
if (!M.findUserByEmail(adminEmail)) {
  const password = process.env.ADMIN_PASSWORD || randomToken(12);
  M.createAdmin({ email: adminEmail, name: 'Amministratore', password });
  lines.push(`Amministratore: ${adminEmail} / ${password}  ->  ${config.baseUrl}/admin`);
}

// ---------- Assistente demo della landing (risponde su Sportello stesso) ----------
if (!M.getWidgetByPublicId(DEMO_WIDGET_ID)) {
  const { accountId } = M.createAccountWithUser({
    company: 'Sportello (sito ufficiale)', name: 'Team Sportello', email: 'demo@sportello.local',
    password: null, plan: 'business', status: 'active', sector: 'generico', createdBy: 'admin',
  });
  const w = M.createWidget({ accountId, name: 'Demo sito Sportello', sector: 'generico', withTemplate: false, fixedPublicId: DEMO_WIDGET_ID });
  M.updateWidget(w.id, {
    settings: {
      title: 'Sportello',
      subtitle: 'Demo: chiedimi come funziono',
      avatarText: 'S',
      welcomeMessage: 'Ciao! Sono un assistente Sportello. Fammi una domanda su prezzi, installazione o privacy: ti rispondo come farei sul tuo sito.',
      launcherLabel: '',
      quickReplies: ['Quanto costa?', 'Come si installa?', 'Funziona su WordPress?'],
      fallbackMessage: 'Su questo non ho una risposta pronta: in un sito vero, qui proporrei di lasciare i recapiti. Prova a chiedermi dei prezzi o di come si installa.',
      leadCapture: true,
      askPhone: false,
      showBranding: false,
    },
  });
  const faq = [
    ['Quanto costa?', 'Ci sono quattro piani: Start a 29 €/mese (1 sito), Pro a 79 € (3 siti), Business a 199 € (10 siti) e Agency a 349 € (25 siti). Prezzi IVA esclusa, con 14 giorni di prova gratuita e due mesi gratis pagando annualmente.', 'prezzi costo piani abbonamento listino euro'],
    ['Come si installa?', 'Copi una riga di codice dalla dashboard e la incolli nel sito prima di </body>. Su WordPress c’è il plugin; se il sito non si può modificare, usi la pagina chat ospitata.', 'installare installazione codice script riga'],
    ['Funziona su WordPress?', 'Sì. Installi il plugin Sportello, apri Impostazioni → Sportello e incolli il codice del tuo assistente. Funziona anche su Wix, Shopify, Joomla e siti in HTML.', 'wordpress plugin wix shopify joomla'],
    ['Usate l’intelligenza artificiale?', 'In questa versione no: l’assistente risponde solo con le risposte che scrivi tu, scegliendo quella più vicina alla domanda. Così non inventa nulla.', 'intelligenza artificiale ai chatgpt inventa'],
    ['Dove sono i dati?', 'Conversazioni e contatti restano su server in Unione Europea. Il widget non usa cookie di profilazione e mostra sempre l’avviso che si sta parlando con un assistente automatico.', 'dati privacy gdpr server europa cookie'],
    ['Posso provarlo gratis?', 'Sì, 14 giorni gratis senza carta di credito. Ti registri, scegli il settore e parti con le domande più frequenti già scritte.', 'prova gratis gratuita trial'],
    ['Sono un’agenzia, posso rivenderlo?', 'Sì, con il piano Agency gestisci fino a 25 siti di clienti da una sola dashboard e consegni ogni assistente con un link di invito.', 'agenzia rivendere clienti partner white label'],
    ['Posso disdire quando voglio?', 'Sì, il piano mensile si disdice in qualsiasi momento, senza penali.', 'disdire disdetta cancellare abbonamento'],
  ];
  for (const [question, answer, keywords] of faq) M.addKnowledge(w.id, { question, answer, keywords });
  lines.push(`Assistente demo della landing: ${DEMO_WIDGET_ID}`);
}

// ---------- Clienti di esempio ----------
const daysAgo = (d, h = 10) => {
  const t = new Date(Date.now() - d * 86400000);
  t.setUTCHours(h, Math.floor(Math.random() * 60), 0, 0);
  return t.toISOString().replace('T', ' ').slice(0, 19);
};

function simulate(widget, questions, { day, lead } = {}) {
  const knowledge = M.listKnowledge(widget.id);
  const conv = M.createConversation({ widgetId: widget.id, visitorId: `v_seed_${Math.random().toString(36).slice(2)}`, pageUrl: `${widget.site_url}/`, isTest: false });
  for (const q of questions) {
    M.addMessage(conv.id, { role: 'visitor', body: q });
    const r = respond({ settings: widget.settings, knowledge, message: q });
    M.addMessage(conv.id, { role: 'bot', body: r.text, knowledgeId: r.knowledgeId, outcome: r.outcome });
    if (r.knowledgeId) M.hitKnowledge(r.knowledgeId);
  }
  if (lead) M.createLead({ widgetId: widget.id, conversationId: conv.id, ...lead, message: '', isTest: false });
  const when = daysAgo(day, 8 + Math.floor(Math.random() * 12));
  run(`UPDATE conversations SET started_at = ?, last_at = ? WHERE id = ?`, when, when, conv.id);
  run(`UPDATE messages SET created_at = ? WHERE conversation_id = ?`, when, conv.id);
  if (lead) run(`UPDATE leads SET created_at = ? WHERE conversation_id = ?`, when, conv.id);
}

function personalize(widgetId, replacements) {
  for (const k of M.listKnowledge(widgetId)) {
    let { question, answer, keywords } = k;
    for (const [from, to] of replacements) answer = answer.replace(from, to);
    answer = answer.replace(/\s*\[[^\]]*\]/g, '').trim();
    M.updateKnowledge(k.id, { question, answer, keywords });
  }
}

if (!M.findUserByEmail('info@locandalemura.example')) {
  const { accountId } = M.createAccountWithUser({
    company: 'Locanda Le Mura', name: 'Giulia Ferri', email: 'info@locandalemura.example',
    password: 'demo-locanda-2026', plan: 'pro', status: 'active', sector: 'hotel', createdBy: 'self',
  });
  const w = M.createWidget({ accountId, name: 'Locanda Le Mura', siteUrl: 'https://www.locandalemura.example', sector: 'hotel' });
  personalize(w.id, [[/\[N\] posti auto gratuiti \/ a pagamento \(\[prezzo\] al giorno\)/, '8 posti auto gratuiti nel cortile interno'], [/\[prezzo\] a notte/, '10 € a notte'], [/\[N\] giorni prima/, '3 giorni prima'], [/\[link\]/, 'https://www.locandalemura.example/prenota']]);
  M.updateWidget(w.id, { settings: { welcomeMessage: 'Benvenuto alla Locanda Le Mura! Chiedimi di camere, colazione, parcheggio o come prenotare.', color: '#7C2D12', avatarText: 'LM' } });
  M.markWidgetSeen(w.id, 'https://www.locandalemura.example/camere');
  const sample = [
    [['A che ora è il check-in?'], 1],
    [['C’è il parcheggio?', 'grazie'], 2],
    [['Accettate cani?'], 3, { name: 'Marco Rinaldi', email: 'marco.rinaldi@example.com', phone: '+39 333 123 4567' }],
    [['Avete una piscina?'], 4, { name: 'Elena Costa', email: 'elena.costa@example.com', phone: '' }],
    [['La colazione è inclusa?', 'Come posso prenotare?'], 6],
    [['Si può cancellare gratis?'], 8],
    [['Fate prezzi per gruppi?'], 9, { name: 'Associazione Il Faro', email: 'gite@ilfaro.example', phone: '+39 051 555 0101' }],
    [['ciao', 'check out entro che ora?'], 12],
    [['Vorrei parlare con una persona'], 15, { name: 'Luca Bassi', email: '', phone: '+39 347 222 9090' }],
    [['C’è il wifi in camera?'], 18],
    [['parcheggio per il camper?'], 21],
    [['Colazione senza glutine?'], 25],
  ];
  for (const [qs, day, lead] of sample) simulate(M.getWidget(w.id), qs, { day, lead });
  lines.push('Cliente di esempio (attivo, Pro): info@locandalemura.example / demo-locanda-2026');
}

if (!M.findUserByEmail('segreteria@studiobianchi.example')) {
  const { accountId } = M.createAccountWithUser({
    company: 'Studio Dentistico Bianchi', name: 'Dott.ssa Anna Bianchi', email: 'segreteria@studiobianchi.example',
    password: null, plan: 'start', status: 'trial', sector: 'sanita', createdBy: 'admin',
  });
  M.createWidget({ accountId, name: 'Studio Dentistico Bianchi', siteUrl: 'https://www.studiobianchi.example', sector: 'sanita' });
  const owner = M.findUserByEmail('segreteria@studiobianchi.example');
  M.createInvite(owner.id);
  run(`UPDATE accounts SET trial_ends_at = ? WHERE id = ?`, daysAgo(-3, 23), accountId);
  lines.push('Cliente di esempio (in prova, invito non ancora accettato): Studio Dentistico Bianchi');
}

if (!M.findUserByEmail('ordini@pizzeriadagino.example')) {
  const { accountId } = M.createAccountWithUser({
    company: 'Pizzeria Da Gino', name: 'Gino Esposito', email: 'ordini@pizzeriadagino.example',
    password: 'demo-pizzeria-2026', plan: 'start', status: 'trial', sector: 'ristorante', createdBy: 'self',
  });
  const w = M.createWidget({ accountId, name: 'Pizzeria Da Gino', siteUrl: 'https://www.pizzeriadagino.example', sector: 'ristorante' });
  run(`UPDATE accounts SET trial_ends_at = ?, created_at = ? WHERE id = ?`, daysAgo(2, 23), daysAgo(16), accountId);
  simulate(M.getWidget(w.id), ['Fate asporto?'], { day: 5 });
  simulate(M.getWidget(w.id), ['Siete aperti la domenica?'], { day: 7 });
  lines.push('Cliente di esempio (prova scaduta): ordini@pizzeriadagino.example / demo-pizzeria-2026');
}

if (lines.length) {
  fs.mkdirSync(path.dirname(credFile), { recursive: true });
  const header = `# Credenziali di prova generate da "npm run seed" il ${new Date().toISOString()}\n# File escluso da git (cartella data/). Non usare queste password in produzione.\n`;
  const existing = fs.existsSync(credFile) && !reset ? fs.readFileSync(credFile, 'utf8') : header;
  fs.writeFileSync(credFile, existing + lines.map((l) => `${l}\n`).join(''));
  console.log(`Fatto. Credenziali salvate in ${credFile}`);
} else {
  console.log('Niente da aggiungere: il database è già pronto.');
}
console.log(`Clienti: ${one('SELECT COUNT(*) AS n FROM accounts').n} · Assistenti: ${one('SELECT COUNT(*) AS n FROM widgets').n}`);
