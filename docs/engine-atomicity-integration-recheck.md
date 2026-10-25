# Rejected-action atomicity: integration recheck

The unchanged shipped engine still fails rejection atomicity. An independent rerun of the Rules owner's `rejection-atomicity-audit.mjs` produced **7 PASS / 2 FAIL**. This is engine/API evidence, not a combined-app match.

After 69 accepted legal setup actions, a naturally reached turn-five draw-step position contains Ram Through, two Plains, and creatures on both sides. Rejection of the automatic cast removes `/state/zone_change_library_knowledge_stamps`. The original engineered position also loses this metadata. The full exported-save equality assertions were retained. Repeated saves and read-only calls preserve the save. Cards, mana, life, zones, immediate seat-visible outputs, and the named six-action visibility continuation controls pass; those bounded controls do not prove that the metadata mutation is harmless in other positions.

The runtime hash remains `a86578b23adcd26c38a68871e745305f3acb249158e1b424065cc6e6b6c3bfee`. Integration head inspected: `3110e75c330b63b4dfccda2c259a6785dd9797ad`. Full fresh evidence and exact runner/helper hashes are identified by the [recheck record](evidence/engine-atomicity-integration-recheck.json).

## Why this requires an engine correction

The inspected WASM boundary calls `apply_with_rejection` on mutable engine state. In `crates/engine/src/game/engine.rs`, `apply_action_boundary_core` clears completed hidden-search sidecars before cloning the rollback snapshot. Rejection restores the already-cleared snapshot. The serializer exposes that mutation by omitting the now-empty vector.

The existing Rules candidate patch moves the rollback snapshot one statement earlier, before `clear_completed_hidden_search_audiences()`. It deliberately leaves the preceding stranded-resolution recovery behavior intact. This is a proposed source correction, not executable proof or a certificate of all rejection paths.

The JavaScript glue delegates to the compiled implementation. Adding UI validation or a preview before submission can avoid some rejected requests, but cannot establish that a rejected engine submission preserves state. A JavaScript export/restore wrapper would alter session/replay bookkeeping and conceal the responsible engine boundary. Neither approach closes this gate.

## Smallest real completion path

1. Review and apply the Rules candidate snapshot-order patch to the exact reconstructed shipped engine source.
2. Run native rejection, hidden-search visibility, reveal/shuffle, casting-reversal, and stranded-resolution recovery regressions.
3. Produce a separately identified WASM executable and exact source/build receipt, preserving the compiled-card database unless separately reviewed.
4. Re-run the two complete-save assertions and all controls against that executable, then update runtime hashes/chunks/manifests and run combined application acceptance.

No build was performed in this recheck. The no-engine-build constraint therefore leaves this release gate **FAIL**, not fixed or untested. No production behavior, deployment, or workflow dispatch occurred.

## Free local build readiness follow-up

The pinned upstream source was subsequently fetched and the exact shipped ninjutsu patch applied. Its resulting tree is exactly `60fc8715ad91f5c91b81f8a8335e238c623ec957`; a separate local reconstruction commit preserves it. The atomicity candidate patch applies cleanly. The safe-pass owner is preparing the additional read-only priority-capability export against this same tree. Neither source change is compiled or adopted.

Rust nightly and crate-index download endpoints are reachable, and the full Git source is now local. Rust/Cargo/wasm-bindgen are not installed. The effective process memory limit is **8 GiB**, below the existing successful build recipe's **12 GiB minimum guard**. No installation or compilation was started, and the guard was not bypassed. See [build readiness evidence](evidence/engine-build-readiness.json).

The recorded recipe pins `nightly-2026-04-19`, `wasm32-unknown-unknown`, and `wasm-bindgen-cli` `0.2.121`. It uses one Cargo job, disabled incremental compilation/optimization/debug/LTO, 256 codegen units, and a 16 MiB stack. The core build command is `cargo +nightly-2026-04-19 build --locked -p engine-wasm --target wasm32-unknown-unknown --profile wasm-dev`, followed by `wasm-bindgen` with the web target. The precise flags remain in the repository's historical `experiments/phase-engine/ci/play-engine-proof.mjs`; that CI-only script must not be invoked or have its approvals forged for a local run. A suitably provisioned free local builder can use the same source and flags without dispatching paid GitHub Actions.

The 12 GiB value is a repository execution guard, not a proven universal compiler minimum. The historical `NINJUTSU-SOURCE-CHECKPOINT.md` records repeated LLVM builds killed under an 8 GiB ceiling, including signal 9 at a reported 7,751 MB compiler RSS and an increased cgroup OOM-kill count. The successful historical `macos-15-intel` job used 14 GiB. Source URLs and exact guard text are retained in the readiness evidence. Re-running that old job would build the old source; a new job must first pin the combined atomicity/capability patch and include their new regressions. No such job was started here.
