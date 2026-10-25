# Timed priority journal: isolated authority proof

October 24, 2026. Development slice based on Play remote head
`70d1902c1add1dc7499b6e927c8af2c5eb7b482e`. No product imports or browser worker
were changed. The unfinished local CI build preparation was left untouched.
No applicable AGENTS.md exists in this CardStashy snapshot; no upstream Rust
source was edited in this slice.

`timed-priority-journal.mjs` combines the existing 30-second clock with engine
save/restore and command receipts in one compare-and-write record. It serializes
human passes and timeout passes, checks current actor/prompt/revision and legal
PassPriority immediately before applying, and persists the next prompt's clock
with the accepted engine checkpoint. Reads do not write or re-arm deadlines.

If persistence fails, the authority requires recovery. A successful write with a
lost acknowledgement is distinguished from a failed write by loading the durable
checkpoint. No automatic retry from uncertain in-memory state is allowed.
Duplicate human commands replay their receipt; a competing writer cannot replace
a newer revision. Mandatory choices report `timeout-needs-choice`, with no guessed
payment, target, discard, action or loss. This is a deliberately priority-pass-only
authority; general human actions still use the future authoritative selector.

## Executed checks

- `node --test experiments/phase-engine/test-*.mjs`: 69 passed, zero failed or
  skipped, including nine new journal tests. These use controlled adapters and
  compare-and-write fault injection, not a real browser storage transaction.
- `timed-priority-engine.mjs`: the exact original upstream WASM/fixture hashes
  verified before loading. An engineered Priority position was checkpointed,
  authority reconstructed at expiry, and exactly one real legal pass accepted.
  Engine state, deadline and receipt were saved together; next actor was seat
  one, life stayed 20/20, and zero runtime fetches occurred. The original
  runtime is still defective for ninjutsu; this does not close that blocker.
- Exact input/source hashes and bounded outcomes are in
  `experiments/phase-engine/timed-priority-evidence-2026-10-24.json`.

Reproduce the engine check with the exact external inputs from the experiment
README, setting CARDSTASHY_PHASE_PKG and CARDSTASHY_PHASE_SOURCE, then run:

```sh
node experiments/phase-engine/timed-priority-engine.mjs
```

## Next work and limits

Connect this authority to the real worker/IndexedDB transaction boundary and
run fresh-process/browser restart and racing-tab tests before adoption. Add a
bounded scheduler and visible accessible countdown without allowing display
reads to arm it. Define the complete explicit mandatory-choice timeout/time-bank
policy, trusted time, suspension, anti-stall and terminal handling first; this
module intentionally cannot finish an entire match or replace the old journal.
An adapter must supply a valid actor/decision identity for each supported state.
Receipts currently grow with accepted passes; bounded retention/replay lifetime
is another integration requirement.

The corrected ninjutsu browser package, full engine gate, fair CPU, integrated
Practice board/history, Casual and Draft remain open. No deployment, APK change,
production merge, paid runner execution or all-card/playability claim follows.
