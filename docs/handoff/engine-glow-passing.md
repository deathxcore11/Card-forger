# Engine: trustworthy glow, Smart passing, separate auto-pay

Branch `claude/engine-glow-smart-pass`, based on `codex/forge-github-host-prep-20261026` at `cf5f7df`.
It already contains `forge-adapter-427.patch` (pacing, attachments, arrows, battlefield fields,
event log, `payment`), so the release rebuild does not apply that patch again.

## What changed

1. **Glow (human overlay, `HumanActionAffordability`).** A cost with parts besides mana and `{T}`
   (Food's sacrifice, life, discard, counters, tapping other permanents) used to return UNKNOWN at
   once, and UNKNOWN glows and stops Smart. Those parts never add mana, so the check now drops them
   and runs the mana solver: if even that relaxed model can't pay, the action is PROVEN_UNAVAILABLE.
   If it can, the answer stays UNKNOWN as before. Parts not on the list keep the old UNKNOWN.
   This one check drives both `selection.actionable` (the glow) and Smart's "can respond".
2. **Reasons (bridge).** `selection.blocked` lists the player's own visible cards that have an
   ability but can't use it now: `{kind:"card", id, reason}` with `"Need N mana"`, `"Wrong timing"`,
   `"No legal target"`, `"Land already played"` or `"Can't pay the cost"`. Only during a priority
   prompt, within 150 ms (`-Dcardstashy.blockedBudgetMs`). Cards in `actionable` never appear here.
3. **Smart passing (bridge).** Smart no longer stops in declare attackers when nothing attacked
   (the CPU's empty combat). The stop returns for the rest of that combat once real attackers are
   declared. Full Control is unchanged. Blockers and damage were already skipped by Forge with no attackers.
4. **Auto-pay (bridge + host).** New action `{"op":"autoPay","value":true|false}`; `/state` carries
   `autoPay`. Until it is used, auto-pay follows the mode as before (Smart pays, Full doesn't), and
   choosing a mode resets it. So Full Control can keep auto-pay, and Smart can pay by hand.
   The host (`deploy/forge-host` session-authority) now forwards `autoPay` with a boolean value only.
   **The web client must add `autoPay` to its allowed ops** (`play-forge-host-client.js`) and show
   the toggle; until then nothing changes for players on this switch.

## Checks run (local, real Forge `e5a0f81` engine, JDK 21)

- Both overlays still reproduce byte for byte; the human overlay's new hashes are in
  `native/human/*-sha256.json`, `build-human-overlay.sh` and `NativeHumanPriorityProof.java`.
- `harness/fixtures/GlowPassingChecks.java` (new): 22 of 22 pass. Food and Freyalise tapped out are
  PROVEN_UNAVAILABLE; Food with two Forests stays possible; Smart passes the tapped-out response
  window and still stops when Food is payable; reasons match the live 4.2.7 position; empty combat;
  four real casts through `/action` for the auto-pay combinations.
- Unchanged from the base branch: NativePaymentTransitionChecks PASS, NativeVisibilityChecks PASS
  (65), NativeStartingPlayerChecks PASS (54), BridgeSmartIntentChecks PASS, NativeHumanPriorityProof
  PASS. ContextualSmartChecks gives the same 44 results as the base branch; its 9 failures are
  already there on the base (they predate the "Smart passes the opponent's main phase" change).
- `deploy/forge-host` npm test: 223 pass, 0 fail.

## Still to do in the host rebuild

Re-derive the proof-package pins as `forge-engine-handoff.md` describes, now with these values:

| File | Old | New |
|---|---|---|
| `ForgeHttpBridge.java` (both copies) | `f51b3360…` | `eb7dc914eaaa85636b133477c052de0c5bd30a6f4789fad190955e5f105c8969` |
| `human/source-sha256.json` | `808b643d…` | `23b9220fb5fe8646ab3784a2e19c6c43d968dabed719bc8c59c88f00cc26350c` |
| `human/runtime-sha256.json` | `89975e8a…` | `61ad2c7b314ce2d091f96f1fb89dfffc1e7c6634058a019e49978904b660570e` |
| `NativeHumanPriorityProof.java` | (see CONTEXT-SHA256.json) | `b85cb1c3fbfad722acff88d644efb24c58d14e7af41abcdd7a95f9de7e1026cf` |

The old human hashes also appear in `harness/collect-combined.py`, `harness/test-collector.py`,
`harness/local-oci/*` and `harness/image-stages/human-priority-contract.mjs`.

## Event log review

Read through the 427 event log code again: ordering, viewer filtering and locking look right. A
card is named only when its face is visible at that moment, CPU draws carry no card, and the log
is copied under its own lock. One thing to know: a name already in the log stays there after the
card goes back to a hidden zone (it was public when it happened). Nothing blocking.

## Follow-up: prompts the table could not answer (branch `claude/engine-prompts`)

Based on `claude/forge-host-4.2.8`, re-pinned (verify-inputs passes, host tests 223/223).

- **Scry / Surveil 2+.** `UI_SELECT_FROM_CARD_DISPLAYS` is off, so Forge asks with its
  choose-then-order dialogs. The `order` prompt treats `-1` bounds as "any number"; the DTO's
  `remainingMin`/`remainingMax` are normalised (0 and the card count), never -1.
- **Combat damage** (`assignCombatDamage`) and **divided amounts** (`assignGenericAmount`:
  divided damage, counters, shields, mana combos) are now supported prompts. The DTO carries
  `options` (blockers, then the player or planeswalker when trample allows it) and
  `assign: {amount, lethal[], defenderIndex, freeDivision, maySkip}` or
  `assign: {amount, maxima[], atLeastOne, label}`. Reply `{"promptId", "amounts":[one per option]}`;
  `{"skip":true}` only when `maySkip`. The bridge checks the total, the per-target limits and
  current combat rules: no damage assignment order among blockers; damage reaches the player
  or planeswalker only after every blocker has lethal (1 with deathtouch).
- Checks: `harness/fixtures/BridgePromptAmountChecks.java`, `harness/fixtures/CombatDamageChecks.java`.
- The web table still shows Concede for these until it renders `prompt.assign`.
