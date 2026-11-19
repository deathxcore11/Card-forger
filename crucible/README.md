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
node crucible/test/test-crucible-rules.mjs             # 40 rule tests
node crucible/test/test-crucible-fuzz.mjs 6000 600     # random play with invariants
node tools/crucible/make-fixtures.mjs --check          # replay golden fixtures hash for hash
node tools/crucible/sim.mjs --runs 10000 --level 2 --family neutral
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

Kotlin engine for the app, every screen, the story acts, account-level progress (Codex
across runs, Vault, level, unlocks), secrets, the reward route, and a CPU that only knows
the melds a new player would know.
