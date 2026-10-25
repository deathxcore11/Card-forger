# CardStashy manifest rules audit

**Result: 14 PASS, 10 FAIL in 24 focused assertions. Innocuous Rat remains UNSUPPORTED.** This audit does not certify manifest as supported or change the admitted starter-deck pool. It exercised the shipped engine and application adapters, not a rendered browser, signed-in session, or complete match.

| Task | Owner | Starting commit | Allowed files | Acceptance | Status |
| --- | --- | --- | --- | --- | --- |
| RULES-MANIFEST-001 | Rules-testing chat | `2af11c9a1326e0db75b875d9c122e3dea01055d7` (4.0.0) | New diagnostic scripts and audit/handoff documents only | Reproduce manifest behavior with unmodified shipped WASM; record start, action, expectation, outcome and assertion | Audit complete; failures and dependencies recorded |

Branch: `codex/gameplay-rules-manifest-audit-20261025`. The integration chat owns review and sequential merging. No production source, UI/CPU implementation, workflows, runtime bytes, coverage lists or account records are changed by this branch. No deployment or engine build was performed.

## Reproduce

From the repository root, with Node (tested on Linux x64, Node 24.22.1):

```sh
node experiments/phase-engine/manifest-acceptance.mjs
```

The runner validates the packaged runtime and card database hashes, decompresses the existing WASM in memory, and loads 13 unchanged compiled card records. It does not fetch network resources or compile an engine. Expect exit code **1** while any assertion fails. Results are written to `test-results/gameplay-acceptance/`.

For one diagnostic:

```sh
CARDSTASHY_ACCEPTANCE_CASES=nameless-rule node experiments/phase-engine/manifest-acceptance.mjs
```

Use `CARDSTASHY_ACCEPTANCE_OUTPUT` to keep partial runs in a different output directory. The report marks partial runs; they must not be presented as the full suite. Engineered starting positions use the persisted-state setup seam and are explicitly not legal full-match histories. All tested subsequent gameplay uses engine submissions; the counter, alternate-hand and payment setup mutations are recorded as fixtures.

Run recorded: **2026-10-25 15:04:28–15:05:16 UTC**. All seven reused fixture/adapter dependencies were checked against Git blob hashes in release `2af11c9a` and matched. New diagnostics record their own SHA-256 hashes.

| Provenance | Value |
| --- | --- |
| Shipped engine source | `5169f7fe03f93a6afe36fec767c3cda10120dcdd` |
| WASM SHA-256 | `a86578b23adcd26c38a68871e745305f3acb249158e1b424065cc6e6b6c3bfee` |
| Compressed compiled-record SHA-256 | `0dbc4d30f035ffc538bf8ae904dbfdc815e9bb53371c05797361b2b639ede2b9` |
| Compiled-record catalog size | 6,137 |
| Subset SHA-256 | `aab85b94bc67a4bccd34e415122a44c947244143aca43fc8b7899df9f266720b` |

## Evidence and scope

The [machine-readable report and complete 36-item ledger](evidence/gameplay-manifest-20261025.json) records PASS / FAIL / NOT TESTED / UNSUPPORTED, build commit, expected/actual results and assertion references. The [full evidence archive](evidence/gameplay-manifest-20261025-full.json.xz) contains exact starting saves, fixture mutations, accepted action traces, interaction submissions, rejected attempts, events, relevant filtered views and source hashes for all 24 cases. It is XZ-compressed UTF-8 JSON, not executable content.

To inspect it without rerunning:

```sh
python - <<'PY'
import json, lzma
from pathlib import Path
p = Path('docs/evidence/gameplay-manifest-20261025-full.json.xz')
evidence = json.loads(lzma.decompress(p.read_bytes()))
print(evidence['report']['counts'])
print(evidence['cases']['nameless-rule']['resultZones'])
PY
```

Full archive SHA-256: `1f93a8f92b78b4f1b26e1dfc8a36e8c306f45be01848eda060e9b4e8379ad059`.

The aggregate count describes diagnostic cases, not 24 of the user's 36 acceptance items. Multiple failing cases share a cause. PASS applies only to the recorded layer and fixture. Human interaction-API submission is not a browser interaction test; same-process restore is not browser recovery; one CPU position is not broad fairness or competence coverage.

## Separate issue reports

All reports below use build 4.0.0 / `2af11c9a`, Linux Node 24.22.1, the exact runtime above, and synthetic two-seat Vintage fixture starts. No browser screenshot is offered as evidence; each has an automated assertion and recorded state/trace.

### RULES-001 — Nameless creatures are incorrectly grouped

- **Owner/dependency:** engine rules; integration must allocate the engine-source fix and any later build separately.
- **Cards/start:** two manifested Grizzly Bears, Declaration in Stone in hand, sufficient untapped lands. Control uses a manifested Bear and Visionary instead.
- **Actions:** cast the removal with only the first face-down instance as target; pass priority to resolution. The fixture asserts both creatures remain face down before resolution and checks the spell's exact target.
- **Expected:** only the targeted nameless creature is exiled. Objects with no name do not share a name (CR 201.2a).
- **Actual:** both creatures are exiled, including the control with different underlying printed names. This establishes the behavior; the internal source-level cause has not been inspected here.
- **Evidence/repeatability:** `nameless-rule` and `nameless-control` FAIL; reproduced in successive diagnostic runs.

### RULES-002 — Raw opponent snapshot contains hidden identity

- **Owner/dependency:** engine viewer filtering; shared-view owner must preserve the current sanitization boundary.
- **Cards/start:** Manifest Dread, Elvish Visionary and Lightning Bolt on top of the library.
- **Actions:** manifest Visionary; request the opponent snapshot.
- **Expected:** the opponent receives no Visionary identity while it remains face down.
- **Actual:** its main object is redacted, but the exact name appears at `/state/state/battlefield_entries_this_turn/0/name`, `/state/state/zone_changes_this_turn/1/name`, `/state/state/zone_changes_this_turn/1/trigger_source_context/lki/name`, and `/state/state/zone_changes_this_turn/1/trigger_source_context/printed_ref/face_name`.
- **Boundary:** the current `projectSeat` projection removes these paths; its no-identity assertion passes. This is not evidence that the current opponent CPU consumed the leaked identity.
- **Evidence/repeatability:** `private-filter-isolation` FAIL; exact paths and sanitized projection retained; reproduced.

### RULES-003 — Rejected turn-up changes exported metadata

- **Owner/dependency:** engine action rejection / serialization.
- **Cards/start:** a manifested land or instant, or Visionary with insufficient mana or wrong-colored available sources.
- **Actions:** submit TurnFaceUp, then compare the complete exported saves before and after rejection.
- **Expected:** rejection leaves the save unchanged.
- **Actual:** action is rejected and mana/card/counter state is unchanged, but `/state/zone_change_library_knowledge_stamps` disappears. A later visibility or recovery consequence has not been demonstrated. Do not describe this as observed mana loss or an illegal completed turn-up.
- **Evidence/repeatability:** `noncreature-forest`, `noncreature-lightning-bolt`, `insufficient-mana`, `wrong-colors` FAIL with the same recorded difference; reproduced. `invalid-selection` is an unchanged-save PASS control.

### RULES-004 — Return to hand lacks an authorized reveal

- **Owner/dependency:** engine reveal event / viewer transition, followed by UI reveal presentation.
- **Cards/start:** a manifested Visionary, Unsummon in hand and adequate mana.
- **Actions:** target the face-down permanent and resolve Unsummon; request the opponent's authorized transition snapshot.
- **Expected:** its identity is revealed as required on leaving the battlefield, before entering a hidden hand.
- **Actual:** destination is correctly Hand and the authoritative object is no longer face down, but neither the authorized events nor the opponent's visible object reveal the identity. Historical metadata in this transition also contains no name.
- **Evidence/repeatability:** `reveal-bounce` FAIL; reproduced. Destroy and face-up exile PASS because the public destination object exposes the identity; concession reveal also PASS. These do not prove a rendered reveal animation.

### UI-DEPENDENCY-001 — Face-down view lacks public characteristics and inspection

- **Owner/dependency:** UI plus integration/shared adapter owner; no adapter edits made here.
- **Cards/start/actions:** manifest Visionary; compare both seat projections with the engine's filtered objects.
- **Expected:** public current creature characteristics survive projection, while the controller gets a separate permitted inspection route.
- **Actual:** `projectSeat` returns only instance/zone/owner/controller/known/tapped for the face-down object; public power/toughness are absent. The controller identity is also dropped. Current session inspection requires `known`, so enabling a private inspector needs an agreed adapter change. The assertion fails first on missing public power; a browser inspector was not executed.
- **Evidence/repeatability:** `public-and-private-view` FAIL with both actual projected objects; reproduced. See the [UI handoff](gameplay-ui-handoff-20261025.md) for prompts, arrows, motion, errors and ownership boundaries.

### CPU-DEPENDENCY-001 — Manifest decision cannot be completed

- **Owner/dependency:** CPU policy plus shared authorized choice projection; no CPU edits made here.
- **Cards/start/actions:** resolve Manifest Dread with Grizzly Bears and Lightning Bolt as the private choices; pass the existing legal actions and projected view to `cpuPacket` / `chooseVisible` with seed 123.
- **Expected:** CPU completes a legal manifest selection using only permitted information, then can exercise a useful legal turn-up.
- **Actual:** both SelectCards candidates become unsupported packets; policy throws `CPU_DECISION_UNSUPPORTED`. The subsequent turn-up assertion is not reached and must not be reported as a tested tactical failure.
- **Evidence/repeatability:** `cpu-choice-and-turnup` FAIL; reproduced.

## Passing controls and outstanding acceptance work

The 14 passing cases cover both human interaction-API choices, original non-token instance identity, engine characteristic fields, legal special-action turn-up, no Visionary ETB retrigger, tapped/counter/equipment persistence, zero/one-card libraries, unchanged invalid selection, one hidden-hand fairness fixture, same-process pending-choice restore, distinct face-down instances, and public-zone/game-end reveals. Some cases cover several assertions.

The fairness fixture swaps an actual unrevealed opponent hand of **Grizzly Bears + Elvish Visionary** for **Lightning Bolt + Forest**, preserving the CPU-visible state and seed 777. Visible state, policy packet and selected action remain identical. It does not establish fairness across all positions, prompts or difficulties.

The restore fixture reuses the same WASM process. Opaque interaction IDs legitimately regenerate; the fixture reacquires them and compares semantic choices and resulting state. Product reload remains **UNSUPPORTED** in the session-only beta.

Innocuous Rat, Bronze Bombshell, Rats of Rath, Progenitus, Soldier of Fortune, City in a Bottle, Karn Liberated and Panglacial Wurm have no compiled record in this shipped catalog. Chaos Orb has a record containing an explicit `Unimplemented` effect. These are catalog/support findings, not executed rules passes. Rat's death, exile/bounce non-trigger and death-trigger response tests cannot be substituted with the standalone Manifest Dread spell fixtures.

The 36-item ledger explicitly leaves broad payment, extra land plays, counterspell/illegal-target interactions, simultaneous triggers, combat, replacements, copies/expiry, Commander, loops, tactical quality, difficulty comparisons, archetype matches, synchronization, result recording and unsupported import UI as **NOT TESTED** in this bounded task. Dragging/sorting/animation identity remains NOT TESTED despite the engine instance-ID control passing.

## Integration next steps

1. Keep manifest and Rat outside the admitted pool. Take RULES-001 as one bounded engine-source fix; use the existing failure and different-printing control as regression tests. Do not bundle a new build into this audit branch.
2. Assign each remaining runtime failure separately. UI work cannot repair a missing public reveal by reading hidden authority state.
3. Agree ownership of shared adapters before the UI and CPU chats edit them. Supply current public characteristics and explicitly private controller choices/inspection while preserving metadata redaction.
4. Run the targeted fixture after each fix, then the relevant UI/CPU checks, a complete supported match and required recovery tests before claiming expanded support. Integration owns the combined release.

Rules sources checked for this audit: Wizards' [current rules page](https://magic.wizards.com/en/rules), [Comprehensive Rules effective September 25, 2026](https://media.wizards.com/2026/downloads/MagicCompRules%2020260925.txt) (201.2a; 701.40; 701.62; 708.2–9; 733), [Duskmourn release notes](https://magic.wizards.com/en/news/feature/duskmourn-house-of-horror-release-notes), and [mechanics explanation](https://magic.wizards.com/en/news/feature/duskmourn-house-of-horror-mechanics). The current Comprehensive Rules take precedence for later changes and unusual interactions.
