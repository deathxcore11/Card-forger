# RULES-004: priority capabilities and auto-pass flag semantics

**Twelve bounded engine fixtures pass. Neither `autoPassRecommended` field proves that a player has no legal action.** This handoff adds executable witnesses for SESSION-001; it does not implement Smart pass or certify exhaustive action coverage.

Owner: Rules / Game Machinery Lord. Diagnostic parent: `ed3175347bc86b346205f3cba102a73bd3494c6c`. Integration inspected: `d81a0a14f3f34cf64fc0156abf495fab590263b6`. Only this report, a new diagnostic runner and its summary/full evidence are added. Session, authority, journal, CPU, projections, UI, runtime and deck admission are unchanged. The owner's combined-release requirement remains in force; this is not a proposal to substitute a starter-only release.

## Reproduce and evidence

```sh
node experiments/phase-engine/priority-capability-audit.mjs
```

Run from the repository root with Node. The runner verifies the shipped runtime and compiled database bytes, loads 14 unchanged records, and disables network access. It writes a summary and one full capture per fixture to `test-results/rules-004`. Assertion failures produce exit code 1. `CARDSTASHY_PRIORITY_CASES` optionally selects comma-separated case IDs; a filtered run is explicitly marked partial. `CARDSTASHY_PRIORITY_OUTPUT` changes the output directory.

Recorded environment: Node 24.22.1, Linux x64. App/runtime provenance is release `2af11c9a1326e0db75b875d9c122e3dea01055d7`; runtime source commit `5169f7fe03f93a6afe36fec767c3cda10120dcdd`; WASM SHA-256 `a86578b23adcd26c38a68871e745305f3acb249158e1b424065cc6e6b6c3bfee`; compiled database SHA-256 `0dbc4d30f035ffc538bf8ae904dbfdc815e9bb53371c05797361b2b639ede2b9`. This uses the existing executable, not a rebuilt engine or the integrated browser session.

- [Runner](../experiments/phase-engine/priority-capability-audit.mjs).
- [Summary, source provenance and archive hashes](evidence/rules-004-priority-capability.json).
- [Full starting saves, fixture recipes, observations, accepted commands and final saves](evidence/rules-004-priority-capability-full.json.xz).

Every case starts from an engineered, seeded two-seat Vintage position using real compiled definitions. The setup uses restore; it is not a normal legal setup history. Subsequent commands must be offered by the engine and accepted. Full raw saves are synthetic diagnostics, not data to send to either game's client or CPU. Each case records its expected/actual result and executable assertions. Browser presentation, CPU choice quality, reload/recovery and all-card support are outside these assertions.

## Results

| Case | Status | Executed observation/assertion |
| --- | --- | --- |
| `empty-priority` | PASS | Empty hand and board offer a legal pass. The nested flag is false even in this empty fixture. Pass is accepted. |
| `mana-only-sol-ring` | PASS | Flat list contains only PassPriority; grouped and interaction surfaces offer Sol Ring. Accepted activation taps the actual permanent and creates two colorless mana. |
| `empty-hand-ooze` | PASS | On the opponent turn, empty-hand Ooze activates using Forest. The engine selects its sole graveyard target; resolution exiles the Bear, gains one life and adds one +1/+1 counter. |
| `zero-cost-main` | PASS | Ornithopter with no mana sources is offered, cast and resolved to the battlefield. |
| `zero-cost-opponent-turn` | PASS | The same ordinary creature is not offered during the opponent turn. Zero cost does not bypass its timing. |
| `unpayable-instant` | PASS | Think Twice without mana has no cast offer in either inspected action surface. This is one bounded negative. |
| `own-spell-response` | PASS | With the controller's Ornithopter on the stack, the top-level flag is true while Lightning Bolt remains offered. Bolt is cast, a mandatory target is selected, damage occurs and Ornithopter resolves. |
| `flashback-graveyard` | PASS | Empty-hand Think Twice is cast from the graveyard using three Islands during the opponent turn, draws one and ends in exile. |
| `cycling-hand` | PASS | Unearth's hand ability is offered as ActivateAbility, executes for two generic mana, discards the card and draws one. |
| `alternate-force-of-will` | PASS | With no mana sources, Force of Will is offered against an opposing spell. OptionalCostChoice elects the alternate cost; PayCost selects the blue card. Life falls to 19, the blue card is exiled, and the opposing spell is countered. |
| `exile-play-permission` | PASS | Accepted Light Up the Stage resolution establishes exile permission. After all three Mountains were used, the exiled Ornithopter is still offered and resolves. Permission is not manufactured by the fixture. |
| `manifest-choice-and-special-action` | PASS | ManifestDreadChoice requires selection and offers no pass. The selected creature can subsequently TurnFaceUp; the same object is face up and the stack is unchanged. |

**Runner total: 12 PASS / 0 FAIL / 0 NOT TESTED / 0 UNSUPPORTED.** This count describes only the twelve named assertions. General enumeration completeness and integrated SESSION-001 behavior are **NOT TESTED**; saved-state recovery remains **UNSUPPORTED** for the release under discussion. No card or deck is promoted to supported by these tests.

Initial harness failures were corrected before the recorded full run: cycling uses ActivateAbility, Ooze's sole target is selected automatically, the counter key is P1P1, and Force of Will needs an explicit optional-cost election before its card payment. These were test assumptions, not engine fixes. Final evidence contains the corrected reproducible run.

## What the interfaces actually mean

Source inspection is pinned to upstream `phase-rs/phase` commit `71ccd8fe1715c45fe9e9bd78d391bec5ac8a4234`, plus the exact ninjutsu patch named by the shipped build receipt. The five files below are unchanged by that patch; their Git blob hashes are checked in the evidence. This is source evidence, not a new compilation.

1. **Top-level `autoPassRecommended` is a policy recommendation.** In [ai_support/mod.rs](https://github.com/phase-rs/phase/blob/71ccd8fe1715c45fe9e9bd78d391bec5ac8a4234/crates/engine/src/ai_support/mod.rs#L2038), `standing_priority_pass` may grant a pass before castability checks, including the controller's own stack object. An opt-in SkipLowUseWindows mode can also recommend passing despite an instant being available. The own-spell fixture demonstrates the former behavior in this executable. The recommendation is not necessarily incorrect; interpreting it as an empty-action certificate would be incorrect.
2. **Nested `viewerInteraction.autoPassRecommended` describes engine auto-pass state.** [interaction.rs](https://github.com/phase-rs/phase/blob/71ccd8fe1715c45fe9e9bd78d391bec5ac8a4234/crates/engine/src/game/interaction.rs#L9209) sets it when the authoritative decision is Priority and the viewer has an entry in `state.auto_pass`. It is false in both the empty fixture and actionable fixtures. Treating it as a more complete replacement for the top-level flag is unsupported.
3. **The flat list intentionally excludes mana actions.** [legal_actions_full](https://github.com/phase-rs/phase/blob/71ccd8fe1715c45fe9e9bd78d391bec5ac8a4234/crates/engine/src/ai_support/mod.rs#L2410) documents the difference from the grouped map. Sol Ring is a concrete counterexample to flat-list exhaustiveness. It does not show that the integrated session already skipped that activation.
4. **Interaction candidates add useful paths, but this audit does not prove universal completeness.** [actor_candidates](https://github.com/phase-rs/phase/blob/71ccd8fe1715c45fe9e9bd78d391bec5ac8a4234/crates/engine/src/game/interaction.rs#L6912) starts from validated candidates, separately validates manual-payment siblings, and adds mana/undo actions at Priority. Payload limits can produce an unsupported result. Combining surfaces must not silently turn unknown coverage into complete coverage.
5. **`progressAvailable` is a legal-progress witness, not an interaction classifier or completeness guarantee.** [InteractionAvailability](https://github.com/phase-rs/phase/blob/71ccd8fe1715c45fe9e9bd78d391bec5ac8a4234/crates/engine/src/types/interaction.rs#L1387) distinguishes progress, input, escape, waiting, terminal, unsupported and stuck states. A progress witness can be PassPriority. In these fixtures `waitingForKind.code` is `choose` for ordinary Priority as well as targeting and alternate-cost election. Use the authoritative decision variant to distinguish a voluntary priority window from an owed choice.

## SESSION-001 handoff

Keep the frozen [turnFlow v1 contract](https://github.com/deathxcore11/Card-forger/blob/fe480bfa42222bd20274b4a97ba60419bad64f94/docs/session001-turn-flow-v1.md). These fixtures supply bounded positive action witnesses and negative controls, not permission to weaken its coverage gate.

- Preserve actual action offers from all permitted zones, free/alternate costs and special actions. An empty hand, zero floating mana or flat pass-only list cannot decide this.
- Emit `mandatory-choice` for authoritative TargetSelection, ManifestDreadChoice, OptionalCostChoice and PayCost in the recorded paths. The UI's generic `choose` shape alone cannot make that decision. Route the choice through the existing authorized interaction surface.
- Stop on an available non-mana action, an unproved mana-only window, unknown/truncated/unsupported data, Full Control, a phase stop, or a pending draft. A bound progress witness establishes only that witness, not the absence of alternatives.
- Do not synthesize `coverage: 'complete'` by unioning lists or substituting one flag for the other. Any bounded capability certificate needs an explicit tested domain and unknown fallback; general completeness remains unproved here.
- Full Control, both-seat stops, same-revision cancellation, stale/duplicate commands, account retirement, floating-mana preservation and final combined UI/CPU operation still need SESSION-001's implementation evidence. Keep authority recomputation and journal serialization in their owning lane.

For CPU-004's enumeration-latency dependency, source inspection gives a profiling lead: [engine-wasm/lib.rs](https://github.com/phase-rs/phase/blob/71ccd8fe1715c45fe9e9bd78d391bec5ac8a4234/crates/engine-wasm/src/lib.rs#L2677) derives an interaction inside `legal_actions_result_for_viewer`; `viewer_snapshot` calls that helper and then derives the filtered interaction again. This is not a measured explanation of the reported 630 ms call and is not a proposed cache workaround. Profile candidate generation, policy and projection separately against a fixed decision before changing ownership-sensitive code.

The rejection-atomicity patch remains uncompiled/unvalidated, and the two audited precons still lack 44 executable names each. This task changes neither status. Rollback: omit this diagnostics-only commit; no shipped behavior depends on these files.
