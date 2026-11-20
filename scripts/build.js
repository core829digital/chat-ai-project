// npm run build
// 1. Impacchetta gli script del browser che usano pacchetti npm (src/client → public/js).
// 2. Controlla la sintassi di tutti i file del server, così un errore emerge qui e non al primo deploy.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { build } from 'esbuild';

const root = path.resolve(import.meta.dirname, '..');
const entries = { 'src/client/live.js': 'public/js/live.js' };

for (const [from, to] of Object.entries(entries)) {
  const result = await build({
    entryPoints: [path.join(root, from)],
    outfile: path.join(root, to),
    bundle: true,
    minify: true,
    format: 'iife',
    target: ['es2020'],
    platform: 'browser',
    legalComments: 'none',
    metafile: true,
    logLevel: 'warning',
  });
  const bytes = Object.values(result.metafile.outputs)[0].bytes;
  console.log(`bundle  ${from} → ${to} (${(bytes / 1024).toFixed(1)} kB)`);
}

const dirs = ['src', 'api', 'scripts', 'test'];
const files = dirs.flatMap((d) => fs.readdirSync(path.join(root, d), { recursive: true })
  .filter((f) => f.endsWith('.js') && !f.startsWith('client'))
  .map((f) => path.join(d, f)));
let failed = 0;
for (const f of files) {
  const r = spawnSync(process.execPath, ['--check', path.join(root, f)], { encoding: 'utf8' });
  if (r.status !== 0) {
    failed++;
    console.error(`errore  ${f}\n${r.stderr}`);
  }
}
console.log(`sintassi ${files.length - failed}/${files.length} file ok`);
if (failed) process.exit(1);
