// Service Worker Tulipano Nero
// Mette in cache l'app (HTML/CSS/JS/icone) così si apre e funziona anche senza internet.
const CACHE_VERSION = 'tulipano-nero-v34';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/db.js',
  './js/utils.js',
  './js/sync.js',
  './js/listino.js',
  './js/clienti.js',
  './js/agenda.js',
  './js/magazzino.js',
  './js/promemoria.js',
  './js/app.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './logo/logo-icona.png',
  './logo/logo-completo.png',
  './fonts/atkinson-hyperlegible-next-latin-400-normal.woff2',
  './fonts/atkinson-hyperlegible-next-latin-700-normal.woff2'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Strategia "stale-while-revalidate": risponde SUBITO con la copia in cache (veloce,
// funziona offline), ma in parallelo scarica sempre la versione più recente e la salva
// per la prossima volta. Così, anche se un aggiornamento futuro dell'app dimenticasse
// di cambiare CACHE_VERSION, i file si aggiornano comunque da soli entro un paio di aperture,
// invece di restare bloccati per sempre su una versione vecchia.
// Le chiamate verso Google Apps Script (rete) restano escluse: le gestisce sync.js.
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return; // lascia passare le chiamate esterne (Google Sheets)
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.open(CACHE_VERSION).then(async (cache) => {
      const cached = await cache.match(event.request);
      const fetchAggiornamento = fetch(event.request)
        .then((response) => {
          if (response && response.ok) cache.put(event.request, response.clone());
          return response;
        })
        .catch(() => cached);
      return cached || fetchAggiornamento;
    })
  );
});

// Tocco sulla notifica del promemoria magazzino: se l'app è già aperta in una scheda, la
// porta in primo piano e le dice di passare alla vista Magazzino; altrimenti ne apre una
// nuova già su quella vista (vedi App.gestisciAperturaDaNotifica in app.js).
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const vista = (event.notification.data && event.notification.data.vista) || null;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((elenco) => {
      for (const client of elenco) {
        if ('focus' in client) {
          client.focus();
          if (vista) client.postMessage({ vaiAVista: vista });
          return;
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(vista ? `./#${vista}` : './');
      }
    })
  );
});
