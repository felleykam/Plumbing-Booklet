/* Plumbing Field Guide offline cache.
   The version comes from BUILD in index.html (registered as sw.js?v=BUILD), so bumping BUILD
   is the only step needed to push an update to phones. */
const CACHE = "jpb-" + (new URL(location).searchParams.get("v") || "dev");
const CORE = ["./", "./index.html", "./manifest.webmanifest", "./icon-180.png", "./icon-192.png", "./icon-512.png"];

/* install: download fresh copies (skip the browser's HTTP cache) and take over right away */
self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE.map(u => new Request(u, {cache: "reload"})))).then(() => self.skipWaiting()));
});
/* activate: delete caches from older versions */
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", e => {
  const req = e.request; if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.pathname.startsWith("/_blob/")) return;  /* My files: always live, never cached */

  if (req.mode === "navigate") {
    /* the page: try the network for updates, give up after 4 s on weak signal, else use the saved copy */
    const net = fetch(req).then(r => { if (r.ok) { const c = r.clone(); caches.open(CACHE).then(x => x.put("./index.html", c)); } return r; });
    const timeout = new Promise((_, fail) => setTimeout(fail, 4000));
    e.respondWith(Promise.race([net, timeout]).catch(() => caches.match("./index.html").then(hit => hit || net)));
    return;
  }
  if (url.origin === location.origin || /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {
    /* icons, manifest, fonts: saved copy first; only good responses get saved */
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => {
      if (r.ok || r.type === "opaque") { const c = r.clone(); caches.open(CACHE).then(x => x.put(req, c)); }
      return r;
    })));
  }
});
