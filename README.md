# Aperto — MVP

Assistente per siti web installabile con una riga di codice, con dashboard per i clienti e pannello di amministrazione.
**In questa versione l'AI non è collegata**: l'assistente risponde con le risposte scritte dal cliente, scegliendo la più vicina alla domanda (motore in italiano in `src/lib/matcher.js`). Quando non è sicuro lo dice e raccoglie i recapiti.

Nessuna dipendenza esterna: serve solo **Node.js 24 o successivo** (usa il database SQLite integrato in Node).

## Avvio

```bash
npm run seed      # crea admin, assistente demo della landing e 3 clienti di esempio
npm start         # http://localhost:3000
```

Le credenziali generate dal seed sono in `data/credenziali-demo.txt` (cartella esclusa da git).
Per ricominciare da zero: `npm run seed -- --reset`. Per sviluppare con riavvio automatico: `npm run dev`.

## Cosa c'è

| Area | Indirizzo | Contenuto |
| --- | --- | --- |
| Landing page | `/` | Presentazione, prezzi, domande frequenti, demo funzionante in basso a destra |
| Registrazione e accesso | `/registrati`, `/accedi` | Prova di 14 giorni, scelta del settore |
| Dashboard cliente | `/app` | Panoramica, assistenti, risposte, aspetto con anteprima dal vivo, installazione, conversazioni, contatti (export CSV), account |
| Pannello admin | `/admin` | MRR e statistiche, clienti, creazione cliente + assistente con **link di invito**, accesso come cliente, piani e stati, tutti gli assistenti e contatti |
| Widget | `/w.js` | Script da incollare nei siti: `<script src="https://DOMINIO/w.js" data-id="wdg_..." async></script>` |
| Chat ospitata | `/c/wdg_...` | Pagina chat per siti che non si possono modificare |
| Plugin WordPress | `/download/aperto-wordpress.zip` | Generato dai sorgenti in `wordpress-plugin/` |

### Due modi di lavorare
- **Il cliente fa da solo**: si registra, sceglie il settore, trova le domande già scritte, personalizza e installa.
- **L'admin prepara tutto**: in `/admin/accounts/new` crea cliente e assistente, completa le risposte, poi manda al cliente il link di invito (con email già pronta). Con “Apri la dashboard del cliente” vede esattamente quello che vede il cliente.

## Verifiche

```bash
npm test          # 31 test: motore di risposta, sicurezza, tutti i flussi del server
npm run e2e       # browser vero (Chrome headless): sito cliente su altro dominio, widget, dashboard, admin; screenshot in ./screenshots
```

Il test nel browser usa un finto sito cliente del 2009 senza meta viewport e con CSS aggressivo, per verificare che il widget funzioni anche sui siti vecchi e non venga rotto dalla grafica del sito.

## Sicurezza già presente
Password con scrypt · sessioni con cookie HttpOnly/SameSite · protezione CSRF su tutti i form · escape automatico dell'HTML nei template · Content Security Policy · domini autorizzati per ogni widget · limiti di frequenza su messaggi, contatti, accessi e registrazioni · CSV protetto dall'iniezione di formule · avviso AI Act non disattivabile nel widget.

## Struttura

```
src/
  server.js          avvio e instradamento
  config.js          piani, prezzi, impostazioni
  db.js, models.js   database e query
  auth.js            sessioni, CSRF, permessi
  templates.js       modelli di settore con le domande già scritte
  lib/matcher.js     motore di risposta senza AI (italiano)
  lib/responder.js   punto unico in cui collegare l'AI
  routes/            public, app (cliente), admin, api (widget)
  views/             pagine HTML
public/widget/w.js   il widget (Shadow DOM, nessuna dipendenza)
wordpress-plugin/    plugin WordPress
scripts/             seed ed e2e
test/                test automatici
```

## Collegare l'AI (prossimo passo)
Tutte le risposte passano da `respond()` in `src/lib/responder.js`. Basta aggiungere una funzione che chiama il modello con le risposte del cliente come contesto e restituisce lo stesso oggetto (`text`, `outcome`, `action`, `suggestions`): widget, dashboard, statistiche e limiti dei piani funzionano già.

## Prima della messa online
- `NODE_ENV=production`, `BASE_URL=https://dominio-definitivo`, server in UE dietro HTTPS.
- Pagamenti (Stripe) e invio email (inviti, notifica nuovi contatti, recupero password) non sono ancora collegati: oggi il cambio piano lo fa l'admin e i link di invito si copiano o si inviano con l'email preparata.
- Privacy, termini e DPA sono bozze da far completare a un consulente.
- Con molti clienti: passare a PostgreSQL (le query sono tutte in `models.js`) e spostare i limiti di frequenza su Redis.
