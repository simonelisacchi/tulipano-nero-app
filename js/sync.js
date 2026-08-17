// sync.js — sincronizzazione con Google Sheets tramite Google Apps Script.
//
// Come funziona (in breve):
// 1. L'app scrive SEMPRE prima nel database del tablet (IndexedDB) -> funziona anche offline.
// 2. Quando c'è internet, questo modulo:
//    a) invia (push) al foglio Google tutte le modifiche fatte offline
//    b) scarica (pull) le modifiche fatte da altrove (es. da PC) e le salva in locale
// 3. In caso di conflitto vince il record modificato più di recente (per data/ora).
//
// L'indirizzo dello script (URL) e la chiave di sincronizzazione vanno impostati una sola
// volta, dalle Impostazioni dell'app, su ogni dispositivo.
//
// SICUREZZA: la sincronizzazione usa una chiave fissa (non l'accesso Google di chi sta
// usando l'app in quel momento). Sono due cose intenzionalmente separate:
// - l'accesso (vedi auth.js) decide CHI può aprire e usare l'app;
// - questa chiave decide se i DATI possono essere letti/scritti sul foglio.
// La chiave non scade mai, quindi la sincronizzazione funziona sempre, in modo affidabile,
// senza bisogno di "rinnovare" nulla — a differenza dei permessi Google, che durano poco
// e il cui rinnovo automatico non è affidabile su tutti i dispositivi.
//
// IMPORTANTE: a differenza delle versioni precedenti, questa chiave NON è scritta qui nel
// codice. Il codice di questo file finisce su GitHub Pages, che per essere gratuito richiede
// un repository pubblico: qualunque cosa scritta qui sarebbe leggibile da chiunque trovasse
// il repository. La chiave va quindi inserita a mano, una volta per dispositivo, dalle
// Impostazioni dell'app (Sincronizzazione → Modifica indirizzo): da lì in poi resta salvata
// solo nella memoria del tablet, mai nel codice pubblico. Istruzioni nel README.

const SYNC_URL_KEY = 'tn_apps_script_url';
const SYNC_SECRET_KEY = 'tn_sync_secret';
const LAST_SYNC_KEY = 'tn_last_sync';
const LAST_SYNC_ERROR_KEY = 'tn_last_sync_error';

const Sync = {
  getUrl() {
    return localStorage.getItem(SYNC_URL_KEY) || '';
  },
  setUrl(url) {
    localStorage.setItem(SYNC_URL_KEY, url.trim());
  },
  getSecret() {
    return localStorage.getItem(SYNC_SECRET_KEY) || '';
  },
  setSecret(secret) {
    localStorage.setItem(SYNC_SECRET_KEY, secret.trim());
  },
  getLastSync() {
    return localStorage.getItem(LAST_SYNC_KEY) || null;
  },
  // Ultimo errore di sincronizzazione incontrato (utile per la diagnostica): { messaggio, quando }
  // oppure null se l'ultima sincronizzazione tentata è andata a buon fine.
  getLastError() {
    try {
      return JSON.parse(localStorage.getItem(LAST_SYNC_ERROR_KEY) || 'null');
    } catch {
      return null;
    }
  },
  // Riparte da zero al prossimo giro: scarica di nuovo tutto dal foglio Google invece di
  // scaricare solo le modifiche più recenti. Utile come intervento di manutenzione se un
  // dispositivo sembra "disallineato" rispetto agli altri.
  forzaRisincronizzazioneCompleta() {
    localStorage.removeItem(LAST_SYNC_KEY);
  },

  async syncNow(opts = {}) {
    const url = Sync.getUrl();
    const secret = Sync.getSecret();
    if (!url || !secret) {
      if (!opts.silent) toast('Imposta prima indirizzo e chiave di sincronizzazione nelle Impostazioni', 'errore');
      return { ok: false, reason: 'no-config' };
    }
    if (!navigator.onLine) {
      if (!opts.silent) toast('Sei offline: le modifiche verranno sincronizzate al ritorno della connessione', 'info');
      return { ok: false, reason: 'offline' };
    }

    setSyncBadge('in-corso');
    try {
      await Sync._push(url, secret);
      await Sync._pull(url, secret);
      localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
      localStorage.removeItem(LAST_SYNC_ERROR_KEY);
      setSyncBadge('ok');
      await Sync._aggiornaVisteDopoSync();
      if (!opts.silent) toast('Sincronizzazione completata', 'successo');
      return { ok: true };
    } catch (err) {
      console.error('Errore di sincronizzazione', err);
      const messaggio = (err && err.message) ? err.message : 'Errore sconosciuto';
      localStorage.setItem(LAST_SYNC_ERROR_KEY, JSON.stringify({ messaggio, quando: new Date().toISOString() }));
      setSyncBadge('errore');
      if (!opts.silent) toast(messaggio, 'errore');
      return { ok: false, reason: 'error', err };
    }
  },

  // Prima d'ora, i dati arrivati con una sincronizzazione (da un altro dispositivo, o già
  // presenti sul foglio Google) restavano scaricati nel database del tablet ma invisibili,
  // perché nessuno diceva alle viste di ridisegnarsi: si vedevano solo dopo aver chiuso e
  // riaperto l'app. Ora, dopo ogni sincronizzazione riuscita, si aggiornano da sole.
  async _aggiornaVisteDopoSync() {
    if (typeof Clienti !== 'undefined' && Clienti.render) await Clienti.render();
    if (typeof Magazzino !== 'undefined' && Magazzino.render) await Magazzino.render();
    if (typeof Agenda !== 'undefined') {
      if (Agenda.modalitaVista === 'mese' && Agenda._renderMese) await Agenda._renderMese();
      else if (Agenda.render) await Agenda.render();
    }
  },

  async _push(url, secret) {
    const payload = {};
    for (const store of STORES) {
      payload[store] = await DB.getPending(store);
    }
    const hasAnything = Object.values(payload).some((arr) => arr.length > 0);
    if (!hasAnything) return;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // evita preflight CORS con Apps Script
      body: JSON.stringify({ azione: 'push', dati: payload, secret })
    });
    if (!res.ok) throw new Error('Push fallito: ' + res.status);
    const risultato = await res.json();
    if (risultato && risultato.ok === false) throw new Error(risultato.errore || 'Push rifiutato dal server');

    for (const store of STORES) {
      for (const rec of payload[store]) {
        await DB.markSynced(store, rec.id);
      }
    }
  },

  async _pull(url, secret) {
    const since = Sync.getLastSync() || '1970-01-01T00:00:00.000Z';
    const res = await fetch(`${url}?azione=pull&since=${encodeURIComponent(since)}&secret=${encodeURIComponent(secret)}`);
    if (!res.ok) throw new Error('Pull fallito: ' + res.status);
    const remote = await res.json();
    if (remote && remote.errore) throw new Error(remote.errore);

    for (const store of STORES) {
      const records = remote[store] || [];
      for (const rec of records) {
        const local = await DB.get(store, rec.id);
        // Non sovrascrivere modifiche locali non ancora inviate: verranno riconciliate al prossimo push.
        if (local && !local.sincronizzato) continue;
        if (!local || new Date(rec.aggiornatoIl) > new Date(local.aggiornatoIl)) {
          await DB.saveFromRemote(store, rec);
        }
      }
    }

    // Righe cancellate DIRETTAMENTE dal foglio Google (non tramite l'app) non lasciano nessuna
    // traccia di "eliminato" da sincronizzare: il pull qui sopra le riceve solo per differenze
    // recenti, quindi non se ne accorgerebbe mai. Qui invece confrontiamo l'elenco completo
    // degli id ancora presenti sul foglio con quelli salvati sul tablet: quelli che sul tablet
    // risultano già sincronizzati ma non compaiono più sul foglio sono stati tolti da lì, e li
    // rimuoviamo anche in locale (senza rimandarli indietro: sono già spariti anche dal foglio).
    const idsAttuali = remote._idsAttuali || null;
    if (idsAttuali) {
      for (const store of STORES) {
        const presentiRemoti = new Set(idsAttuali[store] || []);
        const localiAttivi = await DB.getAll(store);
        for (const rec of localiAttivi) {
          if (rec.sincronizzato && !presentiRemoti.has(rec.id)) {
            await DB.saveFromRemote(store, { ...rec, eliminato: true, aggiornatoIl: new Date().toISOString() });
          }
        }
      }
    }
  }
};

function setSyncBadge(stato) {
  const badge = document.getElementById('sync-badge');
  if (!badge) return;
  badge.className = `sync-badge sync-badge--${stato}`;
  const testi = {
    'ok': 'Sincronizzato',
    'in-corso': 'Sincronizzazione…',
    'errore': 'Sincronizzazione non riuscita',
    'offline': 'Offline',
    'non-configurato': 'Sincronizzazione da configurare'
  };
  badge.textContent = testi[stato] || '';
}

window.addEventListener('online', () => Sync.syncNow({ silent: true }));
window.addEventListener('offline', () => setSyncBadge('offline'));
