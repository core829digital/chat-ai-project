import { config, PLANS } from '../config.js';
import { html, raw } from '../lib/html.js';
import { SECTORS } from '../templates.js';
import { icon, publicLayout } from './layout.js';

const snippet = (id = 'wdg_abc123') => `<script src="${config.baseUrl}/w.js" data-id="${id}" async></script>`;

const PLAN_COPY = {
  start: { who: 'Per chi ha un sito e vuole smettere di rispondere sempre alle stesse domande.', features: ['1 sito', '500 conversazioni al mese', 'Modello del tuo settore', 'Raccolta contatti', 'Marchio Sportello nel widget'] },
  pro: { who: 'Per le attività che ricevono richieste ogni giorno e vogliono il proprio marchio.', features: ['3 siti', '2.000 conversazioni al mese', 'Senza marchio Sportello', 'Esportazione contatti in CSV', 'Domande senza risposta da completare'] },
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

export function landingPage(ctx, { demoWidgetId }) {
  const sectors = Object.entries(SECTORS).filter(([id]) => id !== 'generico');
  const body = html`
<section class="hero">
  <div class="wrap hero-grid">
    <div class="hero-copy">
      <p class="eyebrow">Per hotel, studi, negozi e ogni attività con un sito</p>
      <h1 class="display">Il tuo sito risponde ai clienti. Anche alle undici di sera.</h1>
      <p class="lead">Sportello è l’assistente che conosce orari, prezzi e servizi della tua attività. Risponde ai visitatori in pochi secondi e ti passa i contatti di chi vuole essere richiamato. Si installa con una riga di codice: su WordPress, su Wix, o su un sito fatto dieci anni fa.</p>
      <div class="hero-actions">
        <a class="btn btn-primary btn-lg" href="/registrati">Prova gratis per 14 giorni</a>
        ${demoWidgetId ? html`<button class="btn btn-ghost btn-lg" type="button" data-open-demo>Fai una domanda alla demo ${icon('arrow', 16)}</button>` : ''}
      </div>
      <p class="hero-note">Nessuna carta di credito · Disdici quando vuoi · Assistenza in italiano</p>
    </div>
    <div class="hero-visual" aria-hidden="true">
      <div class="browser">
        <div class="browser-bar"><span></span><span></span><span></span><div class="browser-url">locandalemura.it/camere</div></div>
        <div class="browser-page">
          <div class="mock-nav"><b>Locanda Le Mura</b><i></i><i></i><i></i></div>
          <div class="mock-hero"></div>
          <div class="mock-lines"><i></i><i></i><i class="short"></i></div>
          <div class="mock-cards"><i></i><i></i><i></i></div>
        </div>
        <div class="chat-mock">
          <div class="chat-mock-head"><span class="chat-avatar">LM</span><div><b>Locanda Le Mura</b><small><span class="online"></span>Risponde in pochi secondi</small></div></div>
          <div class="chat-mock-notice">Stai parlando con un assistente virtuale.</div>
          <div class="chat-mock-log">
            <p class="m-visitor">A che ora è il check-in? Arrivo verso le 22.</p>
            <p class="m-bot">Il check-in è dalle 14:00 alle 20:00. Per arrivi più tardi lasciamo le chiavi in una cassetta con codice: te lo mandiamo il giorno prima.</p>
            <p class="m-visitor">Perfetto. Avete il parcheggio?</p>
            <p class="m-bot">Sì, 8 posti auto gratuiti nel cortile interno. Non serve prenotarli.</p>
          </div>
          <div class="chat-mock-input">Scrivi un messaggio…<span class="send-dot">${icon('arrow', 14)}</span></div>
        </div>
      </div>
    </div>
  </div>
</section>

<section class="facts">
  <div class="wrap facts-grid">
    <div><strong>1 riga</strong><span>di codice per installarlo su qualsiasi sito</span></div>
    <div><strong>6 modelli</strong><span>di settore con le domande già scritte</span></div>
    <div><strong>24 ore su 24</strong><span>risposte immediate, anche nei festivi</span></div>
    <div><strong>0 invenzioni</strong><span>risponde solo con quello che scrivi tu</span></div>
  </div>
</section>

<section class="section" id="come-funziona">
  <div class="wrap">
    <div class="section-head">
      <p class="eyebrow">Come funziona</p>
      <h2 class="h2">Pronto in un pomeriggio, senza sviluppatori.</h2>
    </div>
    <ol class="steps">
      <li>
        <span class="step-n">1</span>
        <h3>Scrivi le risposte che dai ogni giorno</h3>
        <p>Parti dal modello del tuo settore: le domande più frequenti sono già scritte. Tu inserisci orari, prezzi e dettagli veri. Puoi aggiungerne quante vuoi.</p>
      </li>
      <li>
        <span class="step-n">2</span>
        <h3>Incolla una riga nel tuo sito</h3>
        <p>Copi il codice dalla dashboard e lo incolli prima di <code>&lt;/body&gt;</code>. Su WordPress c’è il plugin. Se il sito non si può modificare, usi la pagina chat ospitata.</p>
      </li>
      <li>
        <span class="step-n">3</span>
        <h3>Ricevi i contatti di chi vuole parlarti</h3>
        <p>Quando non sa rispondere, l’assistente lo dice e raccoglie nome, email e telefono. Tu li trovi nella dashboard, insieme alle domande da aggiungere.</p>
      </li>
    </ol>
    <div class="code-card">
      <div class="code-card-head"><span>Il codice da incollare nel sito</span><button class="copy-btn" type="button" data-copy="${snippet()}">${icon('copy', 15)} Copia</button></div>
      <pre><code>${snippet()}</code></pre>
    </div>
  </div>
</section>

<section class="section section-alt">
  <div class="wrap">
    <div class="section-head">
      <p class="eyebrow">Installazione</p>
      <h2 class="h2">Tre modi per metterlo online. Uno va bene per il tuo sito.</h2>
    </div>
    <div class="cols-3">
      <article class="card">
        <h3>Una riga di codice</h3>
        <p>Funziona su HTML, PHP, Joomla, Drupal, Wix, Shopify, Squarespace. Il widget è isolato: non cambia la grafica del sito e non la subisce.</p>
      </article>
      <article class="card">
        <h3>Plugin WordPress</h3>
        <p>Installi il plugin, incolli il codice del tuo assistente nelle impostazioni e hai finito. Nessun file del tema da toccare.</p>
      </article>
      <article class="card">
        <h3>Pagina chat ospitata</h3>
        <p>Per i siti che non si possono modificare: un indirizzo pronto da collegare a un pulsante, a un QR code o alla firma email.</p>
      </article>
    </div>
  </div>
</section>

<section class="section" id="settori">
  <div class="wrap">
    <div class="section-head">
      <p class="eyebrow">Modelli di settore</p>
      <h2 class="h2">Non parti da una pagina bianca.</h2>
      <p class="section-lead">Ogni modello contiene le domande che i clienti di quel settore fanno davvero. Tu cambi solo i dettagli.</p>
    </div>
    <div class="sector-grid">
      ${sectors.map(([, s]) => html`<article class="sector">
        <h3>${s.label}</h3>
        <ul>${s.faq.slice(0, 3).map(([q]) => html`<li>${q}</li>`)}</ul>
      </article>`)}
      <article class="sector sector-other">
        <h3>Il tuo settore non c’è?</h3>
        <p>Parti dal modello generico con orari, indirizzo, contatti, prezzi e pagamenti, e aggiungi le tue domande. Con il servizio di configurazione lo prepariamo noi.</p>
      </article>
    </div>
  </div>
</section>

<section class="section section-alt">
  <div class="wrap split">
    <div>
      <p class="eyebrow">Regole europee</p>
      <h2 class="h2">Dati in Europa. Trasparenza verso i visitatori.</h2>
      <p class="section-lead">Per uno studio medico, legale o un hotel, la conformità non è un dettaglio: decide se puoi usare uno strumento o no.</p>
    </div>
    <ul class="checklist">
      <li>${icon('check')}<div><b>Avviso AI Act sempre visibile.</b> Dal 2 agosto 2026 chi usa un assistente automatico deve dichiararlo. Il widget lo fa dal primo messaggio.</div></li>
      <li>${icon('check')}<div><b>Server in Unione Europea.</b> Conversazioni e contatti restano in UE.</div></li>
      <li>${icon('check')}<div><b>Nomina a responsabile del trattamento.</b> Il DPA in italiano è pronto da firmare.</div></li>
      <li>${icon('check')}<div><b>Nessun cookie di profilazione.</b> Il widget non richiede consensi aggiuntivi nel banner del sito.</div></li>
      <li>${icon('check')}<div><b>Consenso esplicito per i contatti.</b> Chi lascia i propri recapiti accetta di essere ricontattato, con link alla tua informativa.</div></li>
    </ul>
  </div>
</section>

<section class="section section-dark" id="agenzie">
  <div class="wrap split">
    <div>
      <p class="eyebrow eyebrow-light">Per agenzie web</p>
      <h2 class="h2">Rivendilo ai tuoi clienti. Gestiscili tutti da una dashboard.</h2>
      <p class="section-lead">Crei l’assistente per il cliente, lo configuri con il modello del suo settore e glielo consegni con un link di invito. Il cliente entra, controlla le risposte e vede i contatti raccolti. Tu mantieni il controllo di tutto.</p>
      <a class="btn btn-light btn-lg" href="mailto:${config.brand.supportEmail}?subject=Programma%20agenzie">Parliamo del programma partner</a>
    </div>
    <dl class="agency-points">
      <div><dt>25 siti</dt><dd>nel piano Agency, con conversazioni condivise tra tutti i clienti</dd></div>
      <div><dt>1 link</dt><dd>per consegnare l’assistente pronto al cliente</dd></div>
      <div><dt>30–40%</dt><dd>di margine indicativo sulla rivendita ai tuoi clienti</dd></div>
    </dl>
  </div>
</section>

<section class="section" id="prezzi">
  <div class="wrap">
    <div class="section-head center">
      <p class="eyebrow">Prezzi</p>
      <h2 class="h2">Un canone fisso in euro. Nessun costo per risposta.</h2>
      <p class="section-lead">Prezzi IVA esclusa. 14 giorni di prova gratuita su ogni piano.</p>
      <div class="billing-toggle" role="group" aria-label="Periodo di fatturazione">
        <button type="button" class="is-active" data-billing="monthly" aria-pressed="true">Mensile</button>
        <button type="button" data-billing="yearly" aria-pressed="false">Annuale <span class="save">2 mesi gratis</span></button>
      </div>
    </div>
    <div class="pricing">
      ${Object.values(PLANS).map((p) => html`<article class="plan${p.id === 'pro' ? ' plan-featured' : ''}">
        ${p.id === 'pro' ? html`<span class="plan-tag">Consigliato</span>` : ''}
        <h3>${p.name}</h3>
        <p class="plan-who">${PLAN_COPY[p.id].who}</p>
        <p class="price"><span class="price-n" data-monthly="${p.price}" data-yearly="${Math.round((p.price * 10) / 12)}">${p.price}</span><span class="price-u"> €/mese</span></p>
        <p class="price-note" data-monthly-note="Fatturato mensilmente" data-yearly-note="${raw(`${p.price * 10} € fatturati una volta all’anno`)}">Fatturato mensilmente</p>
        <a class="btn ${p.id === 'pro' ? 'btn-primary' : 'btn-outline'} btn-block" href="/registrati">Prova gratis</a>
        <ul>${PLAN_COPY[p.id].features.map((f) => html`<li>${icon('check', 16)}${f}</li>`)}</ul>
      </article>`)}
    </div>
    <p class="pricing-foot">Più di 25 siti, hosting dedicato o contratto su misura? <a href="mailto:${config.brand.supportEmail}?subject=Piano%20Enterprise">Piano Enterprise da 800 €/mese</a>. Configurazione “fatta per te”: 290 € una tantum.</p>
  </div>
</section>

<section class="section section-alt" id="domande">
  <div class="wrap faq-wrap">
    <div class="section-head">
      <p class="eyebrow">Domande frequenti</p>
      <h2 class="h2">Quello che ci chiedono prima di iniziare.</h2>
    </div>
    <div class="faq">
      ${FAQ.map(([q, a]) => html`<details><summary>${q}</summary><p>${a}</p></details>`)}
    </div>
  </div>
</section>

<section class="section cta-final">
  <div class="wrap center">
    <h2 class="h2">Prova Sportello sul tuo sito per 14 giorni.</h2>
    <p class="section-lead">Crei l’assistente in pochi minuti. Se non ti convince, non paghi niente.</p>
    <a class="btn btn-primary btn-lg" href="/registrati">Crea il tuo assistente</a>
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
      <h2>Dati dei clienti di Sportello</h2><p>Nome, email, dati di fatturazione e dati di utilizzo della dashboard, trattati per fornire il servizio e adempiere agli obblighi di legge.</p>
      <h2>Dati dei visitatori dei siti dei clienti</h2><p>Per le conversazioni avviate tramite il widget, Sportello agisce come responsabile del trattamento per conto del cliente (titolare). I messaggi e gli eventuali recapiti lasciati volontariamente sono conservati su server in UE e cancellati secondo il periodo impostato dal cliente.</p>
      <h2>Cookie</h2><p>Il widget non usa cookie di profilazione. Usa la memoria locale del browser solo per mantenere la conversazione tra una pagina e l’altra.</p>`,
  },
  termini: {
    title: 'Termini di servizio',
    body: html`<p class="draft-note">Bozza da completare con il consulente legale prima della messa online.</p>
      <h2>Servizio</h2><p>Sportello fornisce un assistente per siti web in abbonamento, con prova gratuita di 14 giorni.</p>
      <h2>Pagamenti e disdetta</h2><p>Gli abbonamenti mensili si rinnovano ogni mese e si possono disdire in qualsiasi momento. Gli abbonamenti annuali si rinnovano ogni anno.</p>
      <h2>Contenuti</h2><p>Il cliente è responsabile delle risposte inserite nel proprio assistente e della correttezza delle informazioni fornite ai visitatori.</p>`,
  },
};

export function legalPage(ctx, key) {
  const page = LEGAL[key];
  return publicLayout(ctx, {
    title: page.title,
    body: html`<section class="section"><div class="wrap prose"><h1 class="h2">${page.title}</h1>${page.body}</div></section>`,
  });
}
