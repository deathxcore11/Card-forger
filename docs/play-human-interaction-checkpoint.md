# Human interaction ingress checkpoint

October 24, 2026. Based on Play branch cdc8394. No engine adoption or playable UI.

The browser human worker now accepts `respond` with a bounded
`{interactionId, response}` submission. The only enabled response encodings are
`choose` and `select`. The bound human seat is zero; the client cannot override
it or submit a raw GameAction. Phase's `submit_interaction_js` validates the
current actor, opaque interaction identity and actual constraints. General
human selections no longer need to appear in the nonexhaustive AI action list.

`surface.interaction` contains projected exact choices or explicit count-bounded
selection candidates, with opaque IDs and allowed display fields. It excludes
engine availability witnesses, full snapshots and arbitrary fields. This is a
human-only surface, never a CPU observation packet. Other schemas remain
unavailable; typed targets, payment previews/manual overrides/cancellation,
ordered selections, modes, numeric/X and other required controls still need
coverage. No complete human interface is claimed.

The journal serializes submissions and atomically stores engine state and the
request receipt. Engine rejection preserves revision and permits a corrected
choice. Unknown outcome or persistence failure requires recovery. A restored
engine rebinds its interaction IDs; old uncommitted IDs are refused, while an
already-committed request ID returns its durable receipt without reapplying.
The diagnostic human save version advances to `human-seat-v2`, refusing v1
human snapshots instead of silently interpreting them under a changed surface.
Automatic diagnostic saves retain their version and exact old traces.

History records these inputs as `InteractionSubmission`, not as a fabricated
raw rules action. Opaque interaction tokens cannot themselves be replayed after
a new engine binding. Exact rules-action replay/export for this new ingress
remains open; checkpoint/receipt recovery is what these tests establish.

## Executed checks

- `node --test experiments/phase-engine/test-*.mjs`: 86 passed, zero failed or
  skipped. Includes bounded input, rejected choices, actor/revision guards,
  unknown outcomes, atomic persistence/duplicate recovery and private-field
  projection. Existing contract suites remain green.
- `interaction-engine.mjs`: real hash-verified original WASM, two cases passed.
  Mulligan then keep exposes seven exact instances, rejects zero bottom cards,
  survives restore and places the selected instance at the library bottom,
  leaving six cards in hand. Duplicate recovery does not bottom twice.
  Head Games accepts a selected pair absent from generated AI candidates,
  gives them to the correct opponent, preserves the controller's library,
  and retires the temporary search permission. Head Games uses engineered
  setup; the mulligan fixture explicitly fixes the opponent to keep.
- `browser-smoke.mjs`: all six original games and the scripted human game
  reproduce their existing traces/results; actual worker + IndexedDB accept
  the new mulligan/bottom route. Fresh browser process, stopped origin server
  and disabled networking resume a pending bottom choice and reject duplication.
  The older Priority/offline/full-game checks pass too. See the interaction
  browser evidence for its exact source hashes.
- Final `browser-smoke.mjs --choices-only`: passes the new worker/IndexedDB/
  cold-offline bottoming path after tightening unknown adapter-result handling.
  This final targeted run does not repeat the six games. Its first invocation
  hit a harness-only ReferenceError because a prior client was assumed; optional
  cleanup fixed that and the rerun passed. No engine assertion was removed.

The Node evidence contains exact input/source hashes. The two browser evidence
files distinguish the full run from the final focused bytes. No physical-device,
Standard/Commander pregame, competitive CPU, all-card or UI-usability claim.

## Build and next work

The original ninjutsu runtime failures remain unchanged. A distinct local build
experiment uses the same clean corrected source a49b8aa, adding
`-Zhint-mostly-unused=yes` only when compiling the engine library, with the
previous serialized low-optimization LLVM flags. This is a compiler work-reduction
hint, not source/card removal. Build outcome must be recorded separately;
no successful new WASM or build receipt exists at this checkpoint.

Next: verified corrected WASM, both ninjutsu regressions, then actual player
controls for the supported interaction schemas, payment/target/cancel, full
pregame, fair bounded CPU, board/countdown and result recovery. Preserve the
Standard/Commander, CPU-first and later Friends/Draft priorities. Nothing is
published, enabled in production, merged to the website branch or built as APK.
