// Test di integrazione: avvia il server vero su un database temporaneo e percorre i flussi completi.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PORT = 3990 + Math.floor(Math.random() * 9);
const BASE = `http://localhost:${PORT}`;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aperto-test-'));
process.env.DB_PATH = path.join(tmp, 'test.db');
process.env.PORT = String(PORT);
process.env.BASE_URL = BASE;

const { startServer } = await import('../src/server.js');
const M = await import('../src/models.js');
const { closeDb } = await import('../src/db.js');
let server;

before(async () => {
  server = await startServer(PORT);
  await M.createAdmin({ email: 'admin@test.local', name: 'Admin', password: 'admin-password-123' });
});
after(async () => {
  server.close();
  await closeDb();
  fs.rmSync(tmp, { recursive: true, force: true });
});

// Browser minimale con cookie e token CSRF.
class Client {
  constructor() { this.cookies = {}; }
  store(res) {
    for (const c of res.headers.getSetCookie()) {
      const [pair, ...attrs] = c.split(';');
      const i = pair.indexOf('=');
      const k = pair.slice(0, i);
      const v = decodeURIComponent(pair.slice(i + 1));
      if (attrs.some((a) => a.trim() === 'Max-Age=0')) delete this.cookies[k];
      else this.cookies[k] = v;
    }
  }
  header() { return Object.entries(this.cookies).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('; '); }
  async get(p, headers = {}) {
    const res = await fetch(BASE + p, { redirect: 'manual', headers: { cookie: this.header(), ...headers } });
    this.store(res);
    return { status: res.status, location: res.headers.get('location'), headers: res.headers, text: await res.text() };
  }
  async post(p, data = {}, { csrf = true } = {}) {
    if (!this.cookies.sp_csrf) await this.get('/accedi');
    const body = new URLSearchParams({ ...(csrf ? { _csrf: this.cookies.sp_csrf } : {}), ...data });
    const res = await fetch(BASE + p, {
      method: 'POST', redirect: 'manual', body,
      headers: { cookie: this.header(), 'content-type': 'application/x-www-form-urlencoded' },
    });
    this.store(res);
    return { status: res.status, location: res.headers.get('location'), text: await res.text() };
  }
}

const widgetApi = (pid, p, body, origin) =>
  fetch(`${BASE}/api/widget/${pid}${p}`, {
    method: body ? 'POST' : 'GET',
    headers: { 'content-type': 'text/plain;charset=UTF-8', ...(origin ? { origin } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  }).then(async (r) => ({ status: r.status, headers: r.headers, data: await r.json() }));

const client = new Client();
let widget;

test('landing: contenuti principali e intestazioni di sicurezza', async () => {
  const r = await new Client().get('/');
  assert.equal(r.status, 200);
  // il titolo è diviso in parole animate: si controlla il testo leggibile, come lo legge un motore di ricerca
  const readable = r.text.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ');
  assert.match(readable, /Il tuo sito risponde ai clienti\. Anche alle undici di sera\./);
  assert.match(readable, /Ogni domanda che resta senza risposta è un cliente che cerca altrove\./);
  assert.match(r.text, /data-monthly="79"/);
  assert.match(r.headers.get('content-security-policy'), /script-src 'self'/);
  assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
});

test('registrazione: errori di validazione e poi successo', async () => {
  const bad = await client.post('/registrati', { company: '', name: 'Mario', email: 'non-email', password: 'corta' });
  assert.equal(bad.status, 422);
  assert.match(bad.text, /Scrivi il nome della tua attività/);
  assert.match(bad.text, /indirizzo email valido/);
  assert.match(bad.text, /almeno 10 caratteri/);
  assert.match(bad.text, /accettare i termini/);

  const ok = await client.post('/registrati', {
    company: 'Hotel Prova <b>', name: 'Mario Rossi', email: 'mario@hotelprova.example', password: 'password-sicura-1', sector: 'hotel', terms: '1',
  });
  assert.equal(ok.status, 303);
  assert.equal(ok.location, '/app/widgets/new?primo=1');
  assert.ok(client.cookies.sp_session);

  const dup = await new Client().post('/registrati', { company: 'X', name: 'Y', email: 'mario@hotelprova.example', password: 'password-sicura-1', terms: '1' });
  assert.match(dup.text, /Esiste già un account/);
});

test('protezione CSRF sui form', async () => {
  const r = await client.post('/app/widgets', { name: 'Senza token' }, { csrf: false });
  assert.equal(r.status, 403);
});

test('creazione assistente con modello di settore', async () => {
  const page = await client.get('/app/widgets/new?primo=1');
  assert.match(page.text, /Benvenuto in Aperto/);
  const bad = await client.post('/app/widgets', { name: 'Hotel', siteUrl: 'non un url', sector: 'hotel', withTemplate: '1' });
  assert.equal(bad.status, 422);
  const r = await client.post('/app/widgets', { name: 'Hotel Prova', siteUrl: 'https://www.hotelprova.example', sector: 'hotel', withTemplate: '1' });
  assert.equal(r.status, 303);
  const id = Number(r.location.match(/\/app\/widgets\/(\d+)\/risposte/)[1]);
  widget = (await M.getWidget(id));
  assert.equal((await M.listKnowledge(id)).length, SECTOR_HOTEL_COUNT);
  assert.deepEqual(widget.allowed_domains, ['hotelprova.example']);
  const kb = await client.get(`/app/widgets/${id}/risposte`);
  assert.match(kb.text, /Da completare/);
  assert.match(kb.text, /data-preview/);
});
const SECTOR_HOTEL_COUNT = 6;

test('limite del piano: il piano Pro consente 3 assistenti', async () => {
  for (const n of [2, 3]) {
    const r = await client.post('/app/widgets', { name: `Sito ${n}`, sector: 'generico' });
    assert.equal(r.status, 303);
  }
  const over = await client.post('/app/widgets', { name: 'Sito 4', sector: 'generico' });
  assert.equal(over.status, 403);
});

test('widget: configurazione pubblica, CORS e domini autorizzati', async () => {
  const ok = await widgetApi(widget.public_id, '/config', null, 'https://www.hotelprova.example');
  assert.equal(ok.status, 200);
  assert.equal(ok.data.active, true);
  assert.equal(ok.headers.get('access-control-allow-origin'), 'https://www.hotelprova.example');
  assert.equal(ok.data.settings.title, 'Hotel Prova');
  assert.equal(ok.data.settings.showBranding, false);

  const sub = await widgetApi(widget.public_id, '/config', null, 'https://prenota.hotelprova.example');
  assert.equal(sub.status, 200);
  const evil = await widgetApi(widget.public_id, '/config', null, 'https://hotelprova.example.evil.com');
  assert.equal(evil.status, 403);
  assert.match(evil.data.error, /Dominio non autorizzato/);
  assert.equal(evil.headers.get('access-control-allow-origin'), 'https://hotelprova.example.evil.com');

  const none = await widgetApi('wdg_inesistente', '/config');
  assert.equal(none.status, 404);
});

let conversationId;
test('widget: conversazione con risposta, fallback e richiesta di una persona', async () => {
  const origin = 'https://www.hotelprova.example';
  const a = await widgetApi(widget.public_id, '/messages', { visitorId: 'v1', text: 'A che ora è il check-in?', pageUrl: `${origin}/camere` }, origin);
  assert.equal(a.status, 200);
  assert.match(a.data.reply.text, /check-in è dalle 14:00/);
  assert.equal(a.data.action, null);
  conversationId = a.data.conversationId;

  const b = await widgetApi(widget.public_id, '/messages', { conversationId, visitorId: 'v1', text: 'Avete una piscina coperta?' }, origin);
  assert.equal(b.data.conversationId, conversationId);
  assert.equal(b.data.action, 'lead_form');
  assert.match(b.data.reply.text, /Non ho una risposta sicura/);

  const c = await widgetApi(widget.public_id, '/messages', { conversationId, visitorId: 'v1', text: 'voglio parlare con un operatore' }, origin);
  assert.equal(c.data.action, 'lead_form');

  const empty = await widgetApi(widget.public_id, '/messages', { visitorId: 'v1', text: '   ' }, origin);
  assert.equal(empty.status, 400);

  const w = (await M.getWidget(widget.id));
  assert.ok(w.last_seen_at, 'il widget risulta installato');
  assert.equal(w.last_seen_url, `${origin}/camere`);
});

test('widget: raccolta contatti con validazione e consenso', async () => {
  const origin = 'https://www.hotelprova.example';
  const bad = await widgetApi(widget.public_id, '/leads', { conversationId, name: '', email: 'x', consent: false }, origin);
  assert.equal(bad.status, 422);
  assert.ok(bad.data.fields.name && bad.data.fields.email && bad.data.fields.consent);
  const ok = await widgetApi(widget.public_id, '/leads', { conversationId, name: 'Laura Neri', email: 'laura@example.com', phone: '+39 333 000', consent: true }, origin);
  assert.equal(ok.status, 200);
  assert.match(ok.data.reply.text, /Grazie Laura/);

  const leads = await client.get('/app/leads');
  assert.match(leads.text, /Laura Neri/);
  assert.match(leads.text, /laura@example.com/);
  const csv = await client.get('/app/leads.csv');
  assert.match(csv.headers.get('content-type'), /text\/csv/);
  assert.match(csv.text, /Laura Neri;laura@example.com/);
});

test('dashboard: domande senza risposta e dettaglio conversazione', async () => {
  const overview = await client.get(`/app/widgets/${widget.id}`);
  assert.match(overview.text, /Avete una piscina coperta\?/);
  const list = await client.get(`/app/widgets/${widget.id}/conversazioni`);
  assert.match(list.text, /A che ora è il check-in\?/);
  const detail = await client.get(`/app/widgets/${widget.id}/conversazioni/${conversationId}`);
  assert.match(detail.text, /Nessuna risposta trovata/);
  assert.match(detail.text, /Aggiungi una risposta a questa domanda/);
  assert.match(detail.text, /Laura Neri/);
});

test('risposte: aggiunta, modifica, uso immediato e escape HTML', async () => {
  const add = await client.post(`/app/widgets/${widget.id}/risposte`, { question: 'Avete la piscina? <script>alert(1)</script>', answer: 'Sì, piscina coperta aperta dalle 8 alle 20.', keywords: 'piscina nuoto' });
  assert.equal(add.status, 303);
  const page = await client.get(`/app/widgets/${widget.id}/risposte`);
  assert.ok(!page.text.includes('<script>alert(1)</script>'));
  assert.match(page.text, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);

  const r = await widgetApi(widget.public_id, '/messages', { visitorId: 'v2', text: 'c’è una piscina?' }, 'https://hotelprova.example');
  assert.match(r.data.reply.text, /piscina coperta aperta/);

  const k = (await M.listKnowledge(widget.id)).at(-1);
  await client.post(`/app/widgets/${widget.id}/risposte/${k.id}`, { question: 'Avete la piscina?', answer: 'Sì, aperta tutto l’anno.', keywords: 'piscina' });
  assert.equal((await M.getKnowledge(k.id)).answer, 'Sì, aperta tutto l’anno.');
  await client.post(`/app/widgets/${widget.id}/risposte/${k.id}/elimina`);
  assert.equal((await M.getKnowledge(k.id)), undefined);
});

test('aspetto: salvataggio e validazione', async () => {
  const r = await client.post(`/app/widgets/${widget.id}/aspetto`, {
    name: 'Hotel Prova', title: 'Reception', subtitle: 'Online', avatarText: 'hp', color: '#123abc', position: 'left',
    welcomeMessage: 'Benvenuto!', launcherLabel: 'Domande?', quickReplies: 'Orari\nParcheggio\n\nPrezzi\nA\nB', fallbackMessage: 'Non lo so.',
    leadCapture: '1', privacyUrl: 'https://hotelprova.example/privacy',
  });
  assert.equal(r.status, 303);
  const s = (await M.getWidget(widget.id)).settings;
  assert.equal(s.color, '#123ABC');
  assert.equal(s.position, 'left');
  assert.equal(s.avatarText, 'HP');
  assert.deepEqual(s.quickReplies, ['Orari', 'Parcheggio', 'Prezzi', 'A']);
  assert.equal(s.askPhone, false);

  await client.post(`/app/widgets/${widget.id}/aspetto`, { name: 'Hotel Prova', title: 'X', welcomeMessage: 'Y', fallbackMessage: 'Z', color: 'javascript:alert(1)', privacyUrl: 'javascript:alert(1)' });
  const after = (await M.getWidget(widget.id)).settings;
  assert.equal(after.color, '#123ABC', 'colore non valido ignorato');
  assert.equal(after.privacyUrl, 'https://hotelprova.example/privacy', 'link privacy non valido rifiutato');
});

test('un cliente non vede né admin né assistenti di altri', async () => {
  const other = new Client();
  await other.post('/registrati', { company: 'Altro', name: 'Altro', email: 'altro@example.com', password: 'password-sicura-2', terms: '1' });
  assert.equal((await other.get(`/app/widgets/${widget.id}`)).status, 404);
  assert.equal((await other.post(`/app/widgets/${widget.id}/risposte`, { question: 'x', answer: 'y' })).status, 404);
  assert.equal((await other.get('/admin')).status, 404);
  const lead = (await M.listLeads({ widgetId: widget.id }))[0];
  assert.equal((await other.post(`/app/leads/${lead.id}/stato`, { status: 'closed' })).status, 404);
});

test('pausa: un assistente in pausa non compare sul sito', async () => {
  await client.post(`/app/widgets/${widget.id}/stato`, { status: 'paused' });
  assert.equal((await widgetApi(widget.public_id, '/config')).data.active, false);
  assert.equal((await widgetApi(widget.public_id, '/messages', { text: 'ciao' })).status, 403);
  await client.post(`/app/widgets/${widget.id}/stato`, { status: 'active' });
  assert.equal((await widgetApi(widget.public_id, '/config')).data.active, true);
});

test('accesso: errori, redirect interni e uscita', async () => {
  const c = new Client();
  const wrong = await c.post('/accedi', { email: 'mario@hotelprova.example', password: 'sbagliata' });
  assert.equal(wrong.status, 401);
  assert.match(wrong.text, /Email o password non corretti/);
  const evil = await c.post('/accedi', { email: 'mario@hotelprova.example', password: 'password-sicura-1', next: '//evil.com' });
  assert.equal(evil.location, '/app');
  const out = await c.post('/esci');
  assert.equal(out.location, '/');
  assert.equal((await c.get('/app')).status, 303);
});

test('admin: crea cliente con assistente e link di invito, il cliente lo attiva', async () => {
  const admin = new Client();
  const login = await admin.post('/accedi', { email: 'admin@test.local', password: 'admin-password-123' });
  assert.equal(login.location, '/admin');
  const dash = await admin.get('/admin');
  assert.match(dash.text, /Ricavi ricorrenti/);

  const r = await admin.post('/admin/accounts', {
    company: 'Ristorante Il Ponte', name: 'Paola', email: 'paola@ilponte.example', sector: 'ristorante',
    plan: 'start', status: 'active', createWidget: '1', siteUrl: 'https://ilponte.example',
  });
  assert.equal(r.status, 303);
  const page = await admin.get(r.location);
  const link = page.text.match(/(http:\/\/localhost:\d+\/invito\/[\w-]+)/)[1];
  assert.match(page.text, /Link di invito pronto/);
  assert.match(page.text, /mailto:paola%40ilponte\.example/);
  const again = await admin.get(r.location);
  assert.ok(!again.text.includes(link), 'il link si vede una volta sola');

  const account = (await M.listAccounts({ q: 'Il Ponte' }))[0];
  assert.equal(account.plan, 'start');
  assert.equal(account.widget_count, 1);

  const client2 = new Client();
  const invitePage = await client2.get(link.replace(BASE, ''));
  assert.match(invitePage.text, /Imposta la tua password/);
  const accept = await client2.post(link.replace(BASE, ''), { name: 'Paola Verdi', password: 'password-paola-1' });
  assert.equal(accept.location, '/app');
  const home = await client2.get('/app');
  assert.match(home.text, /Ristorante Il Ponte/);
  assert.equal((await new Client().get(link.replace(BASE, ''))).status, 404, 'invito usato una sola volta');

  // Il piano Start consente un solo assistente
  assert.equal((await client2.post('/app/widgets', { name: 'Secondo' })).status, 403);
});

test('admin: accesso come cliente e ritorno', async () => {
  const admin = new Client();
  await admin.post('/accedi', { email: 'admin@test.local', password: 'admin-password-123' });
  const account = (await M.listAccounts({ q: 'Hotel Prova' }))[0];
  const imp = await admin.post(`/admin/accounts/${account.id}/impersonate`);
  assert.equal(imp.location, '/app');
  const home = await admin.get('/app');
  assert.match(home.text, /Stai usando la dashboard di/);
  assert.match(home.text, /mario@hotelprova.example/);
  assert.equal((await admin.get('/admin')).status, 404, 'durante l’accesso come cliente non si è admin');
  const stop = await admin.post('/admin/impersonate/stop');
  assert.equal(stop.location, `/admin/accounts/${account.id}`);
  assert.equal((await admin.get('/admin')).status, 200);
});

test('admin: cambio piano, sospensione e prova scaduta bloccano il widget', async () => {
  const admin = new Client();
  await admin.post('/accedi', { email: 'admin@test.local', password: 'admin-password-123' });
  const account = (await M.listAccounts({ q: 'Hotel Prova' }))[0];
  await admin.post(`/admin/accounts/${account.id}`, { name: account.name, plan: 'business', status: 'suspended', sector: 'hotel' });
  assert.equal((await M.getAccount(account.id)).plan, 'business');
  assert.equal((await widgetApi(widget.public_id, '/config')).data.active, false);
  await admin.post(`/admin/accounts/${account.id}`, { name: account.name, plan: 'business', status: 'trial', trialEnds: '2020-01-01', sector: 'hotel' });
  assert.equal((await widgetApi(widget.public_id, '/config')).data.active, false, 'prova scaduta');
  await admin.post(`/admin/accounts/${account.id}`, { name: account.name, plan: 'business', status: 'active', sector: 'hotel' });
  assert.equal((await widgetApi(widget.public_id, '/config')).data.active, true);
  const list = await admin.get('/admin/accounts?q=Hotel');
  assert.match(list.text, /Hotel Prova/);
  assert.equal((await admin.get('/admin/widgets')).status, 200);
  assert.match((await admin.get('/admin/leads')).text, /Laura Neri/);
});

test('admin: eliminazione cliente con conferma', async () => {
  const admin = new Client();
  await admin.post('/accedi', { email: 'admin@test.local', password: 'admin-password-123' });
  const account = (await M.listAccounts({ q: 'Altro' }))[0];
  await admin.post(`/admin/accounts/${account.id}/elimina`, { confirm: 'sbagliato' });
  assert.ok((await M.getAccount(account.id)));
  await admin.post(`/admin/accounts/${account.id}/elimina`, { confirm: 'Altro' });
  assert.equal((await M.getAccount(account.id)), undefined);
  assert.equal((await M.findUserByEmail('altro@example.com')), undefined);
});

test('pagina chat ospitata e plugin WordPress', async () => {
  const page = await new Client().get(`/c/${widget.public_id}`);
  assert.equal(page.status, 200);
  assert.match(page.text, /data-mode="page"/);
  assert.match(page.headers.get('content-security-policy'), /frame-ancestors \*/);
  const zip = await fetch(`${BASE}/download/aperto-wordpress.zip`);
  assert.equal(zip.headers.get('content-type'), 'application/zip');
  const buf = Buffer.from(await zip.arrayBuffer());
  assert.equal(buf.readUInt32LE(0), 0x04034b50);
});

test('limite di frequenza dei messaggi', async () => {
  let last;
  for (let i = 0; i < 22; i++) last = await widgetApi(widget.public_id, '/messages', { visitorId: 'flood', text: `messaggio ${i}` });
  assert.equal(last.status, 429);
});
