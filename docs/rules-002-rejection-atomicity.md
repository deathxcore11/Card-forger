# RULES-002: rejection metadata isolation

**The shipped runtime still fails complete rejection atomicity.** The failure reproduces after a normal legal setup history as well as the original engineered setup. Five repeated saves and both-seat read-only queries preserve the field. No changed player-visible information was observed in the named immediate and six-action continuation controls. This does not establish that the field is harmless in other interactions.

Owner: Rules / Game Machinery Lord. Starting commit: `ed3175347bc86b346205f3cba102a73bd3494c6c`. Inspected integration: `4bd9801c0b5593288c9c29b76cc447ce47781f75`. The scope is a runner, evidence, this report and an **uncompiled candidate source patch**. No session, CPU, UI, runtime, coverage or production files were changed. No engine build or deployment was performed. Recovery and match-history persistence remain separate work.

## Reproduce

```sh
node experiments/phase-engine/rejection-atomicity-audit.mjs
```

The command loads the shipped hash-verified runtime and five unchanged compiled records, forbids network access, and writes `test-results/rules-002/report.json` and `full.json`. On the recorded runtime it exits **1**, preserving two failing assertions. A future fix must make those assertions pass; do not whitelist or delete the metadata field.

Inputs: Node 24.22.1, Linux x64; WASM SHA-256 `a86578b23adcd26c38a68871e745305f3acb249158e1b424065cc6e6b6c3bfee`; source commit `5169f7fe03f93a6afe36fec767c3cda10120dcdd`; source tree `60fc8715ad91f5c91b81f8a8335e238c623ec957`; compiled database SHA-256 `0dbc4d30f035ffc538bf8ae904dbfdc815e9bb53371c05797361b2b639ede2b9`. These are the same runtime/database as DECK-001. App provenance remains release `2af11c9`; no claim that this executed the current integrated session.

The natural setup initializes two 60-card Vintage lists with seed **10**, seat 0 starting:

- Seat 0: 52 Plains, 4 Savannah Lions, 4 Ram Through.
- Seat 1: 56 Forest, 4 Grizzly Bears.

The harness keeps both hands, plays lands, casts one creature on each side and declares no attackers, using only engine-generated legal actions. After **69 accepted actions**, turn 5's draw-step priority belongs to seat 0. Savannah Lions is object 11; opposing Grizzly Bears is 90; Ram Through in hand is 31; untapped Plains are 5 and 10. A normal draw has just created one library-zone-change receipt. There was **no restore, debug creation or direct state edit** in this setup.

The test attempts automatic casting of Ram Through with two white-producing sources and no green source. Both required creature roles are present. The castable-target query returns an empty list while the spell is unavailable; that query is not used as proof of target availability. The command is rejected as `action_not_allowed`. The API supplies a generic reason, so this audit does not claim a dedicated wrong-color error code.

## Individually recorded results

| Case | Result | Observed result |
| --- | --- | --- |
| `natural-setup` | PASS | Reached the described position using 69 accepted legal actions. |
| `repeated-save-control` | PASS | Five consecutive complete saves were deeply identical. |
| `read-only-control` | PASS | Both-seat filtered/viewer/transition reads, legal generation and the target query preserved the complete save. |
| `natural-rejection-atomicity` | **FAIL** | Rejection removed `/state/zone_change_library_knowledge_stamps`. |
| `natural-resource-preservation` | PASS | That metadata path was the only complete-save difference; cards, zones, mana, life and other recorded state were unchanged. This bounded result does not override the atomicity failure. |
| `natural-immediate-seat-visibility` | PASS | Both seats' complete filtered/viewer/transition outputs matched before and after; opponent hands and libraries remained redacted. |
| `second-rejection-control` | PASS | Repeating the rejection after the metadata was already gone made no further change. |
| `six-action-seat-visibility` | PASS | Control and rejection branches followed the same six accepted actions; both-seat filtered game state and transition events matched at each point. |
| `engineered-rejection-atomicity` | **FAIL** | The original fixture pattern lost its 14 initialized draw receipts. |

**Total: 7 PASS / 2 FAIL / 0 NOT TESTED / 0 UNSUPPORTED within the nine-case runner.** Unexecuted product acceptance remains unexecuted: browser UI, current session auto-pass, production CPU behavior, signed-in matches and recovery are not certified by this count.

The continuation control restores the **unedited, naturally produced** save in two branches. Restore changes debug/session bookkeeping, so this is supplemental evidence, not a second claim of a no-restore history. The comparison includes each complete seat-filtered game state and transition event list; it does not compare session-bound interaction capabilities across restores. Full raw captures are retained. No metadata is removed from the full-state rejection assertion.

## Source trace and candidate correction

The relevant source was reconstructed from upstream `phase-rs/phase` commit `71ccd8fe1715c45fe9e9bd78d391bec5ac8a4234` plus the exact shipped ninjutsu patch, SHA-256 `b8a5b0efb91b10d8930252bfe522a07e8ba95030436aa5b5419478a42a2cdb5d`. The patch is available on the historical `codex/cardstashy-play-engine-20261024` branch. Both modified source-file blob hashes match the patch's destination hashes:

- `crates/engine/src/game/engine.rs`: `88072d3af4740c3131db19d570a36b91103bad31`.
- `crates/engine/src/types/game_state.rs`: `c2f92b342658194e533acf9f53a23d64d41a5277`.

The unchanged WASM-boundary and visibility sources were also read; their hashes are in the evidence. This is source inspection tied to the delivered build receipt, not a newly compiled executable.

The path is specific:

1. WASM `submit_action` calls `apply_with_rejection` on mutable state.
2. `apply_action_boundary_core` calls `clear_completed_hidden_search_audiences()` at line 1549.
3. That method also clears `zone_change_library_knowledge_stamps` and action-library generations.
4. The rollback snapshot is cloned **after** that clear, at line 1550. Authorization/reducer rejection restores this already-cleared snapshot.
5. The empty vector is omitted by serialization. The serializer is exposing the mutation; repeated-save controls do not reproduce it by themselves.

The field is an event-time receipt used by library/search visibility lineage. It is separate from durable product knowledge and is redacted from direct viewer snapshots. The visibility implementation consults source/destination receipts when following hidden-search identity across library changes. Its transient role is therefore **not** sufficient justification to ignore it.

[Candidate source patch](../experiments/phase-engine/upstream/rejection-boundary-candidate.patch): take the existing rollback snapshot before clearing the sidecar. The clear still occurs for the attempted action; rejection can restore the pre-clear state. Patch applicability against the reconstructed shipped source is **PASS**. Compilation, behavioral regressions against a corrected executable and adoption are **NOT TESTED**. The patch does not alter the earlier intentional stranded-resolution recovery logic; reviewing its interaction with that logic remains necessary.

The handoff prohibits an engine rebuild, so this report does not mark the runtime fixed. Integration/runtime ownership must review the candidate, run native rejection/visibility/search/reveal/shuffle and casting-reversal regressions, then verify the same runner against a separately identified rebuilt executable. A JavaScript save/restore wrapper is not offered as a workaround: it changes session/replay bookkeeping and would conceal the responsible engine boundary.

## Evidence and remaining limits

- [Summary, exact hashes and source trace](evidence/rules-002-rejection-atomicity.json).
- [Compressed full starts, accepted trace, before/after saves and both-seat captures](evidence/rules-002-rejection-atomicity-full.json.xz).
- [Executable regression runner](../experiments/phase-engine/rejection-atomicity-audit.mjs).

The archive round-trip and source/fixture hashes were checked. The prior starter suite was not rerun merely for documentation/diagnostic additions; its 16 passing cases belong to DECK-001's recorded run. No tests here establish general rejection atomicity, hidden-search harmlessness, all-card support or multiplayer synchronization. The Sol Ring finding remains an API-completeness counterexample; it does not establish that the integrated session skipped an activation.

Rollback: omit this diagnostics-only commit and the unused candidate patch. No shipped behavior depends on these files.
