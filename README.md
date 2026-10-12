# Cardforge

Your Magic: The Gathering collection, decks, upgrades and deck analysis in one installable web app. It runs entirely in the browser with no account and no server. Your cards are saved on your device, and card data and prices come live from [Scryfall](https://scryfall.com).

## What it does

- **Collection**: add cards one at a time, from a list, or by photo scan. Track daily value, see value by color, and keep a trade binder of cards no deck uses.
- **Decks**: import from Moxfield, Archidekt, ManaBox or MTGJSON. See what you own, what's missing and what it costs to finish.
- **Engine score**: a 0–100 build-health check covering lands, ramp, draw, removal, synergy and curve, with 1,000 seeded goldfish test games.
- **Commander bracket estimate** *(new in 2.2)*: the lowest bracket (1–5) your list fits, based on Game Changers, tutors, extra turns and mass land denial, plus what to cut to drop a bracket.
- **Mana base helper** *(new in 2.2)*: suggests how to split your basics using the colored symbols in your spells, and flags lands that always enter tapped.
- **Deck review** *(new in 2.3)*: one badge per deck ("3 to review") that opens every rules problem and guideline worth a look, each with its evidence and a fix button.
- **Buy this card** *(new in 2.3)*: tap any price for direct store links to that exact printing, an honestly labeled estimate, and cheaper printings.
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

### GitHub Pages (free second address)

In GitHub go to Settings → Pages → Source → **GitHub Actions**. The `Publish to GitHub Pages` workflow then deploys the default branch to `https://<user>.github.io/Card-forger/` on every push.

Each web address keeps its own storage. A collection saved on the Cloudflare address won't appear on the GitHub Pages address until you restore a backup there.

## Files

| File | Purpose |
| --- | --- |
| `index.html`, `style.css` | App shell and all styling |
| `app.js` | Actions, routing, saving and Scryfall calls |
| `views.js` | Every screen |
| `insights.js` | Engine score, goldfish sim, versions and value math |
| `extras.js` | Bracket estimate, mana base, proxy sheets and life tracker |
| `core.js`, `planner.js`, `strategy.js`, `deck-flow.js`, `confidence.js`, `catalog-tools.js` | Rules, import, planning and catalog logic |
| `store.js`, `storage.js`, `ui.js` | Shared state, IndexedDB storage and HTML helpers |
| `sw.js`, `manifest.webmanifest` | Offline support and install-as-app |
| `test-*.mjs` | Tests (`npm test`) |

## Limits

Engine score, bracket estimates, upgrade picks and test games are transparent rules and simulations based on card text. They are not AI predictions or win rates. The bracket estimate can't detect two-card combos or how a deck is played. Prices are Scryfall reference estimates. Only single commanders are supported (no partners or backgrounds yet).

Card data and images © Wizards of the Coast, provided by Scryfall. Cardforge is unofficial Fan Content and isn't approved or endorsed by Wizards.
