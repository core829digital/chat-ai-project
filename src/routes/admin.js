// Pannello di amministrazione della piattaforma.
import { ACCOUNT_STATUS, config, PLAN_IDS, PLANS } from '../config.js';
import { endSession, flash, requireAdmin, startSession } from '../auth.js';
import { fmtDate, fmtEur, fmtNum, html, raw, timeAgo } from '../lib/html.js';
import { HttpError, str } from '../lib/http.js';
import { isEmail } from '../lib/security.js';
import { SECTORS } from '../templates.js';
import * as M from '../models.js';
import { adminLayout, checkbox, csrfField, emptyState, field, icon, select, textarea } from '../views/layout.js';
import {
  accountStatusBadge, copyField, dailyChart, installStatus, planBadge, statCard, usageBar, widgetStatusBadge,
} from '../views/components.js';
import { leadsTable } from './app.js';

const sectorOptions = Object.entries(SECTORS).map(([id, s]) => [id, s.label]);
const planOptions = PLAN_IDS.map((id) => [id, `${PLANS[id].name} · ${PLANS[id].price} €/mese`]);
const isHttpUrl = (v) => {
  try {
    return ['http:', 'https:'].includes(new URL(v).protocol);
  } catch {
    return false;
  }
};

const inviteUrl = (token) => `${config.baseUrl}/invito/${token}`;

function inviteEmail(account, user, link) {
  const subject = `Il tuo assistente ${config.brand.name} è pronto`;
  const body = `Ciao ${user.name || ''},\n\nabbiamo preparato l'assistente per il sito di ${account.name}.\n\nDa questo link puoi attivare il tuo account, controllare le risposte e vedere i contatti raccolti:\n${link}\n\nIl link è valido ${config.inviteDays} giorni.\n\nA presto,\nIl team ${config.brand.name}`;
  return `mailto:${encodeURIComponent(user.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

async function loadAccount(id) {
  const account = await M.getAccount(Number(id));
  if (!account) throw new HttpError(404, 'Cliente non trovato');
  return account;
}

export function registerAdmin(router) {
  // ---------- Panoramica ----------
  router.get('/admin', requireAdmin, async (ctx) => {
    const s = await M.platformStats();
    const daily = await M.dailyConversations(M.allWidgetIds(), 30);
    const recentAccounts = (await M.listAccounts()).slice(0, 6);
    const recent = await M.recentConversations(8);
    const body = html`
      <section class="grid-4">
        ${statCard('Ricavi ricorrenti (MRR)', fmtEur(s.mrr), `${s.byStatus.active} clienti paganti`)}
        ${statCard('Clienti', fmtNum(s.accounts), `${s.byStatus.trial} in prova · ${s.byStatus.expired} prove scadute · ${s.byStatus.suspended} sospesi`)}
        ${statCard('Assistenti', fmtNum(s.widgets), `${s.widgetsLive} attivi sui siti negli ultimi 7 giorni`)}
        ${statCard('Questo mese', `${fmtNum(s.conversationsMonth)} conversazioni`, `${fmtNum(s.leadsMonth)} contatti raccolti`)}
      </section>
      <section class="panel">${dailyChart(daily, { label: 'Conversazioni sulla piattaforma, ultimi 30 giorni' })}</section>
      <div class="grid-2">
        <section class="panel">
          <div class="panel-head"><h2 class="panel-title">Prove in scadenza (5 giorni)</h2></div>
          ${s.trialsEndingSoon.length
            ? html`<ul class="lead-list">${s.trialsEndingSoon.map((a) => html`<li>
                <div><a href="/admin/accounts/${a.id}"><b>${a.name}</b></a><span class="muted small">${a.owner_email}</span></div>
                <span class="muted small nowrap">scade il ${fmtDate(a.trial_ends_at)}</span></li>`)}</ul>`
            : html`<p class="muted">Nessuna prova in scadenza nei prossimi 5 giorni.</p>`}
        </section>
        <section class="panel">
          <div class="panel-head"><h2 class="panel-title">Ultimi clienti</h2><a class="link small" href="/admin/accounts">Tutti</a></div>
          ${recentAccounts.length
            ? html`<ul class="lead-list">${recentAccounts.map((a) => html`<li>
                <div><a href="/admin/accounts/${a.id}"><b>${a.name}</b></a><span class="muted small">${a.owner_email} · ${a.created_by === 'admin' ? 'creato dall’admin' : 'registrazione autonoma'}</span></div>
                <span>${accountStatusBadge(a)}</span></li>`)}</ul>`
            : html`<p class="muted">Ancora nessun cliente.</p>`}
        </section>
      </div>
      <section class="panel">
        <h2 class="panel-title">Conversazioni recenti</h2>
        ${recent.length
          ? html`<div class="table-wrap"><table class="table">
              <thead><tr><th scope="col">Prima domanda</th><th scope="col">Cliente</th><th scope="col" class="num">Messaggi</th><th scope="col">Esito</th><th scope="col">Quando</th></tr></thead>
              <tbody>${recent.map((c) => html`<tr>
                <td><a class="row-link" href="/app/widgets/${c.widget_db_id}/conversazioni/${c.public_id}">${c.first_message || '—'}</a></td>
                <td>${c.account_name}<div class="muted small">${c.widget_name}</div></td>
                <td class="num">${c.message_count}</td>
                <td>${c.has_lead ? html`<span class="badge badge-ok">Contatto</span> ` : ''}${c.unanswered ? html`<span class="badge badge-warn">${c.unanswered} senza risposta</span>` : ''}</td>
                <td class="muted nowrap">${timeAgo(c.last_at)}</td></tr>`)}</tbody></table></div>`
          : html`<p class="muted">Nessuna conversazione reale per ora.</p>`}
      </section>`;
    ctx.html(adminLayout(ctx, { title: 'Panoramica', active: 'home', body }));
  });

  // ---------- Clienti ----------
  router.get('/admin/accounts', requireAdmin, async (ctx) => {
    const q = str(ctx.query.q, 100);
    const status = Object.keys(ACCOUNT_STATUS).includes(ctx.query.stato) ? ctx.query.stato : '';
    const accounts = await M.listAccounts({ q, status });
    const body = html`
      <form class="toolbar" method="get" action="/admin/accounts" role="search">
        <div class="search-row">
          <label class="sr-only" for="q">Cerca cliente</label>
          <input id="q" name="q" type="search" value="${q}" placeholder="Cerca per nome o email">
          <label class="sr-only" for="stato">Stato</label>
          <select id="stato" name="stato">
            <option value="">Tutti gli stati</option>
            ${Object.entries(ACCOUNT_STATUS).map(([k, l]) => html`<option value="${k}"${status === k ? raw(' selected') : ''}>${l}</option>`)}
          </select>
          <button class="btn btn-outline" type="submit">Filtra</button>
        </div>
      </form>
      ${accounts.length
        ? html`<div class="table-wrap"><table class="table">
            <thead><tr><th scope="col">Cliente</th><th scope="col">Piano</th><th scope="col">Stato</th><th scope="col" class="num">Assistenti</th><th scope="col" class="num">Conv. mese</th><th scope="col">Ultimo accesso</th></tr></thead>
            <tbody>${accounts.map((a) => html`<tr>
              <td><a class="row-link" href="/admin/accounts/${a.id}">${a.name}</a><div class="muted small">${a.owner_email || '—'}</div></td>
              <td>${planBadge(a.plan)}</td>
              <td>${accountStatusBadge(a)}</td>
              <td class="num">${a.widget_count}</td>
              <td class="num">${fmtNum(a.conv_month)}</td>
              <td class="muted nowrap">${a.last_login_at ? timeAgo(a.last_login_at) : 'mai'}</td>
            </tr>`)}</tbody></table></div>`
        : emptyState({ title: 'Nessun cliente trovato', text: q || status ? 'Prova a cambiare i filtri.' : 'Crea il primo cliente o aspetta la prima registrazione.', action: html`<a class="btn btn-primary" href="/admin/accounts/new">Nuovo cliente</a>` })}`;
    ctx.html(adminLayout(ctx, {
      title: 'Clienti', active: 'accounts', body,
      topRight: html`<a class="btn btn-primary btn-sm" href="/admin/accounts/new">${icon('plus', 15)} Nuovo cliente</a>`,
    }));
  });

  const newAccountForm = (ctx, v = {}, errors = {}) => html`
    <div class="notice-box">${icon('chat', 18)}<p>Crei il cliente e, se vuoi, il suo primo assistente con il modello del settore. Alla fine ottieni un <b>link di invito</b> da mandare al cliente: aprendolo imposta la sua password ed entra nella dashboard già pronta.</p></div>
    <form method="post" action="/admin/accounts" class="grid-main-side">
      ${csrfField(ctx)}
      <div class="stack-lg">
        <section class="panel stack">
          <h2 class="panel-title">Cliente</h2>
          ${field({ label: 'Nome dell’attività', name: 'company', value: v.company, required: true, error: errors.company })}
          ${field({ label: 'Nome del referente', name: 'name', value: v.name, required: true, error: errors.name })}
          ${field({ label: 'Email del referente', name: 'email', type: 'email', value: v.email, required: true, error: errors.email, hint: 'Riceverà il link di invito. Sarà la sua email di accesso.' })}
          ${select({ label: 'Settore', name: 'sector', value: v.sector || 'generico', options: sectorOptions })}
        </section>
        <section class="panel stack">
          <h2 class="panel-title">Primo assistente</h2>
          ${checkbox({ label: 'Crea subito l’assistente con le domande del settore', name: 'createWidget', checked: v.createWidget !== false })}
          ${field({ label: 'Indirizzo del sito', name: 'siteUrl', type: 'url', value: v.siteUrl, error: errors.siteUrl, placeholder: 'https://www.sitocliente.it' })}
        </section>
      </div>
      <aside class="stack-lg">
        <section class="panel stack">
          <h2 class="panel-title">Contratto</h2>
          ${select({ label: 'Piano', name: 'plan', value: v.plan || 'pro', options: planOptions })}
          ${select({ label: 'Stato', name: 'status', value: v.status || 'trial', options: [['trial', `In prova (${config.trialDays} giorni)`], ['active', 'Attivo (pagante)']] })}
          ${textarea({ label: 'Note interne', name: 'notes', value: v.notes, rows: 3, hint: 'Visibili solo agli amministratori.' })}
          <button class="btn btn-primary btn-block btn-lg" type="submit">Crea cliente</button>
        </section>
      </aside>
    </form>`;

  router.get('/admin/accounts/new', requireAdmin, async (ctx) => {
    ctx.html(adminLayout(ctx, { title: 'Nuovo cliente', active: 'accounts', body: newAccountForm(ctx) }));
  });

  router.post('/admin/accounts', requireAdmin, async (ctx) => {
    const v = {
      company: str(ctx.body.company, 120),
      name: str(ctx.body.name, 120),
      email: str(ctx.body.email, 254).toLowerCase(),
      sector: SECTORS[ctx.body.sector] ? ctx.body.sector : 'generico',
      plan: PLANS[ctx.body.plan] ? ctx.body.plan : 'pro',
      status: ctx.body.status === 'active' ? 'active' : 'trial',
      notes: str(ctx.body.notes, 2000),
      createWidget: ctx.body.createWidget === '1',
      siteUrl: str(ctx.body.siteUrl, 300),
    };
    const errors = {};
    if (!v.company) errors.company = 'Obbligatorio.';
    if (!v.name) errors.name = 'Obbligatorio.';
    if (!isEmail(v.email)) errors.email = 'Email non valida.';
    else if (await M.findUserByEmail(v.email)) errors.email = 'Esiste già un utente con questa email.';
    if (v.siteUrl && !isHttpUrl(v.siteUrl)) errors.siteUrl = 'Indirizzo completo, es. https://www.sitocliente.it';
    if (Object.keys(errors).length) {
      return ctx.html(adminLayout(ctx, { title: 'Nuovo cliente', active: 'accounts', body: newAccountForm(ctx, v, errors) }), 422);
    }
    const { accountId, userId } = await M.createAccountWithUser({
      company: v.company, name: v.name, email: v.email, password: null,
      plan: v.plan, status: v.status, sector: v.sector, createdBy: 'admin',
    });
    if (v.notes) await M.updateAccount(accountId, { notes: v.notes });
    if (v.createWidget) await M.createWidget({ accountId, name: v.company, siteUrl: v.siteUrl, sector: v.sector });
    const token = await M.createInvite(userId);
    flash(ctx, inviteUrl(token), 'invite');
    ctx.redirect(`/admin/accounts/${accountId}`);
  });

  // ---------- Scheda cliente ----------
  router.get('/admin/accounts/:id', requireAdmin, async (ctx) => {
    const account = await loadAccount(ctx.params.id);
    const users = await M.listAccountUsers(account.id);
    const owner = users[0];
    const widgets = await M.listWidgets(account.id);
    const plan = PLANS[account.plan];
    const used = await M.accountConversationsThisMonth(account.id);
    const freshInvite = ctx.flashMessage?.type === 'invite' ? ctx.flashMessage.text : null;
    if (freshInvite) ctx.flashMessage = null;

    const body = html`
      ${freshInvite && owner ? html`<section class="invite-box" aria-live="polite">
        <h2>Link di invito pronto</h2>
        <p>Mandalo a <b>${owner.email}</b>: aprendolo imposta la password ed entra nella dashboard. Il link vale ${config.inviteDays} giorni e si vede solo adesso: se lo perdi, generane uno nuovo.</p>
        ${copyField(freshInvite, 'Copia link')}
        <a class="btn btn-primary" href="${inviteEmail(account, owner, freshInvite)}">Prepara l’email per il cliente</a>
      </section>` : ''}

      <div class="account-head">
        <div class="account-badges">${planBadge(account.plan)} ${accountStatusBadge(account)} <span class="muted small">Cliente dal ${fmtDate(account.created_at)} · ${account.created_by === 'admin' ? 'creato dall’admin' : 'registrazione autonoma'}</span></div>
        ${owner ? html`<form method="post" action="/admin/accounts/${account.id}/impersonate">${csrfField(ctx)}<button class="btn btn-outline" type="submit">${icon('eye', 15)} Apri la dashboard del cliente</button></form>` : ''}
      </div>

      <div class="grid-main-side">
        <div class="stack-lg">
          <section class="panel">
            <div class="panel-head"><h2 class="panel-title">Assistenti <span class="count">${widgets.length} di ${plan.widgets}</span></h2></div>
            ${widgets.length
              ? html`<ul class="widget-list">${widgets.map((w) => html`<li>
                  <a href="/app/widgets/${w.id}" class="widget-row">
                    <span class="w-dot" style="background:${/^#[0-9a-f]{6}$/i.test(w.settings.color) ? w.settings.color : '#1F5C4A'}"></span>
                    <span class="w-main"><b>${w.name}</b><span class="muted small">${w.public_id} · ${w.knowledge_count} risposte</span></span>
                    <span class="w-side">${widgetStatusBadge(w)} ${installStatus(w)}<span class="muted small">${w.conv_30d} conversazioni · ${w.leads_30d} contatti (30 g)</span></span>
                  </a></li>`)}</ul>`
              : html`<p class="muted">Nessun assistente.</p>`}
            <details class="inline-create"${widgets.length ? '' : raw(' open')}>
              <summary class="btn btn-sm btn-outline">${icon('plus', 15)} Crea un assistente per questo cliente</summary>
              <form method="post" action="/admin/accounts/${account.id}/widgets" class="stack form-narrow">
                ${csrfField(ctx)}
                ${field({ label: 'Nome', name: 'name', value: account.name, required: true, id: 'nw-name' })}
                ${field({ label: 'Indirizzo del sito', name: 'siteUrl', type: 'url', id: 'nw-site', placeholder: 'https://www.sitocliente.it' })}
                ${select({ label: 'Settore', name: 'sector', value: account.sector, options: sectorOptions, id: 'nw-sector' })}
                <div><button class="btn btn-primary" type="submit">Crea assistente</button></div>
              </form>
            </details>
          </section>

          <section class="panel">
            <h2 class="panel-title">Utilizzo</h2>
            ${usageBar(used, plan.conversations)}
          </section>

          <section class="panel">
            <h2 class="panel-title">Accessi</h2>
            <div class="table-wrap"><table class="table">
              <thead><tr><th scope="col">Utente</th><th scope="col">Stato</th><th scope="col">Ultimo accesso</th><th scope="col"></th></tr></thead>
              <tbody>${users.map((u) => {
                const pending = !u.password_hash;
                return html`<tr>
                  <td><b>${u.name || '—'}</b><div class="muted small">${u.email}</div></td>
                  <td>${pending ? html`<span class="badge badge-warn">Invito non ancora accettato</span>` : html`<span class="badge badge-ok">Attivo</span>`}</td>
                  <td class="muted">${u.last_login_at ? timeAgo(u.last_login_at) : 'mai'}</td>
                  <td class="right"><form method="post" action="/admin/accounts/${account.id}/invite">${csrfField(ctx)}<input type="hidden" name="userId" value="${u.id}"><button class="btn btn-sm btn-outline" type="submit">${pending ? 'Nuovo link di invito' : 'Link per reimpostare la password'}</button></form></td>
                </tr>`;
              })}</tbody></table></div>
          </section>
        </div>

        <aside class="stack-lg">
          <section class="panel">
            <h2 class="panel-title">Contratto</h2>
            <form method="post" action="/admin/accounts/${account.id}" class="stack">
              ${csrfField(ctx)}
              ${field({ label: 'Nome dell’attività', name: 'name', value: account.name, required: true, id: 'acc-name' })}
              ${select({ label: 'Piano', name: 'plan', value: account.plan, options: planOptions })}
              ${select({ label: 'Stato', name: 'status', value: account.status, options: Object.entries(ACCOUNT_STATUS) })}
              ${field({ label: 'Fine della prova', name: 'trialEnds', type: 'date', value: account.trial_ends_at ? account.trial_ends_at.slice(0, 10) : '', hint: 'Conta solo se lo stato è “In prova”.' })}
              ${select({ label: 'Settore', name: 'sector', value: account.sector, options: sectorOptions, id: 'acc-sector' })}
              ${textarea({ label: 'Note interne', name: 'notes', value: account.notes, rows: 4 })}
              <button class="btn btn-primary" type="submit">Salva</button>
            </form>
          </section>
          <section class="panel danger-zone">
            <h2 class="panel-title">Elimina cliente</h2>
            <p class="muted small">Cancella definitivamente account, utenti, assistenti, conversazioni e contatti. Non si può annullare.</p>
            <form method="post" action="/admin/accounts/${account.id}/elimina" class="stack">
              ${csrfField(ctx)}
              ${field({ label: `Scrivi “${account.name}” per confermare`, name: 'confirm', required: true, id: 'del-confirm' })}
              <button class="btn btn-danger" type="submit">Elimina definitivamente</button>
            </form>
          </section>
        </aside>
      </div>`;
    ctx.html(adminLayout(ctx, { title: account.name, active: 'accounts', body }));
  });

  router.post('/admin/accounts/:id', requireAdmin, async (ctx) => {
    const account = await loadAccount(ctx.params.id);
    const name = str(ctx.body.name, 120);
    const status = ACCOUNT_STATUS[ctx.body.status] ? ctx.body.status : account.status;
    const trialEnds = /^\d{4}-\d{2}-\d{2}$/.test(str(ctx.body.trialEnds)) ? `${ctx.body.trialEnds} 23:59:59` : account.trial_ends_at;
    if (!name) {
      flash(ctx, 'Il nome dell’attività è obbligatorio.', 'error');
      return ctx.redirect(`/admin/accounts/${account.id}`);
    }
    await M.updateAccount(account.id, {
      name,
      plan: PLANS[ctx.body.plan] ? ctx.body.plan : account.plan,
      status,
      trial_ends_at: trialEnds,
      sector: SECTORS[ctx.body.sector] ? ctx.body.sector : account.sector,
      notes: str(ctx.body.notes, 2000),
    });
    flash(ctx, 'Cliente aggiornato.');
    ctx.redirect(`/admin/accounts/${account.id}`);
  });

  router.post('/admin/accounts/:id/widgets', requireAdmin, async (ctx) => {
    const account = await loadAccount(ctx.params.id);
    const name = str(ctx.body.name, 80);
    const siteUrl = str(ctx.body.siteUrl, 300);
    if (!name || (siteUrl && !isHttpUrl(siteUrl))) {
      flash(ctx, 'Controlla nome e indirizzo del sito (completo di https://).', 'error');
      return ctx.redirect(`/admin/accounts/${account.id}`);
    }
    const plan = PLANS[account.plan];
    if (await M.countWidgets(account.id) >= plan.widgets) {
      flash(ctx, `Il piano ${plan.name} include ${plan.widgets} assistenti: cambia piano per aggiungerne altri.`, 'error');
      return ctx.redirect(`/admin/accounts/${account.id}`);
    }
    const sector = SECTORS[ctx.body.sector] ? ctx.body.sector : account.sector;
    const widget = await M.createWidget({ accountId: account.id, name, siteUrl, sector });
    flash(ctx, 'Assistente creato con il modello di settore. Completa le risposte prima di consegnarlo.');
    ctx.redirect(`/app/widgets/${widget.id}/risposte`);
  });

  router.post('/admin/accounts/:id/invite', requireAdmin, async (ctx) => {
    const account = await loadAccount(ctx.params.id);
    const user = await M.getUser(Number(ctx.body.userId));
    if (!user || user.account_id !== account.id) throw new HttpError(404, 'Utente non trovato');
    flash(ctx, inviteUrl(await M.createInvite(user.id)), 'invite');
    ctx.redirect(`/admin/accounts/${account.id}`);
  });

  router.post('/admin/accounts/:id/elimina', requireAdmin, async (ctx) => {
    const account = await loadAccount(ctx.params.id);
    if (str(ctx.body.confirm) !== account.name) {
      flash(ctx, 'Conferma non corretta: il cliente non è stato eliminato.', 'error');
      return ctx.redirect(`/admin/accounts/${account.id}`);
    }
    await M.deleteAccount(account.id);
    flash(ctx, `Cliente “${account.name}” eliminato.`);
    ctx.redirect('/admin/accounts');
  });

  // ---------- Accesso come cliente ----------
  router.post('/admin/accounts/:id/impersonate', requireAdmin, async (ctx) => {
    if (ctx.impersonator) throw new HttpError(400, 'Sei già nella dashboard di un cliente.');
    const account = await loadAccount(ctx.params.id);
    const [owner] = await M.listAccountUsers(account.id);
    if (!owner) throw new HttpError(404, 'Il cliente non ha utenti');
    const adminId = ctx.user.id;
    await endSession(ctx);
    await startSession(ctx, owner.id, adminId);
    flash(ctx, `Stai vedendo la dashboard di ${account.name}.`);
    ctx.redirect('/app');
  });

  router.post('/admin/impersonate/stop', async (ctx) => {
    if (!ctx.user || !ctx.impersonator) return ctx.redirect('/accedi');
    const accountId = ctx.user.account_id;
    const adminId = ctx.impersonator.id;
    await endSession(ctx);
    await startSession(ctx, adminId);
    ctx.redirect(accountId ? `/admin/accounts/${accountId}` : '/admin');
  });

  // ---------- Tutti gli assistenti ----------
  router.get('/admin/widgets', requireAdmin, async (ctx) => {
    const widgets = await M.listAllWidgets();
    const body = widgets.length
      ? html`<div class="table-wrap"><table class="table">
          <thead><tr><th scope="col">Assistente</th><th scope="col">Cliente</th><th scope="col">Installazione</th><th scope="col" class="num">Risposte</th><th scope="col" class="num">Conv. (30 g)</th><th scope="col" class="num">Contatti (30 g)</th></tr></thead>
          <tbody>${widgets.map((w) => html`<tr>
            <td><a class="row-link" href="/app/widgets/${w.id}">${w.name}</a><div class="muted small">${w.public_id}</div></td>
            <td><a href="/admin/accounts/${w.account_id}">${w.account_name}</a><div>${planBadge(w.account_plan)}</div></td>
            <td>${widgetStatusBadge(w)} ${installStatus(w)}</td>
            <td class="num">${w.knowledge_count}</td>
            <td class="num">${w.conv_30d}</td>
            <td class="num">${w.leads_30d}</td>
          </tr>`)}</tbody></table></div>`
      : emptyState({ title: 'Nessun assistente', text: 'Gli assistenti creati dai clienti o dall’admin compaiono qui.' });
    ctx.html(adminLayout(ctx, { title: 'Tutti gli assistenti', active: 'widgets', body }));
  });

  router.get('/admin/leads', requireAdmin, async (ctx) => {
    // il nome del cliente arriva già dalla query (account_name): una sola lettura per tutta la lista
    const leads = (await M.listLeads({ limit: 300 })).filter((l) => !l.is_test);
    ctx.html(adminLayout(ctx, {
      title: 'Tutti i contatti', active: 'leads',
      body: html`<p class="muted">Contatti raccolti da tutti gli assistenti della piattaforma (esclusi quelli di prova).</p>${leadsTable(ctx, leads, { showAccount: true, returnTo: '/admin/leads' })}`,
    }));
  });
}
