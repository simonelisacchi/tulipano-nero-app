// magazzino.js — Magazzino prodotti (con avviso scorta minima, novità rispetto alla vecchia app)

const CATEGORIE_MAGAZZINO = [
  'Colore cenere', 'Colore dorato', 'Colore naturale', 'Finish', 'Lozione',
  'Maschera', 'Permanente', 'Shampoo base', 'Shampoo curativo', 'Shampoo specifico'
];

const Magazzino = {
  cache: [],
  filtro: '',

  async init() {
    const select = document.getElementById('campo-categoria');
    select.innerHTML = CATEGORIE_MAGAZZINO.map((c) => `<option value="${c}">${c}</option>`).join('');

    document.getElementById('btn-aggiungi-prodotto').addEventListener('click', () => Magazzino.apriForm());
    document.getElementById('form-prodotto').addEventListener('submit', Magazzino.onSubmit);
    document.getElementById('btn-annulla-prodotto').addEventListener('click', () => chiudiModal('modal-prodotto'));
    document.getElementById('cerca-magazzino').addEventListener('input', debounce((e) => {
      Magazzino.filtro = e.target.value.trim().toLowerCase();
      Magazzino.render();
    }, 200));
    await Magazzino.render();
  },

  async render() {
    Magazzino.cache = await DB.getAll('magazzino');
    const lista = Magazzino.cache
      .filter((p) => corrispondeRicerca(`${p.nome} ${p.categoria}`, Magazzino.filtro))
      .sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'it'));

    const scortaBassa = lista.filter((p) => p.scortaMinima && p.quantita <= p.scortaMinima);
    const avviso = document.getElementById('avviso-scorta');
    if (scortaBassa.length > 0) {
      avviso.style.display = 'flex';
      document.getElementById('avviso-scorta-testo').textContent = `${scortaBassa.length} ${scortaBassa.length > 1 ? 'prodotti' : 'prodotto'} in scorta minima`;
    } else {
      avviso.style.display = 'none';
    }

    const contenitore = document.getElementById('lista-magazzino');
    if (lista.length === 0) {
      contenitore.innerHTML = `
        <div class="stato-vuoto">
          <img src="logo/logo-icona.png" alt="" class="stato-vuoto__tulipano">
          <p class="stato-vuoto__titolo">Nessun prodotto ancora</p>
          <p class="stato-vuoto__sottotitolo">Tocca "Aggiungi prodotto" per iniziare il magazzino.</p>
        </div>`;
      return;
    }

    contenitore.innerHTML = lista.map((p) => {
      const sottoScorta = p.scortaMinima && p.quantita <= p.scortaMinima;
      const critico = p.quantita <= 1; // in esaurimento: resta l'ultima unità (o è già a zero)
      const classeStato = critico ? 'scheda-prodotto--critico' : (sottoScorta ? 'scheda-prodotto--basso' : '');
      const classeQuantita = critico ? 'scheda-prodotto__quantita--critico' : (sottoScorta ? 'scheda-prodotto__quantita--basso' : '');
      return `
        <div class="scheda-prodotto ${classeStato}">
          <div class="scheda-prodotto__intestazione">
            <span class="scheda-prodotto__nome">${escapeHtml(p.nome)}</span>
            <span class="scheda-prodotto__categoria">${escapeHtml(p.categoria || '—')}</span>
          </div>
          <div class="scheda-prodotto__quantita-controlli">
            <button type="button" class="btn-quantita" data-azione="meno" data-id="${p.id}" aria-label="Diminuisci quantità">−</button>
            <span class="scheda-prodotto__quantita ${classeQuantita}">${p.quantita}</span>
            <button type="button" class="btn-quantita" data-azione="piu" data-id="${p.id}" aria-label="Aumenta quantità">+</button>
          </div>
          <div class="scheda-prodotto__azioni">
            <button type="button" class="btn btn--secondario btn--piccolo" data-azione="modifica" data-id="${p.id}">Modifica</button>
          </div>
        </div>
      `;
    }).join('');

    contenitore.querySelectorAll('[data-azione="modifica"]').forEach((el) => {
      el.addEventListener('click', () => Magazzino.apriForm(el.dataset.id));
    });
    contenitore.querySelectorAll('[data-azione="meno"]').forEach((el) => {
      el.addEventListener('click', () => Magazzino.variaQuantita(el.dataset.id, -1));
    });
    contenitore.querySelectorAll('[data-azione="piu"]').forEach((el) => {
      el.addEventListener('click', () => Magazzino.variaQuantita(el.dataset.id, 1));
    });
  },

  apriForm(id) {
    const form = document.getElementById('form-prodotto');
    form.reset();
    form.elements['id'].value = '';
    document.getElementById('modal-prodotto-titolo').textContent = id ? 'Modifica prodotto' : 'Aggiungi prodotto';
    document.getElementById('btn-elimina-prodotto').style.display = id ? 'inline-flex' : 'none';

    if (id) {
      const p = Magazzino.cache.find((x) => x.id === id);
      if (p) {
        form.elements['id'].value = p.id;
        form.elements['nome'].value = p.nome || '';
        form.elements['categoria'].value = p.categoria || CATEGORIE_MAGAZZINO[0];
        form.elements['quantita'].value = p.quantita ?? 0;
        form.elements['scortaMinima'].value = p.scortaMinima ?? '';
      }
    } else {
      form.elements['scortaMinima'].value = 3;
    }
    apriModal('modal-prodotto');
  },

  async onSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const record = {
      id: form.elements['id'].value || undefined,
      nome: form.elements['nome'].value.trim(),
      categoria: form.elements['categoria'].value,
      quantita: Number(form.elements['quantita'].value) || 0,
      scortaMinima: form.elements['scortaMinima'].value ? Number(form.elements['scortaMinima'].value) : null
    };
    if (!record.nome) {
      toast('Il nome del prodotto è obbligatorio', 'errore');
      return;
    }
    await DB.save('magazzino', record);
    chiudiModal('modal-prodotto');
    await Magazzino.render();
    toast('Prodotto salvato', 'successo');
    Sync.syncNow({ silent: true });
  },

  async elimina() {
    const id = document.getElementById('form-prodotto').elements['id'].value;
    if (!id) return;
    const p = Magazzino.cache.find((x) => x.id === id);
    const nome = p ? p.nome : 'questo prodotto';
    if (!confirm(`Eliminare "${nome}" dal magazzino?`)) return;
    await DB.remove('magazzino', id);
    chiudiModal('modal-prodotto');
    await Magazzino.render();
    toast('Prodotto eliminato', 'info');
    Sync.syncNow({ silent: true });
  },

  // Scorciatoie rapide +1/-1 per l'uso quotidiano (scarico prodotto durante un servizio)
  async variaQuantita(id, delta) {
    const p = Magazzino.cache.find((x) => x.id === id);
    if (!p) return;
    const nuovaQuantita = Math.max(0, (p.quantita || 0) + delta);
    await DB.save('magazzino', { ...p, quantita: nuovaQuantita });
    await Magazzino.render();
    Sync.syncNow({ silent: true });
  }
};
