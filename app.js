// app.js — avvio dell'app, navigazione tra le sezioni, impostazioni di sincronizzazione

const STORES_APP = ['clienti', 'magazzino', 'agenda'];
const ZOOM_KEY = 'tn_zoom';
const ULTIMO_BACKUP_KEY = 'tn_ultimo_backup';
// Numero di versione "umano", lo stesso che dai al file zip a ogni consegna (es. "V-2.4").
// Va aggiornato qui a ogni nuova versione pubblicata su GitHub: compare sia in Impostazioni
// (visibile a chiunque apra l'app) sia in Diagnostica, per verificare al volo se un tablet
// ha davvero scaricato l'ultima versione dopo un aggiornamento.
const APP_VERSION = 'V-3.3';

const App = {
  async init() {
    App.applyZoomSalvato();
    App.registraServiceWorker();
    App.gestisciNavigazione();
    App.gestisciImpostazioni();
    App.gestisciSincronizzaManuale();
    App.aggiornaStatoConnessione();
    window.addEventListener('online', App.aggiornaStatoConnessione);
    window.addEventListener('offline', App.aggiornaStatoConnessione);

    await Clienti.init();
    await Agenda.init();
    await Magazzino.init();
    Promemoria.init();
    App.gestisciAperturaDaNotifica();

    if (Sync.getUrl() && Sync.getSecret()) {
      Sync.syncNow({ silent: true });
    } else {
      setSyncBadge('non-configurato');
    }
    // sincronizzazione periodica leggera mentre l'app resta aperta
    setInterval(() => Sync.syncNow({ silent: true }), 5 * 60 * 1000);

    App.animazioneAvvio();
  },

  applyZoomSalvato() {
    const valore = localStorage.getItem(ZOOM_KEY) || '100';
    App.applyZoom(valore);
  },

  applyZoom(valorePercento) {
    // Non usiamo più lo "zoom" grezzo del browser (che ingrandisce l'immagine e basta,
    // a volte in modo sfocato). Cambiamo invece la dimensione di base dei caratteri:
    // testi, pulsanti, campi e icone si adattano tutti insieme in modo nitido e coerente,
    // perché in tutto il resto del foglio di stile sono espressi in proporzione a questa base.
    document.documentElement.style.fontSize = valorePercento + '%';
  },

  registraServiceWorker() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch((err) => {
        console.warn('Service worker non registrato (va bene in locale su file://):', err);
      });
      // Quando una versione più nuova dell'app prende il controllo, ricarica una sola volta
      // in automatico: così gli aggiornamenti arrivano da soli, senza dover disinstallare
      // e reinstallare nulla sul tablet.
      let giaRicaricato = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (giaRicaricato) return;
        giaRicaricato = true;
        location.reload();
      });
    }
  },

  gestisciNavigazione() {
    const tab = document.querySelectorAll('.tab-bar__voce');
    tab.forEach((btn) => {
      if (btn.dataset.azione === 'impostazioni') {
        btn.addEventListener('click', () => App.apriImpostazioni());
        return;
      }
      btn.addEventListener('click', () => App.vaiAVista(btn.dataset.vista));
    });
  },

  // Passa a una vista dato il suo nome (es. "magazzino"), simulando il tocco sulla relativa
  // scheda in basso. Usata sia dai tocchi normali sia per aprire l'app già sulla vista giusta
  // quando si tocca una notifica (es. il promemoria magazzino).
  vaiAVista(nome) {
    const tab = document.querySelectorAll('.tab-bar__voce');
    tab.forEach((b) => {
      if (!b.dataset.vista) return;
      b.classList.toggle('tab-bar__voce--attiva', b.dataset.vista === nome);
    });
    document.querySelectorAll('.vista').forEach((v) => v.classList.remove('vista--attiva'));
    const vista = document.getElementById(`vista-${nome}`);
    if (vista) vista.classList.add('vista--attiva');
  },

  // Se l'app viene aperta (o riportata in primo piano) toccando la notifica del promemoria
  // magazzino, il service worker apre l'indirizzo con #magazzino: qui la si intercetta e si
  // passa subito alla vista giusta, invece di lasciare l'utente sulla Scheda Clienti di default.
  gestisciAperturaDaNotifica() {
    if (location.hash === '#magazzino') {
      App.vaiAVista('magazzino');
      history.replaceState(null, '', location.pathname + location.search);
    }
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.vaiAVista) App.vaiAVista(event.data.vaiAVista);
      });
    }
  },

  apriImpostazioni() {
    document.getElementById('campo-zoom').value = localStorage.getItem(ZOOM_KEY) || '100';
    const versioneEl = document.getElementById('impostazioni-versione');
    if (versioneEl) versioneEl.textContent = `Versione ${APP_VERSION}`;
    App.tornaAlMenuImpostazioni(); // riparte sempre dal menu principale, mai da una sezione aperta in precedenza
    apriModal('modal-impostazioni');
  },

  // ---------- Menu Impostazioni a due livelli: elenco categorie -> dettaglio di una sola ----------

  gestisciMenuImpostazioni() {
    document.querySelectorAll('#impostazioni-menu .impostazioni-menu__voce').forEach((voce) => {
      voce.addEventListener('click', () => App.apriSezioneImpostazioni(voce.dataset.apri));
    });
    document.querySelectorAll('.impostazioni-indietro').forEach((btn) => {
      btn.addEventListener('click', () => App.tornaAlMenuImpostazioni());
    });
  },

  // Ogni sezione carica/aggiorna il proprio contenuto solo quando la si apre davvero,
  // non tutte insieme all'apertura del modal: più leggero, e coerente con l'idea di
  // "tocca per vedere cosa c'è dentro".
  apriSezioneImpostazioni(nome) {
    document.getElementById('impostazioni-menu').classList.remove('impostazioni-livello--attiva');
    const sezione = document.getElementById(`sezione-${nome}`);
    if (sezione) sezione.classList.add('impostazioni-livello--attiva');

    if (nome === 'sincronizzazione') {
      App.aggiornaRiassuntoSync();
      document.getElementById('sync-editor').hidden = true;
      document.getElementById('sync-riassunto').hidden = false;
    } else if (nome === 'listino') {
      listinoBloccato = true; // si riapre sempre bloccato, va sbloccato apposta ogni volta
      renderListino();
    } else if (nome === 'diagnostica') {
      App.renderDiagnostica();
    } else if (nome === 'promemoria') {
      Promemoria._aggiornaStatoSezione();
    } else if (nome === 'backup') {
      App._aggiornaTestoUltimoBackup();
    }
  },

  tornaAlMenuImpostazioni() {
    document.querySelectorAll('.impostazioni-livello').forEach((l) => l.classList.remove('impostazioni-livello--attiva'));
    document.getElementById('impostazioni-menu').classList.add('impostazioni-livello--attiva');
    App.aggiornaValoriMenuImpostazioni();
  },

  // Le piccole anteprime accanto a ciascuna voce del menu (es. "Normale", "Configurata"),
  // così si vede a colpo d'occhio lo stato senza dover entrare in ogni sezione.
  aggiornaValoriMenuImpostazioni() {
    const zoomEl = document.getElementById('menu-valore-zoom');
    if (zoomEl) {
      const etichette = { '100': 'Normale', '110': 'Grande', '120': 'Molto grande' };
      zoomEl.textContent = etichette[localStorage.getItem(ZOOM_KEY) || '100'] || 'Normale';
    }
    const syncEl = document.getElementById('menu-valore-sync');
    if (syncEl) {
      syncEl.textContent = (Sync.getUrl() && Sync.getSecret()) ? 'Configurata' : 'Non configurata';
    }
    Promemoria._aggiornaValoreMenu();
  },

  // ---------- Diagnostica ----------

  async raccogliDiagnostica() {
    const [clienti, magazzino, agenda, pendClienti, pendMagazzino, pendAgenda] = await Promise.all([
      DB.getAll('clienti'), DB.getAll('magazzino'), DB.getAll('agenda'),
      DB.getPending('clienti'), DB.getPending('magazzino'), DB.getPending('agenda')
    ]);

    let cacheAttiva = '—';
    try {
      if ('caches' in window) {
        const chiavi = await caches.keys();
        cacheAttiva = chiavi.length ? chiavi.join(', ') : 'nessuna';
      }
    } catch { /* non critico: si lascia il valore di default */ }

    let spazioOccupato = '—';
    try {
      if (navigator.storage && navigator.storage.estimate) {
        const stima = await navigator.storage.estimate();
        const usatiMB = ((stima.usage || 0) / (1024 * 1024)).toFixed(1);
        const quotaMB = ((stima.quota || 0) / (1024 * 1024)).toFixed(0);
        spazioOccupato = `${usatiMB} MB usati su ~${quotaMB} MB disponibili`;
      }
    } catch { /* non critico */ }

    const ultimaSync = Sync.getLastSync();
    const ultimoErrore = Sync.getLastError();

    return {
      'Versione app': APP_VERSION,
      'Cache attiva': cacheAttiva,
      'Service worker': (navigator.serviceWorker && navigator.serviceWorker.controller) ? 'Attivo' : 'Non attivo',
      'Connessione': navigator.onLine ? 'Online' : 'Offline',
      'Indirizzo di sincronizzazione': Sync.getUrl() ? 'Configurato' : 'Non configurato',
      'Chiave di sincronizzazione': Sync.getSecret() ? 'Impostata' : 'Non impostata',
      'Ultima sincronizzazione riuscita': ultimaSync ? App._fmtDataOra(ultimaSync) : 'Mai',
      'Ultimo errore di sincronizzazione': ultimoErrore ? `${ultimoErrore.messaggio} (${App._fmtDataOra(ultimoErrore.quando)})` : 'Nessuno',
      'Clienti salvati': `${clienti.length} (${pendClienti.length} da sincronizzare)`,
      'Prodotti in magazzino': `${magazzino.length} (${pendMagazzino.length} da sincronizzare)`,
      'Appuntamenti in agenda': `${agenda.length} (${pendAgenda.length} da sincronizzare)`,
      'Spazio occupato sul dispositivo': spazioOccupato
    };
  },

  _fmtDataOra(iso) {
    const d = new Date(iso);
    return `${d.toLocaleDateString('it-IT')} ${d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}`;
  },

  async renderDiagnostica() {
    const contenitore = document.getElementById('diagnostica-griglia');
    if (!contenitore) return;
    const dati = await App.raccogliDiagnostica();
    contenitore.innerHTML = Object.entries(dati).map(([etichetta, valore]) => `
      <div class="diagnostica-riga">
        <span class="diagnostica-riga__etichetta">${escapeHtml(etichetta)}</span>
        <span class="diagnostica-riga__valore">${escapeHtml(String(valore))}</span>
      </div>
    `).join('');
  },

  aggiornaRiassuntoSync() {
    const url = Sync.getUrl();
    const secret = Sync.getSecret();
    const ultima = Sync.getLastSync();
    let testo;
    if (!url || !secret) {
      testo = 'Non configurata';
    } else {
      testo = 'Configurata';
      if (ultima) {
        const d = new Date(ultima);
        testo += ` · ultima sincronizzazione ${d.toLocaleDateString('it-IT')} ${d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}`;
      }
    }
    document.getElementById('sync-riassunto-testo').textContent = testo;
  },

  gestisciImpostazioni() {
    App.gestisciMenuImpostazioni();

    document.getElementById('btn-chiudi-impostazioni').addEventListener('click', () => {
      chiudiModal('modal-impostazioni');
    });

    // Dimensione dell'app: in primo piano e senza bisogno di un pulsante "Salva" a parte,
    // si applica e si salva subito appena si sceglie.
    document.getElementById('campo-zoom').addEventListener('change', (e) => {
      App.applyZoom(e.target.value);
      localStorage.setItem(ZOOM_KEY, e.target.value);
      App.aggiornaValoriMenuImpostazioni();
    });

    // ---- Sincronizzazione: indirizzo e chiave protetti, vanno sbloccati apposta ----
    document.getElementById('btn-sblocca-sync').addEventListener('click', () => {
      document.getElementById('campo-url-sync').value = Sync.getUrl();
      document.getElementById('campo-secret-sync').value = Sync.getSecret();
      document.getElementById('sync-riassunto').hidden = true;
      document.getElementById('sync-editor').hidden = false;
    });
    document.getElementById('btn-annulla-sync').addEventListener('click', () => {
      document.getElementById('sync-editor').hidden = true;
      document.getElementById('sync-riassunto').hidden = false;
    });
    document.getElementById('btn-salva-sync').addEventListener('click', () => {
      const url = document.getElementById('campo-url-sync').value.trim();
      const secret = document.getElementById('campo-secret-sync').value.trim();
      Sync.setUrl(url);
      Sync.setSecret(secret);
      document.getElementById('sync-editor').hidden = true;
      document.getElementById('sync-riassunto').hidden = false;
      App.aggiornaRiassuntoSync();
      App.aggiornaValoriMenuImpostazioni();
      toast('Impostazioni di sincronizzazione salvate', 'successo');
      Sync.syncNow();
    });
    document.getElementById('btn-sync-ora').addEventListener('click', async () => {
      await Sync.syncNow();
      App.aggiornaRiassuntoSync();
    });

    // ---- Listino prezzi: protetto, va sbloccato apposta per modificarlo ----
    document.getElementById('btn-sblocca-listino').addEventListener('click', () => {
      listinoBloccato = !listinoBloccato;
      renderListino();
    });

    document.getElementById('btn-stampa-listino').addEventListener('click', () => stampaListino());

    // ---- Diagnostica: azioni di manutenzione (solo se il blocco è visibile) ----
    document.getElementById('btn-diagnostica-risync').addEventListener('click', async () => {
      Sync.forzaRisincronizzazioneCompleta();
      toast('Risincronizzazione completa avviata…', 'info');
      await Sync.syncNow();
      App.aggiornaRiassuntoSync();
      App.renderDiagnostica();
    });
    document.getElementById('btn-diagnostica-copia').addEventListener('click', async () => {
      const dati = await App.raccogliDiagnostica();
      const testo = Object.entries(dati).map(([etichetta, valore]) => `${etichetta}: ${valore}`).join('\n');
      try {
        await navigator.clipboard.writeText(testo);
        toast('Diagnostica copiata negli appunti', 'successo');
      } catch {
        toast('Non sono riuscito a copiare automaticamente: seleziona e copia a mano', 'errore');
      }
    });

    // ---- Backup: un file scaricabile con una copia di tutti i dati ----
    document.getElementById('btn-backup-scarica').addEventListener('click', () => App.scaricaBackup());
  },

  // Genera un file con una copia di tutti i dati (clienti, agenda, magazzino, ferie) e lo fa
  // scaricare al dispositivo, come rete di sicurezza in più oltre al foglio Google. Non
  // include i record cancellati: solo i dati "vivi" attualmente in uso.
  async scaricaBackup() {
    try {
      const dati = { generatoIl: new Date().toISOString(), app: 'Tulipano Nero', versione: APP_VERSION };
      for (const store of STORES) {
        dati[store] = await DB.getAll(store);
      }
      const contenuto = JSON.stringify(dati, null, 2);
      const blob = new Blob([contenuto], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const oggi = fmtDataOggi();
      const a = document.createElement('a');
      a.href = url;
      a.download = `tulipano-nero-backup-${oggi}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      localStorage.setItem(ULTIMO_BACKUP_KEY, new Date().toISOString());
      App._aggiornaTestoUltimoBackup();
      toast('Backup scaricato', 'successo');
    } catch (err) {
      console.error('Backup non riuscito', err);
      toast('Non sono riuscito a creare il backup', 'errore');
    }
  },

  _aggiornaTestoUltimoBackup() {
    const el = document.getElementById('backup-ultimo-testo');
    if (!el) return;
    const ultimo = localStorage.getItem(ULTIMO_BACKUP_KEY);
    if (!ultimo) {
      el.textContent = 'Non hai ancora scaricato nessun backup.';
      return;
    }
    const d = new Date(ultimo);
    el.textContent = `Ultimo backup scaricato: ${d.toLocaleDateString('it-IT')} alle ${d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}.`;
  },

  aggiornaStatoConnessione() {
    const el = document.getElementById('stato-connessione');
    if (navigator.onLine) {
      el.textContent = 'Online';
      el.className = 'stato-connessione stato-connessione--online';
      if (Sync.getUrl() && Sync.getSecret()) Sync.syncNow({ silent: true });
    } else {
      el.textContent = 'Offline';
      el.className = 'stato-connessione stato-connessione--offline';
    }
  },

  animazioneAvvio() {
    const splash = document.getElementById('splash');
    if (!splash) return;
    setTimeout(() => splash.classList.add('splash--nascosto'), 700);
    setTimeout(() => splash.remove(), 1400);
  },

  // Sostituisce lo scorrimento "trascina per sincronizzare" (comodo ma facilmente scambiato
  // per un semplice tentativo di scorrere la pagina) con un tasto sempre visibile in alto:
  // lo scorrimento resta libero di servire solo a muoversi dentro l'app.
  gestisciSincronizzaManuale() {
    const btn = document.getElementById('btn-sincronizza');
    if (!btn) return;
    btn.addEventListener('click', async () => {
      if (btn.classList.contains('icon-btn--girando')) return; // evita doppie sincronizzazioni se si tocca più volte di fretta
      btn.classList.add('icon-btn--girando');
      await Sync.syncNow({ silent: false });
      btn.classList.remove('icon-btn--girando');
    });
  }
};

document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
