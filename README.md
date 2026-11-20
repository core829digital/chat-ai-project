# Aperto — MVP

Assistente per siti web installabile con una riga di codice, con dashboard per i clienti e pannello di amministrazione.
L'assistente risponde con le risposte scritte dal cliente, scegliendo la più vicina alla domanda (motore in italiano in `src/lib/matcher.js`). Quando non è sicuro lo dice e raccoglie i recapiti. In più, per ogni assistente si può attivare il **motore AI (beta)** tramite Neon AI Gateway: riformula usando solo le stesse informazioni e, se l'AI non è disponibile, torna da solo alle risposte scritte.

Serve **Node.js 24 o successivo**. In locale usa il database SQLite integrato in Node; con `DATABASE_URL` impostata usa **Neon Postgres**.

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
npm run build     # impacchetta gli script del browser (esbuild) e controlla la sintassi di tutti i file
npm test          # 31 test: motore di risposta, sicurezza, tutti i flussi del server (SQLite, o Postgres se DATABASE_URL è impostata)
npm run e2e       # browser vero (Chrome headless): sito cliente su altro dominio, widget, landing animata, dashboard, admin; screenshot in ./screenshots
```

Il test nel browser usa un finto sito cliente del 2009 senza meta viewport e con CSS aggressivo, per verificare che il widget funzioni anche sui siti vecchi e non venga rotto dalla grafica del sito.

## Sicurezza già presente
Password con scrypt · sessioni con cookie HttpOnly/SameSite · protezione CSRF su tutti i form · escape automatico dell'HTML nei template · Content Security Policy · domini autorizzati per ogni widget · limiti di frequenza su messaggi, contatti, accessi e registrazioni · CSV protetto dall'iniezione di formule · avviso AI Act non disattivabile nel widget.

## Struttura

```
src/
  server.js          avvio e instradamento
  config.js          piani, prezzi, impostazioni
  db.js, models.js   database (SQLite o Postgres, stesse query) e query
  auth.js            sessioni, CSRF, permessi
  templates.js       modelli di settore con le domande già scritte
  lib/matcher.js     motore di risposta senza AI (italiano)
  lib/responder.js   punto unico in cui collegare l'AI
  routes/            public, app (cliente), admin, api (widget)
  views/             pagine HTML
public/widget/w.js   il widget (Shadow DOM, nessuna dipendenza)
public/js/motion.js  motion design della landing (sfera di particelle, scroll morbido, racconto a scroll)
src/client/live.js   conversazioni in tempo reale (Neon Realtime), impacchettato in public/js/live.js
src/lib/ai.js        motore AI tramite Neon AI Gateway
src/lib/realtime.js  query sigillate per Neon Realtime
migrations/          schema Postgres (applicato con npm run migrate)
docs/               note di progetto (motion-design.md)
wordpress-plugin/    plugin WordPress
scripts/             seed ed e2e
test/                test automatici
```

## Neon (database, tempo reale, AI)

Il progetto è collegato a Neon con `neon.ts` (servizi: Postgres, Auth, AI Gateway, Functions, Realtime).
Le variabili arrivano con `neon env pull` in `.env.local` (esclusa da git: non va mai committata).

```bash
npm run migrate      # applica migrations/*.sql (usa DATABASE_URL_UNPOOLED, connessione diretta)
npm run seed:neon    # dati iniziali sul database Neon
npm run start:neon   # avvia l'app con le variabili di .env.local
```

- **Postgres**: l'app usa la connessione *pooled* (`DATABASE_URL`), le migrazioni quella diretta. Le migrazioni vanno provate prima su un branch (`neon branches create`), poi applicate a production.
- **Realtime**: nella dashboard, la lista Conversazioni si aggiorna da sola quando arriva un messaggio. Il server sigilla una query limitata all'assistente del cliente (`POST /api/app/widgets/:id/live`, con sessione e CSRF); la capability dura 60 secondi e il browser la rinnova.
- **AI Gateway**: in Aspetto → "Come risponde" si sceglie il motore AI. Il modello si imposta con `AI_MODEL` (predefinito `claude-haiku-4-5`). Serve credito AI Gateway sull'organizzazione Neon: senza, ogni richiesta risponde 403 `paid_plan_required` e il widget usa automaticamente le risposte scritte.
- **Auth**: Neon Auth è attivo sul progetto ma l'app usa ancora il proprio sistema di accesso (scrypt + sessioni); la migrazione è una scelta separata.

## Pubblicazione su Vercel (deploy automatico da GitHub)

Il progetto è pronto per Vercel: `vercel.json` manda tutte le richieste alla funzione `api/index.js`, che usa la stessa applicazione del server locale. Vercel esegue da solo `npm run build`.

**Collegamento (una volta sola, dal sito di Vercel):**
1. vercel.com → **Add New… → Project** → importa il repository `core829digital/chat-ai-project`.
2. Framework Preset: **Other**. Lascia vuoti Build Command e Install Command.
3. In **Environment Variables** aggiungi:
   - `ADMIN_EMAIL` — email dell'amministratore
   - `ADMIN_PASSWORD` — password dell'amministratore (almeno 12 caratteri; senza questa variabile l'admin non viene creato)
   - `SEED_SAMPLE_CLIENTS` — `1` solo se vuoi i clienti di esempio (hanno password pubbliche nel repository: non usarlo su un sito aperto)
   - `BASE_URL` — facoltativa, solo con un dominio personalizzato (es. `https://www.tuodominio.it`)
   - `DATABASE_URL` — la connessione *pooled* di Neon (production), così i dati restano salvati
   - `NEON_REALTIME_URL`, `NEON_REALTIME_SECRET` — per le conversazioni in tempo reale
   - `NEON_AI_GATEWAY_BASE_URL`, `NEON_AI_GATEWAY_TOKEN` — per il motore AI (facoltative)
4. **Deploy**. Da quel momento ogni `git push` su `main` pubblica in produzione e ogni altro branch crea un'anteprima.

**Senza `DATABASE_URL`** l'app su Vercel usa SQLite in `/tmp`, che si svuota quando Vercel ricrea l'istanza: va bene solo per mostrare il prodotto. Con `DATABASE_URL` di Neon i dati restano salvati (regione eu-central-1, Francoforte).

## Prima della messa online
- `NODE_ENV=production`, `BASE_URL=https://dominio-definitivo`, server in UE dietro HTTPS.
- Pagamenti (Stripe) e invio email (inviti, notifica nuovi contatti, recupero password) non sono ancora collegati: oggi il cambio piano lo fa l'admin e i link di invito si copiano o si inviano con l'email preparata.
- Privacy, termini e DPA sono bozze da far completare a un consulente.
- Con molti clienti: spostare i limiti di frequenza (oggi in memoria) su Redis.
