# Motion design della landing — "Segnali notturni"

Filosofia algoritmica alla base delle animazioni generate in codice (canvas, nessun video esterno).

## Il movimento

**Segnali notturni.** Ogni domanda che arriva a un sito è un piccolo segnale luminoso che attraversa il buio: parte da un punto qualsiasi, esita, devia, cerca. Il sistema non disegna oggetti, disegna *intenzioni in viaggio*. Una domanda senza risposta vaga lungo un campo di flusso generato da rumore simplex, una corrente invisibile che cambia lentamente nel tempo; una domanda che trova risposta si accende di verde e smette di vagare, perché ha trovato il suo posto.

Il campo è costruito con un rumore a più ottave da cui si ricava il *curl*: i segnali non si ammassano e non si disperdono, scorrono come fumo in una stanza chiusa. La deviazione dipende dalla distanza dalla meta: lontano domina la corrente, vicino domina l'attrazione. È un algoritmo calibrato con pazienza, in cui ogni costante (scala del rumore, attrito, raggio di cattura) è stata scelta perché il moto sembri cercato e non casuale.

Il tempo non scorre da solo: lo guida lo scroll. La notte è il luogo dell'attesa, con stelle che tremolano a frequenze diverse e una luna che si spegne all'alba; il mattino è il luogo del raccolto, con un sole che sale lungo un arco e i segnali verdi che confluiscono verso il telefono del titolare. Il cielo è un'interpolazione continua tra palette notte, alba e giorno, così che tornare indietro con lo scroll riavvolga davvero la notte.

La casualità è sempre seminata. Il seme è **2240**, l'ora in cui nessuno risponde: stesso seme, stessa notte, a ogni visita. Chi conosce il prodotto riconosce nel numero la promessa; gli altri vedono solo una costellazione ben composta.

L'interazione è discreta: nell'hero il cursore agisce come una lente che accelera e accende i segnali vicini, legandoli con fili sottili, come una conversazione che si accende al passaggio. Nessun effetto è decorativo fine a se stesso: tutto racconta il passaggio da domanda a risposta a contatto, con l'artigianalità di un sistema rifinito iterazione dopo iterazione.

## Regole tecniche

- Un solo ciclo `requestAnimationFrame`, sospeso quando il canvas non è visibile o la scheda è in background.
- Densità di pixel limitata (max 1,75) e numero di particelle proporzionale all'area: fluido anche su telefoni economici.
- Solo `transform` e `opacity` sugli elementi della pagina.
- Con "riduci movimento" attivo: nessun canvas animato, la sezione a scroll mostra direttamente lo stato finale.
- Implementazione: `public/js/motion.js`.
