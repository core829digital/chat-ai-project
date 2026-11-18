import { config, PLANS } from '../config.js';
import { html, raw } from '../lib/html.js';

const ICONS = {
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  chat: 'M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 4v-4H6.5A2.5 2.5 0 0 1 4 13.5z',
  users: 'M16 19v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 17.5V19M10 10.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM20 19v-1.5a3.5 3.5 0 0 0-2.5-3.35M15.5 3.65a3.5 3.5 0 0 1 0 6.7',
  inbox: 'M3 13h5l1.5 3h5L16 13h5M5 5h14l2 8v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-6z',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  building: 'M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16M16 9h2a2 2 0 0 1 2 2v10M8 7h4M8 11h4M8 15h4M2 21h20',
  grid: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
  logout: 'M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H3',
  plus: 'M12 5v14M5 12h14',
  shield: 'M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6z',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  back: 'M19 12H5M11 18l-6-6 6-6',
  external: 'M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5',
  copy: 'M9 9h10v11H9zM5 15H4V4h11v1',
  check: 'M5 12.5l4.5 4.5L19 7',
  eye: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
};

export const icon = (name, size = 18) =>
  raw(`<svg class="i" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${ICONS[name] || ''}"/></svg>`);

export const logo = () => html`<span class="logo"><span class="logo-mark" aria-hidden="true">${icon('chat', 16)}</span>${config.brand.name}</span>`;

function head({ title, description, css }) {
  const fullTitle = title ? `${title} · ${config.brand.name}` : `${config.brand.name} — l'assistente del tuo sito`;
  return html`<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${fullTitle}</title>
${description ? html`<meta name="description" content="${description}">` : ''}
<meta property="og:title" content="${fullTitle}">
${description ? html`<meta property="og:description" content="${description}">` : ''}
<meta property="og:type" content="website">
<meta name="theme-color" content="#F6F4EF">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/static/css/${css}">
</head>`;
}

export const csrfField = (ctx) => html`<input type="hidden" name="_csrf" value="${ctx.csrf || ''}">`;

export function flashBox(ctx) {
  if (!ctx.flashMessage) return '';
  const { text, type } = ctx.flashMessage;
  return html`<div class="flash flash-${type === 'error' ? 'error' : 'ok'}" role="status">${text}</div>`;
}

// ---------------- Sito pubblico ----------------
export function publicLayout(ctx, { title, description, body, bodyClass = '', scripts = '' }) {
  const loggedIn = Boolean(ctx.user);
  const dashboard = ctx.user?.role === 'admin' ? '/admin' : '/app';
  return html`${head({ title, description, css: 'site.css' })}
<body class="${bodyClass}">
<a class="skip" href="#main">Vai al contenuto</a>
<header class="site-header">
  <span class="scroll-progress" aria-hidden="true"></span>
  <div class="wrap header-inner">
    <a href="/" class="brand" aria-label="${config.brand.name}, pagina iniziale">${logo()}</a>
    <nav class="nav" aria-label="Principale">
      <a href="/#come-funziona">Come funziona</a>
      <a href="/#settori">Settori</a>
      <a href="/#agenzie">Per agenzie</a>
      <a href="/#prezzi">Prezzi</a>
      <a href="/#domande">Domande</a>
    </nav>
    <div class="header-cta">
      ${loggedIn
        ? html`<a class="btn btn-primary btn-sm" href="${dashboard}">Vai alla dashboard</a>`
        : html`<a class="link-quiet" href="/accedi">Accedi</a><a class="btn btn-primary btn-sm" href="/registrati">Prova gratis</a>`}
    </div>
    <details class="mobile-nav">
      <summary aria-label="Apri il menu"><span></span><span></span><span></span></summary>
      <div class="mobile-panel">
        <a href="/#come-funziona">Come funziona</a>
        <a href="/#settori">Settori</a>
        <a href="/#agenzie">Per agenzie</a>
        <a href="/#prezzi">Prezzi</a>
        <a href="/#domande">Domande</a>
        ${loggedIn ? html`<a href="${dashboard}">Dashboard</a>` : html`<a href="/accedi">Accedi</a><a href="/registrati" class="btn btn-primary">Prova gratis 14 giorni</a>`}
      </div>
    </details>
  </div>
</header>
<main id="main">${body}</main>
<footer class="site-footer">
  <div class="wrap footer-grid">
    <div>
      ${logo()}
      <p class="muted small">L'assistente per i siti delle attività italiane. Dati trattati in Unione Europea.</p>
    </div>
    <div>
      <h2 class="footer-title">Prodotto</h2>
      <a href="/#come-funziona">Come funziona</a>
      <a href="/#prezzi">Prezzi</a>
      <a href="/#agenzie">Programma agenzie</a>
    </div>
    <div>
      <h2 class="footer-title">Azienda</h2>
      <a href="mailto:${config.brand.supportEmail}">${config.brand.supportEmail}</a>
      <a href="/privacy">Privacy</a>
      <a href="/termini">Termini di servizio</a>
    </div>
  </div>
  <div class="wrap footer-bottom small muted">© ${new Date().getFullYear()} ${config.brand.company}</div>
</footer>
${scripts}
</body></html>`;
}

export function authLayout(ctx, { title, body }) {
  return html`${head({ title, css: 'site.css' })}
<body class="auth-body">
<main id="main" class="auth-main">
  <a href="/" class="brand auth-brand">${logo()}</a>
  <div class="auth-card">${flashBox(ctx)}${body}</div>
</main>
</body></html>`;
}

// ---------------- Dashboard (cliente e admin) ----------------
function navLink(href, label, iconName, active, key) {
  const on = active === key;
  return html`<a href="${href}" class="side-link${on ? ' is-active' : ''}"${on ? raw(' aria-current="page"') : ''}>${on ? raw('<span class="side-ink" aria-hidden="true"></span>') : ''}${icon(iconName)}<span>${label}</span></a>`;
}

function trialNote(account) {
  if (!account || account.status !== 'trial' || !account.trial_ends_at) return '';
  const days = Math.ceil((new Date(account.trial_ends_at.replace(' ', 'T') + 'Z') - Date.now()) / 86400000);
  if (days < 0) return html`<span class="badge badge-warn">Prova scaduta</span>`;
  return html`<span class="badge">Prova: ${days} ${days === 1 ? 'giorno' : 'giorni'}</span>`;
}

function shell(ctx, { title, body, side, scripts = '', topRight = '', bodyClass = '' }) {
  return html`${head({ title, css: 'app.css' })}
<body class="app-body ${bodyClass}">
<a class="skip" href="#main">Vai al contenuto</a>
${ctx.impersonator
  ? html`<div class="impersonation" role="status">
      <span>Stai usando la dashboard di <strong>${ctx.user.email}</strong> come amministratore.</span>
      <form method="post" action="/admin/impersonate/stop">${csrfField(ctx)}<button class="btn btn-sm btn-light" type="submit">Torna all'admin</button></form>
    </div>`
  : ''}
<div class="app">
  <aside class="sidebar">
    <a href="/" class="brand side-brand">${logo()}</a>
    ${side}
    <div class="side-foot">
      <div class="side-user">
        <span class="side-user-name">${ctx.user.name || ctx.user.email}</span>
        <span class="side-user-mail">${ctx.user.email}</span>
      </div>
      <form method="post" action="/esci">${csrfField(ctx)}<button type="submit" class="side-link side-logout">${icon('logout')}<span>Esci</span></button></form>
    </div>
  </aside>
  <div class="content">
    <header class="topbar">
      <h1 class="page-title">${title}</h1>
      <div class="topbar-right">${topRight}</div>
    </header>
    <main id="main" class="main">${flashBox(ctx)}${body}</main>
  </div>
</div>
<script src="/static/js/app.js" defer></script>
${scripts}
</body></html>`;
}

export function appLayout(ctx, { title, active, body, account, scripts, topRight, bodyClass }) {
  const plan = account ? PLANS[account.plan] : null;
  const side = html`
    ${account ? html`<div class="side-account"><span class="side-account-name">${account.name}</span>
      <span class="side-account-meta">Piano ${plan?.name || account.plan} ${trialNote(account)}</span></div>` : ''}
    <nav class="side-nav" aria-label="Dashboard">
      ${navLink('/app', 'Panoramica', 'home', active, 'home')}
      ${navLink('/app/widgets', 'Assistenti', 'chat', active, 'widgets')}
      ${navLink('/app/leads', 'Contatti raccolti', 'inbox', active, 'leads')}
      ${navLink('/app/account', 'Account e piano', 'settings', active, 'account')}
    </nav>
    ${ctx.user.role === 'admin' && !ctx.impersonator
      ? html`<nav class="side-nav side-nav-sep" aria-label="Amministrazione">${navLink('/admin', 'Torna all\'admin', 'shield', active, '-')}</nav>`
      : ''}`;
  return shell(ctx, { title, body, side, scripts, topRight, bodyClass });
}

export function adminLayout(ctx, { title, active, body, scripts, topRight }) {
  const side = html`
    <div class="side-account"><span class="side-account-name">Amministrazione</span><span class="side-account-meta">Gestione piattaforma</span></div>
    <nav class="side-nav" aria-label="Amministrazione">
      ${navLink('/admin', 'Panoramica', 'home', active, 'home')}
      ${navLink('/admin/accounts', 'Clienti', 'building', active, 'accounts')}
      ${navLink('/admin/widgets', 'Tutti gli assistenti', 'grid', active, 'widgets')}
      ${navLink('/admin/leads', 'Tutti i contatti', 'inbox', active, 'leads')}
    </nav>
    <div class="side-action"><a class="btn btn-primary btn-block" href="/admin/accounts/new">${icon('plus', 16)} Nuovo cliente</a></div>`;
  return shell(ctx, { title, body, side, scripts, topRight });
}

export function errorPage(ctx, status, message) {
  const titles = { 403: 'Accesso non consentito', 404: 'Pagina non trovata', 405: 'Operazione non consentita', 413: 'Richiesta troppo grande' };
  const title = titles[status] || (status >= 500 ? 'Qualcosa è andato storto' : 'Richiesta non valida');
  return authLayout(ctx, {
    title,
    body: html`<p class="eyebrow">Errore ${status}</p><h1 class="auth-title">${title}</h1>
      <p class="muted">${message}</p>
      <p><a class="btn btn-primary" href="${ctx.user ? (ctx.user.role === 'admin' ? '/admin' : '/app') : '/'}">Torna alla pagina iniziale</a></p>`,
  });
}

// ---------------- Componenti di form ----------------
export function field({ label, name, value = '', type = 'text', hint, error, required, autocomplete, placeholder, attrs = '', id: customId }) {
  const id = customId || `f-${name}`;
  return html`<div class="field${error ? ' has-error' : ''}">
    <label for="${id}">${label}${required ? '' : html` <span class="optional">facoltativo</span>`}</label>
    <input id="${id}" name="${name}" type="${type}" value="${value ?? ''}"${required ? raw(' required') : ''}${autocomplete ? html` autocomplete="${autocomplete}"` : ''}${placeholder ? html` placeholder="${placeholder}"` : ''}${hint || error ? html` aria-describedby="${id}-hint"` : ''}${error ? raw(' aria-invalid="true"') : ''} ${attrs}>
    ${error ? html`<p class="field-error" id="${id}-hint">${error}</p>` : hint ? html`<p class="hint" id="${id}-hint">${hint}</p>` : ''}
  </div>`;
}

export function textarea({ label, name, value = '', hint, error, required, rows = 3, placeholder, maxlength = 2000, attrs = '', id: customId }) {
  const id = customId || `f-${name}`;
  return html`<div class="field${error ? ' has-error' : ''}">
    <label for="${id}">${label}${required ? '' : html` <span class="optional">facoltativo</span>`}</label>
    <textarea id="${id}" name="${name}" rows="${rows}" maxlength="${maxlength}"${required ? raw(' required') : ''}${placeholder ? html` placeholder="${placeholder}"` : ''}${hint || error ? html` aria-describedby="${id}-hint"` : ''} ${attrs}>${value ?? ''}</textarea>
    ${error ? html`<p class="field-error" id="${id}-hint">${error}</p>` : hint ? html`<p class="hint" id="${id}-hint">${hint}</p>` : ''}
  </div>`;
}

export function select({ label, name, value, options, hint, attrs = '', id: customId }) {
  const id = customId || `f-${name}`;
  return html`<div class="field">
    <label for="${id}">${label}</label>
    <select id="${id}" name="${name}" ${attrs}>
      ${options.map(([v, l]) => html`<option value="${v}"${String(v) === String(value) ? raw(' selected') : ''}>${l}</option>`)}
    </select>
    ${hint ? html`<p class="hint">${hint}</p>` : ''}
  </div>`;
}

export function checkbox({ label, name, checked, hint, attrs = '' }) {
  return html`<div class="field field-check">
    <label><input type="checkbox" name="${name}" value="1"${checked ? raw(' checked') : ''} ${attrs}> <span>${label}</span></label>
    ${hint ? html`<p class="hint">${hint}</p>` : ''}
  </div>`;
}

export function emptyState({ title, text, action }) {
  return html`<div class="empty"><h2>${title}</h2><p class="muted">${text}</p>${action || ''}</div>`;
}
