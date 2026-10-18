# Condition pricing activation

## 3.85.2 public product-page pricing test

`TCGPLAYER_WEB_TEST=true` enables the experimental reader for the same public data loaded by TCGplayer product pages, without a developer key or account cookies. This test mode takes primary priority; JustTCG remains the fallback. Set the flag to `false` to restore the credentialed-primary configuration described below. This is an experimental website integration, not a supported official API contract or a statement of scraping permission.

The reader uses the canonical product ID already resolved for the Buy link. It reads `https://mp-search-api.tcgplayer.com/v2/product/{productId}/details`, verifies product and game, and matches each SKU's condition, variant and language. It then batches those SKU IDs into the page's `https://mpgateway.tcgplayer.com/v1/pricepoints/marketprice/skus/search` request. Only numeric `marketPrice` fields joined to exactly one SKU are accepted. Product-wide prices, lowest/highest listings, nulls and ambiguous matches are never substituted.

A live, keyless test on 2026-10-18 returned Lugia Celebrations product 250317, English Holofoil: NM $0.81, LP $0.64, MP $0.41, HP $0.30, Damaged $0.49. These are dated test observations, not hardcoded prices or future guarantees. The source provides `calculatedAt`; quotes retain that separately from our `checkedAt`, and the UI identifies both accurately. A damaged price may exceed HP in a thin market; the reader does not invent a monotonic discount ladder.

Catalog identity is shared for seven days and all condition prices for 24 hours. One cold product normally needs two requests; a daily refresh needs one price batch. The existing durable coordinator deduplicates concurrent viewers, respects the app request budget and retains dated last-known prices for 30 days. Changing condition reads local quotes. Failed web requests fall back to JustTCG where available. Web data has its own storage prefix; the TCGplayer cooldown remains shared across TCGplayer access modes. JustTCG's shared-hosting pause does not block a separately working TCGplayer source.

No HTML challenges, authentication checks, rate limits, or redirects are bypassed. HTTP 401/403/429 creates a shared cooldown, including for the owner. Unexpected HTML or malformed JSON is unpriced. No user-supplied URL is fetched. The reader is server-only and excluded from static assets.

Run `node test-tcgplayer-web-source.mjs` for exact dimensions, credential absence, shared batching/cache, genuine route integration, calculation dates, partial fallback, rejected/challenged response handling and stale-value exclusion. Synthetic tests are separate from real provider and deployed-route observations.

The optional credentialed configuration below supports the official TCGplayer API as primary and JustTCG v1 as fallback. Those adapters are disabled without their server credentials; the public-web test above has no developer-key requirement. Static code contains no provider credential.

## TCGplayer primary (3.85.1)

TCGplayer is currently not issuing new API access. This adapter requires an existing approved developer account. A product URL is an identity, not authorization to retrieve prices. The credentialed adapter uses only the official API; the separately enabled public-web test is described above. Neither path uses proxy rotation or an inferred condition discount model.

An operator with approved access can add `TCGPLAYER_PUBLIC_KEY` and `TCGPLAYER_PRIVATE_KEY` as encrypted secrets to the existing `cardforge2` Worker, then deploy. Do not place either in source, browser settings, screenshots, or chat. The Worker exchanges them for a short-lived bearer token kept in memory; it does not send credentials to the client or follow upstream redirects. This release does not purchase or activate an account.

The existing exact game/printing resolver identifies the same product used by the filtered Buy URL. The primary adapter verifies its category, loads its SKU catalog, and joins condition, printing and language IDs against the official category dictionaries. It fetches all SKU market prices in batches of up to 100; null market prices never fall back to low/asking/shipping prices. Catalog data is cached for seven days and product prices for one day, shared across visitors and edge regions. Changes of condition reuse those rows locally.

Fresh exact TCGplayer rows take priority. When primary coverage is incomplete or the connection fails, JustTCG can fill missing exact combinations; fresh fallback beats stale primary data. Ambiguous rows remain unpriced. Each source keeps its own provider cooldown, while every outbound call, including token/catalog calls and failures, consumes the same existing app request budget. The verified owner exemption still applies only to app caps, never provider restrictions.

TCGplayer's SKU-price response has no source observation timestamp. Its quotes show **checked** time and explicitly state that the observation date is unavailable. JustTCG quotes retain their reported **last observed** time. Both may be retained for up to 30 days as last known, excluded from current condition totals. JustTCG's explicit `expired` + `lastKnownPrice` rows are now retained with the same treatment.

The condition response exposes only non-secret source status under `providers`. `tcgplayer: not_configured` means the adapter is ready but has no primary connection; it must not be described as live TCGplayer condition pricing. Live recovery needs a real successful response from a configured provider. The tests use synthetic quotes and cannot establish recovery.

Documentation: https://docs.tcgplayer.com/docs/getting-started · https://docs.tcgplayer.com/reference/catalog_getskusbyproductid · https://docs.tcgplayer.com/reference/pricing_getproductconditionprices-1

`node test-tcgplayer-condition-source.mjs` verifies batching, all-condition reuse, durable caching, partial results, source priority, exact dimensions, rate limits, shared budget enforcement, honest timestamp labels and stale-price isolation without contacting either provider.

## Activate JustTCG fallback

1. Obtain a JustTCG account and a plan licensed for the app's use. Commercial use requires a paid plan. No subscription is purchased by this release.
2. Add `JUSTTCG_API_KEY` as an **encrypted secret** in Cloudflare Workers → `cardforge2` → Settings → Variables and Secrets, then deploy. Alternatively use `npx wrangler secret put JUSTTCG_API_KEY` in an authenticated operator terminal. Never put it in config.js, GitHub source, a screenshot or chat.
3. In the app open an exact card printing, select its version/finish/edition/language, then change condition. The preview must show the matching quote. Confirm another edition or language does not reuse it. Unknown or ambiguous mappings remain unpriced.
4. Inspect `/api/prices/conditions` for an exact app card selection. Without the secret it reports `not_configured`; with a verified current quote it reports `available`. `unmapped`, `unpriced`, `rate_limited` and `unavailable` are distinct states.

## Identity and caching

The Worker resolves product IDs from canonical Scryfall IDs, TCGdex variants, or verified Yu-Gi-Oh set code + rarity matches. It does not accept an arbitrary TCGplayer product ID from the browser. Provider calls and the API key stay on the Worker. All conditions for a product share a 24-hour durable cache; raw provider history is not exposed. Browser requests are deduplicated by exact selection and limited to two concurrent requests.

A quote includes condition, currency, source, observed time, expiry and SKU. The UI calls it a provider estimate; it does not claim to have averaged individual seller listings. It is bound to the collection lot's exact printing, finish, edition and language. Expired/null/ambiguous quotes are excluded. Personal condition values retain priority. Generic reference prices do not fill played/damaged conditions. The collection graph uses the resulting lot values, not invented discount ratios.

Condition refresh is on demand, not a whole-collection pull. Newly saved or changed exact lots and explicit scanner review selections use the same condition endpoint as Search, without blocking capture or save. Passive Collection refresh prioritizes a visible selection and rotates through remaining eligible lots using a persisted per-game cursor, so lots after the first 100 are not permanently excluded. Automatic work is capped at eight new product requests per page session. Explicit Search/save/review work has no new session-total cap; the existing server budgets remain authoritative.

Browser work is bounded to two simultaneous requests, starts no faster than once every eight seconds, deduplicates the exact product across conditions, and retains valid cached values. Unavailable, unconfigured or rate-limited requests never substitute a Near Mint reference for a played-condition quote. A full/deferred queue does not prevent saving a card. This does **not** introduce nightly full-catalogue condition ingestion; the scheduled market-history jobs remain separate.

## Verification

`node test-condition-feed.mjs` exercises all five tiers, condition/finish/language/edition isolation, expired/null and duplicate rejection, disabled mode, server-side authentication and cache reuse using deterministic provider fixtures. `node test-condition-refresh-scheduler.mjs` covers bounded scheduling, fair rotation, identity and delayed-save safety. Hosted CI additionally checks real Search/scanner/Collection controls with 150 synthetic holdings and mocked quotes, including cancellation, provider failures and responsive layout. These tests do not contact a paid provider. The credentialed adapters require configured credentials; the explicitly enabled public-web test path does not.

Provider documentation: https://justtcg.com/docs/quickstart · https://justtcg.com/docs/api/cards · https://justtcg.com/docs/schema/variant · https://justtcg.com/pricing

## 3.73.13 price repair and spending controls

Reference fallback order is positive market price, then median asking/listing price, then lowest listing price. Listing estimates are labeled; these mixed-condition statistics never become an LP, MP, HP or Damaged quote. Shipping, fees and a guaranteed resale price are not implied. Exact name, collector number, edition, finish and rarity matching prevents borrowing a similar card's price. Missing aggregate prices no longer discard verified Yu-Gi-Oh product identities.

`CONDITION_PRICES` is a durable coordinator deployed by the `condition-prices-v1` migration. It stores a compact provider product response for 24 hours across users and edge regions and deduplicates simultaneous requests. Limits default to **30 external requests/day, 900/month and 8/minute**, shared by all users and games. They are configured only on the server using `CONDITION_DAILY_LIMIT`, `CONDITION_MONTHLY_LIMIT`, and `CONDITION_MINUTE_LIMIT`. Set them to zero to pause new provider requests. Failed provider calls consume budget too; HTTP 429 triggers shared backoff. Existing cached quotes can still be served at the limit. Credentialed provider modes still require their secrets; the public-web test mode is enabled separately. No mode purchases a subscription.

Refresh is on demand: loaded Pokémon/Yu-Gi-Oh data expires after 24 hours, Magic missing-price set caches expire after 24 hours even in a long-running session, and collection visits refresh stale Magic exact printings in batches of 75 (up to 150 per automatic pass). No nightly whole-catalogue condition pull is introduced. This avoids paying to refresh cards nobody is viewing. Browser condition requests are limited to two concurrently and start their timeout after entering the queue.

`node test-pricing-repair.mjs` additionally verifies listing fallback labels, name/edition collisions, long-session expiry, recovered condition mapping, all-user durable cache reuse, concurrent request deduplication, daily/monthly caps and upstream rate-limit backoff. Live condition verification requires a successful response from the selected source; tests alone do not prove it.
