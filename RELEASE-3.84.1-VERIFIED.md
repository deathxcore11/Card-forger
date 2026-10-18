# CardStashy 3.84.1 — published release evidence

Published 2026-10-18 UTC after the user's explicit “Ok continue and push.”

## Production

- Live application: https://cardstashy.com/
- Worker address: https://cardforge2.deathxcore11.workers.dev/
- Production branch: `claude/edit-publish-github-bpm8zu`.
- Release commit: `1ac52f86788a7f4e9fe6f933e7e605dd11eb68ff`.
- Release tree: `013fc91cccd103396fe100a0b18c01d9ba7a885c`.
- Version: **3.84.1**. Service-worker cache: **cardforge-shell-v214**.
- Expected-head update succeeded from `68d11b59a5a4a255c55c56fefe43d5131896cb76`; both production and integrated-work histories are retained. No other-chat work was overwritten.

Both public addresses serve the new version, service worker and all **74 checked application modules/stylesheets with exact release hashes**. The Worker serves the exact release HTML too.

The main domain's HTML differs by its Cloudflare analytics script plus one newline. The rest of its HTML matches the release. The strict raw-byte deployment verifier intentionally reports that difference as a mismatch; it was not weakened or relabeled as an exact-byte pass. Application module verification succeeded on both hosts. See the public deployment workflow and its retained raw evidence: https://github.com/deathxcore11/Card-forger/actions/runs/39095032854

The optional GitHub Pages workflow failed because that separate Pages site is not enabled. Its complete `npm test` step passed. The existing Cloudflare production deployment succeeded; no additional Pages site was enabled or substituted for production.

## Verification

All **16 regression job groups passed** in the final integrated run:
https://github.com/deathxcore11/Card-forger/actions/runs/39094798545

This includes full Node tests, isolated database safety, finish effects, real-reference scanner flows, mixed capture/printing/lifecycle checks, accounts, Community/decks, responsive cards, Sets, Search, Home, dropdowns, and game switching.

Magic's earlier Scryfall timeouts stopped reproducing. The normal Chromium job passed real photo OCR, exact printing lookup, explicit review, finish/condition/language/copy edits, save-once behavior, live-camera continuity, resized controls and Undo for all three games. Independent phone/desktop native HTTP/2 and phone HTTP/1.1 requests returned the expected Lightning Bolt. A separate complete HTTP/1.1 scanner run also passed:
https://github.com/deathxcore11/Card-forger/actions/runs/39094798596

No API fixture substitution or relaxed assertions were used for these live scanner checks. The underlying cause of the earlier intermittent transport failure is not claimed fixed. Physical phone camera and gyro behavior were not directly tested; browser orientation events and synthetic camera streams were used alongside real public card reference images.

Production-commit CI also runs here:
https://github.com/deathxcore11/Card-forger/actions/runs/39095032789

## Community migration

The native migration call succeeded. Production records `20261018034423_community_shared_deck_details`, corresponding to the checked-in `supabase/migrations/20261018014537_community_shared_deck_details.sql`.

The complete `supabase/tests/community_access.sql` suite passed against the deployed function in a rolled-back transaction. It checked deck format/sections/public reference prices, private-field removal, friend consent and blocking, exact lookup without email disclosure, and account/workspace isolation. All synthetic account/workspace changes were rolled back. Existing security-advisor findings were unchanged.

## Remaining provider limitation

The live Zarude normal-printing condition endpoint returned `provider_shared_limit` / `EXCESSIVE_FREE_TIER_USAGE`. This is the shared JustTCG provider restriction; the user's 6% individual quota does not rule it out. Official documentation: https://justtcg.com/docs/rate-limits

The probe was unauthenticated (`ownerVerified:false`), so it does not prove or disprove the owner's signed-in session. Owner exemption is verified by the Auth server and applies to app caps; it deliberately respects provider restrictions. Tests for owner identity, revoked/anonymous/forged denial, token forwarding, cache reuse and provider backoff passed. No subscription was purchased, rate restriction bypassed, or condition quote invented. An actual signed-in owner condition-price recovery check remains outstanding.

The deployed app keeps reference prices separate from unavailable condition quotes, retains valid saved quotes and provides explicit retry. JustTCG's provider restriction remains unresolved by this software release.
