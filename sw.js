/* 阅界 · PWA Service Worker
   策略：应用壳预缓存；CDN 渲染库/字体运行时缓存，离线可读；
   同源页面网络优先（保证更新即时可见），离线回退缓存。 */
const VERSION = 'yuejie-v2';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png'
];
const RUNTIME_HOSTS = ['cdn.jsdelivr.net', 'cdnjs.cloudflare.com', 'unpkg.com', 'miaoda.feishu.cn'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(VERSION)
      .then(c => c.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function cachePut(cache, req, res) {
  if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // 1) CDN 渲染库 / 字体：缓存优先，失败回退应用壳
  if (RUNTIME_HOSTS.includes(url.hostname)) {
    e.respondWith(
      caches.match(req).then(hit => hit || fetch(req)
        .then(res => { caches.open(VERSION).then(c => cachePut(c, req, res)); return res; })
        .catch(() => caches.match('./index.html')))
    );
    return;
  }

  // 2) 同源请求：网络优先，成功后入缓存；离线回退缓存或应用壳
  if (url.origin === self.location.origin) {
    e.respondWith(
      fetch(req)
        .then(res => {
          if (!url.search) caches.open(VERSION).then(c => cachePut(c, req, res));
          return res;
        })
        .catch(() =>
          caches.match(req).then(m => m || caches.match('./index.html'))
        )
    );
  }
});
