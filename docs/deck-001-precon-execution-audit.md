# DECK-001: exact precon execution audit and priority evidence

**8 PASS / 1 FAIL across nine new diagnostic cases. All 16 existing starter-mechanic cases PASS. Neither complete precon is supported.** These are engine/API assertions and admission checks, not browser or signed-in complete matches.

## Scope and ownership

- Owner: Rules / Game Machinery Lord. Task `DECK-001`, assigned in [issue #50](https://github.com/deathxcore11/Card-forger/issues/50#issuecomment-6399766026).
- Branch: `codex/deck-001-precon-evidence-20261025`.
- Starting full commit: `cfc8f6a5d9cbcfad9252805616cb3467e2ff4ec4`, the completed rules-audit branch. The implementation under these fixtures remains release `2af11c9a1326e0db75b875d9c122e3dea01055d7`.
- Coordination and integration refreshed during the task through `2a1cb86ccf102321f3cfe662a9fcf83b6447bcbf`. All eight reused fixture/admission modules and seven runtime files consumed here match that integration commit by Git blob hash. This does not certify the combined UI, session or new CPU path.
- Allowed scope: two new exact-deck fixtures, one dedicated audit runner, this report and two evidence files. No production-file overlap, coverage promotion, session/CPU/UI edits, workflow changes, engine build, deployment or APK work.
- Current session contract belongs to Live Push: [`turnFlow` v1 at fe480bfa](https://github.com/deathxcore11/Card-forger/blob/fe480bfa42222bd20274b4a97ba60419bad64f94/docs/session001-turn-flow-v1.md). It supersedes the earlier generic proposal wherever fields or ownership differ. This branch supplies evidence, not a competing implementation.

## Exact candidate lists and admission

Player candidate: **Tramplesaurus Rex**, Ghalta, Primal Hunger as commander. Opponent candidate: **Calling All Angels**, Giada, Font of Hope as commander. Both are published Foundations Commander precons. Both seat assignments are checked.

The [official Wizards source](https://magic.wizards.com/en/news/announcements/foundations-commander-decklists), published September 18, 2026, was fetched and its exact deck blocks preserved. Missing quantities mean one; only a trailing Wizards image reference is removed. Each fixture retains all 100 cards, all quantities, the published commander, the raw block and source hashes. The runner re-parses that stored block and verifies the rows before testing.

These are real lists selected for the intended Precons source. Availability in the current user's picker/account is **NOT TESTED**. The MTGJSON index returned HTTP 403 in this environment, so no claim is made that its current list was fetched. The official source supplied the exact deck data. No user deck was replaced, edited or silently converted to Standard.

| Candidate | Total cards | Unique names | Names with compiled records | Missing compiled definitions | Names excluded by current execution coverage |
| --- | ---: | ---: | ---: | ---: | ---: |
| Tramplesaurus Rex | 100 | 69 | 25 | 44 | 66 |
| Calling All Angels | 100 | 69 | 25 | 44 | 68 |

Counts in the last four columns are unique names. Basic-land copies explain why 25 compiled names represent 56 of each deck's 100 physical cards. The current coverage list already contains Forest, Llanowar Elves and Ghalta in the green list, and Plains in the white list. A present compiled record is not an execution pass; absence of an explicit `Unimplemented` marker is not proof of complete behavior.

Exact per-card presence, record hashes and coverage exclusions are in the [machine-readable evidence](evidence/deck-001-precon-execution.json). Examples of missing definitions include Beast Within and Tamiyo's Safekeeping in green, and Youthful Valkyrie and Valorous Stance in white. Their printed text and artwork cannot fill that execution gap.

Both-seat admission correctly rejects both unchanged lists. The engine's `constructionLegal: false` comes with **Unknown cards** reasons in these tests; it is not evidence that the published precon violates paper Commander rules. Live catalog/ban legality is separately **NOT TESTED**. The report separates record availability, execution coverage and format-gate output so UI can explain the actual blocker.

Full-deck status: **UNSUPPORTED** for both. No complete game was started with missing records, no stub abilities were loaded, and no unsupported cards were replaced by basics.

## Named test results

Run: October 25, 2026, **12:22:22–12:22:35 p.m. America/New_York** (16:22:22–16:22:35 UTC). Node 24.22.1 / Linux x64, fixture seed 12345. Real compiled card records and the existing WASM execute every mechanic action. Starts are engineered two-seat Vintage positions to isolate mechanics; they are not full Commander game histories or evidence of command-zone/tax correctness.

| Case | Status | Starting state, action and actual result |
| --- | --- | --- |
| `admission-original` | PASS | Exact green player / white opponent lists; `prepareMatchInput` produces 99 + commander for each; existing admission rejects both without changing inputs. |
| `admission-swapped` | PASS | Same exact lists with seats reversed; both remain rejected and unchanged. |
| `empty-hand-mana-ability` | PASS | Empty hand, untapped Sol Ring. Human interaction API offers activation; accepted activation taps it and immediately produces two colorless mana, with no stack item. |
| `ooze-creature` | PASS | Opponent's turn, empty hand, Scavenging Ooze, one Forest, opposing Hammerskull in graveyard. Activate and resolve: exile target, add one +1/+1 counter, gain one life. |
| `ooze-noncreature` | PASS | Same fixture with a Forest in the graveyard: exile target, no counter and no life gain. |
| `giada-angel-payment` | PASS | Giada, two Plains, Righteous Valkyrie in hand. Activate Giada, then automatically pay the remaining cost. Angel resolves, restricted mana is spent legally, and Giada's replacement gives it one counter (3/5). |
| `giada-forbidden-payment` | PASS | Giada's restricted white mana is the only mana, Sol Ring in hand. No automatic cast candidate; forged automatic cast is rejected, and the complete save remains unchanged. |
| `ram-through-wrong-color` | FAIL | Opponent's turn, Ghalta and an opposing Hammerskull, Ram Through in hand, two Plains. Wrong-color cast is rejected without spending/moving, but exported library-knowledge metadata disappears. |
| `ram-through-paid` | PASS | Same two-target response with two Forests. Correct source and target are pinned on the spell's chained abilities. Resolution kills the 6/6 Hammerskull, deals six excess damage to its controller (20 → 14), leaves Ghalta, and puts the spell in graveyard. |

The nine-case count includes two successful admission **rejections**; it does not mean either full deck passes. Other mechanics on these cards and other cards in these lists remain untested unless separately evidenced. Manual and automatic payment equivalence is not certified by manually activating Giada before an automatically paid cast.

The unchanged `starter-pool-engine.mjs` was also run against independently unpacked, hash-verified shipped bytes: **16 PASS, zero network calls**. Its exact named cases, receipts and runtime provenance are included in the evidence. This confirms its existing assertions still pass; it is not a new combined browser-match result or validation of CPU-003.

## SESSION-001 capability finding

The empty-hand Sol Ring fixture yields these simultaneous results from `get_legal_actions_for_viewer_js(0)`:

```text
actions: [PassPriority]
autoPassRecommended: true
legalActionsByObject[Sol Ring]: ActivateAbility
viewerInteraction.autoPassRecommended: false
viewerInteraction: available activation choice
```

Submitting that engine-authored interaction actually adds two mana. Therefore, **the top-level pass-only candidate list and its auto-pass flag are not a complete description of available actions**. The session must preserve the conservative mana-window stop required by the current contract. This finding is a contract-boundary counterexample, not a claim that the current integrated session has already skipped the choice.

The Ooze fixture supplies a separate non-mana activation witness with an empty hand, on the opponent's turn, targeting a graveyard. The wrong-color Ram Through and restricted-mana Sol Ring fixtures supply negative payment controls. These are useful capability fixtures, not a general exhaustiveness proof.

Another important distinction: the real engine is in `state.waiting_for.type === 'Priority'` while its interaction descriptor may say `waitingForKind.code === 'choose'` and `canSubmit === true`. Those interaction fields alone do not establish a mandatory non-priority prompt. Use the authoritative decision kind and actor, then the authorized interaction choices.

| Capability question | Evidence from this packet | Remaining boundary |
| --- | --- | --- |
| Empty-hand mana activation | Accepted Sol Ring interaction | Mana-only safe suppression is not proved and remains disabled. |
| Empty-hand non-mana activation / graveyard target | Ooze creature and land controls | Not evidence for casting from the graveyard or all activated abilities. |
| Affordable vs unpayable instant | Ram Through payment controls | Not proof that an empty candidate list exhausts every payment route. |
| Restricted mana | Giada positive and negative controls | Other restrictions, alternate costs and full manual-payment equivalence are NOT TESTED. |
| Special action | Prior manifest audit contains a legal turn-up assertion | This packet does not expand that into general capability completeness. |
| Free/alternate costs and non-hand casting permissions | NOT TESTED here | Report unknown coverage, not an empty response window. |
| Required choices, queue cancellation, stops, Full Control | SESSION-001 owns implementation | No session files changed; no Smart-mode end-to-end pass is claimed. |

Neither the union of these observations nor a `progressAvailable` witness establishes full enumeration. A witness proves one action is available. Returning `coverage: 'complete'` for arbitrary supported positions still needs a justified authority rule and the missing negative controls. Integration should consume this report under its frozen schema, with unknown coverage preserved.

## Failure report: rejected cast changes knowledge metadata

Task link: extends the prior manifest audit's `RULES-003` rejection finding beyond turning a card face up.

- Build/runtime: release 4.0.0, exact immutable package below.
- Device/browser: Linux Node 24.22.1; no rendered browser.
- Fixture: `ram-through-wrong-color`; Ghalta ID 6, opposing Hammerskull ID 99, Ram Through ID 5, two Plains.
- Action: submit the recorded automatic CastSpell action with no valid green payment.
- Expected: reject with the complete exported state unchanged.
- Actual: rejected `action_not_allowed`; the only recorded save difference is removal of `/state/zone_change_library_knowledge_stamps`. These entries originated in initialized draw history retained by the engineered fixture. Cards, mana, life and battlefield resources do not change. No later visibility/recovery consequence is established.
- Evidence: exact start, before/after rejection saves, action, structured rejection and differences in the full archive. Reproduced across runs. The Giada forbidden-payment case is a complete-save-unchanged control.
- Dependency: runtime rejection/serialization owner. No production fix or build was attempted here.

## Reproduction and exact artifacts

From this branch, using Node 24 and the existing packaged runtime:

```sh
node experiments/phase-engine/deck-execution-audit.mjs
```

Expected exit code is **1**, because the state-preservation assertion currently fails. Default output: `test-results/deck-001/`. Select a case with `CARDSTASHY_DECK_AUDIT_CASES=empty-hand-mana-ability`; use `CARDSTASHY_DECK_AUDIT_OUTPUT` to keep a partial run separate. The runner marks partial reports and rejects unknown case IDs.

Existing starter regression uses `CARDSTASHY_VERIFICATION_INPUTS` pointing to the unpacked shipped `build-receipt.json`, `integration_cards.json.gz`, and `pkg/engine_wasm.js` / `engine_wasm_bg.wasm`, as specified by `starter-pool-engine.mjs`. No recompilation is required.

| Runtime identity | Value |
| --- | --- |
| Source commit | `5169f7fe03f93a6afe36fec767c3cda10120dcdd` |
| WASM SHA-256 | `a86578b23adcd26c38a68871e745305f3acb249158e1b424065cc6e6b6c3bfee` |
| Compressed card database SHA-256 | `0dbc4d30f035ffc538bf8ae904dbfdc815e9bb53371c05797361b2b639ede2b9` |
| Database entries | 6,137 |

New files:

- `experiments/phase-engine/deck-execution-audit.mjs`
- `experiments/phase-engine/fixtures/deck-001/tramplesaurus-rex.json`
- `experiments/phase-engine/fixtures/deck-001/calling-all-angels.json`
- `docs/deck-001-precon-execution-audit.md`
- `docs/evidence/deck-001-precon-execution.json`
- `docs/evidence/deck-001-precon-execution-full.json.xz`

The [full archive](evidence/deck-001-precon-execution-full.json.xz) is XZ-compressed UTF-8 JSON containing every exact engineered start, action/interaction submission, relevant offered packet, final state, failure and starter regression receipt. SHA-256: `7631d9e02cbdaefdb2f277c21daaf5102b8a7726ac7db84581c28227e90a180c`. The [readable summary](evidence/deck-001-precon-execution.json) includes its decoded hash and source hashes. All data is synthetic/public deck data; it contains no user account match.

## Handoff and remaining work

Before either exact deck can be admitted, provide verified executable records for its missing cards, execute required mechanics/choices, verify human and CPU decision paths, and complete representative matches on the combined candidate. A data expansion may be sufficient for some cards; this audit does not establish whether any particular missing card needs a WASM change. Admission and publication remain integration-owned. Keep current support guards intact.

For immediate SESSION-001 work, reuse the Sol Ring and Ooze fixtures as action-availability controls and the Giada/Ram Through fixtures as cost controls. Keep free/alternate-cost and non-hand casting completeness unknown until their separate evidence exists. UI and CPU owners should receive capabilities through the shared contract; they should not infer absence from hands, tapped sources or button counts.

Actual browser interaction, signed-in picker availability, full matches with these lists, current catalog legality, Commander-specific tax/damage/zone behavior and performance under these full decks are **NOT TESTED**. Product recovery is **UNSUPPORTED**. Rollback is to omit this diagnostics-only commit; no production file or live deck admission changes.

Rules references refreshed for expected results: [current rules landing page](https://magic.wizards.com/en/rules), [Comprehensive Rules effective September 25, 2026](https://media.wizards.com/2026/downloads/MagicCompRules%2020260925.txt), [Giada release notes](https://media.wizards.com/2022/downloads/SNC_Release_Notes/EN_MTGSNC_ReleaseNotes_20220331.pdf), [Ram Through release notes](https://media.wizards.com/2023/downloads/CMM_Release_Notes/EN_MTGCMM_ReleaseNotes_20230616.pdf), and [Scavenging Ooze release notes](https://media.wizards.com/2024/downloads/FDN_Release_Notes_dPeeQG7XyE/EN_FDN%20Release%20Notes%2008282024.pdf). Historical notes provide card-specific context; current rules govern later changes.
