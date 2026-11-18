// Template HTML con escape automatico: ogni valore interpolato viene sanificato,
// tranne ciò che è già marcato come sicuro (frammenti prodotti da html``).
export class SafeHtml {
  constructor(value) {
    this.value = value;
  }
  toString() {
    return this.value;
  }
}

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;' };
export const escapeHtml = (s) => String(s).replace(/[&<>"'`]/g, (c) => ESCAPES[c]);

function render(value) {
  if (value === null || value === undefined || value === false) return '';
  if (value instanceof SafeHtml) return value.value;
  if (Array.isArray(value)) return value.map(render).join('');
  return escapeHtml(value);
}

export function html(strings, ...values) {
  let out = strings[0];
  for (let i = 0; i < values.length; i++) out += render(values[i]) + strings[i + 1];
  return new SafeHtml(out);
}

// Da usare solo per markup costruito internamente (mai per input degli utenti).
export const raw = (s) => new SafeHtml(String(s));

const dateFmt = new Intl.DateTimeFormat('it-IT', { day: '2-digit', month: 'short', year: 'numeric' });
const dateTimeFmt = new Intl.DateTimeFormat('it-IT', {
  day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome',
});
const numFmt = new Intl.NumberFormat('it-IT');
const eurFmt = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

// Le date in SQLite sono UTC senza fuso: le rendiamo esplicite.
const toDate = (s) => new Date(/Z$|[+-]\d\d:?\d\d$/.test(s) ? s : `${s.replace(' ', 'T')}Z`);
export const fmtDate = (s) => (s ? dateFmt.format(toDate(s)) : '—');
export const fmtDateTime = (s) => (s ? dateTimeFmt.format(toDate(s)) : '—');
export const fmtNum = (n) => numFmt.format(n || 0);
export const fmtEur = (n) => eurFmt.format(n || 0);

export function timeAgo(s) {
  if (!s) return 'mai';
  const diff = (Date.now() - toDate(s).getTime()) / 1000;
  if (diff < 60) return 'adesso';
  if (diff < 3600) return `${Math.floor(diff / 60)} min fa`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} ore fa`;
  if (diff < 86400 * 30) return `${Math.floor(diff / 86400)} giorni fa`;
  return fmtDate(s);
}
