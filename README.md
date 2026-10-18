CardStashy is the renamed Cardforge app. Existing browser/IndexedDB keys, backup formats, Supabase project, GitHub repository and Cloudflare Worker URL intentionally remain unchanged so existing data stays accessible.

Animated binders live in Collection → Binders for all three games. They group collection entries by the existing location field, display nine entries per page and do not add or duplicate owned cards. Empty locations appear as Unsorted cards. Animations respect prefers-reduced-motion.

# CardStashy

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

### Shared price history (one-time setup)

1. Supabase → **SQL Editor** → paste and run `supabase/migrations/20261013000000_price_history.sql`.
2. Supabase → Project Settings → **API keys** → copy the **secret** key.
3. Cloudflare → Workers & Pages → `cardforge2` → Settings → **Variables and Secrets** → add a **Secret** named `SUPABASE_SERVICE_KEY` with that key.

The Worker then records daily prices at 07:41 UTC for every tracked Magic and Yu-Gi-Oh! card (about 2,250 Magic and 300 Yu-Gi-Oh! cards per day on Cloudflare's free plan; raise `PRICE_BATCHES` / `YGO_PRICE_BATCHES` variables on a paid plan).

### Sign-up emails not arriving

Supabase's built-in email sender only delivers to members of your Supabase team, and only a few emails per hour. For real users:

1. Create a free account at an email service such as [Resend](https://resend.com) and verify a sending domain.
2. Supabase → Authentication → **Emails → SMTP Settings** → enable custom SMTP with Resend's host, port, user and password (or install the Resend integration).
3. Supabase → Authentication → **URL Configuration**: set **Site URL** to your site (e.g. `https://cardforge2.deathxcore11.workers.dev`) and add it to **Redirect URLs**.

To skip confirmation entirely while testing: Authentication → Sign In / Providers → Email → turn off **Confirm email**.

### Magic tournament results

Magic's **Decks → Meta decks** works without any setup: constructed formats come from Wizards' official [Magic Online decklists](https://www.mtgo.com/decklists) and Commander from [EDHTop16](https://edhtop16.com), both fetched and cached by the Worker (`mtgmeta.js`). Optionally, add a free [TopDeck.gg API](https://topdeck.gg/docs/tournaments-v2) key as a fallback and for extra formats:

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

Database migrations are applied to the current project. For a fresh project, run both SQL files in `supabase/migrations`. Remaining sign-in setup in the Supabase dashboard (project `noxfmbwuytnbvfgukpiv`):

1. **Authentication → Email / SMTP →** configure a mail provider for public signups. The default Supabase mail service restricts recipients and is not suitable for a public app.
2. **Authentication → URL Configuration →** set *Site URL* to your Cardforge address
   `https://cardforge2.deathxcore11.workers.dev/` and add that exact URL to *Redirect URLs*.
3. **Authentication → Providers →** Email is on by default. For Google, enable it and paste a
   Google OAuth client ID and secret (Google Cloud Console → Credentials → OAuth client → Web).
4. **Project Settings → API Keys →** copy the **publishable** key (`sb_publishable_…`, or the
   legacy `anon` key) into `config.js`. Never use the `service_role`/secret key in the app.

Google OAuth must allow `https://noxfmbwuytnbvfgukpiv.supabase.co/auth/v1/callback` as an authorized redirect URI. Google is currently disabled in this project; it needs credentials before the app can offer it. Do not put the Google client secret in frontend code.

Account isolation: the active workspace and recovery copy are switched atomically using the immutable Supabase user ID. Each account retains its own device archive; guest data is separate and is never imported merely by signing in. A legacy workspace is preserved before its first migration. The old profile, dialogs and drafts are hidden immediately while the next account opens. Pending sync decisions carry their owner and session generation; “Later” blocks manual and automatic uploads until an explicit choice. Storage writes reject a mismatched active owner, and delayed cloud responses cannot adopt another account’s data.

Production Auth configuration uses `https://cardstashy.com/` as Site URL and exact callbacks for that URL and `https://cardforge2.deathxcore11.workers.dev/`. Keep preview URLs separate and avoid broad callback wildcards. `supabase/tests/workspace_isolation.sql` tests the deployed policies with synthetic identities inside a rolled-back transaction. `tests/account-browser.mjs` tests actual app code with two independent synthetic backend accounts; it never sends credentials or writes real users’ workspaces.

Account UI: Settings offers email/password login, Create account, Forgot password, Google when enabled, and optional magic links. Email confirmation and password recovery require SMTP. Recovery links must be opened in the requesting browser for PKCE verification. A Supabase PASSWORD_RECOVERY event opens the new-password screen; no password is written into workspace storage.

How sync behaves: the app always saves on the device first, then pushes to the account a few
seconds later. Every write is checked against the revision the device last saw, so two devices
never silently overwrite each other — if both changed, you choose which copy to keep and the other
is downloaded as a backup file. The first sign-in on a device with existing data asks before
uploading or replacing anything. Signing out leaves the data on the device.

### Account deletion (required by Google Play; one-time setup)

Players delete their account in **Settings → Account → Delete account** (typed DELETE to confirm),
and the public page **/delete-account.html** explains how, for the Play Store's "delete account" URL.
Deletion runs a database function, so run this once in Supabase → **SQL Editor**:
`supabase/migrations/20261015120000_delete_my_account.sql`. It deletes only the signed-in user's
account, synced collection and profile; no secret key is involved. Until it's run, the button says
deletion isn't set up yet.

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
| `mtgmeta.js` | Magic Online and EDHTop16 normalizers (used by the Worker), archetype naming by key cards |
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

## 3.9 safeguards and browsing

Magic completion respects its target, rejects known illegal/nonfunctional retained cards, and offers reviewed cuts for oversized lists without treating every >60 list as illegal. Completed non-Commander decks can preview conservative same-role spell swaps; each applies one copy in and one out, with a saved version. Scores measure heuristic build health, including an aggro lens, rather than win rate. Pokémon card-name lookups use the persistent catalog first and deduplicate in-flight requests; six workers keep source load bounded. Set pages progressively load more cards near the viewport, retaining an accessible button fallback.

### Shared market history (3.34)
The deployed Supabase `market-history` function stores public quotes separately from inventory.
Browser callers can request a printing and finish, but cannot submit prices. The nightly
`.github/workflows/market-history.yml` importer uses short-lived GitHub OIDC tokens restricted
to this repository, production branch and workflow; no server credential is stored in GitHub
or browser code. It runs at 06:37 UTC and records recently viewed cards (90-day active window,
3,000-series registration limit). Unavailable feeds preserve existing data.
New Magic printings can receive up to 90 days of MTGJSON backfill. Historical and current
providers remain distinct selectable datasets. Six-month and one-year ranges show available
observations only; they do not manufacture a full year. Pokémon exact-product fallback reads
TCGCSV market prices and keeps asking prices separate. The previous Cloudflare price feed
remains available for deployments configured with its server secret.

### Exact history feeds (3.38)

Pokémon and Yu-Gi-Oh! recent histories use TickerMint's exact TCGplayer product IDs.
Every rendered TickerMint series links back to its card page. The keyless feed is for
personal/non-commercial deployments; commercial deployments need the provider's
commercial license. Do not redistribute its raw history as a dataset or standalone feed.
Terms and API reference: https://tickermint.cards/developers

Magic's daily importer streams MTGJSON AllIdentifiers and AllPrices, joins UUIDs to
Scryfall printing IDs, and imports available market quotes from the last 31 calendar
days for every priced paper printing/finish. It does not shift old observations into
the current month, interpolate missing quotes, or merge market/mid archive prices
with the current provider. Batches are authenticated with repository-scoped GitHub
OIDC and merged through a service-role-only RPC.

### 3.39.0
Artwork proportions now follow their source: landscape Magic art, square Yu-Gi-Oh! art, and uncropped Pokémon scans. Shared dialog chrome, subtle reveal motion and reduced-motion support remain consistent across layouts. Pokémon and Yu-Gi-Oh! builders now use the same manual purchase budget and quick tiers as Magic. A bounded two-pass replacement search compares legal engine packages with the existing Power evaluator, protects the build-around card and keeps deck quantities. Closely matched tournament engines outrank unsupported generic scores. Repeated tiers explain the candidate limit; stronger options over budget show actual purchase totals, the gap and their complete list before review. This is a candidate search and partial rules model, not exhaustive optimization or a claimed win rate.

## Optional AI deck review

The Power tab offers an on-demand AI second opinion for all three games. Numeric scores stay deterministic. See [AI_SETUP.md](AI_SETUP.md) to connect the server-side OpenAI key, review limits and data handling. The feature makes no paid calls until configured and requested.
