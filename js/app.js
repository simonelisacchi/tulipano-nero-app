// app.js — avvio dell'app, navigazione tra le sezioni, impostazioni di sincronizzazione

const STORES_APP = ['clienti', 'magazzino', 'agenda'];
const ZOOM_KEY = 'tn_zoom';
// Aggiornata a ogni modifica pubblicata: utile in Diagnostica per verificare al volo se un
// tablet ha davvero scaricato l'ultima versione dopo un aggiornamento su GitHub.
const APP_VERSION = '2026.08.16';

const App = {
  async init() {
    App.applyZoomSalvato();
    App.registraServiceWorker();
    App.gestisciNavigazione();
    App.gestisciImpostazioni();
    App.gestisciPullToRefresh();
    App.aggiornaStatoConnessione();
    window.addEventListener('online', App.aggiornaStatoConnessione);
    window.addEventListener('offline', App.aggiornaStatoConnessione);

    await Clienti.init();
    await Agenda.init();
    await Magazzino.init();

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
      btn.addEventListener('click', () => {
        tab.forEach((b) => { if (b.dataset.vista) b.classList.remove('tab-bar__voce--attiva'); });
        btn.classList.add('tab-bar__voce--attiva');
        document.querySelectorAll('.vista').forEach((v) => v.classList.remove('vista--attiva'));
        document.getElementById(`vista-${btn.dataset.vista}`).classList.add('vista--attiva');
      });
    });
  },

  apriImpostazioni() {
    document.getElementById('campo-zoom').value = localStorage.getItem(ZOOM_KEY) || '100';
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

  // Sostituisce l'aggiornamento nativo del browser (che ricaricherebbe tutta la pagina,
  // costringendo a un nuovo accesso) con una sincronizzazione vera e propria dei dati.
  gestisciPullToRefresh() {
    const contenitore = document.getElementById('contenuto-principale');
    const indicatore = document.getElementById('pull-sync');
    const testoIndicatore = document.getElementById('pull-sync-testo');
    if (!contenitore || !indicatore) return;

    const SOGLIA_PX = 70;
    let inizioY = null;
    let trascinando = false;
    let sincronizzando = false;

    contenitore.addEventListener('touchstart', (e) => {
      if (contenitore.scrollTop <= 0 && !sincronizzando) {
        inizioY = e.touches[0].clientY;
        trascinando = true;
      }
    }, { passive: true });

    contenitore.addEventListener('touchmove', (e) => {
      if (!trascinando || inizioY === null) return;
      // Appena lo scorrimento normale prende il sopravvento (es. si sta scorrendo la
      // lunga griglia dell'agenda), ci si ferma subito: non deve mai intralciarlo.
      if (contenitore.scrollTop > 0) {
        trascinando = false;
        indicatore.style.height = '0px';
        return;
      }
      const delta = e.touches[0].clientY - inizioY;
      if (delta <= 0) { indicatore.style.height = '0px'; return; }
      const distanza = Math.min(delta * 0.5, 70);
      indicatore.style.height = `${distanza}px`;
      testoIndicatore.textContent = distanza >= SOGLIA_PX ? 'Rilascia per sincronizzare' : 'Trascina per sincronizzare';
    }, { passive: true });

    contenitore.addEventListener('touchend', async () => {
      if (!trascinando) return;
      const distanza = parseFloat(indicatore.style.height) || 0;
      trascinando = false;
      inizioY = null;

      if (distanza >= SOGLIA_PX && !sincronizzando) {
        sincronizzando = true;
        indicatore.classList.add('pull-sync--girando');
        testoIndicatore.textContent = 'Sincronizzazione…';
        indicatore.style.height = '50px';
        await Sync.syncNow({ silent: true });
        indicatore.style.height = '0px';
        indicatore.classList.remove('pull-sync--girando');
        sincronizzando = false;
      } else {
        indicatore.style.height = '0px';
      }
    }, { passive: true });
  }
};

document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
