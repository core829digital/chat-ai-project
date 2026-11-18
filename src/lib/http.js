import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import { SafeHtml } from './html.js';

export class HttpError extends Error {
  constructor(status, message, { expose = true } = {}) {
    super(message);
    this.status = status;
    this.expose = expose;
  }
}

// ---------- Router minimale con parametri (:id) ----------
export class Router {
  constructor() {
    this.routes = [];
  }
  add(method, pattern, ...handlers) {
    const keys = [];
    const regex = new RegExp(
      '^' + pattern.replace(/\/:([a-zA-Z_]+)/g, (_, k) => (keys.push(k), '/([^/]+)')).replace(/\/$/, '') + '/?$',
    );
    this.routes.push({ method, regex, keys, handlers });
    return this;
  }
  get(p, ...h) { return this.add('GET', p, ...h); }
  post(p, ...h) { return this.add('POST', p, ...h); }
  options(p, ...h) { return this.add('OPTIONS', p, ...h); }

  match(method, pathname) {
    let pathMatched = false;
    for (const r of this.routes) {
      const m = r.regex.exec(pathname);
      if (!m) continue;
      pathMatched = true;
      if (r.method !== method && !(method === 'HEAD' && r.method === 'GET')) continue;
      const params = {};
      r.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); });
      return { handlers: r.handlers, params };
    }
    return pathMatched ? { methodNotAllowed: true } : null;
  }
}

// ---------- Cookie ----------
export function parseCookies(header = '') {
  const out = {};
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    try {
      out[k] = decodeURIComponent(part.slice(i + 1).trim());
    } catch {
      /* cookie malformato: ignorato */
    }
  }
  return out;
}

export function serializeCookie(name, value, opts = {}) {
  let s = `${name}=${encodeURIComponent(value)}; Path=${opts.path || '/'}`;
  if (opts.maxAge !== undefined) s += `; Max-Age=${Math.floor(opts.maxAge)}`;
  if (opts.httpOnly !== false) s += '; HttpOnly';
  s += `; SameSite=${opts.sameSite || 'Lax'}`;
  if (config.production) s += '; Secure';
  return s;
}

// ---------- Corpo della richiesta ----------
const MAX_BODY = 256 * 1024;

export function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(new HttpError(413, 'Richiesta troppo grande'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

export function parseBody(raw, contentType = '') {
  if (!raw) return {};
  if (contentType.includes('application/json') || contentType.includes('text/plain')) {
    try {
      const v = JSON.parse(raw);
      return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
    } catch {
      throw new HttpError(400, 'JSON non valido');
    }
  }
  if (contentType.includes('application/x-www-form-urlencoded')) {
    const out = {};
    for (const [k, v] of new URLSearchParams(raw)) {
      if (k in out) out[k] = [].concat(out[k], v);
      else out[k] = v;
    }
    return out;
  }
  return {};
}

// ---------- Intestazioni di sicurezza ----------
export function securityHeaders(res, { frameable = false } = {}) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data:",
      "connect-src 'self'",
      "form-action 'self'",
      "base-uri 'none'",
      "object-src 'none'",
      frameable ? 'frame-ancestors *' : "frame-ancestors 'self'",
    ].join('; '),
  );
}

// ---------- File statici ----------
const MIME = {
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.php': 'text/plain; charset=utf-8',
  '.zip': 'application/zip',
  '.woff2': 'font/woff2',
  '.webm': 'video/webm',
  '.mp4': 'video/mp4',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.html': 'text/html; charset=utf-8',
};

export function serveFile(res, baseDir, relPath, { cors = false, maxAge = 300, req = null } = {}) {
  const resolved = path.resolve(baseDir, '.' + path.posix.normalize('/' + relPath));
  if (!resolved.startsWith(path.resolve(baseDir) + path.sep)) return false;
  let stat;
  try {
    stat = fs.statSync(resolved);
  } catch {
    return false;
  }
  if (!stat.isFile()) return false;
  res.setHeader('Content-Type', MIME[path.extname(resolved)] || 'application/octet-stream');
  res.setHeader('Cache-Control', config.production ? `public, max-age=${maxAge}` : 'no-cache');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Accept-Ranges', 'bytes');
  if (cors) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  }
  // Richieste parziali (Range): servono ai browser per i video, soprattutto Safari.
  const range = req && /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
  if (range && (range[1] || range[2])) {
    let start = range[1] ? Number(range[1]) : stat.size - Number(range[2]);
    let end = range[1] && range[2] ? Number(range[2]) : stat.size - 1;
    start = Math.max(0, start);
    end = Math.min(end, stat.size - 1);
    if (start > end) {
      res.statusCode = 416;
      res.setHeader('Content-Range', `bytes */${stat.size}`);
      res.end();
      return true;
    }
    res.statusCode = 206;
    res.setHeader('Content-Range', `bytes ${start}-${end}/${stat.size}`);
    res.setHeader('Content-Length', end - start + 1);
    fs.createReadStream(resolved, { start, end }).pipe(res);
    return true;
  }
  res.statusCode = 200;
  res.setHeader('Content-Length', stat.size);
  fs.createReadStream(resolved).pipe(res);
  return true;
}

// ---------- Contesto della richiesta ----------
export function createContext(req, res) {
  const url = new URL(req.url, config.baseUrl);
  const ctx = {
    req,
    res,
    method: req.method,
    url,
    path: url.pathname,
    query: Object.fromEntries(url.searchParams),
    params: {},
    cookies: parseCookies(req.headers.cookie),
    body: {},
    user: null,
    session: null,
    pendingCookies: [],

    setCookie(name, value, opts) {
      ctx.pendingCookies.push(serializeCookie(name, value, opts));
    },
    clearCookie(name) {
      ctx.pendingCookies.push(serializeCookie(name, '', { maxAge: 0 }));
    },
    flushCookies() {
      if (ctx.pendingCookies.length) res.setHeader('Set-Cookie', ctx.pendingCookies);
    },
    html(body, status = 200, opts = {}) {
      ctx.flushCookies();
      securityHeaders(res, opts);
      res.statusCode = status;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      res.end(body instanceof SafeHtml ? body.value : String(body));
    },
    json(data, status = 200) {
      ctx.flushCookies();
      res.statusCode = status;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.end(JSON.stringify(data));
    },
    text(body, status = 200, type = 'text/plain; charset=utf-8', extraHeaders = {}) {
      ctx.flushCookies();
      res.statusCode = status;
      res.setHeader('Content-Type', type);
      for (const [k, v] of Object.entries(extraHeaders)) res.setHeader(k, v);
      res.end(body);
    },
    redirect(location, status = 303) {
      ctx.flushCookies();
      res.statusCode = status;
      res.setHeader('Location', location);
      res.end();
    },
  };
  return ctx;
}

// Accetta solo percorsi interni per i redirect (evita open redirect).
export const safeNext = (next, fallback = '/app') =>
  typeof next === 'string' && /^\/(?![/\\])/.test(next) ? next : fallback;

// Normalizza i campi di un form in stringhe tagliate.
export const str = (v, max = 2000) => (Array.isArray(v) ? v[0] : v ?? '').toString().trim().slice(0, max);
