# Lost Memories engine (codename crucible)

R&D build of the Lost Memories mode: a deterministic rules engine, three CPU levels, the
run layer and a headless simulator. Plain JavaScript modules, no dependencies. Nothing in
this folder is wired into the site or the app, and no app or site file is changed by it.

Status words follow the repo rule. **Pass** here means "seen passing in Node on the cloud
machine". Nothing in this folder has been played by a person or seen on a device.

## Run it

```
node tools/crucible/build-pool.mjs --fetch --count     # pool size at three cut-offs
node tools/crucible/build-pool.mjs --fetch             # writes crucible/data/crucible-pool.json
node crucible/test/test-crucible-rules.mjs             # 86 rule tests
node crucible/test/test-crucible-fuzz.mjs 6000 600     # random play with invariants
node crucible/test/test-crucible-fuzz-levers.mjs 1000 200 1   # the same with every Lab lever on, Heat 0-10, wild actions, rule changes mid-run, profiles
node crucible/test/test-crucible-events.mjs 6000        # random play; every change in the state must have an event the page can show
node crucible/test/test-crucible-caps.mjs 1500 1        # random CPU duels; no relic may fire more often than its own text says
node tools/crucible/page-checks.cjs <built index.html> <duel save> [w h]   # a browser taps the built page: Spell targets, forecast, card page
node tools/crucible/make-saves.mjs <dir>               # saved games for every kind of screen (floors 1-3, Heat 0/5/10)
SAVE=<dir>/x.json RELOAD=37 node tools/crucible/play-bot.cjs <index.html> 1 <shots> 1280 720   # click bot from a saved game, with layout and message checks
node tools/crucible/make-fixtures.mjs --check          # replay golden fixtures hash for hash
node tools/crucible/sim.mjs --runs 10000 --level 2 --family neutral
node tools/crucible/make-pack.mjs <dir>                # the full game pack: rules, screens, items, numbers, and every card as a CSV
```

`--level` is the simulated player's skill (0 Novice, 1 Adept, 2 Master). `--family` is
`neutral`, `furnace`, `shadow`, `lean` or `storm`. Set `CRUCIBLE_CFG='{"drawPerTurn":0}'`
to try a config value without editing the file.

## Files

| Path | What |
| --- | --- |
| `data/crucible-pool.json` | Generated from the app's Yu-Gi-Oh card source. Never edited by hand. |
| `data/crucible-spell-tags.json` | Hand-kept: which Spell or Trap does which of the twelve effects, and what each Field Spell favours. |
| `data/crucible-config.json` | Every tunable number. |
| `engine/rng.mjs` | PCG32, state kept as a string so it saves and hashes the same everywhere. |
| `engine/cards.mjs` | Card database, meld rules, weight, the Attribute wheel. |
| `engine/duel.mjs` | The duel: `apply(state, action, db)`, `legalActions`, `viewFor`, `forecast`. |
| `engine/relics.mjs` | Charms, Gifts and Masterworks with their text and rules. |
| `engine/ai.mjs` | CPU players. They receive only `viewFor(seat)`. |
| `engine/run.mjs` | The descent: kits, doors, rivals, bosses, rank, drops, Anvil, Bazaar. |
| `engine/policy.mjs` | Scripted players for the simulator. |
| `engine/forgers.mjs` | The playable characters: a rule, a once-a-duel power and three kits each. Sim flag `--forger tarn`. |
| `engine/meta.mjs` | What stays between runs: Memories, Codex, Forger feats, Heat, the Memory Vault. |
| `web/` | The playable test page (`app.mjs`, `play.css`, `story.mjs`, `labs.mjs` for the Lab switches, `text.mjs` for what a card does in words). Build with `tools/crucible/build-web.mjs`, test with `tools/crucible/play-bot.cjs`. Art is not in this repository. |
| `fixtures/` | 50 duels and 10 runs: seed, actions, and a state hash after every action. |

## Readings taken where the design bible was silent or unclear

Each of these is a decision the engine had to make. They are listed so the owner can
overrule any of them.

1. **Draw limit (a change to the bible).** The hand still fills toward five, but a turn
   draws at most two cards (`drawPerTurn`). With a full refill the simulator's best line was
   a four-card meld almost every turn, and a player's win rate depended on little else.
   Set `drawPerTurn` to 0 for the bible's original rule.
2. **Order in a turn.** Play first, then attacks. Once you attack you cannot play.
3. **Position changes.** A monster may change position once a turn, not on the turn it
   arrived and not after it attacked.
4. **Veiled** means face down in defense. Face down in attack needs Hollow Mask, Fog or Mist.
5. **Scrap.** Your one play may be to send a hand card to the graveyard, so a hand of
   unplayable cards can never lock a duel.
6. **Hand limit six.** Draws stop at six. A bounced card that finds a full hand goes to
   the bottom of its owner's deck.
7. **Targets.** A Spell picks the rival's strongest face-up monster unless a target is given.
8. **Traps** answer one attack each. The defender is asked only when a set Trap can act.
9. **Fusion Monsters are reached only by their printed recipe.** They are not results of
   cross melds.
10. **A meld result keeps duel bonuses** from card A (fuel, Equips, relic bonuses) but not
    its temper or Enchant.
11. **Boss door without two seals.** The boss chamber shows three duel doors until both
    seals are broken.
12. **The third-floor boss.** Five-Headed Dragon is not in the classic pool, so the second
    boss is "The Last Gate" with Gate Guardian. Its Law brings the ace on its fourth turn.
13. **Finite counts added** where the text had none: The Unseen Hand and Glass Idol three
    times a duel, Copper Loop twice a duel, Storm Needle three times a duel.
14. **Clean Draw** is used before your play: put one hand card on the bottom, draw one.
15. **Heat** only raises rival strength for now. It does not add rules yet.

## Not built yet

Kotlin engine for the app, the app screens, the full story (the page has first-pass scenes
only), real Heat rules, secrets, the reward route, balanced Forger numbers (Tarn clears 65%
in the simulator against about 42% with no Forger), and a CPU that only knows the melds a
new player would know.

## Levers and lab relics under test (all off by default)

Set through `CRUCIBLE_CFG`, or the "Lab rules" switches on the playable page's home screen.

- `freeCast`: the first Spell, Field or Trap played alone each turn does not use the play.
- `soloArrival`: a lone face-up Zombie, Fairy, Machine or Spellcaster uses a Type arrival.
- `testRelics`: a list of lab relic ids (`LAB` in `engine/relics.mjs`) the player carries in every duel.
  Lab relics are never offered in a run. They use chained hooks (`ingredients`, `mark`, `returned`,
  `endTurn`): one relic may raise a hook another answers, at most 4 deep and 12 raises a turn.
- `thornLp`: Life Points per veiled monster for Thorn Veil (default 150).
- `freeCast: "trap"`: only the first Trap set each turn is free. `freeCastRival` (`none`, `elite`, `boss`) says which rivals share it.
- `leanOffers`: one of the three Gifts offered comes from a build family the player already holds a piece of. `leanOffers: 2`: once two held relics share a build, a second option fits it too.
- `freeCast: "lone"` (Support turn): once a turn a Spell, Trap, Field or Equip played alone is free, and no meld may be made that turn.
- Linked relics: the seven Gifts in `LINK_GIFTS` (`engine/relics.mjs`) join two builds; they reach a run only through `labPool` (the page's `links` switch). `relicLinks(id)` lists what a relic sets off and what sets it off.
- Simulator players `engine_tomb`, `engine_pyre`, `engine_veil` (`engine/policy.mjs`) aim for one engine and re-deal for it.
- `giftRerolls`: how many times a run a Gift offer may be dealt again (action `{ t: 'reroll' }`).
- `rivalStyles`: from the second floor a themed rival carries relics (`STYLES` in `engine/run.mjs`), shows a tell on its door and plays toward it.
- `stormTune`: 1 is the first try (Patient Coil +200 / +200 and Copper Loop once a duel); an object `{ len, loopLen, loopN, loopAtk, loopDef, coilLen, coilAtk, coilDef }` sets the meld length Storm pieces ask for and what Copper Loop and Patient Coil give. `wardTune`: `{ n, cost }` for Grave Ward (uses a duel, graveyard cost). `itemTune`: 1 applies `ITEM_TUNE` in `engine/relics.mjs` (Storm pieces ask for four cards, Loop +200 ATK twice, Coil +200 / +200, Grave Ward once a duel) and `STYLES_TUNED` for the two rival styles that carry those pieces; wording through `relicText(db, id)` and `styleFor(db, id)`. The page's "Tuned items" switch, on by default. Sim-only families `pick_storm`, `pick_tomb`, `pick_shadow`, `pick_furnace`, `pick_lean` (`engine/policy.mjs`) keep the neutral play style and only prefer one family's Gifts. `forgerTune`: `{ tarnStoke, scrapDraw, veilSet }` (`veilSet` 1: the Veilwalker's first lone veiled set in defense each turn is free; 2: only while she holds no veiled monster).
- Furnace lab Gifts `banked_coals`, `quench`, `cinder_fall` (knobs `coalsAtk`, `cinderLp`, `cinderAtk`) and the feat Master Smith (`bigWins`).
- `kitTune`: 1 uses `KIT_TUNE` (per-kit cap on the strongest starting monster) to even out the starter kits; an object overrides per kit. `testKit`: offer one named kit three times, to measure a kit on its own.
- `heatRules`: the ten-level Heat ladder (`HEAT_RULES` in `engine/run.mjs`). Each Heat level adds one written rule and the old per-Heat stat scaling is switched off. `tools/crucible/profile-sim.mjs 100 30 2 1` plays profiles that climb it.
- `newRun` options (not config): `track` keeps the feat counters in `run.feat`; `featured` lists newly unlocked Gifts to show once; `locked` hides relics.

The long road (page switch "Long road", off by default): `runOptions(profile, forger, long)` gives `newRun` the open kits and Enchants (`kits`, `enchants` options), `applyRun(p, run, { long })` banks kit unlocks and per-Forger Heat records (Heat itself stays shared: `maxHeat(p)`), `FEATS_LONG`, `VAULT_ENCHANTS` (bought with `buy(p, 'ench:<id>')`). `profile-sim.mjs [profiles] [runs] [level] [climb] [long] [buyAll]` measures it.

Progress between runs lives in `engine/meta.mjs`: Memories, the Codex, Forger unlocks, and `FEATS`
(three build feats that count across runs and each unlock one Gift). See `reports/lab-2026-11-20.md`.

Measured over 3000 expert runs (19 Nov 2026): baseline clear 41.8%; freeCast 19.6% with wins from
behind on Life Points up from 6% to 20% and Traps sprung 0.11 to 0.78 a duel; Tomb Ledger + Grave
Call 53.1%, with Second Burial 67.4%; Thorn Veil and Cold Lantern on the shadow brain 27.0% to 27.8%.
