// Registra i video della landing a partire dalle scene in scripts/video-scenes.html.
// Usa Chrome in modalità headless (DevTools Protocol) e MediaRecorder: nessuna dipendenza.
// Uso: node scripts/render-videos.js            (tutte le scene)
//      node scripts/render-videos.js aurora     (una sola scena)
// Uscita: public/media/<scena>.webm (video in loop) e public/media/<scena>.jpg (immagine di riserva).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';

const SCENES = {
  flusso: { width: 1280, height: 720, duration: 8 },
  rete: { width: 1280, height: 720, duration: 8 },
  onde: { width: 1280, height: 720, duration: 8 },
  aurora: { width: 1280, height: 720, duration: 10, bitrate: 600000 },
};
const only = process.argv.slice(2);
const outDir = path.resolve('public/media');
fs.mkdirSync(outDir, { recursive: true });

const chromePath = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome', '/usr/bin/chromium',
].filter(Boolean).find((p) => fs.existsSync(p));
if (!chromePath) throw new Error('Chrome non trovato: imposta CHROME_PATH');

const port = 9444;
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'aperto-video-'));
const chrome = spawn(chromePath, [
  '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
  '--no-first-run', '--autoplay-policy=no-user-gesture-required', '--disable-background-timer-throttling',
  '--disable-renderer-backgrounding', 'about:blank',
], { stdio: 'ignore' });

let version;
for (let i = 0; i < 50 && !version; i++) {
  try { version = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json(); } catch { await sleep(200); }
}
if (!version) throw new Error('Chrome non risponde');
const ws = new WebSocket(version.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let id = 0;
const pending = new Map();
ws.addEventListener('message', (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) {
    const p = pending.get(m.id);
    pending.delete(m.id);
    m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result);
  }
});
const cdp = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
  const mid = ++id;
  pending.set(mid, { resolve, reject });
  ws.send(JSON.stringify({ id: mid, method, params, sessionId }));
});

try {
  const { targetId } = await cdp('Target.createTarget', { url: pathToFileURL(path.resolve('scripts/video-scenes.html')).href });
  const { sessionId } = await cdp('Target.attachToTarget', { targetId, flatten: true });
  await sleep(800);
  for (const [name, opts] of Object.entries(SCENES)) {
    if (only.length && !only.includes(name)) continue;
    process.stdout.write(`Registro "${name}" (${opts.duration}s, ${opts.width}x${opts.height})… `);
    const r = await cdp('Runtime.evaluate', {
      expression: `renderScene(${JSON.stringify(name)}, ${JSON.stringify(opts)})`,
      awaitPromise: true, returnByValue: true,
    }, sessionId);
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    const { webm, poster, bytes } = r.result.value;
    fs.writeFileSync(path.join(outDir, `${name}.webm`), Buffer.from(webm, 'base64'));
    fs.writeFileSync(path.join(outDir, `${name}.jpg`), Buffer.from(poster, 'base64'));
    console.log(`${Math.round(bytes / 1024)} KB`);
  }
} finally {
  ws.close();
  chrome.kill();
  setTimeout(() => { try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* file ancora aperti */ } }, 500);
}
