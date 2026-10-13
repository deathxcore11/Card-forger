const CACHE = "cardforge-shell-v76";
const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./auto-browse.js",
  "./store.js",
  "./ui.js",
  "./artwork.js",
  "./pokemon-set-art.js",
  "./set-list-ui.js",
  "./sheet-history.js",
  "./workbench-ui.js",
  "./collection-locations.js",
  "./binders.js",
  "./deck-safety.js",
  "./format-upgrades.js",
  "./views.js",
  "./insights.js",
  "./strategy.js",
  "./planner.js",
  "./deck-flow.js",
  "./confidence.js",
  "./core.js",
  "./catalog-tools.js",
  "./storage.js",
  "./extras.js",
  "./share.js",
  "./cloud.js",
  "./password-auth.js",
  "./auth-form.js",
  "./config.js",
  "./formats.js",
  "./builder.js",
  "./games.js",
  "./tcg.js",
  "./ygo.js",
  "./ptcg.js",
  "./tcgbuild.js",
  "./emblems.js",
  "./facts.js",
  "./meta.js",
  "./adapt.js",
  "./scan.js",
  "./importance.js",
  "./tiles.js",
  "./guide.js",
  "./pairing.js",
  "./icons.js",
  "./zoom.js",
  "./scansession.js",
  "./scancam.js",
  "./rules.js",
  "./catalog.json",
  "./manifest.webmanifest",
  "./icon.svg",
  "./icon-192.png",
  "./icon-512.png",
];
self.addEventListener("install", (e) =>
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS))),
);
self.addEventListener("activate", (e) =>
  e.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith("cardforge-shell-") && k !== CACHE)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  ),
);
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== self.location.origin) return;
  if (e.request.mode === "navigate") {
    e.respondWith(
      fetch(e.request)
        .then((r) => {
          if (r.ok) {
            const copy = r.clone();
            caches.open(CACHE).then((c) => c.put("./index.html", copy));
          }
          return r;
        })
        .catch(() => caches.match("./index.html")),
    );
  } else
    e.respondWith(
      fetch(e.request)
        .then((r) => {
          if (r.ok) {
            const copy = r.clone();
            caches.open(CACHE).then((c) => c.put(e.request, copy));
          }
          return r;
        })
        .catch(() => caches.match(e.request)),
    );
});
