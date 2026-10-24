/* Utah Plumbers Digital Handbook: offline cache.
   The version comes from BUILD in index.html (registered as sw.js?v=BUILD), so bumping BUILD
   is the only step needed to push an update to phones. */
const CACHE = "jpb-" + (new URL(location).searchParams.get("v") || "dev");
const CORE = ["./index.html", "./manifest.webmanifest"];                      /* must succeed */
const EXTRA = ["./icon-180.png", "./icon-192.png", "./icon-512.png"];         /* nice to have: a missing icon never blocks the offline copy */

/* install: download fresh copies (skip the browser's HTTP cache) and take over right away */
self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE.map(u => new Request(u, {cache: "reload"})))
    .then(() => Promise.all(EXTRA.map(u => c.add(new Request(u, {cache: "reload"})).catch(() => {})))))
    .then(() => self.skipWaiting()));
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
    /* a 404/5xx (GitHub deploy or outage) counts as no signal, so the saved copy shows instead of an error page */
    let saved = Promise.resolve();
    const net = fetch(req).then(r => {
      if (!r.ok) throw r;
      const c = r.clone(); saved = caches.open(CACHE).then(x => x.put("./index.html", c));
      return r;
    });
    e.waitUntil(net.then(() => saved, () => {}));
    const timeout = new Promise((_, fail) => setTimeout(fail, 4000));
    e.respondWith(Promise.race([net, timeout]).catch(() =>
      caches.match("./index.html").then(hit => hit || net.catch(x => x instanceof Response ? x : Response.error()))));
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
