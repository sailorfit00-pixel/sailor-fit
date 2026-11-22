// Cache di base per far funzionare l'app anche offline
const CACHE = "piano-pasti-v366";
const FILES = [
  "./", "index.html", "styles.css", "app.js", "libero.js", "codice-barre.js", "foto-ricetta.js", "diario.js", "settimana.js", "andamento.js", "swipe.js", "recipes.js", "nutrition.js",
  "sortable.min.js", "manifest.json", "icon.svg", "icon-192.png", "icon-512.png", "apple-touch-icon.png"
];

self.addEventListener("install", (e) => {
  // cache: "reload" = scarica sempre la versione nuova dal sito, mai copie vecchie del browser
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES.map(f => new Request(f, { cache: "reload" })))));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  e.respondWith(
    caches.match(e.request).then(res => res || fetch(e.request).then(r => {   // i file pesanti (PDF, lettore codice a barre) non si scaricano all'installazione: si salvano la prima volta che servono
      if (r && r.ok && e.request.method === "GET" && new URL(e.request.url).origin === location.origin && /\.(js|css|png|svg|json)$/.test(e.request.url)) { const copia = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copia)).catch(() => {}); }
      return r;
    }))
  );
});
