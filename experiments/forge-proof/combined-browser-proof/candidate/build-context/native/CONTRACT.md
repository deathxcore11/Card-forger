# Local Forge proof transport — mutable experimental Smart branch

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

## Relationship to reviewed full-control candidate
The independently reviewed immutable 0018-full directory remains the first browser-proof source. This mutable branch additionally accepts `smart` as startup arg5 and exposes a revision-bound `controlMode` operation (`value: "smart"|"full"`). Mode changes require an idle non-Lock native Input, consume their revision immediately, and revalidate exact Input identity and prompt generation on the native EDT before committing the mode. Default remains `full` pending Smart review/browser acceptance. CPU profile is explicitly `Default`; native cheat shuffle, global AI cheats and all flatMC overrides are false. `match:{humanDeck,aiDeck}`, `aiProfile`, `controlMode`, `autoPassNoActions:false` are public metadata.

Native `order`: combined `options` retain source items then destination items, each with its unique positional index. `sourceIndexes` and `destinationIndexes` expose the exact initial partition. `min/max` constrain final destination count from native remainingMin/Max; `indexes` reply gives final destination in chosen order. Preserve every index once when min=max=total (trigger ordering); optional subsets are allowed only when native bounds permit. `topLabel`, `remainingMin`, `remainingMax`, `rememberAllowed` are supplied. Optional strict boolean `remember` defaults false and may be true only when native checkbox was offered. Out-of-range or duplicate indexes are rejected. No ordering is silently auto-selected.

Native cancellation lifecycle: every blocking native dialog records its original Input and prompt generation. A null ability selection or a false priority confirmation restores only that unchanged native decision; other completions remain busy until native callbacks. Enqueued actions recheck Input identity, prompt generation, and absence of a newer pending dialog at execution. No blanket busy-reset is used. Mana display uses native ManaAtom values including colorless=32.


## Experimental Smart policy (not in immutable 0018)

- Uses native YieldController `YIELD_AUTO_PASS_NO_ACTIONS`, with respect-interrupts false. Native phase events disable it in the human's MAIN1/MAIN2, enable it in other windows. All phase-skip settings remain false. Native AvailableActions is a heuristic with fail-open timeout, not an adapter legality oracle; no universal action coverage is claimed.
- Uses the official desktop singleton behavior only for `getAbilityToPlay` with the bridge's null trigger event. Other offered choices, targets, ordering, alternatives, optional payments, discard, etc. remain explicit human decisions.
- Only an accepted direct spell selection from native InputPassPriority arms an intention, using its actual native getChosenSa object. When InputPayManaOfCostPayment arrives, the current native Player.getPaidForSA must be that exact object and must not already be on the stack. Smart consumes the intention before dispatching the enabled native Auto button once on the captured input/generation. Copied/additional-cost spell objects, activated/mana abilities, nested effects, and resolving-spell payments deliberately remain manual. Forge chooses and pays mana via its native utility. No JS or adapter mana/cost inference. A new priority input, rejected/stale selection, explicit priority pass/cancel, or native cancellation ends the intention. Failed native Auto attempts are never looped.
- `full` stops this assistance and preserves the existing native menus, mana-source card clicks, payment/cancel, and priority windows. This transport name does not mean every optional Forge FullControlFlag is enabled. Explicit mana-pool color click transport is not yet implemented.
- Terminal snapshots set `busy:false` regardless of native final LockUI. `nativeAutoPayments` reports the number of native Auto dispatches for evidence; it is not a rules decision.

Executed local tests (not browser acceptance): `test-smart.py` own-main preservation/empty opponent windows/Full override; `test-smart-payment.py` Full payment cancellation then native Smart payment; `test-smart-response.py` real opponent Sarkhan spell holds for Thirst for Knowledge response, auto-pays natively, and leaves the consequential discard choice manual. Tests inspect only the private human/public projection. Required Angels full HTTP games are a separate simple-strategy coverage probe, not competitive play or proof of all mechanics.

0050 follow-on closes 0043 review findings with direct native spell/payment identity binding, consume-before-dispatch, and exact mode Input/generation revalidation. BridgeSmartIntentChecks uses native Card/SpellPermanent objects to reject absent, different/same-host copied, and already-on-stack payment identities; these are transport guard tests, not a real optional-effect gameplay fixture.

0058 additionally supports native ReplacementEffectView options with their exact native getDescription label and effect ID. No host card or raw replacement-effect graph is serialized. Ordered replies still return the original offered view objects; source/destination/count semantics are unchanged. This closes the observed Angels-v-Reign replacement-order display gap, pending complete-game run evidence.

## Exact existing deck initialization
See `../EXACT-INPUT.md`. Hosted exact mode requires proof.matchInput and proof.requireExact=true. Immutable adapter capability: cardstashy.match-input.v1.

## Local three-format extension
See `../FORMATS-PROOF.md` for NativeMatchFormat and the current-data release dependency. This prototype is not approved for universal current-format admission.
