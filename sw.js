// Service Worker — عمر للاتصالات
// استراتيجية: network-first لملفات التطبيق (HTML/JS/CSS) لضمان أحدث نسخة دائماً،
// و cache-first لأصول CDN الثابتة (Bootstrap/الخطوط)، مع تجاهل طلبات Firebase تماماً.

// ⚠️ ارفع رقم الإصدار عند أي تحديث للكود حتى تُمسح النسخ القديمة تلقائياً.
const CACHE_NAME = 'omar-telecom-v3';

// أصول أساسية يتم تخزينها مسبقاً (اختياري — للعمل دون اتصال)
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/login.html',
  '/dashboard.html',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js',
  'https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(PRECACHE_URLS).catch(function () {});
    })
  );
  // فعّل النسخة الجديدة فوراً دون انتظار إغلاق كل التبويبات
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys
          .filter(function (k) { return k !== CACHE_NAME; })
          .map(function (k) { return caches.delete(k); })
      );
    }).then(function () { return self.clients.claim(); })
  );
});

// network-first: جرّب الشبكة أولاً وحدّث الكاش، وارجع للكاش فقط عند انقطاع النت.
function networkFirst(request) {
  return fetch(request).then(function (res) {
    if (res && res.status === 200) {
      const clone = res.clone();
      caches.open(CACHE_NAME).then(function (cache) { cache.put(request, clone); });
    }
    return res;
  }).catch(function () {
    return caches.match(request).then(function (cached) {
      if (cached) return cached;
      if (request.destination === 'document') {
        return caches.match('/index.html').then(function (c) { return c || caches.match('/'); });
      }
      return undefined;
    });
  });
}

// cache-first: للأصول الثابتة المُصدّرة بأرقام إصدارات (CDN).
function cacheFirst(request) {
  return caches.match(request).then(function (cached) {
    if (cached) return cached;
    return fetch(request).then(function (res) {
      if (res && res.status === 200 && (res.type === 'basic' || res.type === 'cors')) {
        const clone = res.clone();
        caches.open(CACHE_NAME).then(function (cache) { cache.put(request, clone); });
      }
      return res;
    }).catch(function () { return undefined; });
  });
}

self.addEventListener('fetch', function (event) {
  const request = event.request;
  if (request.method !== 'GET') return;

  let url;
  try { url = new URL(request.url); } catch (e) { return; }

  // لا تتدخل إطلاقاً في طلبات Firebase / Google — دعها تذهب للشبكة مباشرة
  // (Firestore يعتمد على اتصال حيّ، وتخزينه مؤقتاً يكسر الحفظ والقراءة)
  if (/(^|\.)(firebaseio|firestore|firebase|googleapis|gstatic|google-analytics|analytics\.google)\.com$/.test(url.hostname)
      || url.hostname.indexOf('firebase') !== -1) {
    return;
  }

  const isSameOrigin = url.origin === self.location.origin;

  // ملفات التطبيق (نفس الأصل): network-first لضمان أحدث كود دائماً
  // أصول CDN الخارجية الثابتة: cache-first
  event.respondWith(isSameOrigin ? networkFirst(request) : cacheFirst(request));
});
