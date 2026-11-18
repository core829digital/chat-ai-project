import { config, PLANS } from '../config.js';
import { html } from '../lib/html.js';
import { SECTORS } from '../templates.js';
import { icon, publicLayout } from './layout.js';

const snippet = (id = 'wdg_abc123') => `<script src="${config.baseUrl}/w.js" data-id="${id}" async></script>`;
const brand = config.brand.name;

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

const step = (n, title, text, visual) => html`<li class="step" data-reveal style="--i:${n}">
  <div class="step-visual" aria-hidden="true">${visual}</div>
  <span class="step-n">${n}</span>
  <h3>${title}</h3>
  <p>${text}</p>
</li>`;

export function landingPage(ctx, { demoWidgetId }) {
  const sectors = Object.entries(SECTORS).filter(([id]) => id !== 'generico');
  const first = DEMOS[0];
  const body = html`
<section class="hero">
  <div class="hero-glow" aria-hidden="true"></div>
  <div class="wrap hero-grid">
    <div class="hero-copy">
      <p class="pill" style="--i:0"><span class="live-dot" aria-hidden="true"></span>Risponde 24 ore su 24, anche la domenica</p>
      <h1 class="display" style="--i:1">Il tuo sito risponde ai clienti. <span class="hl">Anche alle undici di sera.</span></h1>
      <p class="lead" style="--i:2">Un assistente che conosce orari, prezzi e servizi della tua attività. Risponde ai visitatori in pochi secondi e ti passa i contatti di chi vuole parlarti.</p>
      <div class="hero-actions" style="--i:3">
        <a class="btn btn-primary btn-lg" href="/registrati">Prova gratis per 14 giorni ${icon('arrow', 16)}</a>
        ${demoWidgetId ? html`<button class="btn btn-ghost btn-lg" type="button" data-open-demo>Fagli una domanda</button>` : ''}
      </div>
      <ul class="hero-ticks" style="--i:4">
        <li>${icon('check', 16)} Pronto in 10 minuti</li>
        <li>${icon('check', 16)} Funziona su qualsiasi sito</li>
        <li>${icon('check', 16)} Nessuna carta richiesta</li>
      </ul>
    </div>

    <div class="hero-stage">
      <div class="demo-tabs" role="tablist" aria-label="Scegli un settore per vedere un esempio">
        ${DEMOS.map((d, i) => html`<button type="button" role="tab" class="demo-tab${i === 0 ? ' is-active' : ''}" aria-selected="${i === 0 ? 'true' : 'false'}" data-demo-tab="${d.id}">${d.tab}<span class="demo-tab-bar" aria-hidden="true"></span></button>`)}
      </div>
      <div class="browser" aria-hidden="true">
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

<section class="platforms" aria-label="Piattaforme compatibili">
  <p class="platforms-label">Si installa su</p>
  <div class="marquee">
    <ul class="marquee-track">${PLATFORMS.map((p) => html`<li>${p}</li>`)}</ul>
    <ul class="marquee-track" aria-hidden="true">${PLATFORMS.map((p) => html`<li>${p}</li>`)}</ul>
  </div>
</section>

<section class="section" id="perche">
  <div class="wrap">
    <div class="section-head center" data-reveal>
      <p class="eyebrow">Cosa cambia</p>
      <h2 class="h2">Stessa domanda, alle 22:40. Due finali diversi.</h2>
    </div>
    <div class="compare">
      <article class="compare-card compare-before" data-reveal style="--i:1">
        <h3>Senza assistente</h3>
        <ol class="timeline">
          <li><time>22:40</time><span>Un cliente chiede se c’è posto sabato.</span></li>
          <li><time>22:41</time><span>Nessuno risponde. Il modulo contatti promette “entro 24 ore”.</span></li>
          <li class="is-bad"><time>22:46</time><span>Prenota da un’altra parte.</span></li>
        </ol>
      </article>
      <article class="compare-card compare-after" data-reveal style="--i:2">
        <h3>Con ${brand}</h3>
        <ol class="timeline">
          <li><time>22:40</time><span>Un cliente chiede se c’è posto sabato.</span></li>
          <li><time>22:40</time><span>Riceve subito orari, prezzi e condizioni.</span></li>
          <li class="is-good"><time>22:41</time><span>Lascia il numero. Domattina lo richiami tu.</span></li>
        </ol>
      </article>
    </div>
  </div>
</section>

<section class="section section-alt" id="come-funziona">
  <div class="wrap">
    <div class="section-head" data-reveal>
      <p class="eyebrow">Come funziona</p>
      <h2 class="h2">Tre passaggi. Nessuno sviluppatore.</h2>
    </div>
    <ol class="steps" data-reveal>
      ${step(1, 'Scegli il tuo settore', 'Le domande che i tuoi clienti fanno davvero sono già scritte. Tu inserisci orari, prezzi e dettagli veri.', html`
        <ul class="mini-kb">
          <li><span class="mini-check">${icon('check', 12)}</span>A che ora è il check-in?</li>
          <li><span class="mini-check">${icon('check', 12)}</span>C’è il parcheggio?</li>
          <li class="is-todo"><span class="mini-check"></span>Accettate animali? <em>da completare</em></li>
        </ul>`)}
      ${step(2, 'Incolla una riga nel sito', 'Prima di </body>, oppure con il plugin WordPress. Se il sito non si può toccare, usi la pagina chat ospitata.', html`
        <div class="mini-code"><code>&lt;script src="…/w.js" data-id="wdg_…"&gt;</code><span class="mini-copy">${icon('copy', 13)} Copiato</span></div>`)}
      ${step(3, 'Ricevi i contatti', 'Quando non sa rispondere lo dice e raccoglie nome e telefono. Tu trovi tutto nella dashboard.', html`
        <div class="mini-lead"><span class="notify-icon">${icon('inbox', 16)}</span><div><b>Nuovo contatto</b><span>Elena C. · +39 333 …</span></div></div>`)}
    </ol>
    <div class="code-card" data-reveal>
      <div class="code-card-head"><span>Il codice da incollare nel sito</span><button class="copy-btn" type="button" data-copy="${snippet()}">${icon('copy', 15)} <span>Copia</span></button></div>
      <pre><code>${snippet()}</code></pre>
    </div>
    <div class="cols-3 install-modes">
      <article class="card" data-reveal style="--i:1"><h3>Una riga di codice</h3><p>Su qualsiasi sito. Il widget è isolato: non cambia la grafica del sito e non la subisce.</p></article>
      <article class="card" data-reveal style="--i:2"><h3>Plugin WordPress</h3><p>Installi il plugin, incolli il codice del tuo assistente nelle impostazioni. Fine.</p></article>
      <article class="card" data-reveal style="--i:3"><h3>Pagina chat ospitata</h3><p>Un indirizzo pronto per un pulsante, un QR code sul bancone o la firma email.</p></article>
    </div>
  </div>
</section>

<section class="section" id="settori">
  <div class="wrap">
    <div class="section-head" data-reveal>
      <p class="eyebrow">Modelli di settore</p>
      <h2 class="h2">Non parti da una pagina bianca.</h2>
      <p class="section-lead">Ogni modello contiene le domande che i clienti di quel settore fanno davvero. Tu cambi solo i dettagli.</p>
    </div>
    <div class="sector-grid">
      ${sectors.map(([, s], i) => html`<article class="sector" data-reveal style="--i:${i}">
        <h3>${s.label}</h3>
        <ul>${s.faq.slice(0, 3).map(([q]) => html`<li>${q}</li>`)}</ul>
      </article>`)}
      <article class="sector sector-other" data-reveal style="--i:${sectors.length}">
        <h3>Il tuo settore non c’è?</h3>
        <p>Parti dal modello generico con orari, indirizzo, contatti, prezzi e pagamenti, e aggiungi le tue domande. Con il servizio di configurazione lo prepariamo noi.</p>
      </article>
    </div>
  </div>
</section>

<section class="section section-alt">
  <div class="wrap split">
    <div data-reveal>
      <p class="eyebrow">Regole europee</p>
      <h2 class="h2">Dati in Europa. Trasparenza verso i visitatori.</h2>
      <p class="section-lead">Per uno studio medico, legale o un hotel la conformità non è un dettaglio: decide se puoi usare uno strumento o no.</p>
    </div>
    <ul class="checklist">
      <li data-reveal style="--i:1">${icon('check')}<div><b>Avviso AI Act sempre visibile.</b> Dal 2 agosto 2026 chi usa un assistente automatico deve dichiararlo. Il widget lo fa dal primo messaggio.</div></li>
      <li data-reveal style="--i:2">${icon('check')}<div><b>Server in Unione Europea.</b> Conversazioni e contatti restano in UE.</div></li>
      <li data-reveal style="--i:3">${icon('check')}<div><b>Nomina a responsabile del trattamento.</b> Il DPA in italiano è pronto da firmare.</div></li>
      <li data-reveal style="--i:4">${icon('check')}<div><b>Nessun cookie di profilazione.</b> Il widget non richiede consensi aggiuntivi nel banner del sito.</div></li>
      <li data-reveal style="--i:5">${icon('check')}<div><b>Consenso esplicito per i contatti.</b> Chi lascia i propri recapiti accetta di essere ricontattato, con link alla tua informativa.</div></li>
    </ul>
  </div>
</section>

<section class="section section-dark" id="agenzie">
  <div class="wrap split">
    <div data-reveal>
      <p class="eyebrow eyebrow-light">Per agenzie web</p>
      <h2 class="h2">Rivendilo ai tuoi clienti. Gestiscili tutti da una dashboard.</h2>
      <p class="section-lead">Crei l’assistente per il cliente, lo configuri con il modello del suo settore e glielo consegni con un link di invito. Il cliente controlla le risposte e vede i contatti raccolti. Tu mantieni il controllo di tutto.</p>
      <a class="btn btn-light btn-lg" href="mailto:${config.brand.supportEmail}?subject=Programma%20agenzie">Parliamo del programma partner</a>
    </div>
    <dl class="agency-points">
      <div data-reveal style="--i:1"><dt><span data-count="25">25</span> siti</dt><dd>nel piano Agency, con conversazioni condivise tra tutti i clienti</dd></div>
      <div data-reveal style="--i:2"><dt><span data-count="1">1</span> link</dt><dd>per consegnare l’assistente pronto al cliente</dd></div>
      <div data-reveal style="--i:3"><dt><span data-count="30">30</span>–<span data-count="40">40</span>%</dt><dd>di margine indicativo sulla rivendita ai tuoi clienti</dd></div>
    </dl>
  </div>
</section>

<section class="section" id="prezzi">
  <div class="wrap">
    <div class="section-head center" data-reveal>
      <p class="eyebrow">Prezzi</p>
      <h2 class="h2">Un canone fisso in euro. Nessun costo per risposta.</h2>
      <p class="section-lead">Prezzi IVA esclusa. 14 giorni di prova gratuita su ogni piano.</p>
      <div class="billing-toggle" role="group" aria-label="Periodo di fatturazione">
        <span class="billing-thumb" aria-hidden="true"></span>
        <button type="button" class="is-active" data-billing="monthly" aria-pressed="true">Mensile</button>
        <button type="button" data-billing="yearly" aria-pressed="false">Annuale <span class="save">2 mesi gratis</span></button>
      </div>
    </div>
    <div class="pricing">
      ${Object.values(PLANS).map((p, i) => html`<article class="plan${p.id === 'pro' ? ' plan-featured' : ''}" data-reveal style="--i:${i}">
        ${p.id === 'pro' ? html`<span class="plan-tag">Consigliato</span>` : ''}
        <h3>${p.name}</h3>
        <p class="plan-who">${PLAN_COPY[p.id].who}</p>
        <p class="price"><span class="price-n" data-monthly="${p.price}" data-yearly="${Math.round((p.price * 10) / 12)}">${p.price}</span><span class="price-u"> €/mese</span></p>
        <p class="price-note" data-monthly-note="Fatturato mensilmente" data-yearly-note="${`${p.price * 10} € fatturati una volta all’anno`}">Fatturato mensilmente</p>
        <a class="btn ${p.id === 'pro' ? 'btn-primary' : 'btn-outline'} btn-block" href="/registrati">Prova gratis</a>
        <ul>${PLAN_COPY[p.id].features.map((f) => html`<li>${icon('check', 16)}${f}</li>`)}</ul>
      </article>`)}
    </div>
    <p class="pricing-foot" data-reveal>Più di 25 siti, hosting dedicato o contratto su misura? <a href="mailto:${config.brand.supportEmail}?subject=Piano%20Enterprise">Piano Enterprise da 800 €/mese</a>. Configurazione “fatta per te”: 290 € una tantum.</p>
  </div>
</section>

<section class="section section-alt" id="domande">
  <div class="wrap faq-wrap">
    <div class="section-head" data-reveal>
      <p class="eyebrow">Domande frequenti</p>
      <h2 class="h2">Quello che ci chiedono prima di iniziare.</h2>
      <p class="section-lead">Non trovi la tua? Scrivila all’assistente in basso a destra, oppure a <a href="mailto:${config.brand.supportEmail}">${config.brand.supportEmail}</a>.</p>
    </div>
    <div class="faq" data-reveal style="--i:1">
      ${FAQ.map(([q, a]) => html`<details><summary>${q}<span class="faq-icon" aria-hidden="true"></span></summary><div class="faq-body"><p>${a}</p></div></details>`)}
    </div>
  </div>
</section>

<section class="section cta-final">
  <div class="wrap center" data-reveal>
    <h2 class="h2">Il tuo sito può rispondere già da stasera.</h2>
    <p class="section-lead">Crei l’assistente in pochi minuti. Se non ti convince, non paghi niente.</p>
    <div class="cta-actions">
      <a class="btn btn-primary btn-lg" href="/registrati">Crea il tuo assistente ${icon('arrow', 16)}</a>
    </div>
  </div>
</section>`;

  return publicLayout(ctx, {
    description: 'L’assistente per il sito della tua attività: risponde ai clienti 24 ore su 24, raccoglie i contatti e si installa con una riga di codice. Dati in UE.',
    body,
    bodyClass: 'landing',
    scripts: html`<script src="/static/js/site.js" defer></script>${demoWidgetId ? html`<script src="/w.js" data-id="${demoWidgetId}" async></script>` : ''}`,
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
