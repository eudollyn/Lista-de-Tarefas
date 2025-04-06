self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open('tarefas-pomodoro').then(function (cache) {
      return cache.addAll([
        '/',
        '/index.html',
        '/style.css',
        '/script.js',
        '/assets/add.wav',
        '/assets/remove.wav',
        '/assets/icon-192.png',
        '/assets/icon-512.png'
      ]);
    })
  );
});

self.addEventListener('fetch', function (e) {
  e.respondWith(
    caches.match(e.request).then(function (response) {
      return response || fetch(e.request);
    })
  );
});
