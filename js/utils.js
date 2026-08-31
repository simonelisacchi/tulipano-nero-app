// utils.js — piccole funzioni condivise tra i moduli

// Formatta una Data come AAAA-MM-GG usando il fuso orario LOCALE del dispositivo — mai UTC.
// È importante vicino alla mezzanotte: l'Italia è avanti rispetto a UTC (1 o 2 ore, a seconda
// della stagione), quindi usare toISOString() (che è sempre in UTC) farebbe risultare "ieri"
// per un'ora o due dopo la mezzanotte locale — esattamente il momento in cui l'Agenda mostra
// il giorno sbagliato se non si sta attenti a questo dettaglio.
function formatDataLocale(d) {
  const anno = d.getFullYear();
  const mese = String(d.getMonth() + 1).padStart(2, '0');
  const giorno = String(d.getDate()).padStart(2, '0');
  return `${anno}-${mese}-${giorno}`;
}

function fmtDataOggi() {
  return formatDataLocale(new Date());
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function debounce(fn, wait) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

// Ricerca "per parole": ogni parola scritta deve trovarsi da qualche parte nel testo,
// in qualsiasi ordine. Così "Rossi Maria" e "Maria Rossi" trovano lo stesso risultato.
function corrispondeRicerca(testoCompleto, query) {
  if (!query) return true;
  const parole = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const testo = testoCompleto.toLowerCase();
  return parole.every((parola) => testo.includes(parola));
}

function toast(msg, type = 'info') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `toast toast--${type} toast--visible`;
  clearTimeout(toast._t);
  // I messaggi di errore restano più a lungo (spesso spiegano esattamente cosa correggere,
  // meglio avere tempo di leggerli o fare uno screenshot).
  const durata = type === 'errore' ? 9000 : (msg.length > 60 ? 6000 : 2600);
  toast._t = setTimeout(() => {
    el.classList.remove('toast--visible');
  }, durata);
}

function apriModal(id) {
  document.getElementById(id).classList.add('modal--aperto');
}

function chiudiModal(id) {
  document.getElementById(id).classList.remove('modal--aperto');
}

function initialsOf(nome, cognome) {
  const a = (nome || '').trim()[0] || '';
  const b = (cognome || '').trim()[0] || '';
  return (a + b).toUpperCase() || '?';
}

// Porta in maiuscolo la prima lettera di ogni parola di un nome (il resto in minuscolo) — utile
// perché chi scrive di fretta su un tablet spesso lascia tutto minuscolo o tutto maiuscolo.
// Gestisce anche i nomi composti: spazi ("de rossi" -> "De Rossi"), trattini ("anna-maria" ->
// "Anna-Maria") e apostrofi ("d'angelo" -> "D'Angelo").
function capitalizzaNome(testo) {
  if (!testo) return testo;
  return testo.trim().replace(/\s+/g, ' ').split(' ').map((parola) => parola
    .split('-').map((parte) => parte
      .split("'").map((sotto) => sotto ? sotto.charAt(0).toUpperCase() + sotto.slice(1).toLowerCase() : sotto)
      .join("'"))
    .join('-'))
    .join(' ');
}

// Applica capitalizzaNome quando si lascia il campo (non mentre si scrive, per non
// "combattere" col dito sul tablet mentre il cognome è ancora a metà).
function autoCapitalizzaSuUscita(input) {
  if (!input) return;
  input.addEventListener('blur', () => {
    input.value = capitalizzaNome(input.value);
  });
}
