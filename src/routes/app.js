// Dashboard del cliente. L'admin può aprire le stesse pagine per qualsiasi assistente.
import { config, PLANS } from '../config.js';
import { flash, loadOwnedWidget, requireUser } from '../auth.js';
import { fmtDateTime, fmtNum, html, raw, timeAgo } from '../lib/html.js';
import { HttpError, str } from '../lib/http.js';
import { verifyPassword } from '../lib/security.js';
import { SECTORS } from '../templates.js';
import * as M from '../models.js';
import { appLayout, csrfField, emptyState, field, icon } from '../views/layout.js';
import {
  dailyChart, installStatus, leadStatusLabel, pct, statCard, usageBar, widgetStatusBadge,
} from '../views/components.js';
import {
  appearancePage, conversationDetail, conversationsPage, installPage, knowledgePage, newWidgetPage,
  previewScript, widgetHeader, widgetOverview,
} from '../views/widget-views.js';
import { buildPluginZip } from '../wordpress.js';

const HEX = /^#[0-9a-f]{6}$/i;
const isHttpUrl = (v) => {
  try {
    return ['http:', 'https:'].includes(new URL(v).protocol);
  } catch {
    return false;
  }
};

// Account su cui si sta lavorando: quello dell'utente, o per l'admin quello del widget aperto.
function ownAccount(ctx) {
  if (!ctx.user.account_id) return null;
  return M.getAccount(ctx.user.account_id);
}

function requireClientAccount(ctx) {
  if (ctx.user.role === 'admin' && !ctx.user.account_id) return ctx.redirect('/admin');
  if (!ownAccount(ctx)) throw new HttpError(404, 'Account non trovato');
}

function widgetPage(ctx, widget, { title, active, body, scripts = '' }) {
  const account = M.getAccount(widget.account_id);
  const isAdmin = ctx.user.role === 'admin';
  return appLayout(ctx, {
    title,
    active: 'widgets',
    account,
    bodyClass: scripts ? 'has-preview' : '',
    topRight: html`${widgetStatusBadge(widget)}<a class="btn btn-sm btn-outline" href="/c/${widget.public_id}" target="_blank" rel="noopener">${icon('eye', 15)} Apri la chat</a>`,
    body: html`${widgetHeader(widget, active, { account, isAdmin })}${body}`,
    scripts,
  });
}

export function parseDomains(input) {
  return [...new Set(
    String(input || '')
      .split(/[\s,;]+/)
      .map((d) => M.domainFromUrl(d.trim()))
      .filter((d) => /^(?=.{1,253}$)([a-z0-9-]{1,63}\.)*[a-z0-9-]{1,63}$/.test(d)),
  )].slice(0, 20);
}

export function registerApp(router) {
  // ---------- Panoramica ----------
  router.get('/app', requireUser, requireClientAccount, (ctx) => {
    const account = ownAccount(ctx);
    const plan = PLANS[account.plan];
    const widgets = M.listWidgets(account.id);
    const used = M.accountConversationsThisMonth(account.id);
    const daily = M.dailyConversations(widgets.map((w) => w.id), 30);
    const leads = M.listLeads({ accountId: account.id, limit: 5 }).filter((l) => !l.is_test);
    const newLeads = M.listLeads({ accountId: account.id, status: 'new' }).filter((l) => !l.is_test).length;

    const body = widgets.length
      ? html`
        <section class="grid-3">
          <div class="panel">${usageBar(used, plan.conversations)}</div>
          ${statCard('Contatti da richiamare', fmtNum(newLeads), newLeads ? html`<a href="/app/leads?stato=new">Apri la lista</a>` : 'nessuno in attesa')}
          ${statCard('Assistenti', `${widgets.length} di ${plan.widgets}`, `piano ${plan.name}`)}
        </section>
        <section class="panel">${dailyChart(daily)}</section>
        <div class="grid-2">
          <section class="panel">
            <div class="panel-head"><h2 class="panel-title">I tuoi assistenti</h2><a class="btn btn-sm btn-outline" href="/app/widgets/new">${icon('plus', 15)} Nuovo</a></div>
            <ul class="widget-list">${widgets.map((w) => html`<li>
              <a href="/app/widgets/${w.id}" class="widget-row">
                <span class="w-dot" style="background:${HEX.test(w.settings.color) ? w.settings.color : '#1F5C4A'}"></span>
                <span class="w-main"><b>${w.name}</b><span class="muted small">${w.site_url || 'Sito non indicato'}</span></span>
                <span class="w-side">${installStatus(w)}<span class="muted small">${w.conv_30d} conversazioni · ${w.leads_30d} contatti in 30 giorni</span></span>
              </a></li>`)}</ul>
          </section>
          <section class="panel">
            <div class="panel-head"><h2 class="panel-title">Ultimi contatti</h2><a class="link small" href="/app/leads">Tutti</a></div>
            ${leads.length
              ? html`<ul class="lead-list">${leads.map((l) => html`<li>
                  <div><b>${l.name}</b><span class="muted small">${l.email || l.phone} · ${l.widget_name}</span></div>
                  <span class="muted small nowrap">${timeAgo(l.created_at)}</span></li>`)}</ul>`
              : html`<p class="muted">Quando un visitatore lascia i suoi recapiti nella chat, lo trovi qui.</p>`}
          </section>
        </div>`
      : emptyState({
          title: 'Crea il tuo primo assistente',
          text: 'Scegli il settore e parti con le domande più frequenti già scritte. Ci vuole meno di un minuto.',
          action: html`<a class="btn btn-primary btn-lg" href="/app/widgets/new">Crea assistente</a>`,
        });

    ctx.html(appLayout(ctx, { title: 'Panoramica', active: 'home', account, body }));
  });

  // ---------- Elenco e creazione ----------
  router.get('/app/widgets', requireUser, requireClientAccount, (ctx) => {
    const account = ownAccount(ctx);
    const widgets = M.listWidgets(account.id);
    const plan = PLANS[account.plan];
    const body = widgets.length
      ? html`<div class="table-wrap"><table class="table">
          <thead><tr><th scope="col">Assistente</th><th scope="col">Stato</th><th scope="col" class="num">Risposte</th><th scope="col" class="num">Conversazioni (30 g)</th><th scope="col" class="num">Contatti (30 g)</th></tr></thead>
          <tbody>${widgets.map((w) => html`<tr>
            <td><a class="row-link" href="/app/widgets/${w.id}">${w.name}</a><div class="muted small">${w.site_url || '—'}</div></td>
            <td>${widgetStatusBadge(w)} ${installStatus(w)}</td>
            <td class="num">${w.knowledge_count}</td>
            <td class="num">${w.conv_30d}</td>
            <td class="num">${w.leads_30d}</td>
          </tr>`)}</tbody></table></div>
          <p class="muted small">Stai usando ${widgets.length} di ${plan.widgets} assistenti inclusi nel piano ${plan.name}.</p>`
      : emptyState({ title: 'Nessun assistente', text: 'Crea il primo assistente per il tuo sito.', action: html`<a class="btn btn-primary" href="/app/widgets/new">Crea assistente</a>` });
    ctx.html(appLayout(ctx, {
      title: 'Assistenti', active: 'widgets', account, body,
      topRight: html`<a class="btn btn-primary btn-sm" href="/app/widgets/new">${icon('plus', 15)} Nuovo assistente</a>`,
    }));
  });

  router.get('/app/widgets/new', requireUser, requireClientAccount, (ctx) => {
    const account = ownAccount(ctx);
    const plan = PLANS[account.plan];
    const limitReached = M.countWidgets(account.id) >= plan.widgets;
    ctx.html(appLayout(ctx, {
      title: 'Nuovo assistente', active: 'widgets', account,
      body: newWidgetPage(ctx, { values: { sector: account.sector }, limitReached, plan, first: ctx.query.primo === '1' }),
    }));
  });

  router.post('/app/widgets', requireUser, requireClientAccount, (ctx) => {
    const account = ownAccount(ctx);
    const plan = PLANS[account.plan];
    if (M.countWidgets(account.id) >= plan.widgets) throw new HttpError(403, 'Hai raggiunto il numero di assistenti incluso nel tuo piano.');
    const values = {
      name: str(ctx.body.name, 80),
      siteUrl: str(ctx.body.siteUrl, 300),
      sector: SECTORS[ctx.body.sector] ? ctx.body.sector : 'generico',
      withTemplate: ctx.body.withTemplate === '1',
    };
    const errors = {};
    if (!values.name) errors.name = 'Scrivi un nome.';
    if (values.siteUrl && !isHttpUrl(values.siteUrl)) errors.siteUrl = 'Inserisci un indirizzo completo, es. https://www.tuosito.it';
    if (Object.keys(errors).length) {
      return ctx.html(appLayout(ctx, { title: 'Nuovo assistente', active: 'widgets', account, body: newWidgetPage(ctx, { values, errors, plan }) }), 422);
    }
    const widget = M.createWidget({ accountId: account.id, ...values });
    flash(ctx, values.withTemplate
      ? 'Assistente creato con le domande del tuo settore. Sostituisci le parti tra [parentesi] con i tuoi dati.'
      : 'Assistente creato. Aggiungi le prime risposte.');
    ctx.redirect(`/app/widgets/${widget.id}/risposte`);
  });

  // ---------- Pagine del singolo assistente ----------
  router.get('/app/widgets/:id', requireUser, (ctx) => {
    const widget = loadOwnedWidget(ctx, ctx.params.id);
    const body = widgetOverview(ctx, {
      widget,
      stats: M.widgetStats(widget.id),
      knowledge: M.listKnowledge(widget.id),
      unanswered: M.unansweredQuestions(widget.id),
    });
    ctx.html(widgetPage(ctx, widget, { title: widget.name, active: '', body }));
  });

  router.post('/app/widgets/:id/stato', requireUser, (ctx) => {
    const widget = loadOwnedWidget(ctx, ctx.params.id);
    const status = ctx.body.status === 'paused' ? 'paused' : 'active';
    M.updateWidget(widget.id, { status });
    flash(ctx, status === 'paused' ? 'Assistente in pausa: non compare più sul sito.' : 'Assistente riattivato.');
    ctx.redirect(`/app/widgets/${widget.id}`);
  });

  router.get('/app/widgets/:id/risposte', requireUser, (ctx) => {
    const widget = loadOwnedWidget(ctx, ctx.params.id);
    const body = knowledgePage(ctx, {
      widget,
      knowledge: M.listKnowledge(widget.id),
      unanswered: M.unansweredQuestions(widget.id),
      prefill: str(ctx.query.q, 300),
    });
    ctx.html(widgetPage(ctx, widget, { title: widget.name, active: '/risposte', body, scripts: previewScript(widget) }));
  });

  const readKnowledge = (ctx) => {
    const v = { question: str(ctx.body.question, 300), answer: str(ctx.body.answer, 2000), keywords: str(ctx.body.keywords, 300) };
    if (!v.question || !v.answer) throw new HttpError(422, 'Domanda e risposta sono obbligatorie.');
    return v;
  };

  router.post('/app/widgets/:id/risposte', requireUser, (ctx) => {
    const widget = loadOwnedWidget(ctx, ctx.params.id);
    if (M.listKnowledge(widget.id).length >= 500) throw new HttpError(422, 'Hai raggiunto il massimo di 500 risposte per assistente.');
    M.addKnowledge(widget.id, readKnowledge(ctx));
    flash(ctx, 'Risposta aggiunta. Puoi provarla subito nell’assistente qui a destra.');
    ctx.redirect(`/app/widgets/${widget.id}/risposte`);
  });

  const loadKnowledge = (ctx, widget) => {
    const k = M.getKnowledge(Number(ctx.params.kid));
    if (!k || k.widget_id !== widget.id) throw new HttpError(404, 'Risposta non trovata');
    return k;
  };

  router.post('/app/widgets/:id/risposte/:kid', requireUser, (ctx) => {
    const widget = loadOwnedWidget(ctx, ctx.params.id);
    const k = loadKnowledge(ctx, widget);
    M.updateKnowledge(k.id, readKnowledge(ctx));
    flash(ctx, 'Risposta salvata.');
    ctx.redirect(`/app/widgets/${widget.id}/risposte`);
  });

  router.post('/app/widgets/:id/risposte/:kid/elimina', requireUser, (ctx) => {
    const widget = loadOwnedWidget(ctx, ctx.params.id);
    const k = loadKnowledge(ctx, widget);
    M.deleteKnowledge(k.id);
    flash(ctx, 'Risposta eliminata.');
    ctx.redirect(`/app/widgets/${widget.id}/risposte`);
  });

  router.get('/app/widgets/:id/aspetto', requireUser, (ctx) => {
    const widget = loadOwnedWidget(ctx, ctx.params.id);
    const account = M.getAccount(widget.account_id);
    ctx.html(widgetPage(ctx, widget, { title: widget.name, active: '/aspetto', body: appearancePage(ctx, { widget, account }), scripts: previewScript(widget) }));
  });

  router.post('/app/widgets/:id/aspetto', requireUser, (ctx) => {
    const widget = loadOwnedWidget(ctx, ctx.params.id);
    const account = M.getAccount(widget.account_id);
    const b = ctx.body;
    const settings = {
      title: str(b.title, 60),
      subtitle: str(b.subtitle, 60),
      avatarText: str(b.avatarText, 2).toUpperCase(),
      color: HEX.test(str(b.color)) ? str(b.color).toUpperCase() : widget.settings.color,
      position: b.position === 'left' ? 'left' : 'right',
      welcomeMessage: str(b.welcomeMessage, 400),
      launcherLabel: str(b.launcherLabel, 40),
      quickReplies: str(b.quickReplies, 400).split(/\r?\n/).map((q) => q.trim().slice(0, 80)).filter(Boolean).slice(0, 4),
      fallbackMessage: str(b.fallbackMessage, 400),
      leadCapture: b.leadCapture === '1',
      askPhone: b.askPhone === '1',
      privacyUrl: str(b.privacyUrl, 300),
      showBranding: PLANS[account.plan].branding ? true : b.showBranding === '1',
    };
    const name = str(b.name, 80);
    const problems = [];
    if (!name) problems.push('il nome dell’assistente');
    if (!settings.title) problems.push('il titolo');
    if (!settings.welcomeMessage) problems.push('il messaggio di benvenuto');
    if (!settings.fallbackMessage) problems.push('il messaggio quando non trova una risposta');
    if (settings.privacyUrl && !isHttpUrl(settings.privacyUrl)) problems.push('un link privacy valido (https://…)');
    if (problems.length) {
      flash(ctx, `Modifiche non salvate: manca ${problems.join(', ')}.`, 'error');
      return ctx.redirect(`/app/widgets/${widget.id}/aspetto`);
    }
    M.updateWidget(widget.id, { name, settings });
    flash(ctx, 'Modifiche salvate. Sono già attive sul sito.');
    ctx.redirect(`/app/widgets/${widget.id}/aspetto`);
  });

  router.get('/app/widgets/:id/installazione', requireUser, (ctx) => {
    const widget = loadOwnedWidget(ctx, ctx.params.id);
    ctx.html(widgetPage(ctx, widget, { title: widget.name, active: '/installazione', body: installPage(ctx, { widget }) }));
  });

  router.post('/app/widgets/:id/installazione', requireUser, (ctx) => {
    const widget = loadOwnedWidget(ctx, ctx.params.id);
    const siteUrl = str(ctx.body.siteUrl, 300);
    if (siteUrl && !isHttpUrl(siteUrl)) {
      flash(ctx, 'Indirizzo del sito non valido: scrivilo completo, es. https://www.tuosito.it', 'error');
      return ctx.redirect(`/app/widgets/${widget.id}/installazione`);
    }
    const domains = parseDomains(ctx.body.allowedDomains);
    M.updateWidget(widget.id, { siteUrl, allowedDomains: domains });
    flash(ctx, domains.length ? `Salvato. L’assistente risponde solo su: ${domains.join(', ')}.` : 'Salvato. Nessun dominio indicato: l’assistente funziona su qualsiasi sito.');
    ctx.redirect(`/app/widgets/${widget.id}/installazione`);
  });

  router.get('/app/widgets/:id/conversazioni', requireUser, (ctx) => {
    const widget = loadOwnedWidget(ctx, ctx.params.id);
    const filter = ['unanswered', 'leads'].includes(ctx.query.filtro) ? ctx.query.filtro : 'all';
    const showTest = ctx.query.prove === '1';
    const conversations = M.listConversations(widget.id, { filter, includeTest: showTest });
    ctx.html(widgetPage(ctx, widget, { title: widget.name, active: '/conversazioni', body: conversationsPage({ widget, conversations, filter, showTest }) }));
  });

  router.get('/app/widgets/:id/conversazioni/:cid', requireUser, (ctx) => {
    const widget = loadOwnedWidget(ctx, ctx.params.id);
    const conversation = M.getConversation(widget.id, ctx.params.cid);
    if (!conversation) throw new HttpError(404, 'Conversazione non trovata');
    const messages = M.listMessages(conversation.id);
    let lastQuestion = '';
    for (const m of messages) {
      if (m.role === 'visitor') lastQuestion = m.body;
      else m.prevQuestion = lastQuestion;
    }
    const knowledgeById = Object.fromEntries(M.listKnowledge(widget.id).map((k) => [k.id, k]));
    const lead = M.listLeads({ widgetId: widget.id }).find((l) => l.conversation_id === conversation.id);
    ctx.html(widgetPage(ctx, widget, {
      title: widget.name, active: '/conversazioni',
      body: conversationDetail({ widget, conversation, messages, knowledgeById, lead }),
    }));
  });

  router.post('/app/widgets/:id/elimina', requireUser, (ctx) => {
    const widget = loadOwnedWidget(ctx, ctx.params.id);
    if (str(ctx.body.confirm) !== widget.name) {
      flash(ctx, 'Per eliminare l’assistente scrivi esattamente il suo nome.', 'error');
      return ctx.redirect(`/app/widgets/${widget.id}`);
    }
    M.deleteWidget(widget.id);
    flash(ctx, `Assistente “${widget.name}” eliminato.`);
    ctx.redirect(ctx.user.role === 'admin' ? `/admin/accounts/${widget.account_id}` : '/app/widgets');
  });

  // ---------- Contatti ----------
  router.get('/app/leads', requireUser, requireClientAccount, (ctx) => {
    const account = ownAccount(ctx);
    const status = ['new', 'contacted', 'closed'].includes(ctx.query.stato) ? ctx.query.stato : '';
    const leads = M.listLeads({ accountId: account.id, status }).filter((l) => ctx.query.prove === '1' || !l.is_test);
    const filters = [['', 'Tutti'], ['new', 'Da richiamare'], ['contacted', 'Contattati'], ['closed', 'Chiusi']];
    const body = html`
      <div class="toolbar">
        <div class="segmented" role="group" aria-label="Filtra per stato">
          ${filters.map(([s, l]) => html`<a class="${status === s ? 'is-active' : ''}" href="/app/leads${s ? `?stato=${s}` : ''}">${l}</a>`)}
        </div>
        <a class="btn btn-sm btn-outline" href="/app/leads.csv">Esporta CSV</a>
      </div>
      ${leadsTable(ctx, leads, { returnTo: ctx.path + ctx.url.search })}`;
    ctx.html(appLayout(ctx, { title: 'Contatti raccolti', active: 'leads', account, body }));
  });

  router.get('/app/leads.csv', requireUser, requireClientAccount, (ctx) => {
    const account = ownAccount(ctx);
    const leads = M.listLeads({ accountId: account.id }).filter((l) => !l.is_test);
    ctx.text(leadsCsv(leads), 200, 'text/csv; charset=utf-8', {
      'Content-Disposition': `attachment; filename="contatti-${new Date().toISOString().slice(0, 10)}.csv"`,
    });
  });

  router.post('/app/leads/:lid/stato', requireUser, (ctx) => {
    const lead = M.getLead(Number(ctx.params.lid));
    if (!lead || (ctx.user.role !== 'admin' && lead.account_id !== ctx.user.account_id)) throw new HttpError(404, 'Contatto non trovato');
    const status = ['new', 'contacted', 'closed'].includes(ctx.body.status) ? ctx.body.status : 'new';
    M.setLeadStatus(lead.id, status);
    flash(ctx, `Contatto segnato come “${leadStatusLabel(status).toLowerCase()}”.`);
    const back = str(ctx.body.returnTo, 300);
    ctx.redirect(/^\/(app|admin)\//.test(back) ? back : '/app/leads');
  });

  // ---------- Account ----------
  router.get('/app/account', requireUser, requireClientAccount, (ctx) => {
    const account = ownAccount(ctx);
    const used = M.accountConversationsThisMonth(account.id);
    const body = html`
      <div class="grid-main-side">
        <div class="stack-lg">
          <section class="panel">
            <h2 class="panel-title">Il tuo piano</h2>
            ${usageBar(used, PLANS[account.plan].conversations)}
            <div class="plan-grid">
              ${Object.values(PLANS).map((p) => html`<div class="plan-mini${p.id === account.plan ? ' is-current' : ''}">
                <b>${p.name}</b><span class="plan-mini-price">${p.price} €/mese</span>
                <span class="muted small">${p.widgets} ${p.widgets === 1 ? 'sito' : 'siti'} · ${fmtNum(p.conversations)} conversazioni</span>
                ${p.id === account.plan ? html`<span class="badge badge-ok">Piano attuale</span>` : ''}
              </div>`)}
            </div>
            <p class="muted small">Per cambiare piano scrivi a <a href="mailto:${config.brand.supportEmail}?subject=${encodeURIComponent(`Cambio piano – ${account.name}`)}">${config.brand.supportEmail}</a>. Il pagamento online arriverà con la prossima versione.</p>
          </section>
          <section class="panel">
            <h2 class="panel-title">Dati dell’attività</h2>
            <form method="post" action="/app/account" class="stack form-narrow">
              ${csrfField(ctx)}
              ${field({ label: 'Nome dell’attività', name: 'company', value: account.name, required: true })}
              ${field({ label: 'Il tuo nome', name: 'name', value: ctx.user.name, required: true })}
              <div><button class="btn btn-primary" type="submit">Salva</button></div>
            </form>
          </section>
        </div>
        <aside class="stack-lg">
          <section class="panel">
            <h2 class="panel-title">Cambia password</h2>
            <form method="post" action="/app/account/password" class="stack">
              ${csrfField(ctx)}
              ${field({ label: 'Password attuale', name: 'current', type: 'password', required: true, autocomplete: 'current-password' })}
              ${field({ label: 'Nuova password', name: 'password', type: 'password', required: true, autocomplete: 'new-password', hint: 'Almeno 10 caratteri.' })}
              <div><button class="btn btn-outline" type="submit">Aggiorna password</button></div>
            </form>
          </section>
          <section class="panel">
            <h2 class="panel-title">Accesso</h2>
            <dl class="dl"><dt>Email</dt><dd>${ctx.user.email}</dd><dt>Cliente dal</dt><dd>${fmtDateTime(account.created_at)}</dd></dl>
          </section>
        </aside>
      </div>`;
    ctx.html(appLayout(ctx, { title: 'Account e piano', active: 'account', account, body }));
  });

  router.post('/app/account', requireUser, requireClientAccount, (ctx) => {
    const account = ownAccount(ctx);
    const company = str(ctx.body.company, 120);
    const name = str(ctx.body.name, 120);
    if (!company || !name) {
      flash(ctx, 'Nome dell’attività e nome sono obbligatori.', 'error');
      return ctx.redirect('/app/account');
    }
    M.updateAccount(account.id, { name: company });
    M.updateUserName(ctx.user.id, name);
    flash(ctx, 'Dati aggiornati.');
    ctx.redirect('/app/account');
  });

  router.post('/app/account/password', requireUser, requireClientAccount, (ctx) => {
    const current = typeof ctx.body.current === 'string' ? ctx.body.current : '';
    const password = typeof ctx.body.password === 'string' ? ctx.body.password : '';
    if (!verifyPassword(current, ctx.user.password_hash)) {
      flash(ctx, 'La password attuale non è corretta.', 'error');
      return ctx.redirect('/app/account');
    }
    if (password.length < 10 || password.length > 200) {
      flash(ctx, 'La nuova password deve avere almeno 10 caratteri.', 'error');
      return ctx.redirect('/app/account');
    }
    M.setPassword(ctx.user.id, password);
    flash(ctx, 'Password aggiornata.');
    ctx.redirect('/app/account');
  });

  // ---------- Plugin WordPress (generato al volo dai sorgenti nel repository) ----------
  router.get('/download/sportello-wordpress.zip', (ctx) => {
    const zip = buildPluginZip();
    ctx.res.setHeader('Content-Disposition', 'attachment; filename="sportello-wordpress.zip"');
    ctx.res.setHeader('Content-Length', zip.length);
    ctx.text(zip, 200, 'application/zip');
  });
}

export function leadsTable(ctx, leads, { showAccount = false, returnTo = '/app/leads' } = {}) {
  if (!leads.length) {
    return html`<div class="panel"><p class="muted">Nessun contatto ${showAccount ? '' : 'per ora. Quando un visitatore lascia i suoi recapiti nella chat, compare qui'}.</p></div>`;
  }
  return html`<div class="table-wrap"><table class="table">
    <thead><tr><th scope="col">Nome</th><th scope="col">Recapiti</th><th scope="col">Assistente</th><th scope="col">Ricevuto</th><th scope="col">Stato</th></tr></thead>
    <tbody>${leads.map((l) => html`<tr>
      <td><b>${l.name}</b>${l.is_test ? html` <span class="badge">Prova</span>` : ''}${showAccount && l.account_name ? html`<div class="muted small">${l.account_name}</div>` : ''}</td>
      <td>${l.email ? html`<a href="mailto:${l.email}">${l.email}</a>` : ''}${l.email && l.phone ? html`<br>` : ''}${l.phone ? html`<a href="tel:${l.phone}">${l.phone}</a>` : ''}</td>
      <td>${l.widget_name}${l.conversation_public_id ? html`<div><a class="link small" href="/app/widgets/${l.widget_id}/conversazioni/${l.conversation_public_id}">Leggi la conversazione</a></div>` : ''}</td>
      <td class="muted nowrap">${timeAgo(l.created_at)}</td>
      <td>
        <form method="post" action="/app/leads/${l.id}/stato" class="inline-form">
          ${csrfField(ctx)}
          <input type="hidden" name="returnTo" value="${returnTo}">
          <label class="sr-only" for="ls-${l.id}">Stato del contatto ${l.name}</label>
          <select id="ls-${l.id}" name="status" data-autosubmit>
            ${['new', 'contacted', 'closed'].map((s) => html`<option value="${s}"${l.status === s ? raw(' selected') : ''}>${leadStatusLabel(s)}</option>`)}
          </select>
          <button class="btn btn-sm btn-outline js-hide" type="submit">Aggiorna</button>
        </form>
      </td>
    </tr>`)}</tbody></table></div>`;
}

// CSV con separatore ";" e BOM: si apre correttamente in Excel con impostazioni italiane.
const BOM = String.fromCharCode(0xfeff);
const CRLF = String.fromCharCode(13, 10);
export function leadsCsv(leads) {
  const cell = (v) => {
    let s = String(v ?? '');
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // evita l'esecuzione di formule nei fogli di calcolo
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = [['Data', 'Nome', 'Email', 'Telefono', 'Assistente', 'Stato']];
  for (const l of leads) rows.push([l.created_at, l.name, l.email, l.phone, l.widget_name, leadStatusLabel(l.status)]);
  return BOM + rows.map((r) => r.map(cell).join(';')).join(CRLF) + CRLF;
}

export { pct };
