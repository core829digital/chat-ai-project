import { config, PLANS } from '../config.js';
import { html, raw } from '../lib/html.js';
import { SECTORS } from '../templates.js';
import { chip, icon, publicLayout } from './layout.js';

const snippet = (id = 'wdg_abc123') => `<script src="${config.baseUrl}/w.js" data-id="${id}" async></script>`;
const brand = config.brand.name;

// Divide un testo in parole animabili: resta testo normale per lettori di schermo e senza JavaScript.
// --wi = indice della parola, oppure frazione 0..1 se total è indicato (effetti legati allo scroll).
function words(text, { start = 0, total = 0, cls = '' } = {}) {
  const list = String(text).split(' ');
  return html`${list.map((w, i) => {
    const wi = total ? ((start + i) / total).toFixed(3) : start + i;
    return html`<span class="w${cls ? ' ' + cls : ''}" style="--wi:${wi}"><span>${w}</span></span>${i < list.length - 1 ? ' ' : ''}`;
  })}`;
}

// Video generati in codice (scripts/video-scenes.html), caricati solo quando stanno per comparire.
const sectionVideo = (name) => html`<div class="section-video" aria-hidden="true"><video muted loop playsinline preload="none" poster="/static/media/${name}.jpg" data-src="/static/media/${name}.webm"></video></div>`;

const MANIFESTO = [
  ['Ogni domanda che resta senza risposta è un cliente che cerca altrove.', ''],
  ['Il tuo sito può rispondere anche quando sei chiuso,', 'is-accent'],
  ['con le tue parole, e lasciarti il contatto per domattina.', ''],
];
function manifestoText() {
  const total = MANIFESTO.reduce((n, [t]) => n + t.split(' ').length, 0);
  let start = 0;
  return html`${MANIFESTO.map(([t, cls], i) => {
    const out = html`${words(t, { start, total, cls })}${i < MANIFESTO.length - 1 ? ' ' : ''}`;
    start += t.split(' ').length;
    return out;
  })}`;
}

const PLAN_COPY = {
  start: { who: 'Per chi ha un sito e vuole smettere di rispondere sempre alle stesse domande.', features: ['1 sito', '500 conversazioni al mese', 'Modello del tuo settore', 'Raccolta contatti', `Marchio ${brand} nel widget`] },
  pro: { who: 'Per le attività che ricevono richieste ogni giorno e vogliono il proprio marchio.', features: ['3 siti', '2.000 conversazioni al mese', `Senza marchio ${brand}`, 'Esportazione contatti in CSV', 'Domande senza risposta da completare'] },
  business: { who: 'Per negozi online e aziende con più siti o più lingue.', features: ['10 siti', '6.000 conversazioni al mese', 'Tutto il piano Pro', 'Supporto prioritario', 'Integrazioni CRM (in arrivo)'] },
  agency: { who: 'Per agenzie web che vogliono rivendere il servizio ai propri clienti.', features: ['25 siti di clienti', '10.000 conversazioni condivise', 'Dashboard multi-cliente', 'Inviti ai clienti con un link', 'Margine sulla rivendita'] },
};

const FAQ = [
  ['Serve un programmatore per installarlo?', 'No. Copi una riga dalla dashboard e la incolli nel sito, oppure installi il plugin WordPress e inserisci il codice del tuo assistente. Se preferisci, lo installiamo noi con il servizio di configurazione.'],
  ['Funziona anche se il mio sito è vecchio?', 'Sì. Lo script gira nel browser di chi visita il sito, quindi non dipende dalla versione del tuo CMS. Se nel sito non si può proprio inserire codice, puoi usare la pagina chat ospitata da noi e collegarla con un semplice link o pulsante.'],
  ['L’assistente può inventare risposte?', 'No. Risponde solo con le informazioni che hai inserito tu. Quando non trova una risposta sicura lo dice apertamente e propone al visitatore di lasciare un contatto. Quella domanda finisce nella lista delle cose da aggiungere.'],
  ['I visitatori sanno che parlano con un assistente automatico?', 'Sì, sempre. Il widget mostra un avviso fisso fin dal primo messaggio, come richiede l’articolo 50 del regolamento europeo sull’intelligenza artificiale (AI Act). L’avviso non si può disattivare.'],
  ['Dove sono conservati i dati delle conversazioni?', 'Su server in Unione Europea. Firmiamo con te la nomina a responsabile del trattamento (DPA), il widget non usa cookie di profilazione e le conversazioni vengono cancellate automaticamente dopo il periodo che scegli.'],
  ['Posso disdire quando voglio?', 'Sì. Il piano mensile si disdice in qualsiasi momento dalla dashboard, senza penali. Con il pagamento annuale hai due mesi gratis.'],
  ['Sono un’agenzia web: posso gestire più clienti?', 'Sì, con il piano Agency. Crei gli assistenti per i tuoi clienti, li consegni con un link di invito e li gestisci tutti da un’unica dashboard. Scrivici per il programma partner.'],
];

// Conversazioni di esempio per la demo animata dell'hero (una per settore).
const DEMOS = [
  {
    id: 'hotel', tab: 'Hotel', site: 'locandalemura.it', name: 'Locanda Le Mura', initials: 'LM', color: '#1F5C4A',
    script: [
      ['visitor', 'A che ora è il check-in? Arrivo verso le 22.'],
      ['bot', 'Il check-in è dalle 14:00 alle 20:00. Per arrivi più tardi lasciamo le chiavi in una cassetta con codice: te lo mandiamo il giorno prima.'],
      ['visitor', 'Avete una camera libera sabato?'],
      ['bot', 'Per la disponibilità ti risponde la reception. Mi lasci nome e telefono? Ti richiamiamo domattina.'],
    ],
    notify: ['Nuovo contatto', 'Marco R. · camera per sabato'],
  },
  {
    id: 'ristorante', tab: 'Ristorante', site: 'trattoriadamario.it', name: 'Trattoria da Mario', initials: 'TM', color: '#7C2D12',
    script: [
      ['visitor', 'Siete aperti domenica a pranzo?'],
      ['bot', 'Sì, la domenica siamo aperti dalle 12:00 alle 15:00. Nel fine settimana conviene prenotare.'],
      ['visitor', 'Avete piatti senza glutine?'],
      ['bot', 'Sì: pasta, pizza e dolci senza glutine. Segnalalo quando prenoti e la cucina si organizza.'],
    ],
    notify: ['Nuova prenotazione', 'Tavolo per 4 · domenica 13:00'],
  },
  {
    id: 'sanita', tab: 'Studio medico', site: 'studiobianchi.it', name: 'Studio Dentistico Bianchi', initials: 'SB', color: '#1D4ED8',
    script: [
      ['visitor', 'Quanto costa una pulizia dei denti?'],
      ['bot', 'La seduta di igiene costa 80 € e dura circa 45 minuti.'],
      ['visitor', 'Posso venire la prossima settimana?'],
      ['bot', 'Certo. Lasciami nome e telefono: la segreteria ti richiama per fissare l’orario.'],
    ],
    notify: ['Nuovo contatto', 'Giulia P. · igiene dentale'],
  },
  {
    id: 'ecommerce', tab: 'Negozio online', site: 'ceramichesole.it', name: 'Ceramiche Sole', initials: 'CS', color: '#B45309',
    script: [
      ['visitor', 'Spedite anche in Germania?'],
      ['bot', 'Sì, in tutta l’Unione Europea in 3–5 giorni lavorativi. Sopra i 120 € la spedizione è gratuita.'],
      ['visitor', 'E se un piatto arriva rotto?'],
      ['bot', 'Lo sostituiamo gratis: scrivici entro 14 giorni con una foto del pacco.'],
    ],
    notify: ['Domanda risolta', 'Risposta in 2 secondi, alle 23:12'],
  },
];

const PLATFORMS = ['WordPress', 'Wix', 'Shopify', 'Joomla', 'Squarespace', 'PrestaShop', 'Drupal', 'Webflow', 'HTML e PHP'];

// Disegni al tratto delle sezioni: SVG con linee che si disegnano allo scroll (pathLength=1, vedi site.css).
const art = {
  // Griglia di tessere: una si accende, il puntatore ci arriva sopra
  tiles: () => raw(`<svg class="art art-tiles" viewBox="0 0 360 260" aria-hidden="true">
    <g class="art-grid">${[0, 1, 2, 3, 4].map((r) => [0, 1, 2, 3, 4, 5].map((c) => `<rect pathLength="1" x="${8 + c * 58}" y="${8 + r * 50}" width="${(r + c) % 5 === 1 && c < 5 ? 108 : 50}" height="42" rx="11"/>`).join('')).join('')}</g>
    <rect class="art-hot" pathLength="1" x="124" y="108" width="50" height="42" rx="11"/>
    <path class="art-plus" d="M149 122v14M142 129h14"/>
    <path class="art-cursor" d="M168 140l20 8-9 3-3 9z"/>
  </svg>`),
  // Nodo centrale collegato: i contatti arrivano da tutte le direzioni
  hub: () => raw(`<svg class="art art-hub" viewBox="0 0 360 260" aria-hidden="true">
    <g class="art-grid">${[[20, 30], [20, 110], [20, 190], [288, 30], [288, 110], [288, 190], [124, 8], [124, 212]].map(([x, y]) => `<rect pathLength="1" x="${x}" y="${y}" width="${x === 124 ? 112 : 52}" height="${x === 124 ? 38 : 52}" rx="12"/>`).join('')}</g>
    <g class="art-wires">
      <path pathLength="1" d="M72 56C120 56 120 130 154 130"/><path pathLength="1" d="M72 136H154"/><path pathLength="1" d="M72 216C120 216 120 130 154 130"/>
      <path pathLength="1" d="M288 56C240 56 240 130 206 130"/><path pathLength="1" d="M288 136H206"/><path pathLength="1" d="M288 216C240 216 240 130 206 130"/>
    </g>
    <g class="art-pulses"><circle r="2.6"><animateMotion dur="2.8s" repeatCount="indefinite" path="M72 56C120 56 120 130 154 130"/></circle><circle r="2.6"><animateMotion dur="3.4s" begin="-1.2s" repeatCount="indefinite" path="M288 216C240 216 240 130 206 130"/></circle><circle r="2.6"><animateMotion dur="3.1s" begin="-2s" repeatCount="indefinite" path="M288 136H206"/></circle></g>
    <rect class="art-hot" pathLength="1" x="154" y="104" width="52" height="52" rx="14"/>
    <path class="art-plus" d="M180 120v20M170 130h20"/>
  </svg>`),
  // Circuito: la domanda viaggia fino al chip dell'avviso
  circuit: () => raw(`<svg class="art art-circuit" viewBox="0 0 420 220" aria-hidden="true">
    <g class="art-grid">${[[40, 40], [110, 40], [250, 40], [320, 40], [40, 150], [250, 150], [320, 150]].map(([x, y]) => `<rect pathLength="1" x="${x}" y="${y}" width="56" height="52" rx="12"/>`).join('')}</g>
    <g class="art-wires"><path pathLength="1" d="M166 66H196V120H180"/><path pathLength="1" d="M250 66H222V120H238"/><path pathLength="1" d="M209 92V150"/></g>
    <g class="art-pulses"><circle r="2.6"><animateMotion dur="2.4s" repeatCount="indefinite" path="M166 66H196V120H180"/></circle><circle r="2.6"><animateMotion dur="2.9s" begin="-1s" repeatCount="indefinite" path="M250 66H222V120H238"/></circle></g>
    <rect class="art-hot" pathLength="1" x="180" y="104" width="58" height="56" rx="14"/>
    <path class="art-plus" d="M200 126h18M200 133h12M200 140h16"/>
  </svg>`),
  // Globo a puntini con i luoghi: i dati restano in Europa
  globe: () => {
    const dots = [];
    for (let lat = -70; lat <= 70; lat += 10) {
      const r = Math.cos((lat * Math.PI) / 180);
      const n = Math.max(6, Math.round(34 * r));
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const x = Math.cos(a) * r;
        if (Math.sin(a) < 0) continue; // solo la metà rivolta verso chi guarda
        dots.push(`<circle cx="${(150 + x * 118).toFixed(1)}" cy="${(130 - Math.sin((lat * Math.PI) / 180) * 118).toFixed(1)}" r="${(1.1 + Math.sin(a) * 0.9).toFixed(2)}" opacity="${(0.25 + Math.sin(a) * 0.55).toFixed(2)}"/>`);
      }
    }
    return raw(`<svg class="art art-globe" viewBox="0 0 300 260" aria-hidden="true">
      <g class="globe-dots">${dots.join('')}</g>
      <g class="globe-pin" style="--d:0s"><circle cx="160" cy="78" r="5"/><circle class="pin-ring" cx="160" cy="78" r="5"/></g>
      <g class="globe-pin" style="--d:.6s"><circle cx="128" cy="112" r="4"/><circle class="pin-ring" cx="128" cy="112" r="4"/></g>
      <g class="globe-pin" style="--d:1.2s"><circle cx="186" cy="124" r="4"/><circle class="pin-ring" cx="186" cy="124" r="4"/></g>
    </svg>`);
  },
};

// Piattaforme in orbita attorno all'assistente (sigle, non loghi: nessun marchio altrui riprodotto)
const ORBIT = [['WP', 'WordPress'], ['Sh', 'Shopify'], ['Wx', 'Wix'], ['</>', 'HTML'], ['Jo', 'Joomla'], ['Ps', 'PrestaShop']];

export function landingPage(ctx, { demoWidgetId }) {
  const sectors = Object.entries(SECTORS).filter(([id]) => id !== 'generico');
  const first = DEMOS[0];
  const body = html`
<div class="loader" aria-hidden="true"><span class="loader-n"></span><span class="loader-bar"></span></div>
<canvas class="orb" data-orb-canvas aria-hidden="true"></canvas>

<section class="hero" data-scroll="hero" data-orb="wave .5 1.08 1.3 -.42 .9">
  <div class="wrap hero-copy">
    <p class="pill" style="--i:0"><span class="live-dot" aria-hidden="true"></span>Risponde 24 ore su 24, anche la domenica</p>
    <h1 class="display words" style="--i:1">${words('Il tuo sito risponde ai clienti.')} <span class="hl">${words('Anche alle undici di sera.', { start: 6 })}</span></h1>
    <p class="lead" style="--i:2">Un assistente che conosce orari, prezzi e servizi della tua attività. Risponde ai visitatori in pochi secondi e ti passa i contatti di chi vuole parlarti.</p>
    <div class="hero-actions" style="--i:3">
      <a class="btn btn-white btn-lg" href="/registrati" data-magnetic>Prova gratis per 14 giorni ${chip()}</a>
      ${demoWidgetId ? html`<button class="btn btn-glass btn-lg" type="button" data-open-demo>Fagli una domanda ${chip()}</button>` : ''}
    </div>
    <ul class="hero-ticks" style="--i:4">
      <li>${icon('check', 15)} Pronto in 10 minuti</li>
      <li>${icon('check', 15)} Funziona su qualsiasi sito</li>
      <li>${icon('check', 15)} Nessuna carta richiesta</li>
    </ul>
  </div>

  <div class="wrap hero-stage-wrap">
    <div class="hero-stage">
      <div class="demo-tabs" role="tablist" aria-label="Scegli un settore per vedere un esempio">
        ${DEMOS.map((d, i) => html`<button type="button" role="tab" class="demo-tab${i === 0 ? ' is-active' : ''}" aria-selected="${i === 0 ? 'true' : 'false'}" data-demo-tab="${d.id}">${d.tab}<span class="demo-tab-bar" aria-hidden="true"></span></button>`)}
      </div>
      <div class="browser" aria-hidden="true" data-tilt>
        <div class="browser-bar"><span></span><span></span><span></span><div class="browser-url" data-demo-site>${first.site}</div></div>
        <div class="browser-page">
          <div class="mock-nav"><b data-demo-name>${first.name}</b><i></i><i></i><i></i></div>
          <div class="mock-hero"></div>
          <div class="mock-lines"><i></i><i></i><i class="short"></i></div>
          <div class="mock-cards"><i></i><i></i><i></i></div>
        </div>
        <div class="chat-mock" data-demo-chat style="--c:${first.color}">
          <div class="chat-mock-head"><span class="chat-avatar" data-demo-initials>${first.initials}</span><div><b data-demo-title>${first.name}</b><small><span class="online"></span>Risponde in pochi secondi</small></div></div>
          <div class="chat-mock-notice">Stai parlando con un assistente virtuale.</div>
          <div class="chat-mock-log" data-demo-log>
            ${first.script.map(([who, text]) => html`<p class="m-${who}">${text}</p>`)}
          </div>
          <div class="chat-mock-input"><span>Scrivi un messaggio…</span><span class="send-dot">${icon('arrow', 14)}</span></div>
        </div>
        <div class="notify" data-demo-notify>
          <span class="notify-icon">${icon('inbox', 18)}</span>
          <div><b data-demo-notify-title>${first.notify[0]}</b><span data-demo-notify-text>${first.notify[1]}</span></div>
        </div>
      </div>
      ${DEMOS.map((d) => html`<ol class="demo-script" hidden data-demo="${d.id}" data-site="${d.site}" data-name="${d.name}" data-initials="${d.initials}" data-color="${d.color}" data-notify-title="${d.notify[0]}" data-notify-text="${d.notify[1]}">
        ${d.script.map(([who, text]) => html`<li data-who="${who}">${text}</li>`)}
      </ol>`)}
      <p class="stage-caption">Esempi costruiti con i modelli di settore. Le risposte sono quelle scritte dall’attività.</p>
    </div>
  </div>
</section>

<section class="platforms" aria-label="Piattaforme compatibili" data-scroll="marquee" data-orb="sphere .5 1.05 .75 .3 .4">
  <p class="platforms-label">Si installa su qualsiasi sito</p>
  <div class="marquee">
    <ul class="marquee-track">${PLATFORMS.map((p) => html`<li>${p}</li>`)}</ul>
    <ul class="marquee-track" aria-hidden="true">${PLATFORMS.map((p) => html`<li>${p}</li>`)}</ul>
  </div>
</section>

<section class="section features" id="perche" data-orb="sphere .5 .2 .34 .2 .95">
  <div class="wrap">
    <div class="section-head center" data-reveal>
      <h2 class="h2 words">${words('Il tuo sito, sempre aperto.')}</h2>
      <p class="section-lead">Risponde, non inventa, ti lascia il contatto. Tutto il resto lo decidi tu.</p>
    </div>
    <div class="cols-3 feature-cards">
      ${[
        ['chat', 'Risponde in due secondi', 'A qualsiasi ora, con orari, prezzi e servizi scritti da te. Anche la domenica sera.'],
        ['shield', 'Non inventa mai', 'Se non trova una risposta sicura lo dice apertamente e propone di lasciare un contatto.'],
        ['inbox', 'Ti passa i contatti', 'Nome e telefono di chi vuole parlarti, con il consenso a essere ricontattato.'],
      ].map(([ic, t, p], i) => html`<article class="glass feature" data-spot data-reveal style="--i:${i}">
        <span class="disc">${icon(ic, 26)}</span>
        <h3>${t}</h3>
        <p>${p}</p>
      </article>`)}
    </div>
  </div>
</section>

<section class="manifesto" data-scroll="manifesto" aria-label="Perché serve" data-orb="sphere .5 .5 .3 .2 0">
  <div class="manifesto-sticky">
    ${sectionVideo('aurora')}
    <div class="wrap"><p class="manifesto-text">${manifestoText()}</p></div>
  </div>
</section>

<section class="story" id="una-notte" data-story aria-labelledby="story-title" data-orb="sphere .5 .5 .3 .2 0">
  <div class="story-sticky">
    <canvas class="story-sky" data-field="sky" aria-hidden="true"></canvas>
    <div class="wrap story-grid">
      <div class="story-copy">
        <p class="eyebrow story-eyebrow">Una notte qualsiasi, al tuo sito</p>
        <h2 id="story-title" class="story-clock"><span class="sr-only">Dalle 22:40 alle 8:30: </span><span data-clock aria-hidden="true">22:40</span></h2>
        <ol class="story-chapters">
          <li data-chapter="0" class="is-active"><h3>Il negozio è chiuso. Il sito no.</h3><p>Una cliente scrive dal divano: vuole sapere se c’è una camera libera sabato.</p></li>
          <li data-chapter="1"><h3>Risposta in due secondi.</h3><p>L’assistente risponde con i tuoi prezzi e le tue condizioni. Niente invenzioni: solo quello che hai scritto tu.</p></li>
          <li data-chapter="2"><h3>Il contatto resta a te.</h3><p>Quando serve una persona, raccoglie nome e telefono, con il consenso a essere ricontattata.</p></li>
          <li data-chapter="3"><h3>Alle 8:30 trovi la lista.</h3><p>Mentre dormivi ha risposto a 27 domande. Tre persone aspettano la tua chiamata.</p></li>
        </ol>
        <div class="story-progress" aria-hidden="true"><i><span></span></i><i><span></span></i><i><span></span></i><i><span></span></i></div>
      </div>
      <div class="story-visual" aria-hidden="true">
        <div class="story-browser">
          <div class="sb-bar"><span></span><span></span><span></span><div class="sb-url">locandalemura.it/camere</div></div>
          <div class="sb-chat">
            <div class="sb-head"><span class="chat-avatar">LM</span><div><b>Locanda Le Mura</b><small><span class="online"></span>Risponde in pochi secondi</small></div></div>
            <div class="sb-log">
              <p class="sb-msg sb-visitor" data-at="0.08">Avete una camera libera sabato? Siamo in due.</p>
              <p class="sb-msg sb-typing" data-from="0.15" data-to="0.24"><i></i><i></i><i></i></p>
              <p class="sb-msg sb-bot" data-at="0.24">Sabato abbiamo ancora due camere doppie: 95 € a notte, colazione inclusa. Vuoi che la reception ti confermi la prenotazione?</p>
              <p class="sb-msg sb-visitor" data-at="0.36">Sì, grazie!</p>
              <p class="sb-msg sb-bot" data-at="0.43">Perfetto. Mi lasci nome e telefono?</p>
              <div class="sb-msg sb-lead" data-at="0.5"><b>Chiara M.</b><span>+39 347 ••• ••45</span><em>${icon('check', 13)} Consenso a essere ricontattata</em></div>
              <p class="sb-msg sb-bot" data-at="0.57">Grazie Chiara! Domattina la reception ti chiama.</p>
            </div>
          </div>
        </div>
        <div class="story-phone">
          <div class="sp-notch"></div>
          <div class="sp-time">08:30</div>
          <div class="sp-date">Domenica</div>
          <div class="sp-note" data-at="0.76"><span class="notify-icon">${icon('inbox', 15)}</span><div><b>Nuovo contatto</b><span>Chiara M. · camera per sabato</span></div></div>
          <div class="sp-note" data-at="0.82"><span class="notify-icon">${icon('inbox', 15)}</span><div><b>Nuovo contatto</b><span>Paolo G. · gruppo di 8 a maggio</span></div></div>
          <div class="sp-note" data-at="0.88"><span class="notify-icon">${icon('inbox', 15)}</span><div><b>Nuovo contatto</b><span>Anna R. · animali ammessi?</span></div></div>
        </div>
        <div class="story-counter"><b data-answered>0</b><span>domande risposte stanotte</span></div>
      </div>
    </div>
  </div>
</section>

<section class="section has-video" id="come-funziona" data-orb="sphere .92 .42 .55 .3 .26">
  ${sectionVideo('flusso')}
  <div class="wrap">
    <div class="section-head center" data-reveal>
      <p class="eyebrow">Come funziona</p>
      <h2 class="h2 words">${words('Tre passaggi. Nessuno sviluppatore.')}</h2>
    </div>
    <ol class="steps">
      <li class="step-row" data-scroll="step">
        <div class="step-copy">
          <span class="step-n">01</span>
          <h3>Scegli il tuo settore</h3>
          <p>Le domande che i tuoi clienti fanno davvero sono già scritte. Tu inserisci orari, prezzi e dettagli veri.</p>
          <a class="btn btn-white" href="/registrati">Scegli il modello ${chip()}</a>
        </div>
        <div class="step-art glass" data-spot>
          ${art.tiles()}
          <ul class="mini-kb">
            <li><span class="mini-check">${icon('check', 12)}</span>A che ora è il check-in?</li>
            <li><span class="mini-check">${icon('check', 12)}</span>C’è il parcheggio?</li>
            <li class="is-todo"><span class="mini-check"></span>Accettate animali? <em>da completare</em></li>
          </ul>
        </div>
      </li>
      <li class="step-row is-flip" data-scroll="step">
        <div class="step-copy">
          <span class="step-n">02</span>
          <h3>Incolla una riga nel sito</h3>
          <p>Prima di &lt;/body&gt;, oppure con il plugin WordPress. Se il sito non si può toccare, usi la pagina chat ospitata.</p>
          <button class="btn btn-white" type="button" data-copy="${snippet()}"><span>Copia</span> ${chip()}</button>
        </div>
        <div class="step-art glass code-card" data-scroll="type" data-spot>
          <div class="code-card-head"><span class="dots"><i></i><i></i><i></i></span><span>index.html</span><button class="copy-btn" type="button" data-copy="${snippet()}">${icon('copy', 14)} <span>Copia</span></button></div>
          <div class="code-lines" aria-hidden="true"><i style="--w:46%"></i><i style="--w:72%"></i><i style="--w:58%"></i></div>
          <div class="code-glow"><pre aria-label="${snippet()}"><code data-type>${snippet()}</code></pre></div>
          <div class="code-lines" aria-hidden="true"><i style="--w:30%"></i><i style="--w:64%"></i></div>
        </div>
      </li>
      <li class="step-row" data-scroll="step">
        <div class="step-copy">
          <span class="step-n">03</span>
          <h3>Ricevi i contatti</h3>
          <p>Quando non sa rispondere lo dice e raccoglie nome e telefono. Tu trovi tutto nella dashboard, con la conversazione completa.</p>
          <a class="btn btn-white" href="/registrati">Inizia ora ${chip()}</a>
        </div>
        <div class="step-art glass" data-spot>
          ${art.hub()}
          <div class="mini-lead"><span class="notify-icon">${icon('inbox', 16)}</span><div><b>Nuovo contatto</b><span>Elena C. · +39 333 …</span></div></div>
        </div>
      </li>
    </ol>
    <div class="cols-3 install-modes">
      <article class="glass card" data-spot data-reveal style="--i:1"><h3>Una riga di codice</h3><p>Su qualsiasi sito. Il widget è isolato: non cambia la grafica del sito e non la subisce.</p></article>
      <article class="glass card" data-spot data-reveal style="--i:2"><h3>Plugin WordPress</h3><p>Installi il plugin, incolli il codice del tuo assistente nelle impostazioni. Fine.</p></article>
      <article class="glass card" data-spot data-reveal style="--i:3"><h3>Pagina chat ospitata</h3><p>Un indirizzo pronto per un pulsante, un QR code sul bancone o la firma email.</p></article>
    </div>
  </div>
</section>

<section class="section bento-section" id="regole" data-orb="sphere .5 .56 1.12 .35 1">
  <div class="wrap">
    <div class="section-head center" data-reveal>
      <p class="eyebrow">Regole europee</p>
      <h2 class="h2 words">${words('Dati in Europa. Trasparenza verso i visitatori.')}</h2>
      <p class="section-lead">Per uno studio medico, legale o un hotel la conformità non è un dettaglio: decide se puoi usare uno strumento o no.</p>
    </div>
    <div class="bento">
      <article class="glass bento-card bento-wide" data-spot data-reveal style="--i:0">
        <div class="bento-copy"><h3>Avviso AI Act sempre visibile</h3><p>Dal 2 agosto 2026 chi usa un assistente automatico deve dichiararlo. Il widget lo fa dal primo messaggio, e l’avviso non si può togliere.</p></div>
        ${art.circuit()}
      </article>
      <article class="glass bento-card" data-spot data-reveal style="--i:1">
        <div class="bento-copy"><h3>Funziona con il tuo sito</h3><p>WordPress, Shopify, Wix o HTML scritto a mano: una riga e il widget si adatta.</p></div>
        <div class="orbit" aria-hidden="true">
          <span class="orbit-core">${icon('chat', 18)}</span>
          <span class="orbit-ring"></span><span class="orbit-ring orbit-ring-2"></span>
          ${ORBIT.map(([t, title], i) => html`<span class="orbit-node" style="--a:${(i * 360) / ORBIT.length}deg" title="${title}"><b>${t}</b></span>`)}
        </div>
      </article>
      <article class="glass bento-card" data-spot data-reveal style="--i:2">
        <div class="bento-copy"><h3>Nessun cookie di profilazione</h3><p>Il widget non chiede consensi aggiuntivi nel banner del sito. I contatti arrivano solo con consenso esplicito.</p></div>
        <div class="keys" aria-hidden="true">${['', '', '', '', '', 'lock', '', '', '', '', '', ''].map((k) => html`<i class="${k ? 'is-hot' : ''}">${k ? icon('shield', 16) : ''}</i>`)}</div>
      </article>
      <article class="glass bento-card bento-wide" data-spot data-reveal style="--i:3">
        <div class="bento-copy"><h3>Server in Unione Europea</h3><p>Conversazioni e contatti restano in UE. La nomina a responsabile del trattamento (DPA) in italiano è pronta da firmare.</p></div>
        <div class="globe-wrap">${art.globe()}<span class="globe-tag" style="--x:53%;--y:24%">Dati in UE</span><span class="globe-tag" style="--x:36%;--y:39%">Il tuo sito</span><span class="globe-tag" style="--x:66%;--y:44%">I tuoi clienti</span></div>
      </article>
    </div>
  </div>
</section>

<section class="section" id="settori" data-orb="funnel .3 .55 1 .1 .9">
  <div class="wrap">
    <div class="section-head center" data-reveal>
      <p class="eyebrow">Modelli di settore</p>
      <h2 class="h2 words">${words('Non parti da una pagina bianca.')}</h2>
      <p class="section-lead">Ogni modello contiene le domande che i clienti di quel settore fanno davvero. Tu cambi solo i dettagli.</p>
    </div>
    <div class="sector-grid" data-scroll>
      ${sectors.map(([, s], i) => html`<article class="glass sector" data-spot data-reveal style="--i:${i % 3}">
        <h3>${s.label}</h3>
        <ul>${s.faq.slice(0, 3).map(([q]) => html`<li>${q}</li>`)}</ul>
      </article>`)}
      <article class="glass sector sector-other" data-spot data-reveal style="--i:${sectors.length % 3}">
        <h3>Il tuo settore non c’è?</h3>
        <p>Parti dal modello generico con orari, indirizzo, contatti, prezzi e pagamenti, e aggiungi le tue domande. Con il servizio di configurazione lo prepariamo noi.</p>
      </article>
    </div>
    <div class="cols-3 stats">
      <div class="glass stat" data-reveal style="--i:0"><b><span data-count="24">24</span>/7</b><span>Sempre aperto, anche nei festivi</span></div>
      <div class="glass stat" data-reveal style="--i:1"><b><span data-count="10">10</span> min</b><span>Per installarlo sul tuo sito</span></div>
      <div class="glass stat" data-reveal style="--i:2"><b>0 €</b><span>Per risposta: paghi un canone fisso</span></div>
    </div>
  </div>
</section>

<section class="section section-dark has-video" id="agenzie" data-scroll data-orb="funnel .5 .5 .8 .1 0">
  ${sectionVideo('rete')}
  <div class="wrap split">
    <div data-reveal>
      <p class="eyebrow">Per agenzie web</p>
      <h2 class="h2 words">${words('Rivendilo ai tuoi clienti. Gestiscili tutti da una dashboard.')}</h2>
      <p class="section-lead">Crei l’assistente per il cliente, lo configuri con il modello del suo settore e glielo consegni con un link di invito. Il cliente controlla le risposte e vede i contatti raccolti. Tu mantieni il controllo di tutto.</p>
      <a class="btn btn-white btn-lg" href="mailto:${config.brand.supportEmail}?subject=Programma%20agenzie">Parliamo del programma partner ${chip()}</a>
    </div>
    <dl class="agency-points">
      <div data-reveal style="--i:1"><dt><span data-count="25">25</span> siti</dt><dd>nel piano Agency, con conversazioni condivise tra tutti i clienti</dd></div>
      <div data-reveal style="--i:2"><dt><span data-count="1">1</span> link</dt><dd>per consegnare l’assistente pronto al cliente</dd></div>
      <div data-reveal style="--i:3"><dt><span data-count="30">30</span>–<span data-count="40">40</span>%</dt><dd>di margine indicativo sulla rivendita ai tuoi clienti</dd></div>
    </dl>
  </div>
</section>

<section class="section" id="prezzi" data-orb="ring .5 .1 1.05 -.95 .85">
  <div class="wrap">
    <div class="section-head center" data-reveal>
      <p class="eyebrow">Prezzi</p>
      <h2 class="h2 words">${words('Un canone fisso in euro. Nessun costo per risposta.')}</h2>
      <p class="section-lead">Prezzi IVA esclusa. 14 giorni di prova gratuita su ogni piano.</p>
      <div class="billing-toggle" role="group" aria-label="Periodo di fatturazione">
        <span class="billing-thumb" aria-hidden="true"></span>
        <button type="button" class="is-active" data-billing="monthly" aria-pressed="true">Mensile</button>
        <button type="button" data-billing="yearly" aria-pressed="false">Annuale <span class="save">2 mesi gratis</span></button>
      </div>
    </div>
    <div class="pricing" data-scroll>
      ${Object.values(PLANS).map((p, i) => html`<article class="glass plan${p.id === 'pro' ? ' plan-featured' : ''}" data-spot style="--o:${(i * 0.09).toFixed(2)}">
        ${p.id === 'pro' ? html`<span class="plan-tag">Consigliato</span>` : ''}
        <h3>${p.name}</h3>
        <p class="plan-who">${PLAN_COPY[p.id].who}</p>
        <p class="price"><span class="price-n" data-monthly="${p.price}" data-yearly="${Math.round((p.price * 10) / 12)}">${p.price}</span><span class="price-u"> €/mese</span></p>
        <p class="price-note" data-monthly-note="Fatturato mensilmente" data-yearly-note="${`${p.price * 10} € fatturati una volta all’anno`}">Fatturato mensilmente</p>
        <ul>${PLAN_COPY[p.id].features.map((f) => html`<li><span class="spark" aria-hidden="true"></span>${f}</li>`)}</ul>
        <a class="btn ${p.id === 'pro' ? 'btn-white' : 'btn-glass'} btn-block" href="/registrati">Prova gratis ${chip()}</a>
      </article>`)}
    </div>
    <p class="pricing-foot" data-reveal>Più di 25 siti, hosting dedicato o contratto su misura? <a href="mailto:${config.brand.supportEmail}?subject=Piano%20Enterprise">Piano Enterprise da 800 €/mese</a>. Configurazione “fatta per te”: 290 € una tantum.</p>
  </div>
</section>

<section class="section" id="domande" data-orb="ring .5 .1 .8 -.95 .3">
  <div class="wrap faq-wrap">
    <div class="section-head" data-reveal>
      <p class="eyebrow">Domande frequenti</p>
      <h2 class="h2 words">${words('Quello che ci chiedono prima di iniziare.')}</h2>
      <p class="section-lead">Non trovi la tua? Scrivila all’assistente in basso a destra, oppure a <a href="mailto:${config.brand.supportEmail}">${config.brand.supportEmail}</a>.</p>
    </div>
    <div class="faq" data-reveal style="--i:1">
      ${FAQ.map(([q, a]) => html`<details class="glass"><summary>${q}<span class="faq-icon" aria-hidden="true"></span></summary><div class="faq-body"><p>${a}</p></div></details>`)}
    </div>
  </div>
</section>

<section class="section cta-final has-video" data-scroll data-orb="wave .5 .82 1.2 -.3 1">
  ${sectionVideo('onde')}
  <div class="wrap center" data-reveal>
    <h2 class="h2 display-xl words-scrub">${words('Il tuo sito può rispondere già da stasera.', { total: 7 })}</h2>
    <p class="section-lead">Crei l’assistente in pochi minuti. Se non ti convince, non paghi niente.</p>
    <div class="cta-actions">
      <a class="btn btn-white btn-lg" href="/registrati" data-magnetic>Crea il tuo assistente ${chip()}</a>
      ${demoWidgetId ? html`<button class="btn btn-glass btn-lg" type="button" data-open-demo>Provalo adesso ${chip()}</button>` : ''}
    </div>
  </div>
</section>`;

  return publicLayout(ctx, {
    description: 'L’assistente per il sito della tua attività: risponde ai clienti 24 ore su 24, raccoglie i contatti e si installa con una riga di codice. Dati in UE.',
    body,
    bodyClass: 'landing',
    scripts: html`<script src="/static/js/site.js" defer></script><script src="/static/js/motion.js" defer></script>${demoWidgetId ? html`<script src="/w.js" data-id="${demoWidgetId}" async></script>` : ''}`,
  });
}

const LEGAL = {
  privacy: {
    title: 'Informativa privacy',
    body: html`<p class="draft-note">Bozza da completare con il consulente privacy prima della messa online.</p>
      <h2>Titolare del trattamento</h2><p>${config.brand.company}. Contatto: <a href="mailto:${config.brand.supportEmail}">${config.brand.supportEmail}</a>.</p>
      <h2>Dati dei clienti di ${brand}</h2><p>Nome, email, dati di fatturazione e dati di utilizzo della dashboard, trattati per fornire il servizio e adempiere agli obblighi di legge.</p>
      <h2>Dati dei visitatori dei siti dei clienti</h2><p>Per le conversazioni avviate tramite il widget, ${brand} agisce come responsabile del trattamento per conto del cliente (titolare). I messaggi e gli eventuali recapiti lasciati volontariamente sono conservati su server in UE e cancellati secondo il periodo impostato dal cliente.</p>
      <h2>Cookie</h2><p>Il widget non usa cookie di profilazione. Usa la memoria locale del browser solo per mantenere la conversazione tra una pagina e l’altra.</p>`,
  },
  termini: {
    title: 'Termini di servizio',
    body: html`<p class="draft-note">Bozza da completare con il consulente legale prima della messa online.</p>
      <h2>Servizio</h2><p>${brand} fornisce un assistente per siti web in abbonamento, con prova gratuita di 14 giorni.</p>
      <h2>Pagamenti e disdetta</h2><p>Gli abbonamenti mensili si rinnovano ogni mese e si possono disdire in qualsiasi momento. Gli abbonamenti annuali si rinnovano ogni anno.</p>
      <h2>Contenuti</h2><p>Il cliente è responsabile delle risposte inserite nel proprio assistente e della correttezza delle informazioni fornite ai visitatori.</p>`,
  },
};

export function legalPage(ctx, key) {
  const page = LEGAL[key];
  return publicLayout(ctx, {
    title: page.title,
    body: html`<section class="section"><div class="wrap prose">${''}<h1 class="h2">${page.title}</h1>${page.body}</div></section>`,
  });
}
