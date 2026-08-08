// 词对 PK — Service Worker（WAVE2）
// 策略：核心文档 network-first（在线拿最新，版本号变化自动拉到新版），其余 static cache-first
const CACHE_NAME = 'wordpair-pk-v1';
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  // 仅处理同源 GET
  if (event.request.method !== 'GET' || url.origin !== location.origin) return;

  const isCoreDoc = url.pathname.endsWith('/') || url.pathname.endsWith('/index.html');

  if (isCoreDoc) {
    // network-first：在线拿最新（revision 变化即新页面），失败回缓存（离线可玩）
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(() => caches.match(event.request).then((hit) => hit || caches.match('./index.html')))
    );
  } else {
    // 其余 static：cache-first
    event.respondWith(
      caches.match(event.request).then(
        (hit) => hit || fetch(event.request).then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return response;
        })
      )
    );
  }
});
