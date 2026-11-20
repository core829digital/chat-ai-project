# Motion design della landing — "Notte elettrica"

Linguaggio visivo e di movimento della landing (tutto generato in codice: nessuna libreria, nessun video esterno).

## L'idea

**Un solo oggetto che accompagna il visitatore.** Una forma fatta di anelli di trattini luminosi attraversa
tutta la pagina: nasce come un'onda sotto la demo, si chiude in un globo dietro le regole europee, si allunga
in un corno accanto ai modelli di settore e diventa un'aureola sopra i prezzi. Non è decorazione: è il
segnale dell'assistente, sempre acceso, che cambia forma ma resta lo stesso dall'inizio alla fine.

Intorno, tutto è sobrio: fondo nero, testo bianco sottile (DM Sans 200–400 con spaziatura stretta),
superfici di vetro sfocato e un solo colore vivo, il blu elettrico.

## Palette

| Token | Valore | Uso |
| --- | --- | --- |
| `--bg` | `#000` | fondo |
| `--text` / `--text-2` / `--muted` | bianco al 100 / 74 / 50 % | testi |
| `--glass`, `--line` | bianco al 5,5 % / 10 % | superfici di vetro e bordi |
| `--accent` | `#2f8cff` | blu elettrico: luci, piano consigliato |
| `--accent-2` | `#5ce1ff` | ciano: dettagli accesi, impulsi, puntatori |
| `--violet` | `#7c5cff` | solo nelle sfumature (logo, aurora) |

La chat demo resta bianca: è il widget vero, come appare sul sito del cliente. Il racconto "Una notte"
passa dalla notte blu all'alba chiara: i toni del giorno sono definiti solo dentro quella sezione.

## Sistema di movimento

Variabili in `public/css/site.css`:

| Elemento | Valore | Uso |
| --- | --- | --- |
| Durate | 180 / 320 / 550 / 900 / 1300 ms | stati, micro-interazioni, componenti, comparse, titoli |
| Curva "out" | `cubic-bezier(.16, 1, .3, 1)` | tutto ciò che entra |
| Curva "in-out" | `cubic-bezier(.65, 0, .35, 1)` | passaggi tra due stati, sipario |
| Molla `--spring` | `linear(…)` con leggero superamento | comparse, pulsanti, pillola del menu, foglio mobile |
| Ritmo | 70 ms tra elementi, 45 ms tra parole | sequenze |
| Scroll | nessuna transizione | gli effetti seguono il dito e si riavvolgono |

### La sfera di particelle (`[data-orb-canvas]`)

Ogni sezione dichiara un fotogramma chiave: `data-orb="forma x y scala inclinazione opacità"`
(forme: `wave`, `sphere`, `funnel`, `ring`; x e y in frazioni dello schermo). Il motore trova il tratto
di pagina in cui cade il centro dello schermo, fonde forma e valori tra le due sezioni vicine e li insegue
con un'inerzia di circa 0,2 s. Ogni punto è definito da (anello, angolo) in tutte le forme, quindi il
passaggio da una forma all'altra è una vera trasformazione, non una dissolvenza. Il trattino di ogni punto
segue la tangente dell'anello; i trattini sono divisi in 4 fasce di profondità (vicini più chiari e spessi)
e disegnati due volte: un alone largo e tenue e una linea sottile, in somma additiva.
Anche la velocità dello scroll e il mouse la fanno ruotare leggermente.

### Motore di scroll

Ogni elemento con `data-scroll` riceve a ogni fotogramma `--pe` (entrata), `--p` (passaggio),
`--px` (uscita) e `--pp` (avanzamento in una sezione fissata). Il CSS li usa direttamente.

### Coreografia per sezione

| Sezione | Movimento |
| --- | --- |
| Caricamento | percentuale 0→100 % (contatore CSS animato) e sipario che sale; poi parte l'hero |
| Testata | menu a pillola di vetro: la pillola chiara scorre sotto la voce in lettura e segue il mouse |
| Hero | parole che salgono da dietro una linea, gradiente che scorre nella frase in evidenza; scorrendo il testo sfuma e la demo si raddrizza dall'inclinazione 3D; onda di particelle sotto la demo |
| Piattaforme | fila di nomi che accelera e si inclina con la velocità dello scroll |
| Il tuo sito, sempre aperto | schede di vetro con disco bianco che ruota al passaggio; globo piccolo in alto |
| Dichiarazione | sezione fissata, parole che si accendono una a una; video "aurora" |
| Una notte | cielo, orologio, chat e telefono guidati dallo scroll, dalla notte all'alba |
| Come funziona | righe alternate: testo e disegno salgono quando la riga entra, le linee del disegno si tracciano con lo scroll, impulsi luminosi viaggiano sui fili, il puntatore va sulla tessera accesa, il codice si scrive da solo |
| Regole europee | griglia bento: circuito con impulsi, piattaforme in orbita, tasto acceso, globo a puntini con luoghi che pulsano; globo grande di particelle dietro |
| Settori | colonne a velocità diverse; corno di particelle a sinistra; numeri che contano |
| Agenzie | la sezione si apre da scheda arrotondata a tutto schermo; video "rete" |
| Prezzi | piani che si alzano in 3D uno dopo l'altro, bordo luminoso che gira attorno al piano consigliato; aureola di particelle in alto |
| Domande | apertura fluida delle risposte, icona che ruota a molla |
| Chiamata finale | titolo che si accende parola per parola; video "onde" e onda di particelle |
| Menu mobile | foglio di vetro che sale dal basso, voci a cascata, sfondo sfocato |
| Ovunque | luce che segue il cursore sulle schede, freccia dei pulsanti che ruota di 45°, riflesso sui pulsanti bianchi, pulsanti magnetici, scorrimento morbido con la rotella |

## Video

I quattro video (`public/media/*.webm`, ~650–750 KB, 1280×720, ciclo perfetto di 8–10 s) sono generati in
codice con la palette blu: le scene sono in `scripts/video-scenes.html`, la registrazione con `npm run videos`.
Accanto a ogni video c'è il primo fotogramma `.jpg`. Si caricano solo quando stanno per entrare nello schermo.

## Regole tecniche

- Un solo ciclo `requestAnimationFrame` per tutta la pagina, fermo quando la scheda è in background.
- Sfera: 46×60 punti (30×40 su telefono), densità di pixel limitata a 1,75; ~3 ms a fotogramma.
- Scorrimento morbido solo con mouse e rotella: tastiera, barra, link interni e touch restano quelli del
  sistema; gli elementi che scorrono da soli (chat del widget) ricevono la rotella normalmente.
- Sugli elementi della pagina solo `transform`, `opacity` e `filter`.
- Con "riduci movimento": niente caricamento, niente scorrimento morbido, la sfera resta ferma e si
  ridisegna solo cambiando sezione, il racconto mostra lo stato finale, i disegni sono già completi.
- Font DM Sans ospitato in `public/fonts` (licenza SIL OFL 1.1 accanto al file): nessuna richiesta esterna.
- Implementazione: `public/js/motion.js`, `public/js/site.js`, `public/css/site.css`.
