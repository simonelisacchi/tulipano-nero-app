// agenda.js — Agenda a griglia, in stile agenda cartacea:
// colonna oraria a sinistra (7:00-20:30 ogni 30 minuti) + 3 colonne per accostare più clienti nello stesso orario.

const ORE_AGENDA = generaOrari('07:00', '20:30', 30);
const NUM_COLONNE_AGENDA = 3;

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
  dataSelezionata: fmtDataOggi(),
  modalitaVista: 'giorno',
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
    const clienti = await DB.getAll('clienti');

    const label = document.getElementById('agenda-data-label');
    const d = new Date(Agenda.dataSelezionata + 'T00:00:00');
    const testoData = d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
    label.textContent = testoData.charAt(0).toUpperCase() + testoData.slice(1);

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
              data-id="${a.id}" role="button" aria-label="Tieni premuto per segnare come completato" title="Tieni premuto per segnare come completato">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7"/></svg>
        </span>
      `;
      blocco.addEventListener('click', () => Agenda.apriForm(a.id));
      Agenda._collegaPressioneLunga(blocco.querySelector('.agenda-blocco__spunta'), a.id);
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

  apriForm(id, presetti = {}) {
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

  // Gesto "tieni premuto" per cambiare lo stato dell'appuntamento: volutamente più lento
  // di un semplice tocco, così non capita per sbaglio scorrendo o toccando la griglia.
  // Un anello che si riempie durante la pressione mostra quanto manca.
  _collegaPressioneLunga(elemento, id) {
    const DURATA_MS = 550;
    let timer = null;
    let completata = false;

    const avvia = (e) => {
      e.stopPropagation();
      completata = false;
      elemento.classList.add('agenda-blocco__spunta--in-pressione');
      timer = setTimeout(() => {
        completata = true;
        elemento.classList.remove('agenda-blocco__spunta--in-pressione');
        elemento.classList.add('agenda-blocco__spunta--completata');
        setTimeout(() => elemento.classList.remove('agenda-blocco__spunta--completata'), 250);
        Agenda.toggleStato(id);
      }, DURATA_MS);
    };

    const annulla = (e) => {
      e.stopPropagation();
      clearTimeout(timer);
      elemento.classList.remove('agenda-blocco__spunta--in-pressione');
    };

    elemento.addEventListener('touchstart', avvia, { passive: false });
    elemento.addEventListener('touchend', annulla);
    elemento.addEventListener('touchmove', annulla);
    elemento.addEventListener('touchcancel', annulla);
    elemento.addEventListener('mousedown', avvia);
    elemento.addEventListener('mouseup', annulla);
    elemento.addEventListener('mouseleave', annulla);
    // Un tocco breve non deve fare nulla (né aprire il modale sottostante).
    elemento.addEventListener('click', (e) => e.stopPropagation());
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

  async _renderMese() {
    Agenda.cache = await DB.getAll('agenda');
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
      return `
        <button type="button" class="agenda-mese-griglia__cella ${eOggi ? 'agenda-mese-griglia__cella--oggi' : ''}" data-iso="${iso}">
          <span>${g}</span>
          ${haAppuntamenti ? '<span class="agenda-mese-griglia__pallino"></span>' : ''}
        </button>
      `;
    }).join('');

    griglia.querySelectorAll('[data-iso]').forEach((cella) => {
      cella.addEventListener('click', () => {
        Agenda.dataSelezionata = cella.dataset.iso;
        document.getElementById('agenda-data').value = cella.dataset.iso;
        Agenda.mostraGiorno();
      });
    });
  }
};
