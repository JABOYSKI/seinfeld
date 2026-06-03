// Service worker — app shell cache only.
// Versioned cache name is stamped by deploy.bat on every deploy so browsers
// pick up new assets without manual cache-clearing.
const CACHE = 'seinfeld-2026-06-03T08:08:15Z';
const SHELL = [
  './',
  './index.html',
  './css/styles.css',
  './css/animations.css',
  './css/textures.css',
  './js/app.js',
  './js/animationPicker.js',
  './js/audio.js',
  './js/auth.js',
  './js/calendar.js',
  './js/chainAnimations.js',
  './js/chainBuild.js',
  './js/chainPicker.js',
  './js/colorWheel.js',
  './js/completions.js',
  './js/fillAnimations.js',
  './js/habits.js',
  './js/soundPicker.js',
  './js/streak.js',
  './js/supabase.js',
  './js/textures.js',
  './js/theme.js',
  './js/utils.js',
  './js/version.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(SHELL).catch(() => {})).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    const old = keys.filter(k => k !== CACHE);
    await Promise.all(old.map(k => caches.delete(k)));
    await self.clients.claim();
    // If a previous cache existed, this activation is an UPDATE (not a first
    // install) — force every open tab to reload onto the fresh assets. Doing
    // this from the SW means it works even for tabs whose page JS predates the
    // reload logic, which is what gets a browser unstuck from a stale SW.
    if (old.length > 0) {
      const wins = await self.clients.matchAll({ type: 'window' });
      for (const c of wins) { try { c.navigate(c.url); } catch (err) { /* ignore */ } }
    }
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // Never cache Supabase API calls — always go to network so RLS + auth
  // state are honored and we don't serve stale data.
  if (url.host.endsWith('supabase.co')) return;

  // esm.sh CDN modules (the Supabase SDK graph) are immutable + version-pinned,
  // so cache-first. This is what makes a cold OFFLINE boot work: without it the
  // cross-origin import is never cached, so offline the import throws and the
  // whole app fails to parse. After the first online visit the full module
  // graph (entry + every sub-import esm.sh pulls) is cached here.
  if (url.host === 'esm.sh') {
    e.respondWith(
      caches.match(req).then(hit => hit || fetch(req).then(res => {
        if (res && (res.ok || res.type === 'opaque')) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        }
        return res;
      }))
    );
    return;
  }

  // Network-first for our own shell so deploys propagate immediately when
  // online; fall back to cache when offline. `cache: 'no-cache'` forces the
  // browser HTTP cache to revalidate (sends If-None-Match), so ES-module
  // imports without a `?v=` query string can't be served stale. If a cache
  // miss coincides with being offline, a navigation falls back to the cached
  // app shell so a deep link / refresh still boots.
  if (url.origin === self.location.origin) {
    e.respondWith(
      fetch(req, { cache: 'no-cache' }).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        return res;
      }).catch(() => caches.match(req).then(hit =>
        hit || (req.mode === 'navigation' ? caches.match('./index.html') : undefined)
      ))
    );
  }
});
