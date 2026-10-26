# Local Forge proof transport (provisional until run evidence)

Default origin: `http://127.0.0.1:8765`. Bind loopback only. One native Commander game per JVM. Start `./run-bridge.sh 8765 20261025 calling-all-angels keen-engineering` or use `reign-of-dragons` for the final argument. Defaults are human Calling All Angels versus AI Keen Engineering. Startup arguments 3/4 accept ONLY `calling-all-angels`, `keen-engineering`, `reign-of-dragons`; no HTTP deck path/import is accepted. Connection JSON is written locally to `adapter/connection.json`; its random token is a local capability, not a service credential. No hosting or account setup.

- `GET /health`: public engine revision and readiness of process.
- `GET /state`: header `Authorization: Bearer <token>`, returns explicit private viewer snapshot.
- `POST /action`: same authorization, JSON `{revision, op, ...}`. Returns 202 accepted, 409 stale/busy, 400 invalid/unadapted operation. Poll state after acceptance. Exact revision and native dialog ID bind responses to the active request.
- `op: "ok" | "cancel"`: only if native button enabled.
- `op: "card" | "player" | "stack", id: <native ID>`: routes to existing `PlayerControllerHuman` selection (engine validates).
- `op: "reply", promptId: <prompt.id>, indexes: [<option.index>, ...]`: replies using only original engine-offered objects. Used for getChoices, getAbilityToPlay, chooseSingleEntityForEffect, chooseEntitiesForEffect, showOptionDialog. Native order is supported using exact source/destination partition and remaining-count constraints.
- For `confirm`/`showConfirmDialog`, reply with `value: true|false` rather than indexes; for `showInputDialog`, use `value: string` with native numeric/list restriction.
- `op: "concede"`.

Snapshot `schema=cardstashy.forge-proof.v1`: `revision, status, failure, viewer, turn, phase, activePlayer, priorityPlayer, players, stack, message, buttons, inputType, selection, prompt, busy, winner, winnerPlayerId, draw`. Players: `id, name, life, isViewer, zones`. Zone: `count, cards`. Cards: native `id, zone, owner, controller, hidden` plus face details only when `CardView.canBeShownTo(viewer)` and `canFaceDownBeShownTo(viewer)` permit. Hidden hand/library entries expose count only, no identities or card IDs. Entire GameView/delta/private logs never serialize.

`selection` is Forge's actual `Selection`: `cards, targets, chosen, actionable, min, max`. References are `{kind:"card"|"player"|"stack",id}`. `actionable` is native UI guidance, not guaranteed complete legal action enumeration. `prompt` is null or `{id,method,message,min,max,options:[{index,value}],supported}`. Unknown prompts fail closed and wait, never substituted by invented rules/default choices.

Bounded prototype limits: one viewer; one match; no persistence, match creation endpoint, reconnect/session authorization, multiplayer, deployment or full generic dialog coverage. Sideboarding order with negative/unbounded constraints, combat damage assignment/generic amount and some uncommon dialogs currently deliberately unsupported. Native rules run completely in Forge. This adapter is not a claim that every card, game outcome or user interaction was proven.

Native board projection now runs only at Forge synchronous state notifications; bare asynchronous prompt/button callbacks overlay cached immutable board data. Commands bind the exact native Input object, reject concurrent normal commands, and pass through that captured Input rather than following a newer InputProxy. JSON scalars are strict (fractional/string indexes and nonboolean confirmations rejected). `getAbilityToPlay` may return native cancel via empty indexes. Native reveal prompts have `acknowledgeOnly:true` and require empty indexes. `showInputDialog` exposes `numeric` and `initialValue`.

Selected precon aliases appear as player `deckAlias`, with validated `deckCount:100`. Native `Command` card IDs preserve commander identity. `notification` carries native `message`/`showErrorDialog` feedback such as invalid attack requirements.

## Frozen full-control candidate 20261026-0018
This candidate accepts only startup controlMode `full` (arg5). Smart policy is deliberately excluded until its separate tests pass. CPU profile is explicitly `Default`; native cheat shuffle, global AI cheats and all flatMC overrides are false. `match:{humanDeck,aiDeck}`, `aiProfile`, `controlMode`, `autoPassNoActions:false` are public metadata.

Native `order`: combined `options` retain source items then destination items, each with its unique positional index. `sourceIndexes` and `destinationIndexes` expose the exact initial partition. `min/max` constrain final destination count from native remainingMin/Max; `indexes` reply gives final destination in chosen order. Preserve every index once when min=max=total (trigger ordering); optional subsets are allowed only when native bounds permit. `topLabel`, `remainingMin`, `remainingMax`, `rememberAllowed` are supplied. Optional strict boolean `remember` defaults false and may be true only when native checkbox was offered. Out-of-range or duplicate indexes are rejected. No ordering is silently auto-selected.

Native cancellation lifecycle: every blocking native dialog records its original Input and prompt generation. A null ability selection or a false priority confirmation restores only that unchanged native decision; other completions remain busy until native callbacks. Enqueued actions recheck Input identity, prompt generation, and absence of a newer pending dialog at execution. No blanket busy-reset is used. Mana display uses native ManaAtom values including colorless=32.
