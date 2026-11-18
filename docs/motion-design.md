# Motion design della landing — "Segnali notturni"

Filosofia algoritmica alla base delle animazioni generate in codice (canvas, nessun video esterno).

## Il movimento

**Segnali notturni.** Ogni domanda che arriva a un sito è un piccolo segnale luminoso che attraversa il buio: parte da un punto qualsiasi, esita, devia, cerca. Il sistema non disegna oggetti, disegna *intenzioni in viaggio*. Una domanda senza risposta vaga lungo un campo di flusso generato da rumore simplex, una corrente invisibile che cambia lentamente nel tempo; una domanda che trova risposta si accende di verde e smette di vagare, perché ha trovato il suo posto.

Il campo è costruito con un rumore a più ottave da cui si ricava il *curl*: i segnali non si ammassano e non si disperdono, scorrono come fumo in una stanza chiusa. La deviazione dipende dalla distanza dalla meta: lontano domina la corrente, vicino domina l'attrazione. È un algoritmo calibrato con pazienza, in cui ogni costante (scala del rumore, attrito, raggio di cattura) è stata scelta perché il moto sembri cercato e non casuale.

Il tempo non scorre da solo: lo guida lo scroll. La notte è il luogo dell'attesa, con stelle che tremolano a frequenze diverse e una luna che si spegne all'alba; il mattino è il luogo del raccolto, con un sole che sale lungo un arco e i segnali verdi che confluiscono verso il telefono del titolare. Il cielo è un'interpolazione continua tra palette notte, alba e giorno, così che tornare indietro con lo scroll riavvolga davvero la notte.

La casualità è sempre seminata. Il seme è **2240**, l'ora in cui nessuno risponde: stesso seme, stessa notte, a ogni visita. Chi conosce il prodotto riconosce nel numero la promessa; gli altri vedono solo una costellazione ben composta.

L'interazione è discreta: nell'hero il cursore agisce come una lente che accelera e accende i segnali vicini, legandoli con fili sottili, come una conversazione che si accende al passaggio. Nessun effetto è decorativo fine a se stesso: tutto racconta il passaggio da domanda a risposta a contatto, con l'artigianalità di un sistema rifinito iterazione dopo iterazione.

## Sistema di movimento

Tutte le animazioni del sito seguono le stesse regole (variabili in `public/css/site.css`):

| Elemento | Valore | Uso |
| --- | --- | --- |
| Durate | 180 / 320 / 550 / 900 / 1300 ms | stati, micro-interazioni, componenti, comparse, titoli |
| Curva "out" | `cubic-bezier(.16, 1, .3, 1)` | tutto ciò che entra |
| Curva "in-out" | `cubic-bezier(.65, 0, .35, 1)` | passaggi tra due stati |
| Curva "spring" | `cubic-bezier(.34, 1.4, .64, 1)` | elementi che "arrivano" (notifiche, numeri dei passaggi) |
| Ritmo | 70 ms tra elementi, 45 ms tra parole | sequenze |
| Scroll | nessuna transizione | gli effetti seguono il dito e si riavvolgono |

### Motore di scroll

Ogni elemento con `data-scroll` riceve dal motore (in `public/js/motion.js`) quattro valori aggiornati a ogni fotogramma:
`--pe` (entrata), `--p` (passaggio), `--px` (uscita), `--pp` (avanzamento mentre la sezione è fissata). Il CSS li usa direttamente.
Senza JavaScript o con "riduci movimento" i valori restano quelli finali: la pagina è completa e ferma.

### Coreografia per sezione

| Sezione | Effetto legato allo scroll |
| --- | --- |
| Hero | il testo sale e sfuma, la demo arretra; campo generativo che reagisce al cursore |
| Dichiarazione | sezione fissata, il testo si accende parola per parola; video "aurora" con zoom lento |
| Piattaforme | la fascia accelera e si inclina con la velocità dello scroll |
| Una notte | racconto fissato: cielo, orologio, chat e telefono guidati dallo scroll |
| Come funziona | linea che si disegna, passaggi che si accendono, codice che si scrive; video "flusso" in parallasse |
| Settori | colonne a velocità diverse |
| Regole europee | titolo fermo mentre i punti scorrono, spunte che si disegnano |
| Agenzie | la sezione si apre da scheda arrotondata a tutto schermo; video "rete" |
| Prezzi | i piani si alzano in 3D uno dopo l'altro |
| Chiamata finale | il titolo si accende con lo scroll; video "onde" |
| Menu | indicatore che segue la sezione in lettura |

## Video

I quattro video (`public/media/*.webm`, ~650–800 KB ciascuno, 1280×720, ciclo perfetto di 8–10 s) sono generati in codice:
le scene sono in `scripts/video-scenes.html`, la registrazione con `npm run videos` (Chrome in background + MediaRecorder).
Ogni scena è periodica sulla sua durata, quindi il ciclo non ha scatti. Accanto a ogni video c'è un'immagine `.jpg`
del primo fotogramma, usata come anteprima e come sostituto con "riduci movimento" o dove l'autoplay è bloccato.
I video si caricano solo quando stanno per entrare nello schermo e si fermano quando escono.

## Regole tecniche

- Un solo ciclo `requestAnimationFrame`, sospeso quando il canvas non è visibile o la scheda è in background.
- Densità di pixel limitata (max 1,75) e numero di particelle proporzionale all'area: fluido anche su telefoni economici.
- Solo `transform` e `opacity` sugli elementi della pagina.
- Con "riduci movimento" attivo: nessun canvas animato, la sezione a scroll mostra direttamente lo stato finale.
- Implementazione: `public/js/motion.js`.
