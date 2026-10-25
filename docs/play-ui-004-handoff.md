# UI-004 — approved tabletop refinement and bounded interaction evidence

Status: READY for sequential UI patch review. This is not the combined release or the completion of all UI scope. The owner approved the art-led composition and requested refinement rather than redesign. This record supersedes the older prototype-only UI-004 report.

Parent: c844b65cd41a56a92a1e42801861ba7734e7da31 (UI-002, stacked on UI-001). Ownership: UI, issue #50. No authority, session, CPU, seat projection, runtime, card admission or shared foil implementation changes.

## What changed

- One art-led tabletop with opponent above, player below, full-face hand, compact decision dock and quieter optional inspector. Opening hand remains a separate stage with Keep/Mulligan.
- Portrait deck art fades into the glass. The actual profile badge remains separate. Turn ownership, phase and required human action are distinct: CPU turn / Combat and Your response / Choose blockers can coexist.
- Battlefield art rotates for accepted tapped state. Upright names/current stats stay readable; selection lift is a separate transform. Instance identity, chosen printing and finish metadata remain unchanged. Full-card inspection preserves existing effects; a full-card foil mask is not stretched onto a differently cropped artwork surface.
- Board selection and keyboard inspection remain available. Target preview, cancel and confirmation use the existing session contract. Blockers can be selected on the board, assigned to exact offered attackers, explicitly changed, cleared and confirmed. Numbered draft pairs focus one connection at a time; the complete options list remains available.
- Zones groups authorized public information, including Command-zone objects when supplied. Help and confirmed exit remain in Match menu. Empty stack is compact, but a legal spell drag exposes a temporary drop destination. Choice ranges/order and remaining clocks remain visible.
- Turn banners follow turn changes and do not replay on each local selection. Rejections remain available beside the decision in understandable wording; no raw engine exception or unsupported reason is invented.

## Evidence

PASS: 40 focused Node tests. See evidence/play-ui-004-node.txt. Reproduce:

```sh
node --test experiments/phase-engine/test-match-ui-presentation.mjs experiments/phase-engine/test-match-ui-refinement.mjs test-play-artwork-views.mjs test-play-card-surface.mjs experiments/phase-engine/test-match-session.mjs experiments/phase-engine/test-combat-interaction.mjs experiments/phase-engine/test-card-stats.mjs experiments/phase-engine/test-card-placement.mjs
```

PASS: 80 synthetic browser layout cases, 10 states × 8 CSS viewports (1280×720, 1920×1080, 2560×1080, 3440×1440, 1024×768, 900×650, 1180×757, 590×378). Includes crowded zones, inspector containment, reachable actions, identity/privacy canary and portrait responsibility. 590×378 is reflow evidence, NOT actual 200% browser zoom. Run `experiments/phase-engine/ui-review-index.html` → Run layout matrix. See evidence/play-ui-004-layout-report.json.

PASS: 25 synthetic DOM decision checks covering opening inspection/Keep/exit cancellation, target draft/inspection/clear/confirm once, combat pairs/focus/clear/no attackers, turn-banner persistence, first-spell dragging to an empty stack, damage total and remaining clocks. Same review page → Check decision flows. Controlled session, not engine acceptance. See evidence/play-ui-004-decision-report.json.

PASS: real-engine browser combat fixture, eight assertions over captured events. Existing hash-verified WASM a86578b23adcd26c38a68871e745305f3acb249158e1b424065cc6e6b6c3bfee, seed 4119. An engineered starting position enters DeclareBlockers through accepted engine passes and DeclareAttackers. Production table, session, seat/interaction projection and journal are used; opponent is scripted to pass. Select Ordinary Bear → Lashwhip Predator; Change block → Bear Cub; Clear blocks; assign Bear → Cub and Llanowar Elves → Tapestry Warden; double-click Confirm blocks; Continue through the real response window. Private changes remain revision 0. Exactly one block submission is accepted, followed by legal passes. Combat reaches revision 4 / CombatDamage: life 20→13, Bear survives with two damage, Cub and Elves enter the graveyard. Vigilant Warden stays untapped while the other attackers are tapped. No power-only outcome estimate is used.

Reproduce with `experiments/phase-engine/ui-combat-engine-review.html`. The fixture's HTTP preview lacks WebCrypto; a test-only SHA-256 adapter bundled from hash.js 1.1.7 supplies the same digest operation. Original length and pinned hash checks still run; production loader is unchanged. Adapter was checked against Node crypto for empty, abc, 70,001 bytes and exact runtime glue. All code and licenses are included. Runtime cache is disabled only in this fixture. This is NOT a production boot-time measurement.

Evidence files: play-ui-004-engine-events.json, play-ui-004-engine-checks.json, block/resolution screenshots and play-ui-004-combat-stepped.mp4. The video is explicitly a stepped capture of actual browser states, 2.5 seconds per frame, not uninterrupted real-time footage. Labels are in play-ui-004-recording-steps.json. The target screenshot is a synthetic visual fixture; block/resolution screenshots are the real-engine fixture.

## Remaining work and exact boundaries

UI-003 deck sources, temporary random decks, explicit saving and Quick Play/Practice navigation remain separate uncommitted work. Do not omit them from the agreed combined release. Social remains later. CPU-005 menu labels must be reconciled with integration-owned difficulty forwarding and CPU-006 route evidence.

SESSION-001 owns Smart passing, Full Control, phase stops, cancellation and exhaustive coverage. This patch neither implements automatic passing nor infers safety from legacy flags. RULES-004 reinforces that top-level autoPassRecommended is not a no-action certificate.

The current human projection does not provide authoritative attachment links, Commander tax/damage/designation, full accepted combat topology or token-equivalence proof. Therefore this patch does not invent attachments, collapse tokens, count total unblocked attackers or predict combat consequences. Exact individual objects stay inspectable. Integration dependencies were recorded in issue #50 comment 6400661860. Commander-specific controls and richer accepted-action feedback remain unfinished.

NOT TESTED: actual signed-in full Home→match→result→Home journey with this combined patch, production CPU browser match, actual 200% zoom, physical touch, uncoached newcomer session, Commander match, live served hashes. Recovery remains UNSUPPORTED. Broader deck coverage and rejection atomicity remain engine/integration work. No engine build, deployment, APK change or workflow dispatch.

Visual adaptation: retain reference art tiles, full-card hand, compact portraits and contextual decisions; adapt to CardStashy's soft glass and restrained gold. Do not copy dense permanent rails or infer card support from screenshots. Crowded rows scroll without permanently shrinking all cards. Layout assertions establish containment; owner visual approval concerned the composition and does not certify every interaction.

Rollback: omit this UI-004 commit, retain UI-001/002. No data migration.
