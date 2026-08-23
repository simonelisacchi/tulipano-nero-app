// Service Worker Tulipano Nero
// Mette in cache l'app (HTML/CSS/JS/icone) così si apre e funziona anche senza internet.
const CACHE_VERSION = 'tulipano-nero-v41';
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

// Strategia "prima la rete": quando c'è connessione, l'app scarica sempre la versione più
// recente — quella salvata sul dispositivo (in cache) serve solo come riserva per quando sei
// offline, non più come prima scelta. È il cambio più importante di questa versione: prima,
// per quanto ben fatto un aggiornamento fosse, il tablet poteva continuare a mostrare una
// copia vecchia anche a lungo, perché quella veniva sempre preferita per primo.
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return; // lascia passare le chiamate esterne (Google Sheets)
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.ok) {
          const copia = response.clone(); // fatta subito: se si aspetta, il corpo potrebbe già essere stato letto
          caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, copia));
        }
        return response;
      })
      .catch(() => caches.open(CACHE_VERSION).then((cache) => cache.match(event.request)))
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
