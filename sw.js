const CACHE = "cardforge-shell-v112";
const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./power.js",
  "./deck-optimizer.js",
  "./rule-dex.js",
  "./ygo-prices.js",
  "./engine-map.js",
  "./strategy-risk.js",
  "./sharedprices.js",
  "./historical-archive.js",
  "./recent-history.js",
  "./deckpower.js",
  "./deckaudit.js",
  "./card-actions.js",
  "./auto-browse.js",
  "./store.js",
  "./ui.js",
  "./artwork.js",
  "./pokemon-set-art.js",
  "./set-list-ui.js",
  "./sheet-history.js",
  "./workbench-ui.js",
  "./shared-history.js",
  "./collection-order.js",
  "./pokemon-prices.js",
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
  "./scanart.js",
  "./install.js",
  "./tcgcompare.js",
  "./pricehist.js",
  "./feel.js",
  "./suggest.js",
  "./tour.js",
  "./trade.js",
  "./tier.js",
  "./goldfish.js",
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
  // The instant-scan index is large and changes rarely: serve the saved copy at once and refresh
  // it in the background.
  if (url.pathname.includes("/scanidx/")) {
    e.respondWith(
      caches.open(CACHE).then(async (c) => {
        const hit = await c.match(e.request),
          fresh = fetch(e.request)
            .then((r) => {
              if (r.ok) c.put(e.request, r.clone());
              return r;
            })
            .catch(() => hit);
        return hit || fresh;
      }),
    );
    return;
  }
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
