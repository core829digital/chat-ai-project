// Modelli di settore: il cliente parte con domande già scritte da adattare.
// Le parti tra [parentesi quadre] vanno sostituite con i dati reali dell'attività.

export const SECTORS = {
  generico: {
    label: 'Attività generica',
    welcome: 'Ciao! Sono l\'assistente di [Nome attività]. Chiedimi orari, servizi o come contattarci.',
    faq: [
      ['Quali sono gli orari di apertura?', 'Siamo aperti dal lunedì al venerdì, dalle 9:00 alle 18:00. [Modifica con i vostri orari]', 'orari aperti chiusi'],
      ['Dove vi trovate?', 'Ci trovi in [Via, numero, città]. [Aggiungi indicazioni o link a Google Maps]', 'indirizzo sede raggiungere mappa'],
      ['Come posso contattarvi?', 'Puoi scriverci a [email] o chiamarci al [telefono]. Oppure lascia qui i tuoi recapiti e ti ricontattiamo noi.', 'telefono email contatti'],
      ['Quanto costano i vostri servizi?', 'I prezzi dipendono dal servizio richiesto. [Inserisci prezzi indicativi] Per un preventivo preciso lasciaci i tuoi recapiti.', 'prezzi costi preventivo listino'],
      ['Quali metodi di pagamento accettate?', 'Accettiamo carta, bancomat e bonifico. [Modifica secondo i vostri metodi]', 'pagamento carta bonifico'],
    ],
  },
  hotel: {
    label: 'Hotel, B&B, affittacamere',
    welcome: 'Benvenuto! Sono l\'assistente di [Nome struttura]. Posso aiutarti con camere, orari di check-in e servizi.',
    faq: [
      ['A che ora è il check-in e il check-out?', 'Il check-in è dalle 14:00 alle 20:00, il check-out entro le 10:30. Per arrivi in tarda serata scrivici prima. [Modifica orari]', 'check-in check-out arrivo partenza orari'],
      ['La colazione è inclusa?', 'Sì, la colazione è inclusa e viene servita dalle 7:30 alle 10:00. [Modifica]', 'colazione inclusa'],
      ['C\'è il parcheggio?', 'Sì, abbiamo [N] posti auto gratuiti / a pagamento ([prezzo] al giorno). [Modifica]', 'parcheggio auto garage'],
      ['Accettate animali?', 'Gli animali di piccola taglia sono i benvenuti con un supplemento di [prezzo] a notte. [Modifica]', 'animali cane gatto'],
      ['Come posso prenotare?', 'Puoi prenotare direttamente dal nostro sito [link] oppure lasciarci date e numero di ospiti: ti confermiamo la disponibilità.', 'prenotare prenotazione disponibilità camere'],
      ['Qual è la politica di cancellazione?', 'La cancellazione è gratuita fino a [N] giorni prima dell\'arrivo. [Modifica secondo la vostra politica]', 'cancellazione disdetta rimborso'],
    ],
  },
  ristorante: {
    label: 'Ristorante, bar, pizzeria',
    welcome: 'Ciao! Sono l\'assistente di [Nome locale]. Chiedimi orari, menù o come prenotare un tavolo.',
    faq: [
      ['Quali sono gli orari di apertura?', 'Siamo aperti a pranzo dalle 12:00 alle 14:30 e a cena dalle 19:00 alle 23:00. Chiusi il [giorno]. [Modifica]', 'orari aperti chiusura'],
      ['Come prenoto un tavolo?', 'Puoi chiamarci al [telefono] o lasciare qui nome, giorno, ora e numero di persone: ti confermiamo noi.', 'prenotare tavolo prenotazione'],
      ['Avete piatti senza glutine o vegani?', 'Sì, abbiamo opzioni senza glutine e vegane. Segnala allergie al momento della prenotazione. [Modifica]', 'glutine celiaci vegano vegetariano allergie'],
      ['Fate asporto o consegna a domicilio?', 'Facciamo asporto tutti i giorni. La consegna è disponibile tramite [servizio]. [Modifica]', 'asporto domicilio consegna delivery'],
      ['Dove vi trovate?', 'Siamo in [Via, numero, città]. [Indicazioni o parcheggio vicino]', 'indirizzo dove parcheggio'],
    ],
  },
  sanita: {
    label: 'Studio medico, dentistico, fisioterapia',
    welcome: 'Buongiorno, sono l\'assistente dello [Nome studio]. Posso darti informazioni su visite, orari e prenotazioni. Non fornisco pareri medici.',
    faq: [
      ['Come prenoto una visita?', 'Puoi prenotare chiamando la segreteria al [telefono] negli orari [orari], oppure lasciando qui i tuoi recapiti: ti richiamiamo noi.', 'prenotare visita appuntamento'],
      ['Quali sono gli orari dello studio?', 'Lo studio riceve dal lunedì al venerdì, [orari]. [Modifica]', 'orari aperto ricevimento'],
      ['Quali prestazioni offrite?', 'Offriamo [elenco prestazioni principali]. Per dettagli su un trattamento specifico chiedi pure.', 'prestazioni servizi trattamenti visite'],
      ['Quanto costa una prima visita?', 'La prima visita costa [prezzo]. [Indicare se convenzionati con assicurazioni o fondi]', 'prezzo costo prima visita tariffa'],
      ['Lavorate con assicurazioni o convenzioni?', 'Siamo convenzionati con [elenco fondi/assicurazioni]. [Modifica]', 'assicurazione convenzione fondo'],
    ],
  },
  ecommerce: {
    label: 'Negozio online',
    welcome: 'Ciao! Sono l\'assistente di [Nome negozio]. Chiedimi di spedizioni, resi, taglie o pagamenti.',
    faq: [
      ['Quanto costa la spedizione?', 'La spedizione costa [prezzo] ed è gratuita sopra [importo]. Consegna in [N] giorni lavorativi in Italia.', 'spedizione costo consegna gratuita tempi'],
      ['Come faccio un reso?', 'Hai [N] giorni dalla consegna per il reso. Scrivici il numero d\'ordine e ti inviamo l\'etichetta. [Modifica]', 'reso rimborso cambio restituire'],
      ['Quali metodi di pagamento accettate?', 'Accettiamo carte di credito, PayPal, Satispay e bonifico. [Modifica]', 'pagamento carta paypal bonifico'],
      ['Come scelgo la taglia giusta?', 'Trovi la guida alle taglie in ogni scheda prodotto. Se sei tra due taglie, consigliamo [indicazione].', 'taglia misura guida'],
      ['Dov\'è il mio ordine?', 'Dopo la spedizione ricevi un\'email con il codice di tracciamento. Se non l\'hai ricevuta, lasciaci il numero d\'ordine.', 'ordine tracciamento tracking stato'],
    ],
  },
  professionista: {
    label: 'Studio professionale (avvocato, commercialista, consulente)',
    welcome: 'Buongiorno, sono l\'assistente dello [Nome studio]. Posso darti informazioni sui servizi e fissare un primo contatto.',
    faq: [
      ['Di cosa vi occupate?', 'Lo studio si occupa di [aree di attività principali]. [Modifica]', 'servizi aree attività competenze'],
      ['Come fisso un appuntamento?', 'Lascia qui nome, recapito e un breve accenno al tema: ti ricontattiamo entro [N] giorni lavorativi.', 'appuntamento consulenza incontro prenotare'],
      ['Quanto costa una prima consulenza?', 'La prima consulenza costa [prezzo] / è gratuita per [durata]. [Modifica]', 'prezzo costo consulenza tariffa onorario'],
      ['Fate consulenze online?', 'Sì, possiamo incontrarci in videochiamata o in studio, come preferisci.', 'online videochiamata distanza'],
      ['Dove si trova lo studio?', 'Lo studio è in [Via, numero, città]. [Indicazioni]', 'indirizzo dove sede'],
    ],
  },
};

export const SECTOR_IDS = Object.keys(SECTORS);

export function defaultSettings({ name, sector = 'generico', showBranding = false }) {
  const tpl = SECTORS[sector] || SECTORS.generico;
  return {
    title: name,
    subtitle: 'Risponde in pochi secondi',
    welcomeMessage: tpl.welcome,
    fallbackMessage:
      'Non ho una risposta sicura a questa domanda. Se mi lasci i tuoi recapiti, ti risponde una persona del team.',
    launcherLabel: 'Hai una domanda?',
    color: '#1F5C4A',
    position: 'right',
    avatarText: initials(name),
    leadCapture: true,
    askPhone: true,
    privacyUrl: '',
    quickReplies: tpl.faq.slice(0, 3).map(([q]) => q),
    showBranding,
    engine: 'faq',
  };
}

export function initials(name) {
  const parts = String(name || '').replace(/[^\p{L}\p{N}\s]/gu, ' ').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'S';
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
}
