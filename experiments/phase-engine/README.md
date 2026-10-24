# Phase runtime investigation

Research only, October 24, 2026. This is an optional Node/WASM diagnostic,
excluded from the app imports, service-worker cache and production asset list.
It does not enable Play or implement a CardStashy difficulty profile.

## Pinned inputs

- Source: `phase-rs/phase`, commit
  `71ccd8fe1715c45fe9e9bd78d391bec5ac8a4234`, workspace version 0.117.0.
- Upstream workflow run `40129115223`, artifact `12574954346` named `wasm`.
  The enclosing workflow was still in progress when the completed artifact
  was retrieved; this is not a claim that its whole deployment passed.
- ZIP SHA-256:
  `47485d739b924120d9a795cc6b522ddd10c91ede91fdb3c5e997cd6d888eb7b0`.
- Extracted `pkg/engine_wasm_bg.wasm`, 40,060,780 bytes, SHA-256:
  `6057521d851bb8544eaeea467f741b90cd2941aa5ba2fddb17e1bcc3d9933f8f`.
- Extracted `pkg/engine_wasm.js`, SHA-256:
  `47c42e78d34eeaad37d74b8163e5319d0578ba0ee8bd3476cfb70131de6287c9`.
- Source fixture `crates/engine/tests/fixtures/runtime_card_export_fixture.json`,
  SHA-256:
  `ee062b8ad351e067723b79fc8462aaea19202ef9756d35b2101334eb3e350107`.

The diagnostic verifies the executable glue, WASM and fixture before loading.
It does not download them. No third-party binary, card fixture or source has
been copied into this repository. Retain upstream MIT/Apache-2.0 notices and
review dependencies/card-data distribution before any adoption. This experiment
does not settle that distribution decision.

## Run

Use the exact source checkout and extracted artifact above. Put a
`package.json` containing `{"type":"module"}` beside the extracted JS so Node
loads the upstream ES module. Run from the CardStashy repository with Node 24:

```sh
CARDSTASHY_PHASE_PKG=/absolute/path/to/pkg \
CARDSTASHY_PHASE_SOURCE=/absolute/path/to/phase \
node experiments/phase-engine/phase-smoke.mjs
```

Results, synthetic accepted-action traces and the pending-choice save go into
ignored `test-results/phase-engine/`. `CARDSTASHY_PHASE_OUTPUT` can select a
different output directory. The checked-in evidence JSON is a captured run,
not a permanently green assertion. Artifact links may expire; a different
build must not be substituted without changing provenance and rerunning.

## What this checks

- Load three exported records: Forest, Grizzly Bears and Lightning Bolt. Bolt
  is not in either deck. Initialize two 60-card lists using the engine's Modern
  configuration: 56 Forest/4 Bears and 57 Forest/3 Bears. This is not a proposed
  shipping pool or a deck-quality example.
- A deliberately ungraded policy selects only supplied legal actions with an
  independent deterministic RNG. Both seats use it; it is not the upstream AI.
  Each action must be present in the current list and actually applied.
- Three shuffle seeds with each starting player must reach engine GameOver
  within 20,000 actions. The ceiling fails rather than inventing a winner.
- Save the first case after action 80 at a Priority choice; start a fresh Node
  process, reload the same inputs, restore engine and policy state, and compare
  every remaining accepted action, final turn and terminal result.
- Fail on any `fetch` call in either process. This is a network-use guard,
  not a browser cache, service-worker or airplane-mode test.
- At the initial position only, both viewer projections must redact hidden
  names/card IDs and zero game RNG seed/position. Ordered opaque library IDs
  are reported, not treated as proof of either an identity leak or full safety.

## Limits

These are three seeds and two starting-player settings for one unequal deck
pair. All captured winners were seat 1; no balance, seat symmetry or playing
strength result follows. There is no independent rules oracle, tactical suite,
card-coverage certification, browser latency/memory benchmark, persisted browser
recovery or duplicate-result test. The policy function uses only its arguments
but is not isolated from authority in a worker. Complete hidden-world
equivalence, previously revealed identities, logs and candidate privacy remain
unproved. Do not feed the full filtered state, raw engine events or save into a
production CPU merely because this smoke test passed.

The full engine gate remains open. See the
[engine evaluation](../../docs/4.0-engine-evaluation.md) and
[CPU proposal review](../../docs/4.0-cpu-proposal-review.md).
