// Service worker : met l'appli en cache pour qu'elle s'ouvre même sans réseau.
// Les données (cartes, progression) sont gérées hors ligne par Firestore, pas ici.
const VERSION = 'v2.0.0';
const CACHE = `stroop-${VERSION}`;
const SHELL = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css',
  'js/app.js', 'js/store.js', 'js/leitner.js', 'js/types.js', 'js/firebase.js', 'js/firebase-config.js',
  'assets/stroop/stroop-contente.webp', 'assets/stroop/stroop-dodo.webp',
  'assets/stroop/stroop-fete.webp', 'assets/stroop/stroop-sport.webp', 'assets/stroop/stroop-etude.webp',
  'assets/icons/icon-192.png', 'assets/icons/apple-touch-icon.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('stroop-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Ne jamais intercepter les échanges avec Firebase (connexion, base de données).
  if (url.hostname.includes('googleapis.com') && !url.hostname.startsWith('fonts.')) return;
  if (url.hostname.includes('firebaseapp.com') || url.hostname.includes('identitytoolkit') || url.hostname.includes('securetoken')) return;

  const sameOrigin = url.origin === self.location.origin;
  const cacheable = sameOrigin || url.hostname === 'www.gstatic.com' || url.hostname.startsWith('fonts.');
  if (!cacheable) return;

  // Réseau d'abord pour l'appli (pour recevoir les mises à jour), cache si hors ligne.
  if (sameOrigin) {
    e.respondWith(
      fetch(req).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
        return res;
      }).catch(() => caches.match(req).then((r) => r || caches.match('index.html')))
    );
    return;
  }
  // Cache d'abord pour les bibliothèques et les polices (elles ne changent pas).
  e.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok || res.type === 'opaque') { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    }))
  );
});
