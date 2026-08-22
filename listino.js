// listino.js — Listino prezzi del salone (da Servizi-Listino_prezzi.xlsx).
// Le voci con "minuti" valorizzato sono quelle evidenziate in azzurro nel foglio originale:
// sono i servizi prenotabili in Agenda, e la loro durata compila automaticamente il campo "Durata".
// Le voci senza "minuti" sono trattamenti/aggiunte extra (mostrati solo nel listino prezzi, non in Agenda).
//
// I prezzi sono modificabili direttamente nell'app (Impostazioni → Listino Prezzi): le modifiche
// restano salvate sul tablet. Il pulsante "Stampa" prepara un foglio pulito pronto per la stampante,
// senza bisogno di un file PDF a parte.

const LISTINO_PREZZI = [
  { servizio: 'Piega corta', minuti: 15, prezzo: 15 },
  { servizio: 'Piega lunga', minuti: 30, prezzo: 17 },
  { servizio: 'Piega con rituale', minuti: 45, prezzo: 25 },
  { servizio: 'Piega con argilla', minuti: 45, prezzo: 30 },
  { servizio: 'Taglio donna', minuti: 15, prezzo: 20 },
  { servizio: 'Taglio uomo', minuti: 15, prezzo: 17 },
  { servizio: 'Taglio a caldo', minuti: 30, prezzo: 30 },
  { servizio: 'Colore ritocco', minuti: 45, prezzo: 32 },
  { servizio: 'Colore senza ammoniaca', minuti: 45, prezzo: 'da 35 a 40' },
  { servizio: 'Colore 2 in 1', minuti: 45, prezzo: 50 },
  { servizio: 'Colpi di sole corti - Spatola', minuti: 60, prezzo: 35 },
  { servizio: 'Colpi di sole lunghi - Spatola', minuti: 75, prezzo: 45 },
  { servizio: 'Colpi di sole stagnola', minuti: 120, prezzo: 55 },
  { servizio: 'Contrasti', minuti: 15, prezzo: 28 },
  { servizio: 'Sfumato', minuti: 75, prezzo: 40 },
  { servizio: 'Permanente', minuti: 30, prezzo: 32 },
  { servizio: 'Ondulazione', minuti: 30, prezzo: 40 },
  { servizio: 'Keratina anti-crespo', minuti: 75, prezzo: 30 },
  { servizio: 'Keratina stirante', minuti: 180, prezzo: 'da 120 a 180' },
  { servizio: 'Shampoo specifico', minuti: null, prezzo: 3 },
  { servizio: 'Crema', minuti: null, prezzo: 3 },
  { servizio: 'Panacea', minuti: null, prezzo: 4 },
  { servizio: 'Trattamento ricostruzione', minuti: null, prezzo: 25 },
  { servizio: 'Acido ialuronico', minuti: null, prezzo: 'da 3 a 5' }
];

const LISTINO_OVERRIDE_KEY = 'tn_prezzi_listino';

function leggiPrezziSalvati() {
  try {
    return JSON.parse(localStorage.getItem(LISTINO_OVERRIDE_KEY) || '{}');
  } catch {
    return {};
  }
}

function prezzoAttuale(servizio) {
  const salvati = leggiPrezziSalvati();
  if (Object.prototype.hasOwnProperty.call(salvati, servizio)) return salvati[servizio];
  const voce = LISTINO_PREZZI.find((s) => s.servizio === servizio);
  return voce ? voce.prezzo : '';
}

function salvaPrezzo(servizio, valore) {
  const salvati = leggiPrezziSalvati();
  salvati[servizio] = valore;
  localStorage.setItem(LISTINO_OVERRIDE_KEY, JSON.stringify(salvati));
}

function formattaPrezzoStampa(valore) {
  const testo = String(valore).trim();
  if (/^\d+([.,]\d+)?$/.test(testo)) return `€${testo}`;
  const m = /^da\s+(\d+)\s+a\s+(\d+)$/i.exec(testo);
  if (m) return `€${m[1]}–${m[2]}`;
  if (testo.startsWith('€')) return testo;
  return testo;
}

// Se true (impostazione predefinita ogni volta che si apre il modal Impostazioni), i prezzi
// sono mostrati in sola lettura: serve toccare "Modifica prezzi" per poterli cambiare.
// Protegge da modifiche accidentali (un tocco distratto scorrendo la lista, per esempio).
let listinoBloccato = true;

// Righe mostrate nelle Impostazioni: in sola lettura finché non si sblocca la modifica.
function renderListino() {
  const contenitore = document.getElementById('listino-tabella');
  if (!contenitore) return;

  if (listinoBloccato) {
    contenitore.innerHTML = LISTINO_PREZZI.map((s) => `
      <div class="listino-riga">
        <span class="listino-riga__nome">${escapeHtml(s.servizio)}</span>
        <span class="listino-riga__prezzo-testo">${escapeHtml(String(prezzoAttuale(s.servizio)))}</span>
      </div>
    `).join('');
  } else {
    contenitore.innerHTML = LISTINO_PREZZI.map((s) => `
      <div class="listino-riga">
        <span class="listino-riga__nome">${escapeHtml(s.servizio)}</span>
        <input class="listino-riga__prezzo-input" type="text" inputmode="decimal"
               data-servizio="${escapeHtml(s.servizio)}" value="${escapeHtml(String(prezzoAttuale(s.servizio)))}">
      </div>
    `).join('');
    contenitore.querySelectorAll('.listino-riga__prezzo-input').forEach((input) => {
      input.addEventListener('change', () => {
        salvaPrezzo(input.dataset.servizio, input.value.trim());
        toast('Prezzo aggiornato', 'successo');
      });
    });
  }

  const btnSblocca = document.getElementById('btn-sblocca-listino');
  if (btnSblocca) btnSblocca.textContent = listinoBloccato ? 'Modifica prezzi' : 'Blocca prezzi';
  const help = document.getElementById('listino-help');
  if (help) {
    help.textContent = listinoBloccato
      ? 'I prezzi sono protetti da tocchi accidentali. Tocca "Modifica prezzi" per sbloccarli; le modifiche restano salvate sul tablet.'
      : 'Tocca un prezzo per modificarlo: resta salvato sul tablet. Tocca "Blocca prezzi" quando hai finito.';
  }
}

// Foglio nascosto usato solo al momento della stampa (vedi @media print in style.css).
// Ogni riga è alta uguale e si allunga per riempire tutta la pagina, qualunque sia il numero di servizi.
function renderListinoStampa() {
  const contenitore = document.getElementById('listino-stampa-righe');
  if (!contenitore) return;
  contenitore.innerHTML = LISTINO_PREZZI.map((s) => `
    <div class="listino-stampa__riga">
      <span class="listino-stampa__nome">${escapeHtml(s.servizio)}</span>
      <span class="listino-stampa__prezzo">${escapeHtml(formattaPrezzoStampa(prezzoAttuale(s.servizio)))}</span>
    </div>
  `).join('');
}

function stampaListino() {
  renderListinoStampa();
  window.print();
}
