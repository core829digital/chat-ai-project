import { config, PLANS } from '../config.js';
import { fmtDate, fmtNum, html, raw, timeAgo } from '../lib/html.js';
import { icon } from './layout.js';

export const snippetFor = (widget) => `<script src="${config.baseUrl}/w.js" data-id="${widget.public_id}" async></script>`;
export const hostedUrl = (widget) => `${config.baseUrl}/c/${widget.public_id}`;

export function statCard(label, value, note = '') {
  return html`<div class="stat"><span class="stat-label">${label}</span><span class="stat-value">${value}</span>${note ? html`<span class="stat-note">${note}</span>` : ''}</div>`;
}

export function usageBar(used, limit) {
  const pct = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const level = pct >= 100 ? 'over' : pct >= 80 ? 'warn' : 'ok';
  return html`<div class="usage">
    <div class="usage-top"><span><strong>${fmtNum(used)}</strong> di ${fmtNum(limit)} conversazioni questo mese</span><span>${pct}%</span></div>
    <div class="usage-track" role="progressbar" aria-valuemin="0" aria-valuemax="${limit}" aria-valuenow="${used}" aria-label="Conversazioni usate questo mese"><span class="usage-fill usage-${level}" style="width:${pct}%"></span></div>
    ${level === 'over' ? html`<p class="hint warn-text">Limite raggiunto: gli assistenti raccolgono solo i contatti finché non passi a un piano superiore.</p>` : ''}
  </div>`;
}

// Grafico a barre delle conversazioni giornaliere: barre in CSS, con tabella accessibile.
export function dailyChart(rows, { label = 'Conversazioni negli ultimi 30 giorni' } = {}) {
  const max = Math.max(1, ...rows.map((r) => r.n));
  const total = rows.reduce((s, r) => s + r.n, 0);
  const fmt = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short' });
  return html`<figure class="chart">
    <figcaption class="chart-cap"><span>${label}</span><strong>${fmtNum(total)}</strong></figcaption>
    <div class="bars" aria-hidden="true">
      ${rows.map((r, i) => html`<span class="bar" style="height:${Math.max(r.n ? 6 : 2, Math.round((r.n / max) * 100))}%;--i:${i}" title="${fmt.format(new Date(r.day))}: ${r.n}"></span>`)}
    </div>
    <div class="bars-axis" aria-hidden="true"><span>${rows.length ? fmt.format(new Date(rows[0].day)) : ''}</span><span>oggi</span></div>
    <table class="sr-only"><caption>${label}</caption><tbody>${rows.map((r) => html`<tr><th scope="row">${r.day}</th><td>${r.n}</td></tr>`)}</tbody></table>
  </figure>`;
}

export function installStatus(widget) {
  if (widget.last_seen_at) {
    return html`<span class="status status-ok" title="${widget.last_seen_url || ''}">Attivo sul sito · ${timeAgo(widget.last_seen_at)}</span>`;
  }
  return html`<span class="status status-idle">Non ancora installato</span>`;
}

export function widgetStatusBadge(widget) {
  return widget.status === 'paused' ? html`<span class="badge badge-warn">In pausa</span>` : '';
}

export function planBadge(planId) {
  return html`<span class="badge badge-plan">${PLANS[planId]?.name || planId}</span>`;
}

export function accountStatusBadge(acc) {
  const expired = acc.status === 'trial' && acc.trial_ends_at && new Date(acc.trial_ends_at.replace(' ', 'T') + 'Z') < new Date();
  if (expired) return html`<span class="badge badge-danger">Prova scaduta</span>`;
  if (acc.status === 'trial') return html`<span class="badge">In prova fino al ${fmtDate(acc.trial_ends_at)}</span>`;
  if (acc.status === 'suspended') return html`<span class="badge badge-danger">Sospeso</span>`;
  return html`<span class="badge badge-ok">Attivo</span>`;
}

export function copyField(value, label = 'Copia', { multiline = false, id = '' } = {}) {
  return html`<div class="copy-field${multiline ? ' copy-multi' : ''}">
    <code${id ? html` id="${id}"` : ''}>${value}</code>
    <button type="button" class="btn btn-sm btn-outline" data-copy="${value}">${icon('copy', 15)} ${label}</button>
  </div>`;
}

export const hasPlaceholder = (text) => /\[[^\]]{2,}\]/.test(text || '');

export function leadStatusLabel(status) {
  return { new: 'Nuovo', contacted: 'Contattato', closed: 'Chiuso' }[status] || status;
}

export function outcomeLabel(outcome) {
  return {
    answered: 'Risposta trovata',
    fallback: 'Nessuna risposta trovata',
    greeting: 'Saluto',
    thanks: 'Ringraziamento',
    handoff: 'Chiede una persona',
    lead: 'Contatto lasciato',
    limit: 'Limite del piano raggiunto',
  }[outcome] || '';
}

export const pct = (v) => (v === null || v === undefined ? '—' : `${Math.round(v * 100)}%`);
export { raw };
