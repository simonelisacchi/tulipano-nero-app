// promemoria.js — promemoria "aggiorna il magazzino" verso fine giornata lavorativa
//
// Come funziona, in breve: mentre l'app è aperta (anche in un'altra scheda, basta che il
// tablet non sia spento o l'app chiusa del tutto), ogni minuto si controlla se è arrivato
// il momento giusto. Se sì, e se non è già stato mostrato oggi, compare una notifica vera
// e propria (quella che appare anche fuori dall'app, come le notifiche di WhatsApp) oltre
// a un avviso dentro l'app. Nei giorni segnati come chiusi in Agenda (domenica/lunedì di
// default, più le ferie impostate a mano) il promemoria non compare.
//
// Non è un promemoria che funziona a tablet spento o con l'app del tutto chiusa: quello
// richiederebbe un server che invia le notifiche da fuori (non c'è, in questa app che vive
// solo su GitHub Pages + foglio Google). Vedi il README per il perché di questa scelta.

const PROMEMORIA_ATTIVO_KEY = 'tn_promemoria_magazzino_attivo';
const PROMEMORIA_ULTIMA_DATA_KEY = 'tn_promemoria_magazzino_ultima_data';
const PROMEMORIA_ORA_INIZIO = 18; // 18:00
const PROMEMORIA_ORA_FINE_MINUTI = 18 * 60 + 30; // 18:30, in minuti dalla mezzanotte

const Promemoria = {
  init() {
    Promemoria._collegaImpostazioni();
    Promemoria._aggiornaValoreMenu();
    // Un controllo subito all'avvio (utile se l'app resta aperta tutto il giorno e viene
    // solo lasciata in una scheda), poi uno ogni minuto, e uno ogni volta che il tablet
    // torna a mostrare l'app (es. si riaccende lo schermo, o si torna da un'altra app).
    Promemoria._controlla();
    setInterval(() => Promemoria._controlla(), 60 * 1000);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') Promemoria._controlla();
    });
  },

  eAttivo() {
    return localStorage.getItem(PROMEMORIA_ATTIVO_KEY) === '1';
  },

  async _attiva() {
    if (!('Notification' in window)) {
      toast('Questo browser non supporta le notifiche: il promemoria comparirà comunque dentro l\'app.', 'info');
      localStorage.setItem(PROMEMORIA_ATTIVO_KEY, '1');
      Promemoria._aggiornaStatoSezione();
      Promemoria._aggiornaValoreMenu();
      return;
    }
    let permesso = Notification.permission;
    if (permesso === 'default') {
      permesso = await Notification.requestPermission();
    }
    localStorage.setItem(PROMEMORIA_ATTIVO_KEY, '1');
    Promemoria._aggiornaStatoSezione();
    Promemoria._aggiornaValoreMenu();
    if (permesso === 'granted') {
      toast('Promemoria attivato', 'successo');
    } else {
      toast('Promemoria attivato solo dentro l\'app: le notifiche sul tablet sono bloccate dal browser (vedi sotto come sbloccarle)', 'info');
    }
  },

  _disattiva() {
    localStorage.setItem(PROMEMORIA_ATTIVO_KEY, '0');
    Promemoria._aggiornaStatoSezione();
    Promemoria._aggiornaValoreMenu();
    toast('Promemoria disattivato', 'info');
  },

  _collegaImpostazioni() {
    const btnAttiva = document.getElementById('btn-promemoria-attiva');
    const btnDisattiva = document.getElementById('btn-promemoria-disattiva');
    if (btnAttiva) btnAttiva.addEventListener('click', () => Promemoria._attiva());
    if (btnDisattiva) btnDisattiva.addEventListener('click', () => Promemoria._disattiva());
    Promemoria._aggiornaStatoSezione();
  },

  // Aggiorna il contenuto della sezione Impostazioni → Promemoria magazzino: stato attuale,
  // pulsante corretto da mostrare, ed eventuale avviso se le notifiche sono bloccate.
  _aggiornaStatoSezione() {
    const attivo = Promemoria.eAttivo();
    const testoStato = document.getElementById('promemoria-stato-testo');
    const btnAttiva = document.getElementById('btn-promemoria-attiva');
    const btnDisattiva = document.getElementById('btn-promemoria-disattiva');
    const avvisoBloccate = document.getElementById('promemoria-avviso-bloccate');

    if (testoStato) testoStato.textContent = attivo ? 'Attivo' : 'Non attivo';
    if (btnAttiva) btnAttiva.hidden = attivo;
    if (btnDisattiva) btnDisattiva.hidden = !attivo;

    const bloccate = attivo && ('Notification' in window) && Notification.permission === 'denied';
    if (avvisoBloccate) avvisoBloccate.hidden = !bloccate;
  },

  _aggiornaValoreMenu() {
    const el = document.getElementById('menu-valore-promemoria');
    if (el) el.textContent = Promemoria.eAttivo() ? 'Attivo' : 'Non attivo';
  },

  // Vero se il giorno (stringa AAAA-MM-GG) è chiuso: domenica/lunedì di default, oppure
  // un'eccezione segnata a mano in Agenda (ferie, o un giorno di chiusura fuori calendario).
  // Non riusa la cache di Agenda (che si aggiorna solo aprendo la vista Agenda): legge lo
  // store direttamente, così il controllo resta corretto anche se oggi non si è mai aperta
  // quella sezione.
  async _eGiornoChiuso(iso) {
    const giorno = new Date(iso + 'T12:00:00').getDay(); // mezzogiorno: evita ambiguità di fuso
    const defaultChiuso = giorno === 0 || giorno === 1; // domenica o lunedì
    const ferie = await DB.getAll('ferie');
    const eccezione = ferie.find((f) => f.data === iso);
    if (eccezione) return eccezione.tipo === 'chiuso';
    return defaultChiuso;
  },

  async _controlla() {
    if (!Promemoria.eAttivo()) return;
    if (Promemoria._controllando) return; // evita due controlli sovrapposti (es. l'intervallo di un minuto e il ritorno in primo piano capitano quasi nello stesso istante)
    Promemoria._controllando = true;
    try {
      const ora = new Date();
      const minutiOggi = ora.getHours() * 60 + ora.getMinutes();
      if (minutiOggi < PROMEMORIA_ORA_INIZIO * 60 || minutiOggi > PROMEMORIA_ORA_FINE_MINUTI) return;

      const oggiIso = fmtDataOggi();
      if (localStorage.getItem(PROMEMORIA_ULTIMA_DATA_KEY) === oggiIso) return; // già mostrato oggi

      if (await Promemoria._eGiornoChiuso(oggiIso)) return;

      localStorage.setItem(PROMEMORIA_ULTIMA_DATA_KEY, oggiIso);
      Promemoria._mostra();
    } finally {
      Promemoria._controllando = false;
    }
  },

  async _mostra() {
    const titolo = 'Tulipano Nero';
    const corpo = 'Ricorda di aggiornare il Magazzino con i prodotti aggiunti o usati oggi.';

    // Notifica "vera", visibile anche fuori dall'app (richiede permesso concesso).
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        if ('serviceWorker' in navigator) {
          const reg = await navigator.serviceWorker.ready;
          await reg.showNotification(titolo, {
            body: corpo,
            icon: './icons/icon-192.png',
            badge: './icons/icon-192.png',
            tag: 'promemoria-magazzino',
            data: { vista: 'magazzino' }
          });
        } else {
          new Notification(titolo, { body: corpo, icon: './icons/icon-192.png' });
        }
      } catch (err) {
        console.warn('Notifica di sistema non riuscita, resta comunque l\'avviso dentro l\'app:', err);
      }
    }

    // Avviso anche dentro l'app: sempre, così arriva comunque a chi ha l'app aperta in
    // primo piano in quel momento, anche senza permesso per le notifiche di sistema.
    toast(corpo, 'info');
  }
};
