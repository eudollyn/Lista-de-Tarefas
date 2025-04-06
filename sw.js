self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open("tarefas-cache").then((cache) => {
      return cache.addAll([
        "/",
        "/index.html",
        "/style.css",
        "/script.js",
        "/icon.png",
        "/assets/add.wav",
        "/assets/remove.wav"
      ]);
    })
  );
});

self.addEventListener("fetch", (e) => {
  e.respondWith(
    caches.match(e.request).then((res) => {
      return res || fetch(e.request);
    })
  );
});
