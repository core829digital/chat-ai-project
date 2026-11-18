import http from 'node:http';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { config } from './config.js';
import { openDb } from './db.js';
import { loadSession, verifyCsrf } from './auth.js';
import { createContext, HttpError, parseBody, readBody, Router, serveFile } from './lib/http.js';
import { errorPage } from './views/layout.js';
import { registerPublic } from './routes/public.js';
import { registerApp } from './routes/app.js';
import { registerAdmin } from './routes/admin.js';
import { registerApi } from './routes/api.js';

export function createApp() {
  const router = new Router();
  registerApi(router);
  registerPublic(router);
  registerApp(router);
  registerAdmin(router);

  const publicDir = path.join(config.root, 'public');

  return async function handle(req, res) {
    const ctx = createContext(req, res);
    try {
      // File statici: script del widget (accessibile da qualsiasi sito) e risorse delle pagine.
      if (ctx.method === 'GET' || ctx.method === 'HEAD') {
        if (ctx.path === '/w.js') {
          if (serveFile(res, path.join(publicDir, 'widget'), 'w.js', { cors: true, maxAge: 300 })) return;
        }
        if (ctx.path.startsWith('/static/')) {
          if (serveFile(res, publicDir, ctx.path.slice('/static/'.length), { maxAge: 3600 })) return;
          throw new HttpError(404, 'File non trovato');
        }
        if (ctx.path === '/favicon.ico' || ctx.path === '/favicon.svg') {
          if (serveFile(res, publicDir, 'img/favicon.svg', { maxAge: 86400 })) return;
        }
        if (ctx.path === '/robots.txt') return ctx.text('User-agent: *\nDisallow: /app\nDisallow: /admin\n');
      }

      const match = router.match(ctx.method, ctx.path);
      if (!match) throw new HttpError(404, 'Pagina non trovata');
      if (match.methodNotAllowed) throw new HttpError(405, 'Metodo non consentito');
      ctx.params = match.params;

      if (ctx.method === 'POST') {
        ctx.body = parseBody(await readBody(req), req.headers['content-type'] || '');
      }

      const isApi = ctx.path.startsWith('/api/');
      if (!isApi || ctx.path.startsWith('/api/app/')) {
        loadSession(ctx);
        if (ctx.method === 'POST') verifyCsrf(ctx);
      }

      for (const handler of match.handlers) {
        await handler(ctx);
        if (res.writableEnded || res.headersSent) break;
      }
      if (!res.writableEnded && !res.headersSent) throw new HttpError(500, 'Nessuna risposta', { expose: false });
    } catch (err) {
      const status = err instanceof HttpError ? err.status : 500;
      if (status >= 500) console.error(`[${new Date().toISOString()}] ${ctx.method} ${ctx.path}`, err);
      if (res.headersSent) return res.end();
      const message = err instanceof HttpError && err.expose ? err.message : 'Si è verificato un errore imprevisto.';
      if (ctx.path.startsWith('/api/')) return ctx.json({ error: message }, status);
      ctx.html(errorPage(ctx, status, message), status);
    }
  };
}

export function startServer(port = config.port) {
  openDb();
  const server = http.createServer(createApp());
  server.headersTimeout = 20000;
  server.requestTimeout = 30000;
  return new Promise((resolve) => {
    server.listen(port, () => resolve(server));
  });
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const server = await startServer();
  const { port } = server.address();
  console.log(`${config.brand.name} in ascolto su http://localhost:${port}`);
}
