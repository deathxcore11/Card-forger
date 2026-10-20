const CACHE = "cardforge-shell-v255";
const ASSETS = [
  "./grid-settings.js", "./price-origin.js", "./collection-display.css",
  "./aura.js", "./aura.css",
  "./brand-motion.css",
  "./game-tabs.css",
  "./game-tab-mtg.jpg",
  "./game-tab-ygo.png",
  "./game-tab-ptcg.jpg",
  "./ai-ask-loop.js",
  "./ai-deck-builder.js",
  "./meta-curation.js",
  "./set-browser.js",
  "./set-release-metadata.js",
  "./community-curation.css",
  "./magic-owned-detail.js",
  "./pokemon-variant-options.js",
  "./pokemon-promo-evidence.js",

  "./settings-theme.css",
  "./theme-init.js",
  "./magic-matchups.css",
  "./settings-theme.js",
  "./sync-merge.js",
  "./recovery-store.js",
  "./magic-card-color.js",
  "./ai-matchup-core.js",
  "./magic-matchups-ui.js",
  "./magic-matchups-controller.js",

  "./",
  "./index.html",
  "./style.css",
  "./value-page.css",
  "./value-page.js",
  "./value-history.js",
  "./finish-effects.css",
  "./sets-ui.css",
  "./printing-picker.css",
  "./printing-picker.js",
  "./scanner-printing.js",
  "./scanner-review.js",
  "./scanner-lookup.js",
  "./app.js",
  "./ygo-identity.js",
  "./vendor/supabase-js-2.110.0.js",
  "./scryfall-client.js",
  "./feedback-layer.js",
  "./deck-box.js",
  "./shared-deck-view.js",
  "./finish-preview.js",
  "./finish-effects.js",
  "./finish-materials.js",
  "./assets/finishes/abyss-title.svg",
  "./assets/finishes/cosmos.svg",
  "./assets/finishes/gamma-title.svg",
  "./assets/finishes/metal-grain.svg",
  "./assets/finishes/omega-title.svg",
  "./assets/finishes/relief-flow.svg",
  "./assets/finishes/starlight.svg",
  "./assets/finishes/water-pattern.svg",
  "./card-detail-extras.js",
  "./community-profile.js", "./account-workspaces.js", "./account-scope.js",
  "./printing-carousel.js",
  "./settings-dialog.js",
  "./profile-art.js",
  "./pokemon-identity.js",
  "./pokemon-corrections.js",
  "./collection-stack.js",
  "./condition-feed.js",
  "./condition-refresh-scheduler.js",
  "./rule-learning.js",
  "./rule-reference.js",
  "./rule-corpus.js",
  "./pricing-presentation.js",
  "./rule-lessons.js",
  "./scan-vision.js",
  "./scan-signals.js",
  "./price-reference.js",
  "./glass-select.js",
  "./home-swipe.js",
  "./home-ui.js",
  "./daily-clock.js",
  "./home-deck-activity.js",
  "./game-navigation.js",
  "./community-feed.js",
  "./community-art.js",
  "./community-sources.js",
  "./power.js",
  "./ai-review.js",
  "./ai-build-contract.js",
  "./ai-deck-goal.js",
  "./coach-evidence.js",
  "./commander-criteria.js",
  "./commander-strategy.js",
  "./mtg-effects.js",
  "./mtg-route-coverage.js",

  "./ai-ask.js",
  "./ai-rules.js",
  "./ai-rules-panel.js",
  "./ai-ui.js",
  "./brand.js",
  "./condition-value.js",
  "./quick-quantity.js",
  "./pokemon-role.js",
  "./ai-tools.js",
  "./deck-optimizer.js",
  "./rule-dex.js",
  "./rule-hover.js",
  "./ygo-price-selection.js",
  "./ygo-prices.js",
  "./ygo-set-prices.js",
  "./engine-map.js",
  "./strategy-risk.js",
  "./sharedprices.js",
  "./historical-archive.js",
  "./recent-history.js",
  "./ptcg-product.js",
  "./mtg-cheap.js",
  "./mtg-tags.js",
  "./mtg-tags.json",
  "./mtg-tcgprice.js",
  "./dialog.js",
  "./buy.js",
  "./pokemon-art.js",
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
  "./ygo-history-identity.js",
  "./collection-order.js",
  "./collection-sort.js",
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
  "./home-search.js",
  "./app-info.js",
  "./tabletop.js", "./tabletop-themes.js",
  "./tour-scenes.js",
  "./trade.js",
  "./tier.js",
  "./goldfish.js",
  "./build-overlay.js",
  "./scouting.js",
  "./tier-card.js",
  "./matchup.js",
  "./matchups-ui.js",
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
  "./ptcg-glc-rules.js",
  "./ptcg.js",
  "./pokemon-catalogue-supplement.js",
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
  "./scan-batch.js",
  "./scan-catalog.js",
  "./rules.js",
  "./catalog.json",
  "./manifest.webmanifest",
  "./icon.svg",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable-512.png",
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
  // API responses (including connection status) must not enter the offline shell cache.
  if (url.pathname.startsWith("/api/")) return;
  // Tour videos stream with range requests, which the shell cache cannot store.
  if (/\.(mp4|webm)$/.test(url.pathname)) return;
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
  // Network first, but a stalled connection falls back to the saved copy after a few seconds,
  // so the app always opens (the fresh copy still updates the cache when it arrives).
  const key = e.request.mode === "navigate" ? "./index.html" : e.request;
  e.respondWith(
    new Promise((resolve) => {
      let done = false;
      const finish = (r) => { if (!done && r) { done = true; resolve(r); } };
      const saved = () => caches.match(key);
      const net = fetch(e.request).then((r) => {
        if (r.ok) { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(key, copy)); }
        return r;
      });
      net.then(finish, () => saved().then((hit) => finish(hit || Response.error())));
      setTimeout(() => saved().then(finish), e.request.mode === "navigate" ? 3500 : 6000);
    }),
  );
});
