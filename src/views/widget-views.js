// Pagine di gestione di un singolo assistente (usate da cliente e admin).
import { config, PLANS } from '../config.js';
import { fmtDateTime, fmtNum, html, raw, timeAgo } from '../lib/html.js';
import { SECTORS } from '../templates.js';
import {
  copyField, hasPlaceholder, hostedUrl, installStatus, outcomeLabel, pct, snippetFor, statCard, widgetStatusBadge,
} from './components.js';
import { checkbox, csrfField, emptyState, field, icon, select, textarea } from './layout.js';

const TABS = [
  ['', 'Panoramica'],
  ['/risposte', 'Risposte'],
  ['/aspetto', 'Aspetto'],
  ['/installazione', 'Installazione'],
  ['/conversazioni', 'Conversazioni'],
];

export function widgetHeader(widget, active, { account, isAdmin } = {}) {
  const base = `/app/widgets/${widget.id}`;
  return html`<div class="widget-head">
    <div class="widget-head-top">
      <a class="back-link" href="${isAdmin && account ? `/admin/accounts/${account.id}` : '/app/widgets'}">${icon('back', 16)} ${isAdmin && account ? account.name : 'Tutti gli assistenti'}</a>
      <div class="widget-head-meta">${widgetStatusBadge(widget)} ${installStatus(widget)}</div>
    </div>
    <nav class="tabs" aria-label="Sezioni dell'assistente">
      ${TABS.map(([path, label]) => html`<a href="${base}${path}" class="tab${active === path ? ' is-active' : ''}"${active === path ? raw(' aria-current="page"') : ''}>${label}${active === path ? raw('<span class="tab-ink" aria-hidden="true"></span>') : ''}</a>`)}
    </nav>
  </div>`;
}

// Script del widget in modalità anteprima: è lo stesso codice installato sui siti.
export const previewScript = (widget) =>
  html`<script src="/w.js" data-id="${widget.public_id}" data-preview async></script>`;

// ---------------- Panoramica dell'assistente ----------------
export function widgetOverview(ctx, { widget, stats, knowledge, unanswered }) {
  const placeholders = knowledge.filter((k) => hasPlaceholder(k.answer) || hasPlaceholder(k.question)).length;
  const steps = [
    {
      done: knowledge.length > 0 && placeholders === 0,
      title: 'Completa le risposte',
      text: placeholders
        ? `${placeholders} ${placeholders === 1 ? 'risposta contiene' : 'risposte contengono'} ancora parti tra [parentesi] da sostituire.`
        : knowledge.length ? 'Tutte le risposte sono personalizzate.' : 'Aggiungi le domande che ricevi più spesso.',
      href: 'risposte',
      cta: 'Vai alle risposte',
    },
    {
      done: widget.updated_at !== widget.created_at,
      title: 'Scegli colori e messaggi',
      text: 'Colore del tuo marchio, messaggio di benvenuto, posizione nella pagina.',
      href: 'aspetto',
      cta: 'Personalizza',
    },
    {
      done: Boolean(widget.last_seen_at),
      title: 'Installalo sul sito',
      text: widget.last_seen_at ? `Rilevato su ${widget.last_seen_url || 'il sito'}.` : 'Incolla una riga di codice o usa il plugin WordPress.',
      href: 'installazione',
      cta: 'Istruzioni',
    },
  ];
  return html`
    <section class="grid-4">
      ${statCard('Conversazioni', fmtNum(stats.conversations), 'ultimi 30 giorni')}
      ${statCard('Messaggi', fmtNum(stats.messages), 'ultimi 30 giorni')}
      ${statCard('Domande con risposta', pct(stats.answerRate), stats.fallback ? `${stats.fallback} senza risposta` : 'nessuna senza risposta')}
      ${statCard('Contatti raccolti', fmtNum(stats.leads), 'ultimi 30 giorni')}
    </section>
    <div class="grid-2">
      <section class="panel">
        <h2 class="panel-title">Messa in funzione</h2>
        <ol class="checklist-steps">
          ${steps.map((s, i) => html`<li class="${s.done ? 'is-done' : ''}">
            <span class="cs-n">${s.done ? icon('check', 14) : i + 1}</span>
            <div><b>${s.title}</b><p class="muted">${s.text}</p></div>
            <a class="btn btn-sm ${s.done ? 'btn-ghost' : 'btn-outline'}" href="/app/widgets/${widget.id}/${s.href}">${s.cta}</a>
          </li>`)}
        </ol>
      </section>
      <section class="panel">
        <h2 class="panel-title">Domande senza risposta</h2>
        ${unanswered.length
          ? html`<p class="muted small">Sono le domande dei visitatori a cui l’assistente non ha saputo rispondere. Aggiungerle migliora le risposte.</p>
            <ul class="question-list">${unanswered.slice(0, 6).map((u) => html`<li>
              <span>“${u.body}”</span>
              <a class="btn btn-sm btn-outline" href="/app/widgets/${widget.id}/risposte?q=${encodeURIComponent(u.body)}#nuova">Aggiungi risposta</a>
            </li>`)}</ul>`
          : html`<p class="muted">Nessuna per ora. Quando un visitatore fa una domanda a cui l’assistente non sa rispondere, la trovi qui.</p>`}
      </section>
    </div>
    <section class="panel panel-row">
      <div>
        <h2 class="panel-title">Stato dell’assistente</h2>
        <p class="muted">${widget.status === 'active'
          ? 'L’assistente è attivo e risponde ai visitatori.'
          : 'L’assistente è in pausa: non compare sul sito finché non lo riattivi.'}</p>
      </div>
      <form method="post" action="/app/widgets/${widget.id}/stato">
        ${csrfField(ctx)}
        <input type="hidden" name="status" value="${widget.status === 'active' ? 'paused' : 'active'}">
        <button class="btn ${widget.status === 'active' ? 'btn-outline' : 'btn-primary'}" type="submit">${widget.status === 'active' ? 'Metti in pausa' : 'Riattiva'}</button>
      </form>
    </section>
    <details class="panel danger-zone">
      <summary class="panel-title">Elimina assistente</summary>
      <p class="muted small">Cancella l’assistente con tutte le risposte, le conversazioni e i contatti raccolti. Il codice installato sul sito smetterà di funzionare. Non si può annullare.</p>
      <form method="post" action="/app/widgets/${widget.id}/elimina" class="stack form-narrow">
        ${csrfField(ctx)}
        ${field({ label: `Scrivi “${widget.name}” per confermare`, name: 'confirm', required: true, id: 'del-widget' })}
        <div><button class="btn btn-danger" type="submit">Elimina definitivamente</button></div>
      </form>
    </details>`;
}

// ---------------- Risposte ----------------
export function knowledgePage(ctx, { widget, knowledge, unanswered, prefill = '' }) {
  const base = `/app/widgets/${widget.id}/risposte`;
  return html`
    <div class="notice-box">
      ${icon('shield', 18)}
      <p><b>Risposte predefinite.</b> In questa versione l’assistente non usa l’intelligenza artificiale: risponde solo con le risposte qui sotto, scegliendo quella più vicina alla domanda. Se nessuna è abbastanza vicina, lo dice e propone di lasciare un contatto.</p>
    </div>
    <div class="grid-main-side">
      <div class="stack-lg">
        <section class="panel" id="nuova">
          <h2 class="panel-title">Aggiungi una risposta</h2>
          <form method="post" action="${base}" class="stack">
            ${csrfField(ctx)}
            ${field({ label: 'Domanda del visitatore', name: 'question', value: prefill, required: true, placeholder: 'Es. Avete il parcheggio?' })}
            ${textarea({ label: 'Risposta', name: 'answer', required: true, rows: 3, placeholder: 'Scrivi la risposta come la daresti a voce a un cliente.' })}
            ${field({ label: 'Altre parole che i visitatori potrebbero usare', name: 'keywords', hint: 'Separate da spazi. Es. “auto posteggio garage” per una domanda sul parcheggio.' })}
            <div><button class="btn btn-primary" type="submit">${icon('plus', 16)} Aggiungi</button></div>
          </form>
        </section>

        <section class="panel">
          <div class="panel-head">
            <h2 class="panel-title">Risposte dell’assistente <span class="count">${knowledge.length}</span></h2>
          </div>
          ${knowledge.length
            ? html`<ul class="kb-list">${knowledge.map((k) => {
                const todo = hasPlaceholder(k.answer) || hasPlaceholder(k.question);
                return html`<li class="kb-item${todo ? ' is-todo' : ''}">
                  <details>
                    <summary>
                      <span class="kb-q">${k.question}</span>
                      <span class="kb-meta">${todo ? html`<span class="badge badge-warn">Da completare</span>` : ''}${k.hits ? html`<span class="muted small">usata ${k.hits} ${k.hits === 1 ? 'volta' : 'volte'}</span>` : ''}</span>
                    </summary>
                    <form method="post" action="${base}/${k.id}" class="stack kb-form">
                      ${csrfField(ctx)}
                      ${field({ label: 'Domanda', name: 'question', value: k.question, required: true, id: `q-${k.id}` })}
                      ${textarea({ label: 'Risposta', name: 'answer', value: k.answer, required: true, rows: 4, id: `a-${k.id}` })}
                      ${field({ label: 'Parole chiave', name: 'keywords', value: k.keywords, id: `k-${k.id}` })}
                      <div class="row-between">
                        <button class="btn btn-primary btn-sm" type="submit">Salva</button>
                        <button class="btn btn-sm btn-danger-ghost" type="submit" formaction="${base}/${k.id}/elimina" data-confirm="Eliminare questa risposta?">Elimina</button>
                      </div>
                    </form>
                  </details>
                  ${todo ? '' : html`<p class="kb-a">${k.answer}</p>`}
                </li>`;
              })}</ul>`
            : emptyState({ title: 'Nessuna risposta', text: 'Aggiungi le domande che ricevi più spesso: orari, prezzi, come prenotare.' })}
        </section>
      </div>
      <aside class="stack-lg">
        <section class="panel">
          <h2 class="panel-title">Provalo subito</h2>
          <p class="muted small">L’assistente è aperto in basso a destra, con le risposte salvate. Le prove non contano nei limiti del piano.</p>
          <button class="btn btn-outline btn-block" type="button" data-preview-reset="${widget.public_id}">Ricomincia la conversazione di prova</button>
        </section>
        <section class="panel">
          <h2 class="panel-title">Senza risposta</h2>
          ${unanswered.length
            ? html`<ul class="question-list compact">${unanswered.slice(0, 8).map((u) => html`<li>
                <span>“${u.body}”</span>
                <a class="link" href="${base}?q=${encodeURIComponent(u.body)}#nuova">Rispondi</a>
              </li>`)}</ul>`
            : html`<p class="muted small">Qui compariranno le domande dei visitatori a cui l’assistente non ha saputo rispondere.</p>`}
        </section>
        <section class="panel">
          <h2 class="panel-title">Come scrivere buone risposte</h2>
          <ul class="tips">
            <li>Una domanda per voce: “Avete il parcheggio?” e “Quanto costa il parcheggio?” sono due voci.</li>
            <li>Scrivi la risposta completa, con orari, prezzi e link veri.</li>
            <li>Nelle parole chiave metti i sinonimi che usano i clienti.</li>
          </ul>
        </section>
      </aside>
    </div>`;
}

// ---------------- Aspetto ----------------
const SWATCHES = ['#1F5C4A', '#1D4ED8', '#7C2D12', '#9F1239', '#334155', '#0F766E', '#B45309', '#111827'];

export function appearancePage(ctx, { widget, account }) {
  const s = widget.settings;
  const plan = PLANS[account.plan];
  return html`
    <div class="notice-box">${icon('eye', 18)}<p><b>Anteprima dal vivo.</b> L’assistente in basso ${s.position === 'left' ? 'a sinistra' : 'a destra'} è quello vero e si aggiorna mentre modifichi. Le modifiche arrivano sul sito solo quando salvi.</p></div>
    <form method="post" action="/app/widgets/${widget.id}/aspetto" class="appearance-form" data-live-preview="${widget.public_id}">
      ${csrfField(ctx)}
      <div class="stack-lg">
        <section class="panel stack">
          <h2 class="panel-title">Identità</h2>
          ${field({ label: 'Nome dell’assistente (interno)', name: 'name', value: widget.name, required: true, hint: 'Serve a te per riconoscerlo nella dashboard.' })}
          ${field({ label: 'Titolo nella chat', name: 'title', value: s.title, required: true, attrs: raw('data-setting="title" maxlength="60"') })}
          ${field({ label: 'Sottotitolo', name: 'subtitle', value: s.subtitle, attrs: raw('data-setting="subtitle" maxlength="60"') })}
          ${field({ label: 'Iniziali nell’avatar', name: 'avatarText', value: s.avatarText, attrs: raw('data-setting="avatarText" maxlength="2"'), hint: 'Una o due lettere.' })}
        </section>
        <section class="panel stack">
          <h2 class="panel-title">Colore e posizione</h2>
          <div class="field">
            <label for="f-color">Colore principale</label>
            <div class="color-row">
              <input id="f-color" name="color" type="color" value="${s.color}" data-setting="color">
              <div class="swatches" role="group" aria-label="Colori suggeriti">
                ${SWATCHES.map((c) => html`<button type="button" class="swatch" style="background:${c}" data-swatch="${c}" aria-label="Usa il colore ${c}"></button>`)}
              </div>
            </div>
            <p class="hint">Il colore del testo sui pulsanti si adatta in automatico per restare leggibile.</p>
          </div>
          <fieldset class="field">
            <legend>Posizione nella pagina</legend>
            <div class="radio-row">
              <label class="radio-card"><input type="radio" name="position" value="right" data-setting="position"${s.position !== 'left' ? raw(' checked') : ''}> In basso a destra</label>
              <label class="radio-card"><input type="radio" name="position" value="left" data-setting="position"${s.position === 'left' ? raw(' checked') : ''}> In basso a sinistra</label>
            </div>
          </fieldset>
        </section>
        <section class="panel stack">
          <h2 class="panel-title">Messaggi</h2>
          ${textarea({ label: 'Messaggio di benvenuto', name: 'welcomeMessage', value: s.welcomeMessage, required: true, rows: 3, maxlength: 400, attrs: raw('data-setting="welcomeMessage"') })}
          ${field({ label: 'Etichetta accanto al pulsante', name: 'launcherLabel', value: s.launcherLabel, attrs: raw('data-setting="launcherLabel" maxlength="40"'), hint: 'Compare accanto al pulsante finché il visitatore non apre la chat. Lascia vuoto per non mostrarla.' })}
          ${textarea({ label: 'Domande suggerite', name: 'quickReplies', value: (s.quickReplies || []).join('\n'), rows: 4, maxlength: 400, hint: 'Una per riga, massimo 4. Compaiono come pulsanti all’inizio della chat.', attrs: raw('data-setting="quickReplies"') })}
          ${textarea({ label: 'Quando non trova una risposta', name: 'fallbackMessage', value: s.fallbackMessage, required: true, rows: 3, maxlength: 400 })}
        </section>
        <section class="panel stack">
          <h2 class="panel-title">Raccolta contatti</h2>
          ${checkbox({ label: 'Proponi di lasciare i recapiti quando l’assistente non sa rispondere o il visitatore chiede una persona', name: 'leadCapture', checked: s.leadCapture })}
          ${checkbox({ label: 'Chiedi anche il numero di telefono', name: 'askPhone', checked: s.askPhone, attrs: raw('data-setting="askPhone"') })}
          ${field({ label: 'Link alla tua informativa privacy', name: 'privacyUrl', type: 'url', value: s.privacyUrl, placeholder: 'https://tuosito.it/privacy', hint: 'Compare accanto alla casella del consenso.' })}
          ${plan.branding
            ? html`<p class="hint">Il piano ${plan.name} mostra la scritta “Assistente realizzato con ${config.brand.name}”. Dal piano Pro puoi toglierla.</p>`
            : checkbox({ label: `Mostra “Assistente realizzato con ${config.brand.name}”`, name: 'showBranding', checked: s.showBranding, attrs: raw('data-setting="showBranding"') })}
        </section>
      </div>
      <div class="save-bar">
        <p class="hint save-state" data-save-state aria-live="polite">Nessuna modifica da salvare.</p>
        <button class="btn btn-outline" type="button" data-preview-reset="${widget.public_id}">Ricomincia la prova</button>
        <button class="btn btn-primary" type="submit">Salva le modifiche</button>
      </div>
    </form>`;
}

// ---------------- Installazione ----------------
export function installPage(ctx, { widget }) {
  const snippet = snippetFor(widget);
  const hosted = hostedUrl(widget);
  const mailBody = `Ciao,\n\nper attivare l'assistente sul sito serve incollare questa riga prima della chiusura del tag </body> in tutte le pagine:\n\n${snippet}\n\nSe il sito è WordPress si può usare il plugin: ${config.baseUrl}/download/aperto-wordpress.zip (codice assistente: ${widget.public_id}).\n\nGrazie!`;
  return html`
    <div class="install-status panel panel-row">
      <div>
        <h2 class="panel-title">Stato dell’installazione</h2>
        <p class="muted">${widget.last_seen_at
          ? html`L’assistente ha risposto l’ultima volta ${timeAgo(widget.last_seen_at)} sulla pagina <a href="${widget.last_seen_url}" target="_blank" rel="noopener">${widget.last_seen_url}</a>.`
          : 'Non abbiamo ancora ricevuto messaggi dal tuo sito. Dopo l’installazione, apri il sito e scrivi un messaggio di prova: lo stato si aggiorna qui.'}</p>
      </div>
      ${installStatus(widget)}
    </div>

    <div class="install-grid">
      <section class="panel stack">
        <p class="eyebrow">Metodo consigliato</p>
        <h2 class="panel-title">Una riga di codice</h2>
        <p class="muted">Incolla questa riga in tutte le pagine del sito, subito prima di <code>&lt;/body&gt;</code>. Funziona con qualsiasi sito: HTML, PHP, Joomla, Drupal, Wix (Impostazioni → Codice personalizzato), Shopify (tema → <code>theme.liquid</code>), Squarespace (Iniezione di codice).</p>
        ${copyField(snippet, 'Copia codice', { multiline: true })}
        <a class="link" href="mailto:?subject=${encodeURIComponent('Codice da installare sul sito')}&body=${encodeURIComponent(mailBody)}">Invia le istruzioni a chi gestisce il sito</a>
      </section>

      <section class="panel stack">
        <p class="eyebrow">WordPress</p>
        <h2 class="panel-title">Plugin ufficiale</h2>
        <ol class="steps-compact">
          <li>Scarica il plugin e caricalo da <b>Plugin → Aggiungi nuovo → Carica plugin</b>.</li>
          <li>Attivalo e apri <b>Impostazioni → ${config.brand.name}</b>.</li>
          <li>Incolla il codice dell’assistente e salva.</li>
        </ol>
        ${copyField(widget.public_id, 'Copia codice assistente')}
        <a class="btn btn-outline" href="/download/aperto-wordpress.zip" download>Scarica il plugin (.zip)</a>
      </section>

      <section class="panel stack">
        <p class="eyebrow">Siti che non si possono modificare</p>
        <h2 class="panel-title">Pagina chat ospitata</h2>
        <p class="muted">Un indirizzo pronto da collegare a un pulsante del sito, a un QR code sul bancone, alla firma email o ai social.</p>
        ${copyField(hosted, 'Copia link')}
        <a class="btn btn-outline" href="${hosted}" target="_blank" rel="noopener">${icon('external', 15)} Apri la pagina chat</a>
      </section>
    </div>

    <section class="panel">
      <h2 class="panel-title">Siti autorizzati</h2>
      <p class="muted">Per sicurezza l’assistente risponde solo sui domini elencati (sottodomini compresi). Se lasci la lista vuota funziona su qualsiasi sito: utile per le prove, sconsigliato quando è online.</p>
      <form method="post" action="/app/widgets/${widget.id}/installazione" class="stack form-narrow">
        ${csrfField(ctx)}
        ${field({ label: 'Indirizzo del sito', name: 'siteUrl', type: 'url', value: widget.site_url, placeholder: 'https://www.tuosito.it' })}
        ${textarea({ label: 'Domini autorizzati', name: 'allowedDomains', value: widget.allowed_domains.join('\n'), rows: 3, hint: 'Uno per riga, senza https://. Es. tuosito.it', placeholder: 'tuosito.it' })}
        <div><button class="btn btn-primary" type="submit">Salva</button></div>
      </form>
    </section>`;
}

// ---------------- Conversazioni ----------------
export function conversationsPage({ widget, conversations, filter, showTest }) {
  const base = `/app/widgets/${widget.id}/conversazioni`;
  const filters = [['all', 'Tutte'], ['unanswered', 'Con domande senza risposta'], ['leads', 'Con contatto lasciato']];
  const q = (f, t) => `${base}?filtro=${f}${t ? '&prove=1' : ''}`;
  return html`
    <div class="toolbar">
      <div class="segmented" role="group" aria-label="Filtra conversazioni">
        ${filters.map(([f, l]) => html`<a class="${filter === f ? 'is-active' : ''}" href="${q(f, showTest)}"${filter === f ? raw(' aria-current="true"') : ''}>${l}</a>`)}
      </div>
      <a class="link small" href="${q(filter, !showTest)}">${showTest ? 'Nascondi le conversazioni di prova' : 'Mostra anche le conversazioni di prova'}</a>
    </div>
    ${conversations.length
      ? html`<div class="table-wrap"><table class="table">
          <thead><tr><th scope="col">Prima domanda</th><th scope="col">Pagina</th><th scope="col" class="num">Messaggi</th><th scope="col">Esito</th><th scope="col">Ultimo messaggio</th></tr></thead>
          <tbody>${conversations.map((c) => html`<tr>
            <td><a class="row-link" href="${base}/${c.public_id}">${c.first_message || '(nessun messaggio)'}</a>${c.is_test ? html` <span class="badge">Prova</span>` : ''}</td>
            <td class="truncate muted" title="${c.page_url}">${pathOf(c.page_url)}</td>
            <td class="num">${c.message_count}</td>
            <td>${c.has_lead ? html`<span class="badge badge-ok">Contatto</span> ` : ''}${c.unanswered ? html`<span class="badge badge-warn">${c.unanswered} senza risposta</span>` : ''}</td>
            <td class="muted nowrap">${timeAgo(c.last_at)}</td>
          </tr>`)}</tbody>
        </table></div>`
      : html`<div class="panel">${filter === 'all'
          ? html`<p class="muted">Ancora nessuna conversazione${showTest ? '' : ' reale'}. Quando un visitatore scrive all’assistente, la trovi qui.</p>`
          : html`<p class="muted">Nessuna conversazione con questo filtro.</p>`}</div>`}`;
}

function pathOf(url) {
  try {
    const u = new URL(url);
    return u.hostname + (u.pathname === '/' ? '' : u.pathname);
  } catch {
    return url || '—';
  }
}

export function conversationDetail({ widget, conversation, messages, knowledgeById, lead }) {
  const base = `/app/widgets/${widget.id}`;
  return html`
    <a class="back-link" href="${base}/conversazioni">${icon('back', 16)} Tutte le conversazioni</a>
    <div class="grid-main-side">
      <section class="panel transcript">
        ${messages.map((m) => html`<div class="t-msg t-${m.role}">
          <div class="t-bubble">${m.body}</div>
          <div class="t-meta">${m.role === 'visitor' ? 'Visitatore' : 'Assistente'} · ${fmtDateTime(m.created_at)}${m.outcome && m.role === 'bot' ? html` · <span class="t-outcome t-${m.outcome}">${outcomeLabel(m.outcome)}${m.knowledge_id && knowledgeById[m.knowledge_id] ? html`: “${knowledgeById[m.knowledge_id].question}”` : ''}</span>` : ''}</div>
          ${m.role === 'bot' && m.outcome === 'fallback' && m.prevQuestion
            ? html`<a class="btn btn-sm btn-outline t-action" href="${base}/risposte?q=${encodeURIComponent(m.prevQuestion)}#nuova">Aggiungi una risposta a questa domanda</a>`
            : ''}
        </div>`)}
      </section>
      <aside class="stack-lg">
        <section class="panel">
          <h2 class="panel-title">Dettagli</h2>
          <dl class="dl">
            <dt>Iniziata</dt><dd>${fmtDateTime(conversation.started_at)}</dd>
            <dt>Pagina</dt><dd class="break">${conversation.page_url || '—'}</dd>
            <dt>Messaggi</dt><dd>${conversation.message_count}</dd>
            <dt>Tipo</dt><dd>${conversation.is_test ? 'Prova dalla dashboard' : 'Visitatore reale'}</dd>
          </dl>
        </section>
        ${lead ? html`<section class="panel">
          <h2 class="panel-title">Contatto lasciato</h2>
          <dl class="dl">
            <dt>Nome</dt><dd>${lead.name}</dd>
            ${lead.email ? html`<dt>Email</dt><dd><a href="mailto:${lead.email}">${lead.email}</a></dd>` : ''}
            ${lead.phone ? html`<dt>Telefono</dt><dd><a href="tel:${lead.phone}">${lead.phone}</a></dd>` : ''}
          </dl>
        </section>` : ''}
      </aside>
    </div>`;
}

export function newWidgetPage(ctx, { values = {}, errors = {}, limitReached, plan, first, action = '/app/widgets' }) {
  const sectorOptions = Object.entries(SECTORS).map(([id, s]) => [id, s.label]);
  if (limitReached) {
    return html`<section class="panel form-narrow"><h2 class="panel-title">Hai raggiunto il limite del piano</h2>
      <p class="muted">Il piano ${plan.name} include ${plan.widgets} ${plan.widgets === 1 ? 'assistente' : 'assistenti'}. Per aggiungerne altri passa a un piano superiore.</p>
      <a class="btn btn-primary" href="/app/account">Vedi i piani</a></section>`;
  }
  return html`
    ${first ? html`<div class="welcome-box"><h2>Benvenuto in ${config.brand.name}.</h2><p>Creiamo il tuo primo assistente: ci vuole meno di un minuto. Partirai con le domande più frequenti del tuo settore già scritte.</p></div>` : ''}
    <section class="panel form-narrow">
      <form method="post" action="${action}" class="stack">
        ${csrfField(ctx)}
        ${field({ label: 'Nome dell’attività o del sito', name: 'name', value: values.name, required: true, error: errors.name, placeholder: 'Es. Locanda Le Mura' })}
        ${field({ label: 'Indirizzo del sito', name: 'siteUrl', type: 'url', value: values.siteUrl, error: errors.siteUrl, placeholder: 'https://www.tuosito.it', hint: 'Lo usiamo per autorizzare l’assistente solo sul tuo dominio.' })}
        ${select({ label: 'Settore', name: 'sector', value: values.sector || 'generico', options: sectorOptions, hint: 'Scegli il modello con le domande più adatte. Potrai modificarle tutte.' })}
        ${checkbox({ label: 'Parti con le domande del modello di settore', name: 'withTemplate', checked: values.withTemplate !== false })}
        <div><button class="btn btn-primary btn-lg" type="submit">Crea assistente</button></div>
      </form>
    </section>`;
}
