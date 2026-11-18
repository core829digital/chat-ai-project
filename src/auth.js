// Sessioni, protezione CSRF e controlli di accesso.
import { config } from './config.js';
import { HttpError } from './lib/http.js';
import { randomToken, safeEqual } from './lib/security.js';
import * as M from './models.js';

export const SESSION_COOKIE = 'sp_session';
export const CSRF_COOKIE = 'sp_csrf';
const FLASH_COOKIE = 'sp_flash';

export function loadSession(ctx) {
  const session = M.getSession(ctx.cookies[SESSION_COOKIE]);
  if (session) {
    ctx.session = session;
    ctx.user = session.user;
    ctx.impersonator = session.impersonator;
  }
  // Token CSRF "double submit": cookie + campo nascosto nei form.
  ctx.csrf = ctx.cookies[CSRF_COOKIE];
  if (!ctx.csrf || ctx.csrf.length < 20) {
    ctx.csrf = randomToken(18);
    ctx.setCookie(CSRF_COOKIE, ctx.csrf, { maxAge: 60 * 60 * 24 * 30 });
  }
  // Messaggio una tantum (es. "Salvato") passato tra redirect.
  if (ctx.cookies[FLASH_COOKIE]) {
    try {
      ctx.flashMessage = JSON.parse(ctx.cookies[FLASH_COOKIE]);
    } catch {
      /* ignorato */
    }
    ctx.clearCookie(FLASH_COOKIE);
  }
}

export function flash(ctx, text, type = 'ok') {
  ctx.setCookie(FLASH_COOKIE, JSON.stringify({ text, type }), { maxAge: 60 });
}

export function verifyCsrf(ctx) {
  const sent = ctx.body._csrf || ctx.req.headers['x-csrf-token'];
  if (!safeEqual(String(sent || ''), String(ctx.cookies[CSRF_COOKIE] || ''))) {
    throw new HttpError(403, 'Sessione del modulo scaduta. Ricarica la pagina e riprova.');
  }
}

export function startSession(ctx, userId, impersonatorId = null) {
  const token = M.createSession(userId, impersonatorId);
  ctx.setCookie(SESSION_COOKIE, token, { maxAge: config.sessionDays * 86400 });
}

export function endSession(ctx) {
  M.deleteSession(ctx.cookies[SESSION_COOKIE]);
  ctx.clearCookie(SESSION_COOKIE);
}

export function requireUser(ctx) {
  if (!ctx.user) {
    const next = encodeURIComponent(ctx.path + ctx.url.search);
    return ctx.redirect(`/accedi?next=${next}`);
  }
}

export function requireAdmin(ctx) {
  if (!ctx.user) return requireUser(ctx);
  if (ctx.user.role !== 'admin') throw new HttpError(404, 'Pagina non trovata');
}

// L'admin può gestire qualsiasi widget; il cliente solo quelli del proprio account.
export function canManageAccount(user, accountId) {
  return Boolean(user && (user.role === 'admin' || user.account_id === accountId));
}

export function loadOwnedWidget(ctx, id) {
  const widget = M.getWidget(Number(id));
  if (!widget || !canManageAccount(ctx.user, widget.account_id)) throw new HttpError(404, 'Widget non trovato');
  return widget;
}
