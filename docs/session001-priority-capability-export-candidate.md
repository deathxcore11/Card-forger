# SESSION-001 priority capability export candidate

Status: source patch prepared; NOT COMPILED, NOT EXECUTED, NOT RELEASE READY. The production JavaScript gate remains `coverage: unknown`. The JavaScript authority now optionally consumes the exact new export; the delivered runtime lacks it, so behavior remains conservatively stopped. No production runtime is changed.

## Why the current action lists cannot authorize passing

Run `node experiments/phase-engine/priority-capability-gap-engine.mjs` against the delivered runtime. Two reproducible assertions PASS: Bane of the Living's `PlayFaceDown` and `TurnFaceUp(x=1)` are accepted by the engine while omitted from its flat, grouped and interaction offers. Before the turn-up action, the flat list contains only PassPriority and the top-level auto-pass recommendation is true. These witnesses prove incomplete enumeration; they do not certify correct Magic execution of the card's mechanics. The fixture starts from an engineered position, not a legal setup history. Unknown capability correctly suppresses session automation.

The pinned engine already has an independent reducer-family preflight: `preflight_priority_window` in `crates/engine/src/game/engine.rs`. It deliberately does not use AI enumeration. Its outcomes distinguish Actionless, Actionable, NotPriorityWindow and Indeterminate, including a RequiresChosenX block. The delivered WASM does not expose this result.

## Candidate patch and provenance

Apply `experiments/phase-engine/patches/session001-priority-capability-v1.patch` to the reconstructed shipped source tree `60fc8715ad91f5c91b81f8a8335e238c623ec957` (upstream `71ccd8fe1715c45fe9e9bd78d391bec5ac8a4234` plus the exact shipped ninjutsu patch). The rejection-atomicity patch remains necessary. The combined alternative `experiments/phase-engine/patches/release-priority-atomicity-candidate.patch` includes both changes against that same base, so a builder applies the combined patch once, not both alternatives. These changes touch distinct hunks in engine.rs and were applied together locally without conflict.

Final combined patch SHA-256: `a1188d35bfb3905dae06e5fda8b6fa4ed0dbc4cd8d0dbe19ee574ba211afc343`. Forward application to a fresh index loaded from the shipped tree PASS; resulting candidate tree: `c8f2db24fd81f34821dddf69e5b7404fcf16412c`. The standalone preflight patch SHA-256 is `f79b2b0b8c8029538d5b296f3f11aa8e78f1227d857c482c3500651ac4a65ad9` (resulting tree `bc9af78b5df35fa4400f4fd5dac6942de9362231`). An initial patch export lacked the new test file's `new file mode 100644` metadata; forward verification caught it and these final patches correct it. Reverse verification alone was insufficient.

The candidate adds `priority_capability_for_viewer_v1` in the engine and the thin WASM export `get_priority_capability_v1_js(viewer)`. It reuses existing preflight and reducer authorities, clones before flushing derived layers, and simulates the exact pass on that disposable state. It does not change game rules, recommendations, AI candidates or persisted state.

Seven Rust assertions are added to the existing integration target. `git diff --check` and reverse patch applicability PASS. Rust formatting, compilation, all seven assertions and generated-WASM execution are NOT RUN: no installed Rust toolchain, and this environment has an 8 GiB cgroup limit below the existing 12 GiB build guard. That guard was not bypassed. This is not a successful build receipt.

## Version 1 wire contract

```ts
interface PriorityCapabilityV1 {
  version: 1;
  status: 'actionless' | 'actionable' | 'notPriority' | 'unknown';
  actor: number | null;
  priorityHolder: number | null;
  floatingMana: boolean | null;
  passVerified: boolean;
}
```

V1 supports only two-seat games without shared team turns. Invalid/non-authorized viewers receive unknown, null seat/mana facts and false passVerified. Out-of-range WASM viewer inputs and absent state return null. Actor and semantic priority holder remain separate under turn control. No action payload, card identity, object reference, diagnostic family, hidden state, seed or engine save appears in this response.

The only potential automatic-pass authorization is version exactly 1, status actionless, passVerified true, floatingMana false, and actor/holder matching the current supported session. All other outcomes stop. Actionable is a witness that at least one alternative exists; it does not assert all alternatives were enumerated. Indeterminate is always mapped to unknown.

The JavaScript authority must recompute this engine export immediately before a pass under journal serialization, bind epoch/revision/decision itself, and require an exact current legal PassPriority. Session Full Control, cancellation, own/opponent phase stops, mandatory decisions, pending drafts, in-flight commands, error and account/session retirement continue to stop automation. A certificate is never accepted from UI input. Unknown export versions or older runtime absence retain the existing unknown fallback. The optional JavaScript adapter is now implemented: a fresh synchronous export read is wrapped by the authority with its epoch and journal revision. `priorityCapability` rejects absent/malformed/stale envelopes, unknown schema versions, holder/actor mismatch and all non-actionless outcomes. The current two-seat session also refuses turn-control holder/actor differences. Current WASM absence keeps coverage unknown. This prepared binding does not establish new-runtime behavior.

## Required build and acceptance sequence

1. Reconstruct the exact shipped source; apply this patch and the separate atomicity patch. Format and compile with the approved build recipe in a sufficiently sized environment. Do not silently lower the memory guard or switch to paid workflow execution.
2. Execute all seven new Rust integration assertions: read-only empty window, unauthorized/invalid viewer privacy, separate controller/holder authority and stale authority, floating mana preservation, legal land action, terminal refusal, and exact versioned JSON shape.
3. Execute the existing preflight suite, particularly alternative-face casts, mana sources, special actions, RequiresChosenX, reducer rejection, and authority mismatch. Inspect every Indeterminate result; never turn it into an actionless fallback.
4. Generate WASM/glue, verify export presence and hashes, then run real-WASM positive and negative fixtures. An empty window must certify actionless and allow the journal pass. Sol Ring, free casts, own-spell responses, graveyard/exile actions and variable-X turn-up must stop. Verify byte-identical live saves before and after every read-only capability call, including RNG and knowledge metadata.
5. Update the runtime manifest and strict identity checks, bind the actual export to authority, and rerun stale/replay/cancel/mana/session-retirement tests and a complete combined browser match. No synthetic complete-capability fixture substitutes for this step.

The focused JavaScript run has 31 checks PASS: 18 priority-flow assertions (four new certificate/schema/staleness/mana/fresh-read cases), six candidate-cache assertions and seven outcome assertions. The two additional delivered-runtime capability-gap assertions PASS; both original real-WASM journal refusal fixtures also PASS with byte-identical state/journal after the optional binding change. Evidence: `evidence/session001-capability-gap.json` and `evidence/session001-optional-capability-engine.json`. They establish the current conservative behavior and the reason for this source dependency. They do not establish this candidate export's runtime behavior. Recovery remains UNSUPPORTED.
