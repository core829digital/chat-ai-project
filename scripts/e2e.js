// Prova end-to-end in un browser vero (Chrome headless via DevTools Protocol, nessuna dipendenza).
// - Avvia Sportello su un database temporaneo con i dati di esempio.
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
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sportello-e2e-'));
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
const locanda = M.listWidgets(M.findUserByEmail('info@locandalemura.example').account_id)[0];
M.updateWidget(locanda.id, { allowedDomains: ['localhost'] });
// Un secondo assistente autorizzato altrove: sul sito di prova NON deve comparire.
const pizzeria = M.listWidgets(M.findUserByEmail('ordini@pizzeriadagino.example').account_id)[0];
M.updateAccount(pizzeria.account_id, { status: 'active' });

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
  await sleep(350);
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
}

const W = (pid) => `document.querySelector('#sportello-${pid}')`;
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
  await sleep(300);
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
  check(M.listLeads({ widgetId: locanda.id }).some((l) => l.name === 'Sara Galli' && !l.is_test), 'contatto salvato nel database');
  // la conversazione sopravvive al cambio pagina
  await goto(`http://localhost:${SITE_PORT}/altra-pagina`);
  await waitFor(`!!${W(locanda.public_id)}`, 'widget dopo cambio pagina');
  await sleep(300);
  check(await evaluate(`${S(locanda.public_id)}.querySelectorAll('.msg').length >= 5`), 'la conversazione resta tra una pagina e l’altra');

  // mobile
  await viewport(390, 780, true);
  await goto(`http://localhost:${SITE_PORT}/`);
  await waitFor(`!!${W(locanda.public_id)}`, 'widget mobile');
  await evaluate(`${S(locanda.public_id)}.querySelector('.launcher').click()`);
  await sleep(300);
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
  await sleep(300);
  check(await evaluate(fill), 'sito moderno su mobile: la chat occupa tutto lo schermo');
  await shot('05-sito-moderno-mobile');

  // ---------- 2. Landing page ----------
  await viewport(1440, 900);
  await goto(`${BASE}/`);
  await shot('10-landing-desktop', { full: true });
  await shot('11-landing-hero');
  await evaluate(`document.querySelector('[data-billing=yearly]').click()`);
  check((await evaluate(`document.querySelector('.plan-featured .price-n').textContent`)) === '66', 'prezzi annuali: Pro 66 €/mese');
  await evaluate(`document.querySelector('[data-open-demo]').click()`);
  await waitFor(`!!${S('wdg_sportellodemo')} && ${S('wdg_sportellodemo')}.querySelector('.sp').classList.contains('open')`, 'demo aperta');
  const demo = await askWidget('wdg_sportellodemo', 'quanto costa al mese?');
  check(demo.includes('29 €'), 'la demo della landing risponde sui prezzi');
  await shot('12-landing-demo');
  await viewport(390, 844, true);
  await goto(`${BASE}/`);
  await shot('13-landing-mobile', { full: true });
  check(await evaluate(`document.documentElement.scrollWidth <= 390`), 'landing mobile senza scroll orizzontale');

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
  const conv = M.listConversations(locanda.id).find((c) => c.has_lead && c.unanswered);
  await goto(`${BASE}/app/widgets/${locanda.id}/conversazioni/${conv.public_id}`);
  await shot('26-cliente-conversazione-dettaglio', { full: true });
  await goto(`${BASE}/app/leads`);
  await shot('27-cliente-contatti', { full: true });
  await viewport(390, 844, true);
  await goto(`${BASE}/app`);
  await shot('28-cliente-mobile', { full: true });
  check(await evaluate(`document.documentElement.scrollWidth <= 390`), 'dashboard mobile senza scroll orizzontale');

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
  await sleep(300);
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
  await sleep(300);
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
