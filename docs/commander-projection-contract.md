# Commander projection v1

The match authority supplies `surface.commander` from the engine's seat-filtered state. It never reads a raw authority save for presentation. The helper is integration-owned; CPU/seat-surface files are unchanged.

## Public designation ledger

At successful game initialization, `createCommanderProjector.reset()` captures only visible, face-up Command-zone objects explicitly marked `is_commander` by the engine. The registry stores their public IDs, original public names and owners. It is immutable during that game and reset before a new game; summary reads do not discover identities or mutate the registry. This avoids retaining speculative identity information from a failed journal commit.

Schema:

- `version: 1`, `coverage: "public-designation-ledger"`.
- `commanders`: `{id, name, owner, controller, zone, tax, castCount, visible}`. The name/initial ownership are the designation observed publicly at game start. While the commander is currently visible in a public zone, `tax` copies `object.commander_tax` and the current public zone/controller are supplied. `castCount` copies the explicit public `state.commander_cast_count[id]`. Missing facts are `null`, not guessed zero.
- While a registered commander is hidden, its row remains with `visible:false` and `controller`, `zone`, `tax` all `null`. Its current hidden identity, location and object metadata are never copied. Initial public designation, public cast counts and public historical damage remain available.
- `damage`: `{commanderId, player, amount}`, copied from authoritative `state.commander_damage` rows `{commander, player, damage}` only for registered public commander IDs. These historical rows persist even when their commander is currently hidden.
- `damageAvailable`: whether the engine supplied the authoritative array. A missing array is not a zero-damage certificate.

The stateless `projectCommander()` helper remains available with `coverage: "visible-public-objects"` for isolated projections and tests. Production authority uses the initialized ledger.

The UI may mark currently visible cards as commanders, show numeric supplied tax, and show recorded damage against each player. Hidden commander rows use the retained public name without a current location or tax. It must not calculate tax from casts, infer designation from legendary status, or treat unknown fields as zero.

## Evidence

`node --test experiments/phase-engine/test-commander-projection.mjs`: 7 PASS. Exact field mapping, hidden/face-down/private-zone redaction, malformed/missing values, wrong-seat/raw-authority refusal, persistent public designation without hidden-object copying, lifecycle reset, and sentinel ID refusal.

`node --test experiments/phase-engine/test-authority-candidates.mjs experiments/phase-engine/test-random-outcomes.mjs`: 13 existing tests PASS.

`node experiments/phase-engine/commander-projection-engine.mjs`: 4 PASS with unchanged packaged WASM and exact generated-candidate actions; evidence in `docs/evidence/commander-projection-engine.json`.

1. Actual Command-zone Ghalta cast and resolution: tax 0 before cast; tax 2 and explicit cast count 1 on Stack and Battlefield. Both seat projections agree.
2. Actual combat trade, both explicit CommanderZoneChoice returns, and a second cast: same commander ID, tax 2 in Command before recast, tax 4/count 2 on Stack after recast. All continuation commands are engine-generated and accepted.
3. Actual unblocked Ghalta combat: opponent life 40 → 28 and recorded Commander damage `{commander:199, player:1, damage:12}`. Both seat projections agree.
4. Engineered relocation to Library: the stateless public-object projection suppresses the hidden object, while the initialized ledger retains only its prior public designation and 12 damage. Both seats get the same ledger, with no hidden location/tax/controller. This is a privacy fixture, not a legal relocation action claim.

Fixtures use engineered starting positions with existing compiled cards and seed 12345. They do not prove a full Commander match, arbitrary commanders, deck support, or owner-account UI behavior. No recovery support is introduced. Restoring a journal snapshot within the same live authority retains the immutable initial designation registry; a fresh restored authority without the initial public identity receipt falls back to the existing stateless visible-public-objects contract, preserving that read path without claiming complete historical designation. Ordinary new-game initialization provides the full public designation ledger.

## Source corroboration

The reconstructed shipped source described in RULES-002 uses upstream `71ccd8fe1715c45fe9e9bd78d391bec5ac8a4234` plus the shipped ninjutsu patch:

- `crates/engine/src/game/visibility.rs`, SHA-256 `b9c01a5ffb7a1cb9e779e99eb54465cf809c5bc64122b33c6bd7a555e5c57f6f`: `commander_damage_is_visible_to_every_viewer` explicitly tests public damage visibility. The hidden-card routine redacts printed identity; the projection above additionally avoids hidden object fields altogether.
- `crates/engine/src/types/game_state.rs`, SHA-256 `3eb7e46f773776428396bd0707efca1848aa1322b43f8f501e6fc33dbeab6d09`: new-state `next_object_id` is 1, the allocator is monotonic, and ID 0 is used as a sentinel/redaction placeholder. The `id > 0` guard is intentional. `CommanderDamageEntry` defines player/commander/damage; command-zone cast counts are stored by ObjectId.

Source inspection supplements the unchanged-runtime fixtures; it is not a newly built engine.

Integration must package `experiments/phase-engine/commander-projection.mjs`, bind the table to the schema, and run combined acceptance. No engine build, deployment, paid workflow, or CPU-owned-file edit occurred.
