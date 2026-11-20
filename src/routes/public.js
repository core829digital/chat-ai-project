import { config } from '../config.js';
import { endSession, flash, startSession } from '../auth.js';
import { html } from '../lib/html.js';
import { HttpError, safeNext, str } from '../lib/http.js';
import { createRateLimiter, isEmail, verifyPassword } from '../lib/security.js';
import { SECTORS } from '../templates.js';
import * as M from '../models.js';
import { authLayout, csrfField, field, publicLayout, select } from '../views/layout.js';
import { landingPage, legalPage } from '../views/landing.js';

export const DEMO_WIDGET_ID = 'wdg_apertodemo';
const loginLimiter = createRateLimiter({ windowMs: 15 * 60_000, max: 10 });
const signupLimiter = createRateLimiter({ windowMs: 60 * 60_000, max: 10 });

const sectorOptions = Object.entries(SECTORS).map(([id, s]) => [id, s.label]);
const homeFor = (user) => (user.role === 'admin' ? '/admin' : '/app');

export function registerPublic(router) {
  router.get('/', async (ctx) => {
    const demo = await M.getWidgetByPublicId(DEMO_WIDGET_ID);
    ctx.html(landingPage(ctx, { demoWidgetId: demo ? demo.public_id : null }));
  });

  router.get('/privacy', async (ctx) => ctx.html(legalPage(ctx, 'privacy')));
  router.get('/termini', async (ctx) => ctx.html(legalPage(ctx, 'termini')));

  // ---------- Registrazione ----------
  const signupForm = (ctx, values = {}, errors = {}) =>
    authLayout(ctx, {
      title: 'Prova gratis',
      body: html`
        <h1 class="auth-title">Crea il tuo assistente</h1>
        <p class="muted">14 giorni gratis con tutte le funzioni del piano Pro. Nessuna carta richiesta.</p>
        ${errors._ ? html`<div class="flash flash-error" role="alert">${errors._}</div>` : ''}
        <form method="post" action="/registrati" class="stack" novalidate>
          ${csrfField(ctx)}
          ${field({ label: 'Nome dell’attività', name: 'company', value: values.company, required: true, autocomplete: 'organization', error: errors.company, placeholder: 'Es. Locanda Le Mura' })}
          ${select({ label: 'Settore', name: 'sector', value: values.sector || 'generico', options: sectorOptions, hint: 'Partirai con le domande più frequenti del tuo settore già scritte.' })}
          ${field({ label: 'Il tuo nome', name: 'name', value: values.name, required: true, autocomplete: 'name', error: errors.name })}
          ${field({ label: 'Email', name: 'email', type: 'email', value: values.email, required: true, autocomplete: 'email', error: errors.email })}
          ${field({ label: 'Password', name: 'password', type: 'password', required: true, autocomplete: 'new-password', error: errors.password, hint: 'Almeno 10 caratteri.' })}
          <div class="field field-check${errors.terms ? ' has-error' : ''}">
            <label><input type="checkbox" name="terms" value="1"${values.terms ? html` checked` : ''}> <span>Accetto i <a href="/termini" target="_blank">termini di servizio</a> e ho letto l’<a href="/privacy" target="_blank">informativa privacy</a>.</span></label>
            ${errors.terms ? html`<p class="field-error">${errors.terms}</p>` : ''}
          </div>
          <button class="btn btn-primary btn-block btn-lg" type="submit">Crea account e inizia</button>
        </form>
        <p class="auth-switch muted">Hai già un account? <a href="/accedi">Accedi</a></p>`,
    });

  router.get('/registrati', async (ctx) => {
    if (ctx.user) return ctx.redirect(homeFor(ctx.user));
    ctx.html(signupForm(ctx));
  });

  router.post('/registrati', async (ctx) => {
    const v = {
      company: str(ctx.body.company, 120),
      sector: SECTORS[ctx.body.sector] ? ctx.body.sector : 'generico',
      name: str(ctx.body.name, 120),
      email: str(ctx.body.email, 254).toLowerCase(),
      password: typeof ctx.body.password === 'string' ? ctx.body.password : '',
      terms: ctx.body.terms === '1',
    };
    const errors = {};
    if (!v.company) errors.company = 'Scrivi il nome della tua attività.';
    if (!v.name) errors.name = 'Scrivi il tuo nome.';
    if (!isEmail(v.email)) errors.email = 'Inserisci un indirizzo email valido.';
    else if (await M.findUserByEmail(v.email)) errors.email = 'Esiste già un account con questa email. Prova ad accedere.';
    if (v.password.length < 10) errors.password = 'La password deve avere almeno 10 caratteri.';
    if (v.password.length > 200) errors.password = 'La password è troppo lunga.';
    if (!v.terms) errors.terms = 'Per continuare devi accettare i termini di servizio.';
    if (Object.keys(errors).length) return ctx.html(signupForm(ctx, { ...v, password: '' }, errors), 422);
    if (!signupLimiter(ctx.req.socket.remoteAddress || '')) {
      return ctx.html(signupForm(ctx, v, { _: 'Troppe registrazioni da questa connessione. Riprova tra un’ora.' }), 429);
    }

    const { userId } = await M.createAccountWithUser({
      company: v.company, name: v.name, email: v.email, password: v.password, sector: v.sector,
    });
    await M.touchLogin(userId);
    await startSession(ctx, userId);
    ctx.redirect(`/app/widgets/new?primo=1`);
  });

  // ---------- Accesso ----------
  const loginForm = (ctx, { email = '', next = '', error = '' } = {}) =>
    authLayout(ctx, {
      title: 'Accedi',
      body: html`
        <h1 class="auth-title">Bentornato</h1>
        <p class="muted">Accedi per gestire i tuoi assistenti.</p>
        ${error ? html`<div class="flash flash-error" role="alert">${error}</div>` : ''}
        <form method="post" action="/accedi" class="stack">
          ${csrfField(ctx)}
          <input type="hidden" name="next" value="${next}">
          ${field({ label: 'Email', name: 'email', type: 'email', value: email, required: true, autocomplete: 'email' })}
          ${field({ label: 'Password', name: 'password', type: 'password', required: true, autocomplete: 'current-password' })}
          <button class="btn btn-primary btn-block btn-lg" type="submit">Accedi</button>
        </form>
        <p class="auth-switch muted">Non hai un account? <a href="/registrati">Prova gratis</a><br>
        Password dimenticata? Scrivi a <a href="mailto:${config.brand.supportEmail}">${config.brand.supportEmail}</a></p>`,
    });

  router.get('/accedi', async (ctx) => {
    if (ctx.user) return ctx.redirect(safeNext(ctx.query.next, homeFor(ctx.user)));
    ctx.html(loginForm(ctx, { next: safeNext(ctx.query.next, '') }));
  });

  router.post('/accedi', async (ctx) => {
    const email = str(ctx.body.email, 254).toLowerCase();
    const password = typeof ctx.body.password === 'string' ? ctx.body.password : '';
    const next = safeNext(ctx.body.next, '');
    if (!loginLimiter(`${ctx.req.socket.remoteAddress}:${email}`)) {
      return ctx.html(loginForm(ctx, { email, next, error: 'Troppi tentativi. Riprova tra 15 minuti.' }), 429);
    }
    const user = await M.findUserByEmail(email);
    if (!user || !verifyPassword(password, user.password_hash)) {
      return ctx.html(loginForm(ctx, { email, next, error: 'Email o password non corretti.' }), 401);
    }
    await M.touchLogin(user.id);
    await startSession(ctx, user.id);
    ctx.redirect(next || homeFor(user));
  });

  router.post('/esci', async (ctx) => {
    await endSession(ctx);
    ctx.redirect('/');
  });

  // ---------- Invito (account creati dall'admin) ----------
  const inviteForm = async (ctx, invite, token, error = '') => {
    const account = await M.getAccount(invite.user.account_id);
    return authLayout(ctx, {
      title: 'Attiva il tuo account',
      body: html`
        <p class="eyebrow">Invito per ${account?.name || ''}</p>
        <h1 class="auth-title">Imposta la tua password</h1>
        <p class="muted">Il tuo assistente è già pronto. Scegli una password per accedere con <strong>${invite.user.email}</strong>.</p>
        ${error ? html`<div class="flash flash-error" role="alert">${error}</div>` : ''}
        <form method="post" action="/invito/${token}" class="stack">
          ${csrfField(ctx)}
          ${field({ label: 'Il tuo nome', name: 'name', value: invite.user.name, required: true, autocomplete: 'name' })}
          ${field({ label: 'Password', name: 'password', type: 'password', required: true, autocomplete: 'new-password', hint: 'Almeno 10 caratteri.' })}
          <button class="btn btn-primary btn-block btn-lg" type="submit">Attiva account</button>
        </form>`,
    });
  };

  router.get('/invito/:token', async (ctx) => {
    const invite = await M.getInvite(ctx.params.token);
    if (!invite) throw new HttpError(404, 'Questo invito non è valido o è scaduto. Chiedi un nuovo link a chi te l’ha inviato.');
    ctx.html(await inviteForm(ctx, invite, ctx.params.token));
  });

  router.post('/invito/:token', async (ctx) => {
    const invite = await M.getInvite(ctx.params.token);
    if (!invite) throw new HttpError(404, 'Questo invito non è valido o è scaduto.');
    const password = typeof ctx.body.password === 'string' ? ctx.body.password : '';
    const name = str(ctx.body.name, 120);
    if (password.length < 10 || password.length > 200) {
      return ctx.html(await inviteForm(ctx, invite, ctx.params.token, 'La password deve avere almeno 10 caratteri.'), 422);
    }
    const user = await M.consumeInvite(ctx.params.token, password);
    if (name) await M.updateUserName(user.id, name);
    await M.touchLogin(user.id);
    await endSession(ctx);
    await startSession(ctx, user.id);
    flash(ctx, 'Account attivato. Benvenuto!');
    ctx.redirect('/app');
  });

  // ---------- Pagina chat ospitata (per siti dove non si può inserire codice) ----------
  router.get('/c/:pid', async (ctx) => {
    const widget = await M.getWidgetByPublicId(ctx.params.pid);
    if (!widget) throw new HttpError(404, 'Questa chat non esiste.');
    const title = widget.settings.title || widget.name;
    ctx.html(
      html`<!doctype html><html lang="it"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} · Chat</title>
<meta name="robots" content="noindex">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/static/css/hosted.css">
</head><body>
<main class="hosted">
  <div class="hosted-frame" id="chat"><script src="/w.js" data-id="${widget.public_id}" data-mode="page"></script></div>
  <p class="hosted-note">Chat di ${title}${widget.site_url ? html` · <a href="${widget.site_url}" rel="noopener">torna al sito</a>` : ''}</p>
</main>
</body></html>`,
      200,
      { frameable: true },
    );
  });

  // Compatibilità: alcuni visitatori arrivano con link vecchi o maiuscole diverse.
  router.get('/login', async (ctx) => ctx.redirect('/accedi', 301));
  router.get('/signup', async (ctx) => ctx.redirect('/registrati', 301));
}

export { publicLayout };
