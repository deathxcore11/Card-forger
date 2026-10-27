# Forge engine handoff: pacing, attachments, arrows, faster JIT

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
| `blockingIds` | **Built and compiled, but not exercised in a live block.** The test games never reached a human block or a CPU block. Please watch one block before relying on block arrows. |

AppCDS gave no gain because the classpath uses `target/classes` folders; it would need the classes jarred first.

## How to apply

```sh
git fetch origin claude/lucid-ride-5cz864 codex/forge-github-host-prep-20261026
git checkout codex/forge-github-host-prep-20261026
git show origin/claude/lucid-ride-5cz864:docs/handoff/forge-adapter-play.patch | git apply
cp experiments/forge-proof/combined-browser-proof/candidate/build-context/native/adapter/src/cardstashy/forge/ForgeHttpBridge.java \
   experiments/forge-proof/combined-browser-proof/candidate/native/adapter/src/cardstashy/forge/ForgeHttpBridge.java
git show origin/claude/lucid-ride-5cz864:docs/handoff/forge-gateway-jit.patch | git apply
```

Then re-derive the proof-package pins the same way `d017be8` did (`SOURCE-SHA256.json`, `CONTEXT-SHA256.json`, the Dockerfile source sha, `checkpoint-files.json`, `deploy-private-host.mjs`), run the host's own checks, and rebuild.
