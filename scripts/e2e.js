// Prova end-to-end in un browser vero (Chrome headless via DevTools Protocol, nessuna dipendenza).
// - Avvia Aperto su un database temporaneo con i dati di esempio.
// - Avvia un secondo server che finge di essere il sito di un cliente (vecchio stile, CSS aggressivo).
// - Usa il widget come un visitatore, entra in dashboard come cliente e come admin.
// - Salva screenshot in ./screenshots e fallisce se trova errori nella console.
// Uso: npm run e2e   (CHROME_PATH per indicare il browser se non viene trovato)
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const APP_PORT = 3150;
const SITE_PORT = 3151;
const DEBUG_PORT = 9333;
const BASE = `http://localhost:${APP_PORT}`;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aperto-e2e-'));
Object.assign(process.env, {
  DB_PATH: path.join(tmp, 'e2e.db'), PORT: String(APP_PORT), BASE_URL: BASE,
  ADMIN_EMAIL: 'admin@e2e.local', ADMIN_PASSWORD: 'admin-e2e-password',
});

const outDir = path.resolve('screenshots');
fs.mkdirSync(outDir, { recursive: true });

await import('./seed.js');
const M = await import('../src/models.js');
const { startServer } = await import('../src/server.js');
const app = await startServer(APP_PORT);

// Assistente installato sul "sito del cliente" (localhost:3151): autorizzato solo su localhost.
const locanda = (await M.listWidgets((await M.findUserByEmail('info@locandalemura.example')).account_id))[0];
await M.updateWidget(locanda.id, { allowedDomains: ['localhost'] });
// Un secondo assistente autorizzato altrove: sul sito di prova NON deve comparire.
const pizzeria = (await M.listWidgets((await M.findUserByEmail('ordini@pizzeriadagino.example')).account_id))[0];
await M.updateAccount(pizzeria.account_id, { status: 'active' });

const OLD_SITE = `<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.01 Transitional//EN">
<html><head><meta http-equiv="Content-Type" content="text/html; charset=utf-8"><title>Locanda Le Mura - Camere</title>
<style>
  * { font-family: "Comic Sans MS", cursive !important; color: #a00 !important; box-sizing: content-box !important; }
  button { display: none !important; } textarea, input { border: 5px dotted red !important; }
  div { padding: 3px; background: #ffe !important; }
</style></head>
<body bgcolor="#ffffee"><table width="760" border="1" cellpadding="8"><tr><td>
<h1>Locanda Le Mura</h1><p>Benvenuti nel nostro sito. Le nostre camere sono accoglienti.</p>
<p><font size="2">Sito realizzato nel 2009</font></p></td></tr></table>
<script type="text/javascript" src="${BASE}/w.js" data-id="${locanda.public_id}" async></script>
<script type="text/javascript" src="${BASE}/w.js" data-id="${pizzeria.public_id}" async></script>
</body></html>`;
const MODERN_SITE = `<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Locanda Le Mura</title><style>body{font-family:system-ui;margin:0;padding:24px}</style></head>
<body><h1>Locanda Le Mura</h1><p>Sito moderno e responsive.</p>
<script src="${BASE}/w.js" data-id="${locanda.public_id}" async></script></body></html>`;
const site = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(req.url.startsWith('/moderno') ? MODERN_SITE : OLD_SITE);
}).listen(SITE_PORT);

// ---------- Chrome ----------
const chromeCandidates = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome', '/usr/bin/chromium',
].filter(Boolean);
const chromePath = chromeCandidates.find((p) => fs.existsSync(p));
if (!chromePath) throw new Error('Chrome non trovato: imposta CHROME_PATH');
const profile = path.join(tmp, 'chrome');
const chrome = spawn(chromePath, [
  '--headless=new', `--remote-debugging-port=${DEBUG_PORT}`, `--user-data-dir=${profile}`,
  '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--hide-scrollbars', 'about:blank',
], { stdio: 'ignore' });

let version;
for (let i = 0; i < 50 && !version; i++) {
  try {
    version = await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`)).json();
  } catch {
    await sleep(200);
  }
}
if (!version) throw new Error('Chrome non risponde');

const ws = new WebSocket(version.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let nextId = 0;
const pending = new Map();
const listeners = [];
ws.addEventListener('message', (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? reject(new Error(`${msg.error.message}`)) : resolve(msg.result);
  } else if (msg.method) {
    for (const l of listeners) l(msg);
  }
});
const cdp = (method, params = {}, sessionId) =>
  new Promise((resolve, reject) => {
    const id = ++nextId;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params, sessionId }));
  });

const { targetId } = await cdp('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await cdp('Target.attachToTarget', { targetId, flatten: true });
const page = (method, params) => cdp(method, params, sessionId);
await page('Page.enable');
await page('Runtime.enable');
await page('Log.enable');

const problems = [];
const warnings = [];
let currentUrl = '';
listeners.push((msg) => {
  if (msg.sessionId !== sessionId) return;
  if (msg.method === 'Runtime.exceptionThrown') problems.push(`${currentUrl}: eccezione ${msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text}`);
  if (msg.method === 'Runtime.consoleAPICalled') {
    const text = msg.params.args.map((a) => a.value ?? a.description ?? '').join(' ');
    if (msg.params.type === 'error') problems.push(`${currentUrl}: console.error ${text}`);
    if (msg.params.type === 'warning') warnings.push(text);
  }
  if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error') {
    const t = msg.params.entry.text;
    const u = msg.params.entry.url || '';
    // Errori voluti, verificati a parte: 403 dell'assistente non autorizzato,
    // 422 del modulo contatti inviato senza consenso, avviso "modifiche non salvate" lasciando l'anteprima.
    const expected = u.includes(pizzeria.public_id) || (u.endsWith('/leads') && t.includes('422')) || t.includes('beforeunload');
    if (!expected) problems.push(`${currentUrl}: ${t} ${u}`);
  }
});

async function viewport(width, height, mobile = false) {
  await page('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile });
}
async function goto(url) {
  currentUrl = url;
  const loaded = new Promise((r) => {
    const l = (m) => { if (m.sessionId === sessionId && m.method === 'Page.loadEventFired') { listeners.splice(listeners.indexOf(l), 1); r(); } };
    listeners.push(l);
  });
  await page('Page.navigate', { url });
  await loaded;
  await sleep(900); // fine della transizione tra pagine e delle comparse
}
async function evaluate(expression) {
  const r = await page('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(`Errore JS: ${r.exceptionDetails.exception?.description || r.exceptionDetails.text}`);
  return r.result.value;
}
async function waitFor(expression, label, timeout = 6000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (await evaluate(expression)) return;
    await sleep(100);
  }
  throw new Error(`Timeout: ${label}`);
}
async function shot(name, { full = false } = {}) {
  let clip;
  if (full) {
    const { cssContentSize } = await page('Page.getLayoutMetrics');
    clip = { x: 0, y: 0, width: cssContentSize.width, height: Math.min(cssContentSize.height, 16000), scale: 1 };
  }
  const { data } = await page('Page.captureScreenshot', { format: 'png', captureBeyondViewport: full, ...(clip ? { clip } : {}) });
  fs.writeFileSync(path.join(outDir, `${name}.png`), Buffer.from(data, 'base64'));
}
async function submitForm(formSelector, values) {
  await evaluate(`(() => {
    const f = document.querySelector(${JSON.stringify(formSelector)});
    const v = ${JSON.stringify(values)};
    for (const [k, val] of Object.entries(v)) {
      const el = f.querySelector('[name="' + k + '"]');
      if (el.type === 'checkbox') el.checked = !!val; else el.value = val;
    }
    f.requestSubmit();
  })()`);
}
async function login(email, password) {
  await goto(`${BASE}/accedi`);
  const loaded = new Promise((r) => {
    const l = (m) => { if (m.sessionId === sessionId && m.method === 'Page.loadEventFired') { listeners.splice(listeners.indexOf(l), 1); r(); } };
    listeners.push(l);
  });
  await submitForm('form[action="/accedi"]', { email, password });
  await loaded;
  await sleep(900);
}

const W = (pid) => `document.querySelector('#aperto-${pid}')`;
const S = (pid) => `${W(pid)}.shadowRoot`;
// Scrive nel widget come farebbe un visitatore e attende la risposta.
async function askWidget(pid, text) {
  const before = await evaluate(`${S(pid)}.querySelectorAll('.msg.bot').length`);
  await evaluate(`(() => {
    const r = ${S(pid)};
    const ta = r.querySelector('textarea');
    ta.value = ${JSON.stringify(text)};
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    ta.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  })()`);
  await waitFor(`${S(pid)}.querySelectorAll('.msg.bot').length > ${before}`, `risposta a "${text}"`);
  return evaluate(`[...${S(pid)}.querySelectorAll('.msg.bot')].at(-1).textContent`);
}

// Su un telefono vero Chrome rimpicciolisce le pagine troppo larghe: innerWidth cresce e nasconde il problema.
// Per questo si misura contro la larghezza reale del telefono (390px), non contro la finestra.
const PHONE_WIDTH = 390;
async function checkFitsPhone(label) {
  const layoutWidth = await evaluate('innerWidth');
  const wide = await evaluate(`[...document.querySelectorAll('body *')].filter(e => {
      // esclude ciò che sta dentro un contenitore che scorre da solo (marquee, blocchi di codice, tabelle)
      const r = e.getBoundingClientRect(); return r.width && r.right > ${PHONE_WIDTH} + 1 && !e.closest('.marquee, pre, .table-wrap, .tabs, .side-nav, .demo-tabs, [data-aperto], .section-video');
    }).slice(0, 5).map(e => e.tagName.toLowerCase() + '.' + [...e.classList].join('.') + ' ' + Math.round(e.getBoundingClientRect().right))`);
  const ok = layoutWidth <= PHONE_WIDTH && !wide.length;
  check(ok, `${label}: niente esce dallo schermo da ${PHONE_WIDTH}px${ok ? '' : ` — pagina larga ${layoutWidth}px, sporgono: ${wide.join(', ') || '—'}`}`);
}

const results = [];
const check = (ok, label) => {
  results.push([ok, label]);
  if (!ok) problems.push(`Verifica fallita: ${label}`);
};

try {
  // ---------- 1. Sito del cliente (dominio diverso, HTML del 2009, CSS aggressivo) ----------
  await viewport(1280, 860);
  await goto(`http://localhost:${SITE_PORT}/`);
  await waitFor(`!!${W(locanda.public_id)}`, 'widget sul sito del cliente');
  await sleep(400);
  check(!(await evaluate(`!!${W(pizzeria.public_id)}`)), 'assistente non autorizzato per il dominio: non compare');
  check(warnings.some((w) => w.includes('Dominio non autorizzato')), 'avviso in console per il dominio non autorizzato');
  check(await evaluate(`getComputedStyle(${S(locanda.public_id)}.querySelector('.launcher')).display !== 'none'`), 'il CSS del sito (button{display:none}) non nasconde il widget');
  await shot('01-sito-cliente-chiuso');
  await evaluate(`${S(locanda.public_id)}.querySelector('.launcher').click()`);
  await sleep(700);
  check(await evaluate(`${S(locanda.public_id)}.querySelector('.notice').textContent.includes('assistente virtuale')`), 'avviso AI Act visibile');
  const a1 = await askWidget(locanda.public_id, 'A che ora è il check-in?');
  check(a1.includes('14:00'), `risposta check-in: "${a1.slice(0, 60)}…"`);
  const a2 = await askWidget(locanda.public_id, 'Avete un centro benessere con sauna?');
  check(a2.includes('Non ho una risposta sicura'), 'fallback onesto su domanda sconosciuta');
  await waitFor(`!!${S(locanda.public_id)}.querySelector('form.lead')`, 'modulo contatti');
  await shot('02-sito-cliente-conversazione');
  // invio senza consenso → errore mostrato
  await evaluate(`(() => { const f = ${S(locanda.public_id)}.querySelector('form.lead');
    f.querySelector('[name=name]').value = 'Sara Galli'; f.querySelector('[name=email]').value = 'sara@example.com';
    f.querySelector('.btn').click(); })()`);
  await waitFor(`[...${S(locanda.public_id)}.querySelectorAll('.ferr')].some(e => e.textContent.includes('consenso'))`, 'errore consenso');
  await evaluate(`(() => { const f = ${S(locanda.public_id)}.querySelector('form.lead');
    f.querySelector('input[type=checkbox]').checked = true; f.querySelector('.btn').click(); })()`);
  await waitFor(`[...${S(locanda.public_id)}.querySelectorAll('.msg.bot')].some(e => e.textContent.includes('Grazie Sara'))`, 'conferma contatto');
  await shot('03-sito-cliente-contatto-inviato');
  check((await M.listLeads({ widgetId: locanda.id })).some((l) => l.name === 'Sara Galli' && !l.is_test), 'contatto salvato nel database');
  // la conversazione sopravvive al cambio pagina
  await goto(`http://localhost:${SITE_PORT}/altra-pagina`);
  await waitFor(`!!${W(locanda.public_id)}`, 'widget dopo cambio pagina');
  await sleep(700);
  check(await evaluate(`${S(locanda.public_id)}.querySelectorAll('.msg').length >= 5`), 'la conversazione resta tra una pagina e l’altra');

  // mobile
  await viewport(390, 780, true);
  await goto(`http://localhost:${SITE_PORT}/`);
  await waitFor(`!!${W(locanda.public_id)}`, 'widget mobile');
  await evaluate(`${S(locanda.public_id)}.querySelector('.launcher').click()`);
  await sleep(700);
  // Sito vecchio senza meta viewport: il telefono lo impagina a 980px e lo rimpicciolisce.
  const fill = `(() => { const r = ${S(locanda.public_id)}.querySelector('.panel').getBoundingClientRect();
    return r.left <= 1 && r.top <= 1 && r.right >= innerWidth - 2 && r.bottom >= innerHeight - 2; })()`;
  check(await evaluate('innerWidth') > 390, `sito vecchio: pagina impaginata a ${await evaluate('innerWidth')}px su un telefono da 390px`);
  check(await evaluate(fill), 'sito vecchio su mobile: la chat occupa tutto lo schermo');
  check(Number(await evaluate(`${S(locanda.public_id)}.querySelector('.sp').style.zoom`)) > 2, 'sito vecchio su mobile: il widget si ingrandisce per restare leggibile');
  await shot('04-sito-vecchio-mobile');
  await goto(`http://localhost:${SITE_PORT}/moderno`);
  await waitFor(`!!${W(locanda.public_id)}`, 'widget sito moderno');
  await evaluate(`${S(locanda.public_id)}.querySelector('.launcher').click()`);
  await sleep(700);
  check(await evaluate(fill), 'sito moderno su mobile: la chat occupa tutto lo schermo');
  await shot('05-sito-moderno-mobile');

  // ---------- 2. Landing page ----------
  await viewport(1440, 900);
  await goto(`${BASE}/`);
  // demo animata dell'hero: i messaggi compaiono uno alla volta e arriva la notifica del contatto
  check((await evaluate(`document.querySelectorAll('[data-demo-log] p').length`)) < 4, 'demo hero: la conversazione parte da capo e si costruisce');
  await waitFor(`document.querySelector('[data-demo-notify]').classList.contains('is-shown')`, 'notifica nuovo contatto nella demo', 9000);
  check((await evaluate(`document.querySelectorAll('[data-demo-log] .m-bot').length`)) === 2, 'demo hero: due risposte dell’assistente');
  await sleep(700);
  const noOverlap = `(() => { const a = document.querySelector('[data-demo-notify]').getBoundingClientRect();
    const b = document.querySelector('[data-demo-chat]').getBoundingClientRect();
    return a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top; })()`;
  check(await evaluate(noOverlap), 'demo hero: la notifica non copre la chat (desktop)');
  await shot('11-landing-hero');
  await evaluate(`document.querySelector('[data-demo-tab=sanita]').click()`);
  await waitFor(`document.querySelector('[data-demo-site]').textContent === 'studiobianchi.it'`, 'cambio settore nella demo');
  await waitFor(`document.querySelector('[data-demo-notify]').classList.contains('is-shown')`, 'demo studio medico completa', 9000);
  check((await evaluate(`document.querySelector('[data-demo-tab=sanita]').getAttribute('aria-selected')`)) === 'true', 'demo hero: scheda settore selezionata e accessibile');
  await shot('11b-landing-hero-studio');
  check(await evaluate(`(() => { const col = document.querySelector('.hero-copy').getBoundingClientRect();
    const r = document.createRange(); r.selectNodeContents(document.querySelector('.display'));
    return [...r.getClientRects()].every(b => b.right <= col.right + 1); })()`), 'hero: il titolo resta nella sua colonna (va a capo, non finisce sotto la demo)');
  // sfera di particelle: disegnata davvero, e cambia posizione/forma passando da una sezione all'altra
  const orbState = `(() => { const c = document.querySelector('[data-orb-canvas]'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let n = 0, sx = 0, sy = 0; for (let i = 3, p = 0; i < d.length; i += 64, p += 16) if (d[i] > 20) { n++; sx += p % c.width; sy += Math.floor(p / c.width); }
    return { n, x: n ? sx / n / c.width : 0, y: n ? sy / n / c.height : 0 }; })()`;
  const orbHero = await evaluate(orbState);
  check(orbHero.n > 400, `sfera: disegnata nell'hero (${orbHero.n} punti accesi)`);
  check(!(await evaluate(`!!document.querySelector('.loader') && getComputedStyle(document.querySelector('.loader')).visibility !== 'hidden'`)), 'caricamento: il sipario si è alzato');
  check((await evaluate(`getComputedStyle(document.querySelector('.loader-n')).getPropertyValue('--n').trim()`)) === '100', 'caricamento: la percentuale arriva a 100%');

  // racconto a scroll "Una notte": lo stato segue la posizione di scroll, avanti e indietro
  const storyAt = (p) => evaluate(`(async () => {
    const s = document.querySelector('[data-story]');
    const top = s.getBoundingClientRect().top + scrollY;
    scrollTo({ top: top + (s.offsetHeight - innerHeight) * ${p}, behavior: 'instant' });
    await new Promise(r => setTimeout(r, 900));
    const c = document.querySelector('[data-field=sky]');
    const px = c.getContext('2d').getImageData(4, 4, 1, 1).data; const hz = c.getContext('2d').getImageData(Math.round(c.width * 0.3), Math.round(c.height * 0.93), 1, 1).data;
    return { clock: document.querySelector('[data-clock]').textContent,
      day: document.querySelector('.story-sticky').classList.contains('is-day'),
      chapter: [...document.querySelectorAll('[data-chapter]')].findIndex(l => l.classList.contains('is-active')),
      msgs: document.querySelectorAll('.sb-msg.is-on').length, lead: !!document.querySelector('.sb-lead.is-on'),
      notes: document.querySelectorAll('.sp-note.is-on').length, answered: document.querySelector('[data-answered]').textContent,
      sky: px[0] + px[1] + px[2], horizon: hz[0] + hz[1] + hz[2], warm: hz[0] - hz[2] };
  })()`);
  const s0 = await storyAt(0.02);
  check(s0.clock === '22:40' && s0.chapter === 0 && s0.msgs === 0 && !s0.day, `storia, inizio: 22:40, notte, nessun messaggio (${JSON.stringify(s0)})`);
  await shot('14-storia-notte');
  const s1 = await storyAt(0.3);
  check(s1.chapter === 1 && s1.msgs >= 2 && !s1.lead, `storia, risposta: capitolo 2 e risposta visibile (${s1.msgs} messaggi)`);
  await shot('15-storia-risposta');
  const s2 = await storyAt(0.55);
  check(s2.chapter === 2 && s2.lead, 'storia, contatto: modulo compilato visibile');
  await shot('16-storia-contatto');
  const s3 = await storyAt(0.99);
  check(s3.day && s3.clock === '08:30' && s3.chapter === 3 && s3.notes === 3 && s3.answered === '27', `storia, mattino: 08:30, giorno, 3 notifiche, 27 risposte (${JSON.stringify(s3)})`);
  check(s3.horizon > s0.horizon + 120 && s3.warm > 30, `storia: all’alba l’orizzonte si scalda (luminosità ${s0.horizon} → ${s3.horizon}, rosso−blu ${s3.warm})`);
  check(s3.sky < 120, `storia: in alto il cielo resta notte, niente modalità chiara (luminosità ${s3.sky})`);
  check(await evaluate(`getComputedStyle(document.querySelector('.story-browser')).backgroundColor.match(/\\d+/g).slice(0, 3).reduce((a, b) => a + +b, 0) < 200`), 'storia: la finestra del sito resta scura all’alba');
  check(await evaluate(`(() => { const a = document.querySelector('.story-phone').getBoundingClientRect();
    const b = document.querySelector('.sb-chat').getBoundingClientRect();
    return a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top; })()`), 'storia: il telefono non copre la chat');
  check(await evaluate(`[...document.querySelectorAll('.sb-msg.is-on')].every(m => m.scrollHeight <= m.clientHeight + 1)`), 'storia: nessun messaggio schiacciato o tagliato');
  await shot('17-storia-mattino');
  const back = await storyAt(0.3);
  check(!back.day && back.notes === 0 && back.chapter === 1, 'storia: tornando indietro con lo scroll la notte si riavvolge');

  // ---- motore di scroll: ogni effetto segue la posizione e si riavvolge ----
  // porta il bordo alto dell'elemento a una frazione dell'altezza dello schermo (0 = in alto, 1 = in fondo)
  const placeAt = (sel, frac) => evaluate(`(async () => {
    const el = document.querySelector(${JSON.stringify(sel)});
    const top = el.getBoundingClientRect().top + scrollY;
    scrollTo({ top: top - innerHeight * ${frac}, behavior: 'instant' });
    await new Promise(r => setTimeout(r, 700));
  })()`);
  // scorre dentro una sezione fissata (sticky) in base all'avanzamento 0..1
  const pinnedAt = (sel, p) => evaluate(`(async () => {
    const el = document.querySelector(${JSON.stringify(sel)});
    const top = el.getBoundingClientRect().top + scrollY;
    scrollTo({ top: top + (el.offsetHeight - innerHeight) * ${p}, behavior: 'instant' });
    await new Promise(r => setTimeout(r, 700));
  })()`);
  const lastWordOpacity = `Number(getComputedStyle([...document.querySelectorAll('.manifesto-text .w > span')].at(-1)).opacity)`;

  await evaluate(`scrollTo({ top: 420, behavior: 'instant' })`);
  await sleep(600);
  check((await evaluate(`Number(getComputedStyle(document.querySelector('.hero-copy')).opacity)`)) < 0.95, 'hero: il testo si dissolve scorrendo verso il basso');

  await pinnedAt('.manifesto', 0.02);
  check((await evaluate(lastWordOpacity)) < 0.3, 'dichiarazione: all’inizio le ultime parole sono spente');
  await pinnedAt('.manifesto', 0.5);
  await shot('18-dichiarazione');
  await pinnedAt('.manifesto', 0.98);
  check((await evaluate(lastWordOpacity)) > 0.95, 'dichiarazione: alla fine tutte le parole sono accese');

  await placeAt('.steps', 0.97);
  check((await evaluate(`document.querySelectorAll('.steps > .is-on').length`)) === 0, 'come funziona: i passaggi sono spenti prima di arrivarci');
  await placeAt('.steps', 0.6);
  const midSteps = await evaluate(`document.querySelectorAll('.steps > .is-on').length`);
  check(midSteps >= 1 && midSteps < 3, `come funziona: i passaggi si accendono uno alla volta (${midSteps} di 3 a metà strada)`);
  await shot('19-come-funziona-in-corso');
  await placeAt('.step-row:last-child', 0.35);
  check((await evaluate(`document.querySelectorAll('.steps > .is-on').length`)) === 3, 'come funziona: tutti i passaggi accesi');
  check((await evaluate(`parseFloat(getComputedStyle(document.querySelector('.step-row:last-child .art-grid rect')).strokeDashoffset)`)) < 0.3, 'come funziona: il disegno al tratto si completa con lo scroll');
  await placeAt('.code-card', 0.1);
  check(await evaluate(`document.querySelector('[data-scroll=type]').classList.contains('is-typed') && document.querySelector('[data-type]').textContent.includes('w.js')`), 'come funziona: il codice si scrive da solo fino in fondo');
  await placeAt('.steps', 0.97);
  check((await evaluate(`document.querySelectorAll('.steps > .is-on').length`)) === 0, 'come funziona: tornando su i passaggi si spengono di nuovo');

  // agenzie: la sezione si apre dal centro con bordi sfumati (maschera ellittica) mentre il contenuto sale
  const agencyLift = `parseFloat(getComputedStyle(document.querySelector('#agenzie > .wrap')).translate.split(' ')[1] || '0')`;
  await placeAt('#agenzie', 0.85);
  const maskStart = await evaluate(`getComputedStyle(document.querySelector('#agenzie')).maskImage`);
  const liftStart = await evaluate(agencyLift);
  check(/radial-gradient/.test(maskStart) && liftStart > 10, `agenzie: entra con un'apertura sfumata dal centro (contenuto ancora ${Math.round(liftStart)}px più in basso)`);
  await placeAt('#agenzie', 0.45);
  await shot('20-agenzie-apertura');
  await placeAt('#agenzie', 0.02);
  const liftEnd = await evaluate(agencyLift);
  check(liftEnd < 0.5, `agenzie: apertura completa, contenuto al suo posto (${liftEnd.toFixed(2)}px)`);
  await sleep(1500);
  check(await evaluate(`(() => { const v = document.querySelector('#agenzie video'); return !!v.currentSrc && !v.paused && v.readyState >= 2; })()`), 'agenzie: il video di sfondo è caricato e in riproduzione');
  await shot('21-agenzie-video');

  await placeAt('.pricing', 0.9);
  check((await evaluate(`Number(getComputedStyle(document.querySelector('.plan')).opacity)`)) < 0.5, 'prezzi: i piani sono ancora abbassati prima di arrivarci');
  await placeAt('.pricing', 0.55);
  await shot('22-prezzi-in-salita');
  await placeAt('#regole .bento', 0.25);
  await sleep(900);
  const orbBento = await evaluate(orbState);
  check(orbBento.n > 400 && Math.abs(orbBento.y - orbHero.y) > 0.15, `sfera: si sposta e cambia forma tra hero e regole (y ${orbHero.y.toFixed(2)} → ${orbBento.y.toFixed(2)})`);
  await shot('19b-regole-bento');
  await placeAt('.pricing', 0.08);
  check(await evaluate(`[...document.querySelectorAll('.plan')].every(p => Number(getComputedStyle(p).opacity) > 0.98)`), 'prezzi: tutti i piani alzati e visibili');
  check(await evaluate(`document.querySelector('.nav a[href="/#prezzi"]').classList.contains('is-current')`), 'menu: evidenzia la sezione Prezzi mentre la si legge');
  check(await evaluate(`(() => { const a = document.querySelector('.nav a[href="/#prezzi"]').getBoundingClientRect(); const ink = document.querySelector('.nav-ink').getBoundingClientRect();
    return Math.abs(a.left - ink.left) < 2 && Math.abs(a.width - ink.width) < 2; })()`), 'menu: la pillola si posiziona sotto la voce corrente');

  await placeAt('.cta-final', 0.1);
  await sleep(1200);
  check(await evaluate(`[...document.querySelectorAll('.words-scrub .w > span')].every(s => Number(getComputedStyle(s).opacity) > 0.95)`), 'chiamata finale: il titolo si accende tutto');
  await shot('23-chiamata-finale');
  check(await evaluate(`[...document.querySelectorAll('video[data-src]')].every(v => !v.currentSrc || v.closest('section') !== null)`), 'video: caricati solo quando servono');

  // scorre la pagina come un visitatore, così le sezioni animate compaiono
  await evaluate(`(async () => { for (let y = 0; y < document.body.scrollHeight; y += 500) { scrollTo(0, y); await new Promise(r => setTimeout(r, 120)); } })()`);
  await sleep(1600);
  check((await evaluate(`[...document.querySelectorAll('[data-reveal]')].filter(e => !e.classList.contains('is-in')).length`)) === 0, 'tutte le sezioni compaiono durante lo scroll');
  check((await evaluate(`document.querySelector('[data-count="25"]').textContent`)) === '25', 'contatori animati arrivano al valore finale');
  await evaluate('scrollTo(0, 0)');
  await sleep(400);
  await shot('10-landing-desktop', { full: true });
  await evaluate(`document.querySelector('[data-billing=yearly]').click()`);
  await waitFor(`document.querySelector('.plan-featured .price-n').textContent === '66'`, 'prezzo annuale animato');
  check((await evaluate(`document.querySelector('.plan-featured .price-n').textContent`)) === '66', 'prezzi annuali: Pro 66 €/mese');
  await evaluate(`document.querySelector('[data-open-demo]').click()`);
  await waitFor(`!!${S('wdg_apertodemo')} && ${S('wdg_apertodemo')}.querySelector('.sp').classList.contains('open')`, 'demo aperta');
  const demo = await askWidget('wdg_apertodemo', 'quanto costa al mese?');
  check(demo.includes('29 €'), 'la demo della landing risponde sui prezzi');
  await shot('12-landing-demo');
  await viewport(390, 844, true);
  await goto(`${BASE}/`);
  // sul telefono la demo sta sotto il titolo: parte quando il visitatore ci arriva
  await evaluate(`document.querySelector('.hero-stage').scrollIntoView({ block: 'center', behavior: 'instant' })`);
  await waitFor(`document.querySelector('[data-demo-notify]').classList.contains('is-shown')`, 'demo mobile completa', 11000);
  await sleep(700);
  check(await evaluate(noOverlap), 'demo hero: la notifica non copre la chat (mobile)');
  await shot('13b-landing-mobile-hero');
  const m1 = await storyAt(0.3);
  check(m1.chapter === 1 && m1.msgs >= 2, 'storia su mobile: funziona anche sul telefono');
  check(await evaluate(`(() => { const a = document.querySelector('.story-counter').getBoundingClientRect();
    const b = document.querySelector('.sb-chat').getBoundingClientRect();
    return (a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top) && a.bottom <= innerHeight; })()`), 'storia su mobile: il contatore non copre la chat ed è visibile');
  await shot('13c-storia-mobile-notte');
  await storyAt(0.99);
  await shot('13d-storia-mobile-mattino');
  // telefono basso (360×640, barre del browser comprese): il racconto deve stare tutto nello schermo
  await viewport(360, 640, true);
  for (const p of [0.3, 0.99]) {
    const fit = await storyAt(p).then(() => evaluate(`(() => { const vh = innerHeight; const q = (s) => document.querySelector(s).getBoundingClientRect();
      const clock = q('.story-clock'), chat = q('.sb-chat'), counter = q('.story-counter'), prog = q('.story-progress');
      return { ok: clock.top >= 56 && chat.bottom <= vh && chat.height > 220 && chat.width > innerWidth * 0.8 && prog.bottom <= chat.top && counter.bottom <= chat.top,
        clock: Math.round(clock.top), chat: [Math.round(chat.top), Math.round(chat.bottom), Math.round(chat.height)], vh }; })()`));
    check(fit.ok, `storia su telefono basso (${p === 0.3 ? 'notte' : 'mattino'}): orologio, testo e chat interi (${JSON.stringify(fit)})`);
  }
  await shot('13f-storia-telefono-basso');
  await viewport(390, 844, true);
  await evaluate(`scrollTo({ top: 0, behavior: 'instant' })`);
  await sleep(500);
  await shot('13-landing-mobile', { full: true });
  await checkFitsPhone('landing mobile');
  // menu mobile: foglio che sale dal basso e si chiude scegliendo una voce
  await evaluate(`document.querySelector('.mobile-nav summary').click()`);
  await sleep(800);
  check(await evaluate(`(() => { const p = document.querySelector('.mobile-panel').getBoundingClientRect(); return document.querySelector('.mobile-nav').open && p.bottom <= innerHeight && p.bottom > innerHeight - 40; })()`), 'menu mobile: il foglio si apre dal basso');
  await shot('13e-menu-mobile');
  await evaluate(`document.querySelector('.mobile-links a[href="/#prezzi"]').click()`);
  await sleep(300);
  check(!(await evaluate(`document.querySelector('.mobile-nav').open`)), 'menu mobile: si chiude scegliendo una voce');

  // ---------- 3. Dashboard cliente ----------
  await viewport(1440, 900);
  await login('info@locandalemura.example', 'demo-locanda-2026');
  check(currentUrl.includes('/accedi') && (await evaluate('location.pathname')) === '/app', 'accesso cliente');
  currentUrl = `${BASE}/app`;
  await shot('20-cliente-panoramica', { full: true });
  await goto(`${BASE}/app/widgets/${locanda.id}`);
  await shot('21-cliente-assistente', { full: true });
  await goto(`${BASE}/app/widgets/${locanda.id}/risposte`);
  await waitFor(`!!${W(locanda.public_id)}`, 'anteprima nella pagina risposte');
  await sleep(500);
  await shot('22-cliente-risposte');
  await goto(`${BASE}/app/widgets/${locanda.id}/aspetto`);
  await waitFor(`!!${W(locanda.public_id)}`, 'anteprima aspetto');
  await sleep(400);
  await evaluate(`(() => { const c = document.querySelector('input[name=color]'); c.value = '#1d4ed8'; c.dispatchEvent(new Event('input', { bubbles: true }));
    const t = document.querySelector('input[name=title]'); t.value = 'Reception Le Mura'; t.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await sleep(200);
  check((await evaluate(`${S(locanda.public_id)}.querySelector('.sp').style.getPropertyValue('--c')`)) === '#1d4ed8', 'anteprima dal vivo: colore aggiornato');
  check((await evaluate(`${S(locanda.public_id)}.querySelector('.title').textContent`)) === 'Reception Le Mura', 'anteprima dal vivo: titolo aggiornato');
  await shot('23-cliente-aspetto-anteprima');
  check(await evaluate(`(() => { const b = document.querySelector('.save-bar button[type=submit]').getBoundingClientRect();
    const p = ${S(locanda.public_id)}.querySelector('.panel').getBoundingClientRect();
    return b.right <= p.left || b.top >= p.bottom; })()`), 'aspetto: il pulsante Salva non è coperto dall’anteprima');
  await goto(`${BASE}/app/widgets/${locanda.id}/installazione`);
  await shot('24-cliente-installazione', { full: true });
  await goto(`${BASE}/app/widgets/${locanda.id}/conversazioni`);
  await shot('25-cliente-conversazioni', { full: true });
  const conv = (await M.listConversations(locanda.id)).find((c) => c.has_lead && c.unanswered);
  await goto(`${BASE}/app/widgets/${locanda.id}/conversazioni/${conv.public_id}`);
  await shot('26-cliente-conversazione-dettaglio', { full: true });
  await goto(`${BASE}/app/leads`);
  await shot('27-cliente-contatti', { full: true });
  await viewport(390, 844, true);
  await goto(`${BASE}/app`);
  await shot('28-cliente-mobile', { full: true });
  await checkFitsPhone('dashboard mobile');

  // ---------- 4. Pannello admin ----------
  await viewport(1440, 900);
  await page('Network.clearBrowserCookies').catch(() => {});
  await page('Network.enable');
  await page('Network.clearBrowserCookies');
  await login('admin@e2e.local', 'admin-e2e-password');
  check((await evaluate('location.pathname')) === '/admin', 'accesso admin');
  currentUrl = `${BASE}/admin`;
  await shot('30-admin-panoramica', { full: true });
  await goto(`${BASE}/admin/accounts`);
  await shot('31-admin-clienti', { full: true });
  await goto(`${BASE}/admin/accounts/new`);
  const loaded = new Promise((r) => {
    const l = (m) => { if (m.sessionId === sessionId && m.method === 'Page.loadEventFired') { listeners.splice(listeners.indexOf(l), 1); r(); } };
    listeners.push(l);
  });
  await submitForm('form[action="/admin/accounts"]', {
    company: 'Agriturismo Il Poggio', name: 'Franco Neri', email: 'franco@ilpoggio.example',
    sector: 'hotel', plan: 'pro', status: 'trial', createWidget: true, siteUrl: 'https://www.ilpoggio.example',
  });
  await loaded;
  await sleep(900);
  await sleep(700);
  currentUrl = await evaluate('location.href');
  check(await evaluate(`document.body.textContent.includes('Link di invito pronto')`), 'admin: link di invito mostrato dopo la creazione');
  await shot('32-admin-cliente-creato', { full: true });
  const accountPath = await evaluate('location.pathname');
  await goto(`${BASE}/admin/widgets`);
  await shot('33-admin-assistenti', { full: true });
  await goto(`${BASE}${accountPath}`);
  await evaluate(`document.querySelector('form[action$="/impersonate"]').requestSubmit()`);
  await sleep(800);
  currentUrl = await evaluate('location.href');
  check(await evaluate(`document.body.textContent.includes('come amministratore')`), 'admin: accesso come cliente con banner');
  await shot('34-admin-come-cliente');

  // ---------- 5. Pagina chat ospitata ----------
  await goto(`${BASE}/c/${locanda.public_id}`);
  await waitFor(`!!${W(locanda.public_id)}`, 'chat ospitata');
  await sleep(700);
  await shot('40-chat-ospitata');
} catch (err) {
  problems.push(`Interrotto: ${err.message}`);
} finally {
  ws.close();
  chrome.kill();
  site.close();
  app.close();
}

for (const [ok, label] of results) console.log(`${ok ? '✔' : '✖'} ${label}`);
console.log(`\nScreenshot salvati in ${outDir}`);
if (problems.length) {
  console.log('\nProblemi trovati:');
  for (const p of problems) console.log(` - ${p}`);
  process.exitCode = 1;
} else {
  console.log('Nessun errore in console, tutte le verifiche superate.');
}
setTimeout(() => {
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* Chrome può tenere aperti dei file */ }
  process.exit();
}, 500);
