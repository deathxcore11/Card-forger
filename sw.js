const CACHE = "cardforge-shell-audit-fixes-4352-v418";
const ASSETS = [
  "./assets/fonts/fonts.css",
  "./play-forge-feature.js",
  "./audio.js",
  "./audio-loops.js",
  "./play-table-audio.js",
  "./planeswalk-audio.js",
  "./play-update-gate.js",
  "./play-precon-formats.js",
  "./play-forge-cpu-policy.js",
  "./play-forge-setup-review.js",
  "./play-forge-host-client.js",
  "./play-forge-local-client.js",
  "./play-forge-artwork.js",
  "./play-forge-player-mat.js",
  "./play-forge-pregame.js",
  "./play-match-record.js",
  "./play-daily-goals.js",
  "./experiments/forge-proof/table-emotes.mjs",
  "./play-forge-table.css",
  "./experiments/forge-proof/forge-session.mjs",
  "./experiments/forge-proof/forge-table.mjs",
  "./experiments/forge-proof/cpu-action-playback.mjs",
  "./experiments/forge-proof/motion-kit.mjs",
  "./play-board-badges.js",
  "./play-board-icons.js",
  "./play-token-art.js",
  "./play-token-printing.js",
  "./play-playmats.js",
  "./play-orientation.js",
  "./experiments/forge-proof/native-panel.mjs",
  "./experiments/phase-engine/choice-presentation.mjs",
  "./play-card-support.js",
  "./experiments/phase-engine/shipped-response-proof.mjs",
  "./experiments/phase-engine/compiled-card-support.mjs",
  "./experiments/phase-engine/priority-flow.mjs",
  "./play-deck-sources.js",
  "./play-quick-match.js",
  "./play-engine-names.js",
  "./play-cpu-options.js",
  "./play-turn-controls.js",
  "./experiments/phase-engine/commander-projection.mjs",
  "./experiments/phase-engine/match-result.mjs",
  "./experiments/phase-engine/practice-result-history.mjs",

  "./experiments/phase-engine/cpu-block-search.mjs",
  "./experiments/phase-engine/cpu-difficulty-config.mjs",
  "./experiments/phase-engine/cpu-hand-observation.mjs",
  "./experiments/phase-engine/cpu-playbook.mjs",
  "./experiments/phase-engine/cpu-tactical-planning.mjs",
  "./experiments/phase-engine/cpu-public-observation.mjs",
  "./experiments/phase-engine/cpu-combat-evaluation.mjs",
  "./experiments/phase-engine/cpu-public-policy.mjs",
  "./experiments/phase-engine/cpu-public-worker.mjs",
  "./experiments/phase-engine/cpu-legal-candidates.mjs",
"./experiments/phase-engine/practice-session-record.mjs", "./experiments/phase-engine/turn-budget.mjs", "./experiments/phase-engine/card-placement.mjs", "./experiments/phase-engine/card-stats.mjs", "./experiments/phase-engine/random-outcomes.mjs", "./experiments/phase-engine/human-command.mjs", "./experiments/phase-engine/interaction-surface.mjs", "./experiments/phase-engine/match-authority.mjs", "./experiments/phase-engine/match-input.mjs", "./experiments/phase-engine/catalog-admission.mjs", "./experiments/phase-engine/match-session.mjs", "./experiments/phase-engine/match-table.mjs", "./experiments/phase-engine/practice-authority.mjs", "./experiments/phase-engine/practice-client.mjs", "./experiments/phase-engine/practice-coverage.mjs", "./experiments/phase-engine/practice-preflight.mjs", "./experiments/phase-engine/practice-flow.mjs", "./experiments/phase-engine/practice-presentation.mjs", "./experiments/phase-engine/practice-record.mjs", "./experiments/phase-engine/priority-clock.mjs", "./experiments/phase-engine/priority-scheduler.mjs", "./experiments/phase-engine/protocol-fault.mjs", "./experiments/phase-engine/runtime-assets.mjs", "./experiments/phase-engine/seat-surface.mjs", "./experiments/phase-engine/visible-cpu-policy.mjs", "./experiments/phase-engine/visible-policy-worker.mjs", "./experiments/phase-engine/worker-journal.mjs", "./experiments/phase-engine/match-table.css", "./play-menu.js", "./play-starter-deck.js", "./play-opponent-build.js", "./play-deck-import.js", "./play-deck-context.js", "./play-card-preparation.js", "./play-catalog-review.js", "./play-setup.js", "./play-player-mat.js", "./play-pregame.js", "./play-card-surface.js", "./play-surface-policy.js", "./play-menu.css", "./desktop-play.js", "./commander-evidence.js", "./commander-combos.js", "./game-changers.js",
  "./home-overview.css",
  "./polish.css",
  "./deck-viewer.js",
  "./collection-banner.js",
  "./deck-viewer.css",
  "./deck-mechanic-plan.js", "./mtg-land-requirements.js", "./mtg-commander-conditions.js", "./mtg-primary-inputs.js", "./mtg-ability-endpoints.js", "./mtg-final-support.js", "./mtg-reference-construction.js", "./mtg-mana-sources.js", "./mtg-wiki-knowledge.js", "./mtg-wiki-client.js", "./mtg-wiki-ui.js", "./wiki-sources.js", "./game-wiki-knowledge.js", "./game-glossary-data.js", "./game-wiki-article.js", "./wiki-card-handoff.js", "./wiki-deck-handoff.js",
  "./community-edition.js", "./img/news/2026-10-19-magic-delay.webp", "./img/news/2026-10-22-pokemon-rules.webp", "./img/news/2026-10-19-ygo-list.webp",
  "./release-record.js", "./release-status.js",
  "./card-discovery.js", "./rule-extra.js", "./mtg-keyword-reference.js", "./mtg-vocabulary.js", "./deck-preferences.js", "./deck-construction.js", "./deck-pipeline.js", "./deck-experience.js", "./deck-seeds.js",
  "./deck-strategy-plan.js", "./mtg-combo-packages.js",
  "./ai-auth.js",
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
  "./settings-storage.js",
  "./mobile-tilt.js", "./set-experience.js", "./pack-preview.js", "./mtg-boosters.js", "./rarity-emblem.js", "./data-loading.js", "./collector-search.js",
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
  "./app-motion.js",
  "./ygo-identity.js",
  "./vendor/supabase-js-2.110.0.js",
  "./scryfall-client.js",
  "./feedback-layer.js",
  "./deck-box.js",
  "./shared-deck-view.js",
  "./finish-preview.js",
  "./foil-fx.js",
  "./foil-fx.css",
  "./finish-effects.js",
  "./pokemon-anniversary-masks.js",
  "./finish-materials.js",
  "./ygo-name-foil.js",
  "./ygo-rarity-foil.js",
  "./ygo-foil-analysis.js",
  "./ygo-foil-recipes.js",
  "./ygo-foil-worker.js",
  "./foil-gl.js", "./mtg-foil.js", "./mtg-foil-analysis.js", "./mtg-foil-recipes.js", "./mtg-foil-worker.js", "./ptcg-foil.js", "./ptcg-foil-recipes.js", "./home-today.js",
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

  "./ai-ask.js", "./ask-navigation.js",
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
  "./android-beta.js",
  "./tcgcompare.js",
  "./pricehist.js",
  "./feel.js",
  "./suggest.js",
  "./tour.js",
  "./home-search.js",
  "./universal-search.js",
  "./search-fan.js",
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
  "./app-errors.js",
  "./planeswalk-cloud.js",
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
  "./tab-glide.js",
  "./search-hints.js",
  "./zoom.js",
  "./scansession.js",
  "./scancam.js",
  "./scan-grid.js",
  "./scan-batch.js",
  "./scan-catalog.js",
  "./scan-collector.js",
  "./rules.js",
  "./catalog.json",
  "./manifest.webmanifest",
  "./icon.svg",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable-512.png",
];
// Card artwork the app serves itself (packs, card backs, set art, Yu-Gi-Oh! images) is kept across
// releases in its own cache, trimmed to the most recent images.
const ART = "cardforge-art-v1", ART_MAX = 800;
const BASE = self.location.href || self.location.origin + "/";
// Stylesheets stay network-first (a corrected style reaches open apps at once); they load in parallel.
const SHELL = new Set(ASSETS.filter((a) => !a.endsWith(".css")).map((a) => new URL(a, BASE).pathname)),
  PAGES = new Set(["./", "./index.html"].map((a) => new URL(a, BASE).pathname));
// A new release takes over at once; the page picks it up on its next open.
self.addEventListener("install", (e) => {
  self.skipWaiting?.();
  // Fetch past the browser's HTTP cache so a release never saves an older copy of a file.
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS.map((a) => new Request(a, { cache: "reload" })))));
});
let trimming = null;
const trimArt = () => trimming ||= caches.open(ART).then(async (c) => {
  const keys = await c.keys();
  await Promise.all(keys.slice(0, Math.max(0, keys.length - ART_MAX)).map((k) => c.delete(k)));
}).finally(() => { trimming = null; });
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
  // App downloads go straight to the network (a navigation would otherwise be saved as the start page).
  if (url.pathname.startsWith("/downloads/")) return;
  // Sound and music keep their own cache (audio.js, cardstashy-audio-v1), which outlives app updates.
  if (url.pathname.startsWith("/assets/audio/")) return;
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
  // Saved artwork appears instantly; new artwork is saved as it is browsed.
  if (url.pathname.startsWith("/img/")) {
    e.respondWith(
      caches.open(ART).then(async (c) => {
        const hit = await c.match(e.request);
        if (hit) return hit;
        const r = await fetch(e.request);
        if (r.ok && r.type === "basic") { c.put(e.request, r.clone()).then(trimArt, () => {}); }
        return r;
      }),
    );
    return;
  }
  // The app's own scripts are versioned with this worker: they open from the saved copy at once (no
  // network round trip per module) and refresh in the background in case of a same-version fix.
  const appPage = e.request.mode === "navigate" && PAGES.has(url.pathname);
  if (appPage || (e.request.mode !== "navigate" && SHELL.has(url.pathname))) {
    const key = appPage ? "./index.html" : url.pathname;
    e.respondWith(
      caches.open(CACHE).then(async (c) => {
        const hit = await c.match(key),
          fresh = fetch(e.request).then((r) => {
            if (r.ok && r.type === "basic" && !r.redirected) c.put(key, r.clone());
            return r;
          });
        if (hit) { e.waitUntil(fresh.catch(() => {})); return hit; }
        return fresh.catch(() => Response.error());
      }),
    );
    return;
  }
  // Network first, but a stalled connection falls back to the saved copy after a few seconds,
  // so the app always opens (the fresh copy still updates the cache when it arrives). Only the
  // app page above is saved as the start page; other pages (account deletion, the Android
  // sign-in return with its one-time code, review pages) are never saved, and neither is any
  // response marked no-store.
  const key = e.request, keep = (r) => r.ok && e.request.mode !== "navigate" && !/no-store/i.test(r.headers.get("cache-control") || "");
  e.respondWith(
    new Promise((resolve) => {
      let done = false;
      const finish = (r) => { if (!done && r) { done = true; resolve(r); } };
      const saved = () => caches.match(key);
      const net = fetch(e.request).then((r) => {
        if (keep(r)) { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(key, copy)); }
        return r;
      });
      net.then(finish, () => saved().then((hit) => finish(hit || Response.error())));
      setTimeout(() => saved().then(finish), e.request.mode === "navigate" ? 3500 : 6000);
    }),
  );
});
