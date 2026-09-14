/* ==========================================================================
   Service Worker - إهداء ثواب الأعمال الصالحة (PWA)
   نطاق الجذر (Scope: /) متوافق تماماً مع Vercel و Vite
   ========================================================================== */

const CACHE_VERSION = 'khetma-cache-v2';
const CACHE_NAME = `${CACHE_VERSION}`;

// أصول التطبيق الأساسية المخزنة للعمل بدون إنترنت (App Shell)
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-512-maskable.png',
  '/icons/apple-touch-icon.png',
  '/icons/favicon.png',
  '/images/deceased.png'
];

/* --------------------------------------------------------------------------
   1. تثبيت الـ Service Worker وحفظ الـ App Shell
   -------------------------------------------------------------------------- */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return Promise.allSettled(
          STATIC_ASSETS.map((assetUrl) => {
            return cache.add(new Request(assetUrl, { cache: 'reload' })).catch((err) => {
              console.warn(`[SW] Pre-cache skipped for: ${assetUrl}`, err);
            });
          })
        );
      })
      .then(() => self.skipWaiting())
  );
});

/* --------------------------------------------------------------------------
   2. تفعيل النسخة الجديدة ومسح الـ Caches القديمة
   -------------------------------------------------------------------------- */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((existingCache) => {
          if (existingCache !== CACHE_NAME) {
            console.log(`[SW] Deleting old cache: ${existingCache}`);
            return caches.delete(existingCache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

/* --------------------------------------------------------------------------
   3. استراتيجيات الجلب والتصفح في وضع عدم الاتصال (Offline)
   -------------------------------------------------------------------------- */
self.addEventListener('fetch', (event) => {
  const request = event.request;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  if (!url.protocol.startsWith('http')) return;

  if (url.pathname.endsWith('.mp3') || url.hostname.includes('archive.org') || url.hostname.includes('mp3quran.net')) {
    event.respondWith(
      fetch(request).catch(() => {
        return new Response(
          JSON.stringify({ error: 'المقطع الصوتي يتطلب اتصالاً بالإنترنت للاستماع لأول مرة' }),
          { status: 503, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
        );
      })
    );
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return networkResponse;
        })
        .catch(() => {
          return caches.match(request).then((cached) => {
            return cached || caches.match('/') || caches.match('/index.html');
          });
        })
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});
