# Cardforge

Your Magic: The Gathering, Yu-Gi-Oh! and Pokémon collections, decks, upgrades and deck analysis in one installable web app. It runs entirely in the browser with no account and no server. Your cards are saved on your device, and card data and prices come live from [Scryfall](https://scryfall.com).

## What it does

- **Tournament-backed decks for all three games — Magic via TopDeck.gg, Yu-Gi-Oh! via YGOPRODeck, Pokémon via Limitless — with the original list, a budget adaptation that keeps the engine, and a draft from your own cards** *(new in 3.4)*.
- **Deck ideas and builds from any number of your cards, and one Home layout for all three games**.
- **Game emblems, random cards & decks, full filters/sorting and “Did you know?” card facts for all three games**.
- **Art-first card pages, rules & banned lists, and equal deck tools for all three games**.
- **Three games** *(new in 3.0)*: Magic (Scryfall), Yu-Gi-Oh! (YGOPRODeck) and Pokémon (TCGdex), each with its own collection, decks, formats, sets and daily prices. Switch from the header or Home.
- **Deck generator** *(new in 2.9)*: build a complete, legal deck around any card in any format, at several budgets, using your cards first.
- **Every format** *(new in 2.8)*: 22 formats from Standard to Oathbreaker, each with its own deck size, copy limits, commander rules and Scryfall banned/restricted list.
- **Collection**: add cards one at a time, from a list, or by photo scan. Track daily value, see value by color, and keep a trade binder of cards no deck uses.
- **Decks**: import from Moxfield, Archidekt, ManaBox or MTGJSON. See what you own, what's missing and what it costs to finish.
- **Engine score**: a 0–100 build-health check covering lands, ramp, draw, removal, synergy and curve, with 1,000 seeded goldfish test games.
- **Commander bracket estimate** *(new in 2.2)*: the lowest bracket (1–5) your list fits, based on Game Changers, tutors, extra turns and mass land denial, plus what to cut to drop a bracket.
- **Mana base helper** *(new in 2.2)*: suggests how to split your basics using the colored symbols in your spells, and flags lands that always enter tapped.
- **Deck review** *(new in 2.3)*: one badge per deck ("3 to review") that opens every rules problem and guideline worth a look, each with its evidence and a fix button.
- **Buy this card** *(new in 2.3)*: tap any price for direct store links to that exact printing, an honestly labeled estimate, and cheaper printings.
- **Set pages** *(new in 2.4)*: tap any set badge for every printing in that set, with what you own, search, rarity and price sorting. "Browse sets" lists every paper set live from Scryfall.
- **Official mana symbols** *(new in 2.4)* in costs, color identity and rules text.
- **Find decks I can almost build** *(new in 2.5)*: precons, shared and saved decks ranked by what it costs to finish them from your collection.
- **Share links** *(new in 2.5)*: send a deck to anyone as a link. They can match it to their own collection and make their version, with credit to you. No account needed, and your collection is never included.
- **Upgrade lab**: budget ladder with engine gain per dollar, slot filling, and before/after comparisons.
- **Versions**: automatic snapshots, so you can compare any two versions of a deck.
- **Playtest**: opening hands and mulligans, a game log tagged with the deck version, and a **life tracker** *(new in 2.2)* for 2–6 players with commander damage, poison and turns.
- **Proxy sheets** *(new in 2.2)*: print missing cards (or the whole deck) 9 per page at real card size for playtesting.
- **Deck ideas & random decks**: commanders your collection already supports, built into full 100-card proposals within a budget.

## Run it locally

Any static file server works:

```sh
npm start          # serves on http://localhost:8080
npm test           # pure-logic and action tests (Node 22+)
```

## Publishing

The site is plain static files, so there is no build step.

### Cloudflare (your current site)

**Option A, automatic from GitHub (recommended).** In Cloudflare go to Workers & Pages → `cardforge2` → Settings → Builds → **Connect**. Pick this repository and branch, and leave the build command empty. The deploy command is `npx wrangler deploy`. From then on, every push deploys automatically. `wrangler.jsonc` keeps the Worker name the same, so your site address and saved collection don't change. `.assetsignore` keeps tests and config files off the live site.

**Option B, manual zip upload.** Export a backup in Settings first, then upload the site files to the same Worker as before (see `START_HERE.txt`).

### Magic tournament results (TopDeck.gg)

Magic's **Decks → Find decks → Tournament results** comes from the free [TopDeck.gg API](https://topdeck.gg/docs/tournaments-v2) through the Worker, so the key never reaches the browser.

1. Create a free API key at topdeck.gg (API docs → **Get API Key**).
2. Cloudflare → Workers & Pages → `cardforge2` → Settings → **Variables and Secrets** → add a **Secret** named `TOPDECK_KEY` (or run `npx wrangler secret put TOPDECK_KEY`).
3. Check what TopDeck actually returns for each format:
   `node scripts/topdeck-coverage.mjs --site https://<your-site>` (or `TOPDECK_KEY=… node scripts/topdeck-coverage.mjs` locally).

The Worker caches each format for 12 hours, refreshes the main formats daily (cron in `wrangler.jsonc`), and keeps serving the last good data (marked as such) if TopDeck is down. TopDeck requires the visible "Data provided by TopDeck.gg" credit, which the app shows wherever the data appears. Only top-cut lists are used, so shares mean "share of published top-cut lists" — not overall popularity or win rate. Yu-Gi-Oh! (YGOPRODeck) and Pokémon (Limitless) need no key.

### GitHub Pages (free second address)

GitHub Pages serves only static files, so the Worker features (Yu-Gi-Oh! card-image cache, Yu-Gi-Oh! meta, Magic tournament results) work on the Cloudflare address only.



In GitHub go to Settings → Pages → Source → **GitHub Actions**. The `Publish to GitHub Pages` workflow then deploys the default branch to `https://<user>.github.io/Card-forger/` on every push.

Each web address keeps its own storage. A collection saved on the Cloudflare address won't appear on the GitHub Pages address until you restore a backup there.

## Accounts (optional, Supabase)

Cardforge works fully without accounts. Signing in adds a private copy of your workspace in your
account so it follows you to other devices. It's off until a key is added to `config.js`.

One-time setup in the Supabase dashboard (project `noxfmbwuytnbvfgukpiv`):

1. **SQL Editor →** paste and run `supabase/migrations/20261012000000_cardforge_accounts.sql`.
   It creates `profiles` and `workspaces`, both with row-level security (each user can only read
   and write their own row) and no access for signed-out visitors.
2. **Authentication → URL Configuration →** set *Site URL* to your Cardforge address
   (e.g. `https://cardforge2.<you>.workers.dev`) and add the same address to *Redirect URLs*.
3. **Authentication → Providers →** Email is on by default. For Google, enable it and paste a
   Google OAuth client ID and secret (Google Cloud Console → Credentials → OAuth client → Web).
4. **Project Settings → API Keys →** copy the **publishable** key (`sb_publishable_…`, or the
   legacy `anon` key) into `config.js`. Never use the `service_role`/secret key in the app.

How sync behaves: the app always saves on the device first, then pushes to the account a few
seconds later. Every write is checked against the revision the device last saw, so two devices
never silently overwrite each other — if both changed, you choose which copy to keep and the other
is downloaded as a backup file. The first sign-in on a device with existing data asks before
uploading or replacing anything. Signing out leaves the data on the device.

## Files

| File | Purpose |
| --- | --- |
| `index.html`, `style.css` | App shell and all styling |
| `app.js` | Actions, routing, saving and Scryfall calls |
| `views.js` | Every screen |
| `insights.js` | Engine score, goldfish sim, versions and value math |
| `builder.js` | Deck generator for every format |
| `rules.js` | Rules reference and live banned lists |
| `tcgbuild.js` | Yu-Gi-Oh! and Pokémon deck generators |
| `emblems.js` | Yu-Gi-Oh! attribute/level/Spell-Trap emblems, Pokémon energy symbols, set and rarity badges (Pokémon set/rarity symbol images from [pokesymbols.com](https://pokesymbols.com)) |
| `meta.js` | Live tournament meta: YGOPRODeck Tournament Meta Decks (via the Worker) and Limitless Pokémon events |
| `topdeck.js`, `scripts/topdeck-coverage.mjs` | TopDeck.gg normalizer (used by the Worker) and the per-format coverage report |
| `adapt.js` | Closest proven deck: similar lists, engine detection, budget adaptation with reasons, owned-card draft |
| `facts.js` | “Did you know?” facts built from each card’s data |
| `games.js`, `tcg.js`, `ygo.js`, `ptcg.js` | Yu-Gi-Oh! and Pokémon: data adapters, rules and screens |
| `worker.js` | Cloudflare Worker: serves the site and caches Yu-Gi-Oh! card images, Pokémon set/rarity symbols and the Yu-Gi-Oh! tournament meta |
| `formats.js` | Rules for all 22 formats |
| `extras.js` | Bracket estimate, mana base, proxy sheets and life tracker |
| `core.js`, `planner.js`, `strategy.js`, `deck-flow.js`, `confidence.js`, `catalog-tools.js` | Rules, import, planning and catalog logic |
| `store.js`, `storage.js`, `ui.js` | Shared state, IndexedDB storage and HTML helpers |
| `cloud.js`, `config.js`, `supabase/` | Optional accounts and cloud sync |
| `share.js` | Share links and the "almost build" finder |
| `sw.js`, `manifest.webmanifest` | Offline support and install-as-app |
| `test-*.mjs` | Tests (`npm test`) |

## Limits

Engine score, bracket estimates, upgrade picks and test games are transparent rules and simulations based on card text. They are not AI predictions or win rates. The bracket estimate can't detect two-card combos or how a deck is played. Prices are Scryfall reference estimates. Only single commanders are supported (no partners or backgrounds yet).

Card data and images © Wizards of the Coast, provided by Scryfall. Cardforge is unofficial Fan Content and isn't approved or endorsed by Wizards.
