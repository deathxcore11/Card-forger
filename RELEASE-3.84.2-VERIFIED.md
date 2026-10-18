# CardStashy 3.84.2 — visual and Community repair

Published commit: `e1a9488bf4fe0228ff76dffc24bd8800a83852af`.
Published tree: `d1961806cedd14de8fec6fc591479e92ccc50848`.
Final integrated browser/regression run: https://github.com/deathxcore11/Card-forger/actions/runs/39098238218

## Changes

- Owned collection gallery uses each saved copy’s exact finish. Normal has no foil layer; holo and reverse holo use separate masked materials with a repeating light sweep. Viewing another finish never edits the lot.
- Restored the neutral moving detail spotlight driven by existing pointer/phone orientation controls. Fine textured foil uses the same light coordinates. Offscreen/background/reduced-motion surfaces stop effects.
- Source-backed Pokémon Holofoil layouts distinguish Celebrations Zekrom’s illustration window, Mega Charizard Y ex’s smooth full face, and shiny Charizard VMAX’s textured full face. Unknown layouts remain explicitly unsupported; prices never create finish availability.
- Corrected Yu-Gi-Oh! illustration coordinates and full-face Starlight coverage, with intact phone seller labels.
- Moved the effects switch to App settings. Preserved the top logo, restored the game-colored animated Ask background and illustrated Search suggestions.
- Fixed overlapping deck-box/title/format layout and outlined Community navigation icon.
- Shared binders reuse the real cover, page-turn and card-detail flow in read-only mode, with the public reference subtotal retained. Shared decks use the common inspector layout and save independent copies with format and sections intact. Cross-game player popups work from both Community and Account settings.
- Public showcase appearance stores only bounded safe fields. Older owner snapshots are repaired only if their complete card multiset still matches the local item, without changing already valid published deck sections.

## Evidence and limits

The isolated SQL suite checks friend consent, exact lookup without exposing email, server-side private-field stripping, safe public cover fields, and unchanged account/workspace isolation. Browser checks include exact source images and synthetic fixture identities. Phone orientation was emulated; physical phone camera/gyroscope hardware was not available.

Foil patterns and masks are approximate visual simulations, not authenticity checks. This patch does not change JustTCG provider restrictions or substitute reference prices for unavailable condition quotes.

## Published release — 2026-10-18 UTC

Published to `claude/edit-publish-github-bpm8zu` using a non-forced, expected-head fast-forward from `1ac52f86788a7f4e9fe6f933e7e605dd11eb68ff` to the commit above. Both https://cardstashy.com/ and https://cardforge2.deathxcore11.workers.dev/ serve version **3.84.2**, service-worker cache **cardforge-shell-v215**.

All **16 job groups** in the linked final integrated CI run passed on the published commit: unit/action, isolated database, deployment-verifier unit tests, finish effects, responsive cards, account/Community, deck boxes, Search, dropdown/rules, Home, Sets, card polish, scanner, adversarial scanner, game navigation, and Yu-Gi-Oh! history. Browser checks span phone, foldable, tablet and desktop sizes. These are hosted browser tests, not physical-device hardware tests.

### Production database

Applied `community_showcase_appearance` as migration version `20261018045349`. Source: `supabase/migrations/20261018041746_community_showcase_appearance.sql`, SHA-256 `f742621cf8c208fdf5e0e4f83accd1bdd24f49c4b56ef47c9dbf294d088937d0`.

The deployed `community_private.perform(text,jsonb)` body exactly matched the tested migration. A production transaction verified safe public appearance round trips, rejection of unsafe appearance URLs/private fields, and the existing access boundary. It used one synthetic account and rolled back; a follow-up confirmed no retained test accounts. Security advisors were unchanged from the pre-migration check.

### Live asset verification

Read-only public HTTP checks ran from **04:54:55 to 04:56:01 UTC**. All **77 checked modules/stylesheets on each host** matched the tested release hashes. `config.js` and `sw.js` matched exact expected bytes on both ordinary and cache-busted URLs. The Worker host's HTML also matched exactly.

The verifier's overall result remains **UNVERIFIED**, because the main domain's raw HTML hash differs. The domain serves Cloudflare-injected analytics; that is consistent with its previous release behavior, but this run did not prove an exact match after removing injected markup. This is not reported as a full raw-HTML verification pass. No runtime files were changed to suppress the discrepancy.

| Asset | Expected SHA-256 |
| --- | --- |
| `config.js` | `8c42e33ffa3874eeb2899736ac48d65d841d9b98f6ccd18ffc7854165f907a1c` |
| `sw.js` | `ffbd9da21690487db1e5c42c895e32f5c8844f2cd4a8451f2307bef55d35624c` |
| `index.html` | `2e8d3a35ffd9b38d65f6d5a5076c4d047225dfcb725487aca618c98229714603` |

Main-domain HTML SHA-256 observed: `d9b1989dff547850a6ac458b88974df0fba8303abe5651ea3e19f033da0ad088`.

The local verification checkout was commit `ac5f7a6db63025218265135f406ba9eb7c73de0c`, with the same tree as the published commit. This evidence document is recorded on the repair branch after deployment; it does not trigger another production release.
