// clienti.js — Scheda Clienti

const Clienti = {
  cache: [],
  filtro: '',

  async init() {
    document.getElementById('btn-aggiungi-cliente').addEventListener('click', () => Clienti.apriForm());
    document.getElementById('form-cliente').addEventListener('submit', Clienti.onSubmit);
    document.getElementById('btn-annulla-cliente').addEventListener('click', () => chiudiModal('modal-cliente'));
    autoCapitalizzaSuUscita(document.querySelector('#form-cliente [name="cognome"]'));
    autoCapitalizzaSuUscita(document.querySelector('#form-cliente [name="nome"]'));
    document.getElementById('cerca-clienti').addEventListener('input', debounce((e) => {
      Clienti.filtro = e.target.value.trim().toLowerCase();
      Clienti.render();
    }, 200));
    await Clienti.render();
  },

  async render() {
    Clienti.cache = await DB.getAll('clienti');
    const lista = Clienti.cache
      .filter((c) => {
        if (!Clienti.filtro) return true;
        const testo = `${c.nome} ${c.cognome} ${c.telefono || ''} ${c.email || ''}`;
        return corrispondeRicerca(testo, Clienti.filtro);
      })
      .sort((a, b) => (a.cognome || '').localeCompare(b.cognome || '', 'it'));

    const contenitore = document.getElementById('lista-clienti');

    if (lista.length === 0) {
      contenitore.innerHTML = Clienti.filtro
        ? emptyState('Nessun cliente trovato', 'Prova con un altro nome o numero di telefono.')
        : emptyState('Nessun cliente ancora', 'Tocca "Aggiungi cliente" per creare la prima scheda.');
      return;
    }

    contenitore.innerHTML = lista.map((c) => `
      <div class="scheda-cliente">
        <div class="scheda-cliente__intestazione">
          <span class="avatar-iniziali">${initialsOf(c.nome, c.cognome)}</span>
          <span class="scheda-cliente__nome">${escapeHtml(c.cognome)} ${escapeHtml(c.nome)}</span>
        </div>
        <dl class="scheda-cliente__dati">
          <div class="scheda-cliente__campo"><dt>Telefono</dt><dd>${escapeHtml(c.telefono || '—')}</dd></div>
          <div class="scheda-cliente__campo"><dt>Email</dt><dd>${escapeHtml(c.email || '—')}</dd></div>
          <div class="scheda-cliente__campo"><dt>Trattamento</dt><dd>${escapeHtml(c.trattamento || '—')}</dd></div>
          <div class="scheda-cliente__campo"><dt>Note</dt><dd>${escapeHtml(c.note || '—')}</dd></div>
        </dl>
        <div class="scheda-cliente__azioni">
          <button type="button" class="btn btn--secondario btn--piccolo" data-azione="modifica" data-id="${c.id}">Modifica</button>
        </div>
      </div>
    `).join('');

    contenitore.querySelectorAll('[data-azione="modifica"]').forEach((el) => {
      el.addEventListener('click', () => Clienti.apriForm(el.dataset.id));
    });
  },

  apriForm(id) {
    const form = document.getElementById('form-cliente');
    form.reset();
    form.elements['id'].value = '';
    document.getElementById('modal-cliente-titolo').textContent = id ? 'Modifica cliente' : 'Aggiungi cliente';
    document.getElementById('btn-elimina-cliente').style.display = id ? 'inline-flex' : 'none';

    if (id) {
      const c = Clienti.cache.find((x) => x.id === id);
      if (c) {
        form.elements['id'].value = c.id;
        form.elements['cognome'].value = c.cognome || '';
        form.elements['nome'].value = c.nome || '';
        form.elements['telefono'].value = c.telefono || '';
        form.elements['email'].value = c.email || '';
        form.elements['trattamento'].value = c.trattamento || '';
        form.elements['note'].value = c.note || '';
      }
    }
    apriModal('modal-cliente');
  },

  async onSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const record = {
      id: form.elements['id'].value || undefined,
      cognome: form.elements['cognome'].value.trim(),
      nome: form.elements['nome'].value.trim(),
      telefono: form.elements['telefono'].value.trim(),
      email: form.elements['email'].value.trim(),
      trattamento: form.elements['trattamento'].value.trim(),
      note: form.elements['note'].value.trim()
    };
    if (!record.cognome || !record.nome) {
      toast('Cognome e nome sono obbligatori', 'errore');
      return;
    }
    await DB.save('clienti', record);
    chiudiModal('modal-cliente');
    await Clienti.render();
    toast('Cliente salvato', 'successo');
    Sync.syncNow({ silent: true });
  },

  async elimina() {
    const id = document.getElementById('form-cliente').elements['id'].value;
    if (!id) return;
    const c = Clienti.cache.find((x) => x.id === id);
    const nomeCompleto = c ? `${c.cognome} ${c.nome}` : 'questo cliente';
    if (!confirm(`Eliminare la scheda di ${nomeCompleto}? L'operazione non è reversibile su questo tablet.`)) return;
    await DB.remove('clienti', id);
    chiudiModal('modal-cliente');
    await Clienti.render();
    toast('Cliente eliminato', 'info');
    Sync.syncNow({ silent: true });
  }
};

function emptyState(titolo, sottotitolo) {
  return `
    <div class="stato-vuoto">
      <img src="logo/logo-icona.png" alt="" class="stato-vuoto__tulipano">
      <p class="stato-vuoto__titolo">${titolo}</p>
      <p class="stato-vuoto__sottotitolo">${sottotitolo}</p>
    </div>
  `;
}
