// Dashboard → Conversazioni: lista aggiornata in tempo reale con Neon Realtime.
// Sorgente; "npm run build" la impacchetta in public/js/live.js (esbuild, solo la parte client
// di @neon/realtime: il segreto resta sul server).
// Quando una conversazione nasce o cambia, la tabella viene ricaricata dal server (stesso HTML,
// stessi filtri), senza ricaricare la pagina e senza duplicare i modelli lato browser.
import { createRealtimeClient } from '@neon/realtime/client';

const pill = document.querySelector('[data-live-url]');
if (pill) start(pill);

function start(pill) {
  const label = pill.querySelector('.live-label');
  const list = document.getElementById('conv-list');
  const csrf = document.querySelector('input[name="_csrf"]')?.value || '';
  const LABELS = { connecting: 'Collegamento…', live: 'In tempo reale', stale: 'Collegamento…', error: 'Aggiornamento automatico non disponibile', closed: 'Disconnesso' };

  const setState = (s) => {
    pill.dataset.state = s;
    label.textContent = LABELS[s] || s;
  };

  async function seal() {
    const res = await fetch(pill.dataset.liveEndpoint, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'x-csrf-token': csrf },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  async function reloadList() {
    const res = await fetch(location.href, { credentials: 'same-origin', headers: { accept: 'text/html' } });
    if (!res.ok) return;
    const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
    const fresh = doc.getElementById('conv-list');
    if (fresh && list) {
      list.innerHTML = fresh.innerHTML;
      list.classList.remove('live-flash');
      void list.offsetWidth; // riavvia l'animazione
      list.classList.add('live-flash');
    }
  }

  // Firma dei dati osservati: se cambia rispetto al primo risultato, la lista è da aggiornare.
  const signature = (rows) => rows.map((r) => `${r.id}:${r.message_count}:${r.unanswered}:${r.has_lead}:${r.last_at}`).sort().join('|');

  (async () => {
    try {
      const client = createRealtimeClient({ url: pill.dataset.liveUrl });
      const first = await seal();
      const sub = client.subscribe(first);
      let baseline = null;
      let pending = null;
      let renewTimer = null;

      // La capability dura 60 secondi: la rinnoviamo 15 secondi prima della scadenza, con la stessa
      // sessione. Se nel frattempo è scaduta (es. scheda sospesa), lo stato "stale" la rinnova subito.
      let renewing = false;
      const renew = async () => {
        if (renewing) return;
        renewing = true;
        clearTimeout(renewTimer);
        try {
          const next = await seal();
          await sub.renew(next);
          scheduleRenew(next);
        } catch {
          setState('error');
          renewTimer = setTimeout(renew, 15_000); // nuovo tentativo (es. rete assente per un momento)
        } finally {
          renewing = false;
        }
      };
      const scheduleRenew = (sealed) => {
        clearTimeout(renewTimer);
        renewTimer = setTimeout(renew, Math.max(5_000, sealed.expiresAt - Date.now() - 15_000));
      };
      scheduleRenew(first);

      sub.onStateChange(({ status }) => {
        setState(status);
        if (status === 'stale') renew();
      });
      sub.onChange(({ data, error }) => {
        if (error) return setState('error');
        if (!data) return;
        const sig = signature(data);
        if (baseline === null) baseline = sig;
        else if (sig !== baseline) {
          baseline = sig;
          clearTimeout(pending);
          pending = setTimeout(reloadList, 250); // raggruppa più messaggi ravvicinati
        }
      });
      window.addEventListener('pagehide', () => { clearTimeout(renewTimer); client.close(); }, { once: true });
    } catch {
      setState('error');
    }
  })();
}
