// Service worker — app shell cache only.
// Versioned cache name is stamped by deploy.bat on every deploy so browsers
// pick up new assets without manual cache-clearing.
const CACHE = 'seinfeld-2026-05-29T08:58:10Z';
const SHELL = [
  './',
  './index.html',
  './css/styles.css',
  './css/animations.css',
  './css/textures.css',
  './js/app.js',
  './js/animationPicker.js',
  './js/auth.js',
  './js/calendar.js',
  './js/chainAnimations.js',
  './js/chainBuild.js',
  './js/chainPicker.js',
  './js/colorWheel.js',
  './js/completions.js',
  './js/fillAnimations.js',
  './js/habits.js',
  './js/streak.js',
  './js/supabase.js',
  './js/textures.js',
  './js/theme.js',
  './js/utils.js',
  './js/version.js',
  './manifest.json',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(SHELL).catch(() => {})).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // Never cache Supabase API calls — always go to network so RLS + auth
  // state are honored and we don't serve stale data.
  if (url.host.endsWith('supabase.co')) return;

  // Network-first for our own shell so deploys propagate immediately when
  // online; fall back to cache when offline.
  if (url.origin === self.location.origin) {
    e.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        return res;
      }).catch(() => caches.match(req))
    );
  }
});
