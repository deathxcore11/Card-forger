# Forge engine handoff: pacing, attachments, arrows, battlefield fields, faster JIT

**Use `forge-adapter-427.patch`.** It holds everything in `forge-adapter-play.patch` plus
the battlefield fields below, for both bridge copies. It was checked against the host branch
at `cf5f7df` (C1-only JIT, deployed 27 Oct). Both copies there are byte-identical
(`f51b3360…`), and after the patch both hash to
`4d3d2607d5c2aec7bc764ad15ffcc33242f1e061dac050d07939beb232e8501e`, the exact source played
in the proof games. `forge-adapter-play.patch` is kept only for history.

For whoever rebuilds the Forge host (`codex/forge-github-host-prep-20261026`).
Both patches below were checked with `git apply --check` against that branch at
`d017be8` ("Smart passing stops where MTG Arena stops"), which already carries the
Arena auto-pass change.

## What is in each patch

### `forge-adapter-play.patch` (bridge, Java)

It targets `experiments/forge-proof/combined-browser-proof/candidate/build-context/native/adapter/src/cardstashy/forge/ForgeHttpBridge.java`.
The branch also has an identical copy at `.../candidate/native/adapter/...`, so apply the patch to both.

1. **CPU pacing.**
   - When the CPU plays a land, casts a non-trigger spell or ability, or declares attackers or blockers, the bridge publishes the board and then pauses for 650 ms. Set `-Dcardstashy.cpuStepPauseMs` to change the pause, or `0` to turn pacing off.
   - It never pauses on the player's own actions or on triggers. It also doesn't pause when no `/state` poll has arrived in the last 3 s, so an unwatched table is not slowed.
2. **Attachments.** Visible face-up cards now carry `attachedTo`, the id of the card they are attached to, and `attachments`, the ids of cards attached to them. Only ids of cards the viewer may see are included.
3. **Combat arrows.**
   - Attacking cards carry `attackTarget`, which is `{kind:'player'|'card', id}`.
   - Blocking cards carry `blockingIds`, the ids of the attackers they block.
4. **Stack targets.** Stack items' `targets` now list target players and target stack items as well as target cards. The visibility filter in `refs()` still applies.

The table (website 4.2.3/4.2.4) already reads all of these fields when they are present.

### Battlefield fields for the 4.2.7 icon kit (in `forge-adapter-427.patch` only)

These are projection only: no rules change, read from Forge's own state. Card fields are
sent only on face-up cards the viewer may see, as before.

| Field | Where | Meaning |
|---|---|---|
| `keywords` | card | `[{keyword, text}]`. Keywords the card has right now, printed or granted, with Forge's full title: `"Ward {2}"`, `"Ward—Pay 2 life."`, `"Crew 3"`, `"Equip {1}"`, `"Protection from red"`. `keyword` is Forge's enum name (`WARD`, `CREW`, …). Duplicate titles are dropped; omitted when empty. |
| `crew` | card | The crew number on vehicles (`3` for "Crew 3"). |
| `classLevel` | card | The current level of a Class enchantment (1 to 3). |
| `ringBearer` | card | `true` on its controller's Ring-bearer. |
| `commanderCasts`, `commanderTax` | card | On commanders: casts from the command zone so far, and the extra cost now (`2 × casts`). |
| `designations` | player | `{monarch, initiative, citysBlessing, ringTemptations, ringBearer}`. The first three are booleans, `ringTemptations` is a count, and `ringBearer` is a card id or `null` (`null` too when the viewer may not see it). |
| `dayNight` | board | `"day"`, `"night"` or `null` (neither yet). |

Example (trimmed):

```json
{"dayNight":"day",
 "players":[{"id":0,"designations":{"monarch":true,"initiative":false,"citysBlessing":true,"ringTemptations":1,"ringBearer":77},
   "zones":{"Battlefield":{"cards":[
     {"id":12,"name":"Krenko, Mob Boss","commanderCasts":1,"commanderTax":2,
      "keywords":[{"keyword":"WARD","text":"Ward—Pay 2 life."}]},
     {"id":40,"name":"Skysovereign, Consul Flagship","crew":3,
      "keywords":[{"keyword":"FLYING","text":"Flying"},{"keyword":"CREW","text":"Crew 3"}]},
     {"id":55,"name":"Artist's Talent","classLevel":1},
     {"id":77,"name":"Hexing Squelcher","ringBearer":true}]}}}]}
```

### `forge-gateway-jit.patch` (launcher, Python)

It adds `-XX:TieredStopAtLevel=1` to the java command in `deploy/forge-host/container/gateway.py`.
The same line exists in `candidate/build-context/hosting/gateway.py` and `candidate/host/container/gateway.py`; update those copies too if the proof package pins them.

## Evidence (real engine, deployed recipe, one core)

The engine was built from Forge `e5a0f8156da70ffc7866f923bed371c0111707cd`. The combined-browser-proof adapter, the AI overlay (12 classes) and the human overlay (9 classes) were reproduced byte for byte, and both attestations pass. It ran with gateway.py's JVM flags, pinned to one core, and was driven through the bridge's own `/state` and `/action`.

| Check | Result |
|---|---|
| Opening hand, current flags | 12.8–16.9 s |
| Opening hand, with `TieredStopAtLevel=1` | 8.1–8.3 s |
| 8 turns of play, current flags vs C1 only | 10.1–11.0 s vs 5.4–5.7 s, with the same 29 stops (same decisions) |
| Smart stops, same seed, 8 turns, all patches | 29, the same as auto-pass alone; 0 engine exceptions |
| Pacing: distinct CPU-turn states a poller sees | 3 off, 11 on; about +5 s over a 9-turn game |
| Attachments seen live | Swiftfoot Boots `attachedTo 201` (Kemba); Kemba `attachments [197]`, then `[197,196]`; Trusty Machete `attachedTo 201` |
| `attackTarget` seen live | Savannah Lions, Kemba and a Cat token: `{kind:'player', id:0}` |
| Stack targets seen live | equip abilities `[{kind:'card', id:201}]`; CPU Swords to Plowshares `[{kind:'card', id:211}]` |
| `blockingIds` | Seen live (27 Oct, 427 patch): CPU Sai, Thopter and Myr tokens block with `[84]`, `[51]`, `[54]`; the player's Harvesttide Infiltrator blocks with `[108]` |
| Battlefield fields seen live (9 Commander games, 27 Oct) | Keywords incl. granted (Hexing Squelcher gives Krenko `Ward—Pay 2 life.`), `Ward {2}`, `Crew 1`/`Crew 3`, `Dash {2}{R}`, `Daybound`; `crew` 1 and 3; `classLevel` 1 (Cool but Rude, Artist's Talent, Blacksmith's Talent); `ringBearer` and `designations.ringBearer`/`ringTemptations 1`; `commanderCasts 1`/`commanderTax 2` for both commanders, kept after the commander returns to the command zone; `monarch` and `initiative` for both players; `citysBlessing`; `dayNight` `day`. `night` uses Forge's `Game.isNight()`, the mirror of `isDay()` |

AppCDS gave no gain because the classpath uses `target/classes` folders; it would need the classes jarred first.

## How to apply

```sh
git fetch origin claude/lucid-ride-5cz864 codex/forge-github-host-prep-20261026
git checkout codex/forge-github-host-prep-20261026
git show origin/claude/lucid-ride-5cz864:docs/handoff/forge-adapter-427.patch | git apply   # patches both copies
# forge-gateway-jit.patch is already live on cf5f7df; skip it there.
```

Then re-derive the proof-package pins the same way `d017be8` did. The old source sha
`f51b3360…` appears in `candidate/native/SHA256SUMS`, `build-context/Dockerfile` (twice),
`build-context/CONTEXT-SHA256.json`, `build-context/hosting/checkpoint-files.json` and the
`combined-browser-proof/harness/` pins (`composition-contract.json`, `image-stages/pins.mjs`,
`verify-inputs.py`, `run-case.sh`, `fixture-server.mjs`, `collect-combined.py`, `cleanup-image.mjs`
and their tests). Then run the host's own checks and rebuild. The rules data expires at
`2026-11-03` (Monday 2 November, 7 pm Eastern), so ship the weekly rules refresh in the same rebuild.
