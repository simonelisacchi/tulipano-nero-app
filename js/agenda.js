// agenda.js — Agenda a griglia, in stile agenda cartacea:
// colonna oraria a sinistra (7:00-20:30 ogni 30 minuti) + 3 colonne per accostare più clienti nello stesso orario.

const ORE_AGENDA = generaOrari('07:00', '20:30', 30);
const NUM_COLONNE_AGENDA = 3;

// Giorni della settimana chiusi per default (0 = domenica, 1 = lunedì, secondo il calendario
// JavaScript). Restano modificabili giorno per giorno tramite il pulsante "Ferie" in vista
// mese: toccando una domenica o un lunedì la si segna come eccezionalmente aperta (utile nei
// periodi di lavoro intenso), toccando un giorno normalmente aperto lo si segna come chiuso.
const GIORNI_CHIUSURA_DEFAULT = [0, 1];

// Durata per servizio, derivata dal listino prezzi (solo le voci con un tempo associato,
// cioè quelle evidenziate in azzurro nel foglio originale): si può comunque modificare a mano nel form.
const SERVIZI_DURATA = {};
LISTINO_PREZZI.filter((s) => s.minuti != null).forEach((s) => { SERVIZI_DURATA[s.servizio] = s.minuti; });

function generaOrari(inizio, fine, stepMinuti) {
  const [h0, m0] = inizio.split(':').map(Number);
  const [h1, m1] = fine.split(':').map(Number);
  let cursore = h0 * 60 + m0;
  const fineMinuti = h1 * 60 + m1;
  const elenco = [];
  while (cursore <= fineMinuti) {
    const h = String(Math.floor(cursore / 60)).padStart(2, '0');
    const m = String(cursore % 60).padStart(2, '0');
    elenco.push(`${h}:${m}`);
    cursore += stepMinuti;
  }
  return elenco;
}

function orarioInMinuti(hhmm) {
  if (!hhmm) return 0;
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

const Agenda = {
  cache: [],
  ferieCache: [],
  dataSelezionata: fmtDataOggi(),
  modalitaVista: 'giorno',
  modalitaFerie: false, // mentre è true, toccare un giorno nella vista mese ne cambia lo stato (aperto/chiuso) invece di aprirlo
  meseVisualizzato: null,
  _clientiIndex: [],

  async init() {
    Agenda._costruisciGrigliaBase();
    Agenda._popolaSelectOra();
    Agenda._popolaGrigliaServizio();

    document.getElementById('btn-aggiungi-appuntamento').addEventListener('click', () => Agenda.apriForm());
    document.getElementById('form-appuntamento').addEventListener('submit', Agenda.onSubmit);
    document.getElementById('btn-annulla-appuntamento').addEventListener('click', () => chiudiModal('modal-appuntamento'));

    document.getElementById('agenda-data').value = Agenda.dataSelezionata;
    document.getElementById('agenda-data').addEventListener('change', (e) => {
      Agenda.dataSelezionata = e.target.value;
      Agenda.render();
    });
    document.getElementById('agenda-prev').addEventListener('click', () => Agenda.spostaGiorno(-1));
    document.getElementById('agenda-next').addEventListener('click', () => Agenda.spostaGiorno(1));
    document.getElementById('agenda-oggi').addEventListener('click', () => {
      Agenda.dataSelezionata = fmtDataOggi();
      document.getElementById('agenda-data').value = Agenda.dataSelezionata;
      Agenda.render();
      setTimeout(() => Agenda._scorriAOraAttuale(), 50);
    });

    document.getElementById('agenda-vedi-mese').addEventListener('click', () => Agenda.mostraMese());
    document.getElementById('agenda-vedi-giorno').addEventListener('click', () => Agenda.mostraGiorno());
    document.getElementById('mese-prev').addEventListener('click', () => Agenda.spostaMese(-1));
    document.getElementById('mese-next').addEventListener('click', () => Agenda.spostaMese(1));
    document.getElementById('btn-ferie').addEventListener('click', () => Agenda._toggleModalitaFerie());

    document.getElementById('btn-cerca-appuntamento').addEventListener('click', () => Agenda._apriRicerca());
    document.getElementById('ricerca-agenda-input').addEventListener('input', debounce(() => Agenda._renderRicerca(), 200));

    const d = new Date(Agenda.dataSelezionata + 'T00:00:00');
    Agenda.meseVisualizzato = { anno: d.getFullYear(), mese: d.getMonth() };

    await Agenda.render();

    // Riga che segna l'ora attuale: si aggiorna da sola ogni minuto mentre l'app resta aperta.
    setInterval(() => Agenda._aggiornaOraAttuale(), 60 * 1000);
    if (Agenda.dataSelezionata === fmtDataOggi()) {
      Agenda._scorriAOraAttuale();
    }

    // Al primo avvio la vista Agenda è nascosta (si vede prima "Clienti"): in quel momento
    // le misure sono a zero. Ricalcola quando l'utente apre davvero la scheda Agenda, e
    // riporta sempre in vista l'orario attuale, così è sempre a portata d'occhio.
    const tabAgenda = document.querySelector('.tab-bar__voce[data-vista="agenda"]');
    if (tabAgenda) {
      tabAgenda.addEventListener('click', () => {
        Agenda._aggiornaOraAttuale();
        if (Agenda.modalitaVista === 'giorno' && Agenda.dataSelezionata === fmtDataOggi()) {
          setTimeout(() => Agenda._scorriAOraAttuale(), 50);
        }
      });
    }
  },

  _aggiornaOraAttuale() {
    const linea = document.getElementById('agenda-adesso');
    if (!linea) return;

    document.querySelectorAll('.agenda-griglia__ora--adesso').forEach((el) => el.classList.remove('agenda-griglia__ora--adesso'));

    if (Agenda.dataSelezionata !== fmtDataOggi()) {
      linea.style.display = 'none';
      return;
    }

    const adesso = new Date();
    const minutiAdesso = adesso.getHours() * 60 + adesso.getMinutes();
    const inizio = orarioInMinuti(ORE_AGENDA[0]);
    const fine = orarioInMinuti(ORE_AGENDA[ORE_AGENDA.length - 1]);
    if (minutiAdesso < inizio || minutiAdesso > fine + 30) {
      linea.style.display = 'none';
      return;
    }

    const primaEtichetta = document.querySelector('.agenda-griglia__ora');
    if (!primaEtichetta) return;
    const altezzaRiga = primaEtichetta.getBoundingClientRect().height + 1; // +1 per la linea di separazione tra righe
    const indiceRigaFloat = (minutiAdesso - inizio) / 30;
    linea.style.top = `${indiceRigaFloat * altezzaRiga}px`;
    linea.style.display = 'block';

    // evidenzia anche l'etichetta della mezz'ora corrente
    const minutiArrotondati = Math.floor(minutiAdesso / 30) * 30;
    const h = String(Math.floor(minutiArrotondati / 60)).padStart(2, '0');
    const m = String(minutiArrotondati % 60).padStart(2, '0');
    const etichetta = document.querySelector(`.agenda-griglia__ora[data-ora="${h}:${m}"]`);
    if (etichetta) etichetta.classList.add('agenda-griglia__ora--adesso');
  },

  _scorriAOraAttuale() {
    const linea = document.getElementById('agenda-adesso');
    if (!linea || linea.style.display === 'none') return;
    linea.scrollIntoView({ block: 'center', behavior: 'smooth' });
  },

  spostaGiorno(delta) {
    const d = new Date(Agenda.dataSelezionata + 'T00:00:00');
    d.setDate(d.getDate() + delta);
    Agenda.dataSelezionata = formatDataLocale(d);
    document.getElementById('agenda-data').value = Agenda.dataSelezionata;
    Agenda.render();
  },

  mostraMese() {
    Agenda.modalitaVista = 'mese';
    Agenda.modalitaFerie = false;
    const d = new Date(Agenda.dataSelezionata + 'T00:00:00');
    Agenda.meseVisualizzato = { anno: d.getFullYear(), mese: d.getMonth() };
    document.getElementById('agenda-vista-giorno').style.display = 'none';
    document.getElementById('agenda-vista-mese').style.display = 'block';
    Agenda._renderMese();
  },

  mostraGiorno() {
    Agenda.modalitaVista = 'giorno';
    document.getElementById('agenda-vista-mese').style.display = 'none';
    document.getElementById('agenda-vista-giorno').style.display = 'block';
    Agenda.render();
  },

  spostaMese(delta) {
    let { anno, mese } = Agenda.meseVisualizzato;
    mese += delta;
    if (mese < 0) { mese = 11; anno -= 1; }
    if (mese > 11) { mese = 0; anno += 1; }
    Agenda.meseVisualizzato = { anno, mese };
    Agenda._renderMese();
  },

  async render() {
    Agenda.cache = await DB.getAll('agenda');
    Agenda.ferieCache = await DB.getAll('ferie');
    const clienti = await DB.getAll('clienti');

    const label = document.getElementById('agenda-data-label');
    const d = new Date(Agenda.dataSelezionata + 'T00:00:00');
    const testoData = d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
    label.textContent = testoData.charAt(0).toUpperCase() + testoData.slice(1);

    const grigliaGiorno = document.getElementById('agenda-griglia');
    if (grigliaGiorno) grigliaGiorno.classList.toggle('agenda-griglia--chiuso', Agenda.eGiornoChiuso(Agenda.dataSelezionata));

    const delGiorno = Agenda.cache.filter((a) => a.data === Agenda.dataSelezionata && !a.eliminato);

    document.querySelectorAll('.agenda-blocco').forEach((el) => el.remove());

    const griglia = document.getElementById('agenda-griglia');
    delGiorno.forEach((a) => {
      const indiceOra = ORE_AGENDA.indexOf(a.ora);
      if (indiceOra === -1) return;
      const spanRighe = Math.max(1, Math.round((a.durata || 30) / 30));
      const colonna = a.colonna ?? 0;

      const blocco = document.createElement('button');
      blocco.type = 'button';
      blocco.className = `agenda-blocco agenda-blocco--${a.stato || 'confermato'}`;
      blocco.style.gridColumn = String(colonna + 2);
      blocco.style.gridRow = `${indiceOra + 1} / span ${spanRighe}`;
      blocco.innerHTML = `
        <span class="agenda-blocco__nome">${escapeHtml(a.clienteNome || 'Cliente')}</span>
        ${a.servizio ? `<span class="agenda-blocco__servizio">${escapeHtml(a.servizio)}</span>` : ''}
        <span class="agenda-blocco__spunta ${a.stato === 'completato' ? 'agenda-blocco__spunta--attiva' : ''}"
              data-id="${a.id}" role="button" aria-label="Segna come completato" title="Segna come completato">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7"/></svg>
        </span>
      `;
      blocco.addEventListener('click', () => Agenda.apriForm(a.id));
      Agenda._collegaSpunta(blocco.querySelector('.agenda-blocco__spunta'), a.id);
      griglia.appendChild(blocco);
    });

    const datalist = document.getElementById('elenco-clienti-agenda');
    datalist.innerHTML = clienti.map((c) => `<option data-id="${c.id}" value="${escapeHtml(c.cognome)} ${escapeHtml(c.nome)}"></option>`).join('');
    Agenda._clientiIndex = clienti;
    Agenda._aggiornaOraAttuale();
  },

  _costruisciGrigliaBase() {
    const griglia = document.getElementById('agenda-griglia');
    let html = '';
    ORE_AGENDA.forEach((ora, i) => {
      const mezzora = ora.endsWith(':30');
      html += `<div class="agenda-griglia__ora ${mezzora ? 'agenda-griglia__ora--mezza' : ''}" style="grid-row:${i + 1}" data-ora="${ora}">${ora}</div>`;
      for (let col = 0; col < NUM_COLONNE_AGENDA; col++) {
        html += `<div class="agenda-griglia__cella" style="grid-column:${col + 2}; grid-row:${i + 1}" data-ora="${ora}" data-colonna="${col}"></div>`;
      }
    });
    html += `<div class="agenda-griglia__adesso" id="agenda-adesso"></div>`;
    griglia.innerHTML = html;
    griglia.querySelectorAll('.agenda-griglia__cella').forEach((cella) => {
      cella.addEventListener('click', () => {
        Agenda.apriForm(null, { ora: cella.dataset.ora, colonna: Number(cella.dataset.colonna) });
      });
    });
  },

  // Menu a tendina nativo per l'ora: al tocco mostra tutti gli orari in un'unica finestra,
  // il modo più affidabile su ogni telefono/tablet per scegliere rapidamente.
  _popolaSelectOra() {
    const select = document.getElementById('campo-ora');
    select.innerHTML = ORE_AGENDA.map((ora) => `<option value="${ora}">${ora}</option>`).join('');
  },

  // Griglia di bottoni per i servizi: tutti visibili subito, a colpo d'occhio, senza scorrimento.
  _popolaGrigliaServizio() {
    const contenitore = document.getElementById('servizio-griglia');
    contenitore.innerHTML = Object.keys(SERVIZI_DURATA).map((s) => `
      <button type="button" class="servizio-bottone" data-servizio="${escapeHtml(s)}">${escapeHtml(s)}</button>
    `).join('');
    contenitore.querySelectorAll('.servizio-bottone').forEach((btn) => {
      btn.addEventListener('click', () => Agenda._toggleServizio(btn.dataset.servizio));
    });
    Agenda._serviziSelezionati = [];
  },

  _toggleServizio(nome) {
    const indice = Agenda._serviziSelezionati.indexOf(nome);
    if (indice === -1) {
      Agenda._serviziSelezionati.push(nome);
    } else {
      Agenda._serviziSelezionati.splice(indice, 1);
    }
    Agenda._aggiornaListaServizio();
  },

  _impostaServiziSelezionati(elenco) {
    Agenda._serviziSelezionati = elenco.filter((s) => Object.prototype.hasOwnProperty.call(SERVIZI_DURATA, s));
    Agenda._aggiornaListaServizio();
  },

  _aggiornaListaServizio() {
    const form = document.getElementById('form-appuntamento');
    form.elements['servizio'].value = Agenda._serviziSelezionati.join(', ');
    document.querySelectorAll('.servizio-bottone').forEach((btn) => {
      btn.classList.toggle('servizio-bottone--selezionato', Agenda._serviziSelezionati.includes(btn.dataset.servizio));
    });
    // La durata è la somma dei servizi scelti; resta comunque modificabile a mano dopo.
    if (Agenda._serviziSelezionati.length > 0) {
      const totale = Agenda._serviziSelezionati.reduce((tot, s) => tot + (SERVIZI_DURATA[s] || 0), 0);
      form.elements['durata'].value = totale;
    }
  },

  async apriForm(id, presetti = {}) {
    // Solo per un NUOVO appuntamento (non quando se ne modifica uno già esistente): se il
    // giorno selezionato è segnato come chiuso, blocchiamo e chiediamo se sbloccarlo prima di
    // proseguire — così non capita di prendere un appuntamento per sbaglio in un giorno che si
    // pensava di tenere libero.
    if (!id && Agenda.eGiornoChiuso(Agenda.dataSelezionata)) {
      const d = new Date(Agenda.dataSelezionata + 'T00:00:00');
      const testoData = d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
      const etichetta = testoData.charAt(0).toUpperCase() + testoData.slice(1);
      const conferma = confirm(`${etichetta} è segnato come chiuso.\n\nVuoi sbloccarlo per aggiungere comunque un appuntamento?`);
      if (!conferma) return;
      await Agenda.toggleFerie(Agenda.dataSelezionata);
    }

    const form = document.getElementById('form-appuntamento');
    form.reset();
    form.elements['id'].value = '';
    form.elements['clienteId'].value = '';
    form.elements['colonna'].value = '';
    document.getElementById('modal-appuntamento-titolo').textContent = id ? 'Modifica appuntamento' : 'Nuovo appuntamento';
    document.getElementById('btn-elimina-appuntamento').style.display = id ? 'inline-flex' : 'none';
    apriModal('modal-appuntamento');

    if (id) {
      const a = Agenda.cache.find((x) => x.id === id);
      if (a) {
        form.elements['id'].value = a.id;
        form.elements['data'].value = a.data || Agenda.dataSelezionata;
        form.elements['ora'].value = a.ora || ORE_AGENDA[0];
        form.elements['clienteNome'].value = a.clienteNome || '';
        form.elements['clienteId'].value = a.clienteId || '';
        form.elements['durata'].value = a.durata || 30;
        form.elements['stato'].value = a.stato || 'confermato';
        form.elements['colonna'].value = (a.colonna ?? '') === '' ? '' : a.colonna;
        Agenda._impostaServiziSelezionati(a.servizio ? a.servizio.split(',').map((s) => s.trim()) : []);
      }
    } else {
      form.elements['data'].value = Agenda.dataSelezionata;
      form.elements['ora'].value = presetti.ora || ORE_AGENDA[0];
      form.elements['durata'].value = 30;
      form.elements['stato'].value = 'confermato';
      form.elements['colonna'].value = presetti.colonna !== undefined ? presetti.colonna : '';
      Agenda._impostaServiziSelezionati([]);
    }
  },

  async onSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const id = form.elements['id'].value || undefined;
    const data = form.elements['data'].value;
    const ora = form.elements['ora'].value;
    const durata = Number(form.elements['durata'].value) || 30;

    if (!data || !ora) {
      toast('Data e ora sono obbligatorie', 'errore');
      return;
    }

    const nomeInserito = form.elements['clienteNome'].value.trim();
    const match = (Agenda._clientiIndex || []).find(
      (c) => `${c.cognome} ${c.nome}`.toLowerCase() === nomeInserito.toLowerCase()
    );

    const appuntamentiStessoGiorno = Agenda.cache.filter((a) => a.data === data);
    const colonnaPreferitaRaw = form.elements['colonna'].value;
    const colonnaPreferita = colonnaPreferitaRaw === '' ? null : Number(colonnaPreferitaRaw);

    let colonna = -1;
    if (colonnaPreferita !== null && !Agenda._colonnaOccupata(appuntamentiStessoGiorno, colonnaPreferita, ora, durata, id)) {
      colonna = colonnaPreferita;
    } else {
      colonna = Agenda._trovaColonnaLibera(appuntamentiStessoGiorno, ora, durata, id);
    }

    if (colonna === -1) {
      toast('Orario al completo: ci sono già 3 appuntamenti in questa fascia oraria', 'errore');
      return;
    }

    const record = {
      id,
      data,
      ora,
      durata,
      colonna,
      clienteNome: nomeInserito,
      clienteId: match ? match.id : (form.elements['clienteId'].value || null),
      servizio: form.elements['servizio'].value,
      stato: form.elements['stato'].value
    };

    await DB.save('agenda', record);
    chiudiModal('modal-appuntamento');
    Agenda.dataSelezionata = data;
    document.getElementById('agenda-data').value = data;
    await Agenda.render();
    toast('Appuntamento salvato', 'successo');
    Sync.syncNow({ silent: true });
  },

  _colonnaOccupata(appuntamenti, colonna, ora, durata, idEscludi) {
    const inizio = orarioInMinuti(ora);
    const fine = inizio + durata;
    return appuntamenti.some((a) => {
      if (a.id === idEscludi) return false;
      if ((a.colonna ?? 0) !== colonna) return false;
      const aInizio = orarioInMinuti(a.ora);
      const aFine = aInizio + (a.durata || 30);
      return inizio < aFine && aInizio < fine;
    });
  },

  _trovaColonnaLibera(appuntamenti, ora, durata, idEscludi) {
    for (let col = 0; col < NUM_COLONNE_AGENDA; col++) {
      if (!Agenda._colonnaOccupata(appuntamenti, col, ora, durata, idEscludi)) return col;
    }
    return -1;
  },

  // Il tasto per completare l'appuntamento risponde a un semplice tocco: più adatto
  // all'uso su tablet, dove serve vedere subito il risultato. Una piccola animazione di
  // rimbalzo conferma il tocco, e il colore del blocco cambia immediatamente (vedi CSS).
  _collegaSpunta(elemento, id) {
    elemento.addEventListener('click', (e) => {
      e.stopPropagation(); // non deve aprire anche il modulo di modifica sottostante
      elemento.classList.add('agenda-blocco__spunta--completata');
      setTimeout(() => elemento.classList.remove('agenda-blocco__spunta--completata'), 250);
      Agenda.toggleStato(id);
    });
  },

  async toggleStato(id) {
    const a = Agenda.cache.find((x) => x.id === id);
    if (!a) return;
    const nuovoStato = a.stato === 'completato' ? 'confermato' : 'completato';
    await DB.save('agenda', { ...a, stato: nuovoStato });
    await Agenda.render();
    Sync.syncNow({ silent: true });
  },

  async elimina() {
    const id = document.getElementById('form-appuntamento').elements['id'].value;
    if (!id) return;
    if (!confirm('Eliminare questo appuntamento?')) return;
    await DB.remove('agenda', id);
    chiudiModal('modal-appuntamento');
    await Agenda.render();
    toast('Appuntamento eliminato', 'info');
    Sync.syncNow({ silent: true });
  },

  // Ricerca appuntamenti (passati o futuri) per nome cliente, su tutto lo storico e non solo
  // sul giorno visualizzato al momento: utile per ritrovare al volo "quando è venuta l'ultima
  // volta" o un appuntamento preso per una data lontana.
  async _apriRicerca() {
    const input = document.getElementById('ricerca-agenda-input');
    input.value = '';
    apriModal('modal-ricerca-agenda');
    await Agenda._renderRicerca();
    setTimeout(() => input.focus(), 50);
  },

  async _renderRicerca() {
    const query = document.getElementById('ricerca-agenda-input').value.trim();
    const contenitore = document.getElementById('ricerca-agenda-risultati');

    if (!query) {
      contenitore.innerHTML = `<p class="testo-aiuto" style="text-align:center;padding:24px 8px;">Scrivi il nome di un cliente per ritrovare i suoi appuntamenti, passati o futuri.</p>`;
      return;
    }

    // Lettura diretta dal database (non dalla cache del giorno) così il risultato copre
    // sempre tutto lo storico, anche se la vista giorno non è mai stata aperta su quelle date.
    const tutti = await DB.getAll('agenda');
    const risultati = tutti
      .filter((a) => corrispondeRicerca(a.clienteNome || '', query))
      .sort((a, b) => `${b.data}${b.ora}`.localeCompare(`${a.data}${a.ora}`)); // più recenti prima

    if (risultati.length === 0) {
      contenitore.innerHTML = emptyState('Nessun appuntamento trovato', 'Prova con un altro nome.');
      return;
    }

    contenitore.innerHTML = risultati.map((a) => {
      const d = new Date(a.data + 'T00:00:00');
      const giorno = String(d.getDate()).padStart(2, '0');
      const mese = d.toLocaleDateString('it-IT', { month: 'short' }).replace('.', '');
      const extra = [a.servizio, a.stato === 'completato' ? 'completato' : null].filter(Boolean).join(' · ');
      return `
        <button type="button" class="risultato-appuntamento" data-id="${a.id}">
          <span class="risultato-appuntamento__data">
            <span class="risultato-appuntamento__giorno">${giorno}</span>
            <span class="risultato-appuntamento__mese">${escapeHtml(mese)}</span>
          </span>
          <span class="risultato-appuntamento__dettagli">
            <span class="risultato-appuntamento__nome">${escapeHtml(a.clienteNome || 'Cliente')}</span>
            ${extra ? `<span class="risultato-appuntamento__extra">${escapeHtml(extra)}</span>` : ''}
          </span>
          <span class="risultato-appuntamento__ora">${escapeHtml(a.ora || '')}</span>
        </button>
      `;
    }).join('');

    contenitore.querySelectorAll('[data-id]').forEach((el) => {
      el.addEventListener('click', () => Agenda._vaiARisultato(el.dataset.id, risultati));
    });
  },

  _vaiARisultato(id, risultati) {
    const a = risultati.find((r) => r.id === id);
    if (!a) return;
    chiudiModal('modal-ricerca-agenda');
    Agenda.dataSelezionata = a.data;
    document.getElementById('agenda-data').value = a.data;
    Agenda.mostraGiorno();
  },

  async _renderMese() {
    Agenda.cache = await DB.getAll('agenda');
    Agenda.ferieCache = await DB.getAll('ferie');
    const { anno, mese } = Agenda.meseVisualizzato;

    const label = document.getElementById('mese-label');
    const nomeMese = new Date(anno, mese, 1).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
    label.textContent = nomeMese.charAt(0).toUpperCase() + nomeMese.slice(1);

    const primoGiorno = new Date(anno, mese, 1);
    const ultimoGiorno = new Date(anno, mese + 1, 0);
    const giorniNelMese = ultimoGiorno.getDate();
    const offsetIniziale = (primoGiorno.getDay() + 6) % 7; // lunedì = 0

    const celle = [];
    for (let i = 0; i < offsetIniziale; i++) celle.push(null);
    for (let g = 1; g <= giorniNelMese; g++) celle.push(g);
    while (celle.length % 7 !== 0) celle.push(null);

    const isoDiGiorno = (g) => `${anno}-${String(mese + 1).padStart(2, '0')}-${String(g).padStart(2, '0')}`;
    const oggiIso = fmtDataOggi();

    const griglia = document.getElementById('agenda-mese-griglia');
    griglia.innerHTML = celle.map((g) => {
      if (!g) return `<div class="agenda-mese-griglia__cella agenda-mese-griglia__cella--vuota"></div>`;
      const iso = isoDiGiorno(g);
      const haAppuntamenti = Agenda.cache.some((a) => a.data === iso);
      const eOggi = iso === oggiIso;
      const eChiuso = Agenda.eGiornoChiuso(iso);
      return `
        <button type="button" class="agenda-mese-griglia__cella ${eOggi ? 'agenda-mese-griglia__cella--oggi' : ''} ${eChiuso ? 'agenda-mese-griglia__cella--chiuso' : ''}" data-iso="${iso}">
          <span>${g}</span>
          ${haAppuntamenti ? '<span class="agenda-mese-griglia__pallino"></span>' : ''}
        </button>
      `;
    }).join('');

    griglia.querySelectorAll('[data-iso]').forEach((cella) => {
      cella.addEventListener('click', () => {
        if (Agenda.modalitaFerie) {
          Agenda.toggleFerie(cella.dataset.iso);
          return;
        }
        Agenda.dataSelezionata = cella.dataset.iso;
        document.getElementById('agenda-data').value = cella.dataset.iso;
        Agenda.mostraGiorno();
      });
    });
  },

  // Vero se questo giorno della settimana è chiuso per default (domenica/lunedì), a
  // prescindere da eventuali eccezioni segnate a mano.
  _eDefaultChiuso(iso) {
    const giorno = new Date(iso + 'T00:00:00').getDay();
    return GIORNI_CHIUSURA_DEFAULT.includes(giorno);
  },

  // Vero se il giorno risulta chiuso, tenendo conto sia della chiusura settimanale di default
  // sia di un'eventuale eccezione segnata a mano (che può andare in entrambe le direzioni:
  // chiudere un giorno normalmente aperto, o riaprirne uno normalmente chiuso).
  eGiornoChiuso(iso) {
    const eccezione = Agenda.ferieCache.find((f) => f.data === iso);
    if (eccezione) return eccezione.tipo === 'chiuso';
    return Agenda._eDefaultChiuso(iso);
  },

  // Attiva/disattiva la modalità "segna chiusure": mentre è attiva, toccare un giorno nella
  // vista mese ne cambia lo stato invece di aprirlo. Un tocco sul pulsante stesso per uscire.
  _toggleModalitaFerie() {
    Agenda.modalitaFerie = !Agenda.modalitaFerie;
    const btn = document.getElementById('btn-ferie');
    btn.classList.toggle('btn--attivo', Agenda.modalitaFerie);
    btn.textContent = Agenda.modalitaFerie ? 'Fatto' : 'Ferie';
    document.getElementById('agenda-ferie-aiuto').hidden = !Agenda.modalitaFerie;
  },

  // Tocca un giorno per ribaltarne lo stato rispetto al comportamento di default: un giorno
  // normalmente aperto viene segnato come chiuso (es. ferie), uno normalmente chiuso (domenica,
  // lunedì) viene segnato come eccezionalmente aperto. Toccandolo di nuovo si torna al default.
  async toggleFerie(iso) {
    const esistente = Agenda.ferieCache.find((f) => f.data === iso);
    if (esistente) {
      await DB.remove('ferie', esistente.id);
    } else {
      const tipo = Agenda._eDefaultChiuso(iso) ? 'aperto' : 'chiuso';
      await DB.save('ferie', { data: iso, tipo });
    }
    Agenda.ferieCache = await DB.getAll('ferie');

    // Aggiorna solo la vista effettivamente visibile in questo momento, non sempre entrambe.
    if (Agenda.modalitaVista === 'mese') {
      await Agenda._renderMese();
    } else if (Agenda.dataSelezionata === iso) {
      const griglia = document.getElementById('agenda-griglia');
      if (griglia) griglia.classList.toggle('agenda-griglia--chiuso', Agenda.eGiornoChiuso(iso));
    }
    Sync.syncNow({ silent: true });
  }
};
