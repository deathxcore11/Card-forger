# Condition pricing activation

The optional Worker adapter uses JustTCG v1 for NM / LP / MP / HP / Damaged prices across Magic, Pokémon and Yu-Gi-Oh. It is disabled without a server credential; static code contains no credential.

## Activate

1. Obtain a JustTCG account and a plan licensed for the app's use. Commercial use requires a paid plan. No subscription is purchased by this release.
2. Add `JUSTTCG_API_KEY` as an **encrypted secret** in Cloudflare Workers → `cardforge2` → Settings → Variables and Secrets, then deploy. Alternatively use `npx wrangler secret put JUSTTCG_API_KEY` in an authenticated operator terminal. Never put it in config.js, GitHub source, a screenshot or chat.
3. In the app open an exact card printing, select its version/finish/edition/language, then change condition. The preview must show the matching quote. Confirm another edition or language does not reuse it. Unknown or ambiguous mappings remain unpriced.
4. Inspect `/api/prices/conditions` for an exact app card selection. Without the secret it reports `not_configured`; with a verified current quote it reports `available`. `unmapped`, `unpriced`, `rate_limited` and `unavailable` are distinct states.

## Identity and caching

The Worker resolves product IDs from canonical Scryfall IDs, TCGdex variants, or verified Yu-Gi-Oh set code + rarity matches. It does not accept an arbitrary TCGplayer product ID from the browser. Provider calls and the API key stay on the Worker. All conditions for a product share a 24-hour durable cache; raw provider history is not exposed. Browser requests are deduplicated by exact selection and limited to two concurrent requests.

A quote includes condition, currency, source, observed time, expiry and SKU. The UI calls it a provider estimate; it does not claim to have averaged individual seller listings. It is bound to the collection lot's exact printing, finish, edition and language. Expired/null/ambiguous quotes are excluded. Personal condition values retain priority. Generic reference prices do not fill played/damaged conditions. The collection graph uses the resulting lot values, not invented discount ratios.

This release refreshes watched collection selections on demand (up to the first 100 lots per visit). It does **not** yet run a nightly full-catalogue condition-price ingestion job. That needs an activated provider, quota sizing and persistent bulk storage; the existing scheduled market-history jobs remain separate.

## Verification

`node test-condition-feed.mjs` exercises all five tiers, condition/finish/language/edition isolation, expired/null and duplicate rejection, disabled mode, server-side authentication and cache reuse using deterministic provider fixtures. CI additionally checks the real application controls and responsive layout. Live provider prices cannot be verified without a configured credential.

Provider documentation: https://justtcg.com/docs/quickstart · https://justtcg.com/docs/api/cards · https://justtcg.com/docs/schema/variant · https://justtcg.com/pricing

## 3.73.13 price repair and spending controls

Reference fallback order is positive market price, then median asking/listing price, then lowest listing price. Listing estimates are labeled; these mixed-condition statistics never become an LP, MP, HP or Damaged quote. Shipping, fees and a guaranteed resale price are not implied. Exact name, collector number, edition, finish and rarity matching prevents borrowing a similar card's price. Missing aggregate prices no longer discard verified Yu-Gi-Oh product identities.

`CONDITION_PRICES` is a durable coordinator deployed by the `condition-prices-v1` migration. It stores a compact provider product response for 24 hours across users and edge regions and deduplicates simultaneous requests. Limits default to **30 external requests/day, 900/month and 8/minute**, shared by all users and games. They are configured only on the server using `CONDITION_DAILY_LIMIT`, `CONDITION_MONTHLY_LIMIT`, and `CONDITION_MINUTE_LIMIT`. Set them to zero to pause new provider requests. Failed provider calls consume budget too; HTTP 429 triggers shared backoff. Existing cached quotes can still be served at the limit. Provider credentials remain required; adding this coordinator does not activate or purchase a subscription.

Refresh is on demand: loaded Pokémon/Yu-Gi-Oh data expires after 24 hours, Magic missing-price set caches expire after 24 hours even in a long-running session, and collection visits refresh stale Magic exact printings in batches of 75 (up to 150 per automatic pass). No nightly whole-catalogue condition pull is introduced. This avoids paying to refresh cards nobody is viewing. Browser condition requests are limited to two concurrently and start their timeout after entering the queue.

`node test-pricing-repair.mjs` additionally verifies listing fallback labels, name/edition collisions, long-session expiry, recovered condition mapping, all-user durable cache reuse, concurrent request deduplication, daily/monthly caps and upstream rate-limit backoff. Live condition values still cannot be checked until `JUSTTCG_API_KEY` is configured.
