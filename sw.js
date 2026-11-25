/* Utah Plumbers Digital Handbook: offline cache. © 2026 Deklan Patrick Kelley. All rights reserved. */
/* Utah Plumbers Digital Handbook: offline cache.
   The version comes from BUILD in index.html (registered as sw.js?v=BUILD), so bumping BUILD
   is the only step needed to push an update to phones. */
const CACHE = "jpb-" + (new URL(location).searchParams.get("v") || "dev");
const CORE = ["./index.html", "./manifest.webmanifest", "./jobs.js?v=" + encodeURIComponent(new URL(location).searchParams.get("v") || "dev")];   /* jobs.js under the same build name index.html asks for */                      /* must succeed */
const EXTRA = ["./icon-180.png?v=3", "./icon-192.png?v=3", "./icon-512.png?v=3"];   /* the same addresses the page and manifest ask for */         /* nice to have: a missing icon never blocks the offline copy */
/* the PDF viewer (PDF.js) keeps its own cache, named for its version: saved once, kept through app updates, so an update
   never downloads it again. A new PDF.js version gets a new folder and a new cache. */
const PDFJS_DIR = "./vendor/pdfjs-6.5.438/", PDFJS_CACHE = "jpb-pdfjs-6.5.438";
const PDFJS_FILES = ["pdf.min.mjs", "pdf.worker.min.mjs", "wasm/jbig2.wasm", "wasm/openjpeg.wasm", "wasm/qcms_bg.wasm"].map(f => PDFJS_DIR + f);

/* install: download fresh copies (skip the browser's HTTP cache) and take over right away */
self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE.map(u => new Request(u, {cache: "reload"})))
    .then(() => Promise.all(EXTRA.map(u => c.add(new Request(u, {cache: "reload"})).catch(() => {})))))
    .then(() => self.skipWaiting()));
  /* PDF viewer: fill in whatever is missing, after the app itself is saved; never blocks an update */
  e.waitUntil(caches.open(PDFJS_CACHE).then(c => Promise.all(PDFJS_FILES.map(u => c.match(u).then(hit => hit || c.add(u).catch(() => {}))))).catch(() => {}));
});
/* activate: delete caches from older versions */
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE && k !== PDFJS_CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", e => {
  const req = e.request; if (req.method !== "GET") return;
  const url = new URL(req.url);

  if (req.mode === "navigate") {
    /* the page: try the network for updates, give up after 2 s on weak signal (the fresh copy still saves for next time), else use the saved copy */
    /* a 404/5xx (GitHub deploy or outage) counts as no signal, so the saved copy shows instead of an error page */
    let saved = Promise.resolve();
    const net = fetch(req).then(r => {
      if (!r.ok) throw r;
      /* save the new page only once the jobs.js it asks for is saved too, or offline it would open with My jobs missing */
      const c1 = r.clone(), c2 = r.clone();
      saved = c1.text().then(html => { const m = html.match(/var BUILD = "([^"]+)"/), js = m && "./jobs.js?v=" + encodeURIComponent(m[1]);
        return caches.open(CACHE).then(x => (js ? caches.match(js).then(hit => hit || fetch(js, {cache: "reload"}).then(j => { if (!j.ok) throw j; return x.put(js, j); })) : null)
          .then(() => x.put("./index.html", c2))); }).catch(() => {});
      return r;
    });
    e.waitUntil(net.then(() => saved, () => {}));
    const timeout = new Promise((_, fail) => setTimeout(fail, 2000));
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
