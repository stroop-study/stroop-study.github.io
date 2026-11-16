// Service worker : met l'appli en cache pour qu'elle s'ouvre même sans réseau.
// Les données (cartes, progression) sont gérées hors ligne par Firestore, pas ici.
const VERSION = 'v2.14.2';
const CACHE = `stroop-${VERSION}`;
// Moteur de voix (gros fichiers qui ne changent pas) : cache séparé, gardé d'une version à l'autre.
const VENDOR = 'vendor-piper-1';
// SDK Firebase et polices hébergés dans l'appli (aucun CDN) : cache séparé, nommé d'après la version du SDK.
const VENDOR_FB = 'vendor-fb-10.12.2';
const FB_FILES = ['vendor/firebase/firebase-app.js', 'vendor/firebase/firebase-auth.js', 'vendor/firebase/firebase-firestore.js', 'vendor/firebase/firebase-messaging.js',
  'vendor/fonts/fonts.css', ...[1, 2, 3, 4, 5, 6, 7].map((i) => `vendor/fonts/f${i}.woff2`)];
const SHELL = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css',
  'js/app.js', 'js/store.js', 'js/leitner.js', 'js/types.js', 'js/recherche.js', 'js/voix.js', 'js/ecoute.js', 'js/figures.js', 'js/sons.js', 'js/notifs.js', 'js/firebase.js', 'js/firebase-config.js',
  'assets/stroop/stroop-contente.webp', 'assets/stroop/stroop-dodo.webp',
  'assets/stroop/stroop-fete.webp', 'assets/stroop/stroop-sport.webp', 'assets/stroop/stroop-etude.webp', 'assets/stroop/stroop-arcenciel.webp',
  'assets/stroop/yeux-contente.webp', 'assets/stroop/yeux-etude.webp', 'assets/stroop/yeux-sport.webp',
  'assets/icons/icon-192.png', 'assets/icons/apple-touch-icon.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(Promise.all([
    caches.open(CACHE).then((c) => c.addAll(SHELL)),
    caches.open(VENDOR_FB).then(async (c) => { for (const f of FB_FILES) if (!(await c.match(f))) await c.add(f); })
  ]).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => (k.startsWith('stroop-') && k !== CACHE) || (k.startsWith('vendor-fb-') && k !== VENDOR_FB)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Ne jamais intercepter les échanges avec Firebase (connexion, base de données).
  if (url.hostname.includes('googleapis.com')) return;
  if (url.hostname.includes('firebaseapp.com') || url.hostname.includes('identitytoolkit') || url.hostname.includes('securetoken')) return;

  const sameOrigin = url.origin === self.location.origin;
  if (!sameOrigin) return;
  if (url.pathname.includes('/vendor/firebase/') || url.pathname.includes('/vendor/fonts/')) {
    e.respondWith(caches.open(VENDOR_FB).then((c) => c.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req).then((res) => { if (res.ok) c.put(req, res.clone()); return res; }))));
    return;
  }

  if (sameOrigin && url.pathname.includes('/vendor/')) {
    e.respondWith(caches.open(VENDOR).then((c) => c.match(req).then((hit) => hit || fetch(req).then((res) => { if (res.ok) c.put(req, res.clone()); return res; }))));
    return;
  }
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
});

// ===== Notifications push (envoyées par le programme planifié via Firebase Cloud Messaging) =====
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { data: { body: e.data && e.data.text() } }; }
  const data = d.data || {};
  const title = data.title || d.notification?.title || 'Stroop Study';
  const body = data.body || d.notification?.body || '';
  e.waitUntil(self.registration.showNotification(title, {
    body, icon: 'assets/icons/icon-192.png?v=2', badge: 'assets/icons/icon-192.png?v=2',
    tag: data.tag || 'stroop', data: { url: data.url || './' }
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = new URL(e.notification.data?.url || './', self.location.href).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    for (const c of list) { if ('focus' in c) { c.navigate?.(url); return c.focus(); } }
    return self.clients.openWindow(url);
  }));
});
