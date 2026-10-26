# CardStashy Play UI: resume here

Updated 2026-10-26. Task UI-007. Owner: this integration/UI continuation session.
This handoff is committed before implementation so a stopped session is recoverable.

## Starting point

- Repository: `deathxcore11/Card-forger`.
- Production branch: `claude/edit-publish-github-bpm8zu`, verified at `14c65637e4402f61cff95b54d0ced2412da4819d`.
- Evidence branch: `codex/forge-web-acceptance-20261026`, verified at `f77eb18ac225f5c11348132a760a9710c3af6ea8` (same application plus release evidence).
- UI continuation branch: `codex/play-ui-continuation-20261026`. Read its current HEAD and this file first; its latest committed state is authoritative for this task.
- Production website: 4.1.0, `https://cardstashy.com/#play`; Worker `cardforge2`, version `0eef0537-cf20-4aa6-8daa-45955f58d782`, deployment `ecd4fb33-6802-4eb9-8cc4-998bb2fd860a`.
- Native host source: `8358a281f40677e6d824c0bb6dea7097f2c19e2e`, successful run `40391886971`; Worker version `5203d3a9-d42e-4406-aedb-cfac7695d934` and container version 2 at 100%. No native rebuild is needed for UI-007.
- `docs/play-visual-contract-audit.md` distinguishes deployed source, local native evidence and untested browser behavior. Issue #50 was inspected; its latest entries are October 25 and predate the Forge release. Do not revert to the old WASM/starter-only direction.

## Current task status

URGENT SCOPE CHANGE from the owner: fix only normal Play reaching the legacy runtime, then push live. All cosmetic/gesture/rail work below is PAUSED.

The screenshot title and stopped-session message match legacy play-player-mat.js. Source confirms normal Play still branches on the separately cached FORGE_PLAY_TEST_ENABLED module. Modern is shown only when the Forge branch is selected. We have not proved whether the user has an old open session or mixed cached modules.

Immediate work: remove the production legacy branch and its imports; make all three formats route directly to hosted Forge; repair stale-shell update behavior without clearing user storage or auto-reloading an active match; add engine/build diagnostics backed by the actual native receipt; validate and publish website-only. Do not claim the next signed-in match passed without evidence.

No implementation or deployment of this correction at this checkpoint.

Confirmed source problems:
1. `forge-table.mjs` starts a drag after eight pixels for all pointer types, so touch scrolling can be intercepted. A rejected drop has no local explanation.
2. `match-table.mjs` forces its inspector/stack rail open whenever the stack has any item; Close cannot collapse it.
3. Native error diagnostics and internal labels can appear in the primary decision dock rather than its secondary details.

Implementation order:
1. Separate native card gestures: normal touch scrolling and tap remain available; deliberate hold inspects. Mouse drag uses the same native card command as click, with revision checks, click suppression and clear invalid-drop feedback. Never infer playability from card costs or artwork.
2. Make the stack/history rail genuinely collapsible while retaining an obvious stack count. Opening an inspector remains separate from collapsing the rail. Keep all actual decisions visible in the dock.
3. Use player-facing error summaries while retaining technical information in Match details. Preserve real engine prompt text, canonical IDs, payment and choice semantics.
4. Run focused event/DOM regressions and the existing Play checks. Update this handoff with exact behavior, commands and results. Commit and push before any publication.
5. Under the owner's existing live-push authorization, publish a bounded website-only update after checking the production head again. Preserve unrelated changes if the head moved. Verify provider deployment; mark actual browser/physical touch checks NOT TESTED if unavailable.

Allowed files: `experiments/forge-proof/forge-table.mjs`, `native-panel.mjs`, a narrowly scoped gesture module beside them, `experiments/phase-engine/match-table.mjs`, `play-forge-table.css`, focused tests, deployment asset/cache lists if a module is added, version/release metadata and this handoff. Do not modify Forge rules, CPU policies, native host images, Supabase, account/deck data or unrelated app screens.

## Nonnegotiable user direction

- Real saved/imported/precon/meta/community lists in Standard, Modern and Commander. No starter-only restriction, invented community decks, substituted cards or silent list repair.
- One Medium CPU underneath; no difficulty selector. Easy/Hard and APK later.
- Forge owns legality, payment, priority, mandatory choices, combat and results. UI explains and submits exact choices.
- Preserve existing art/glass, profile portraits, deck popup and card inspector. Native hidden-hand filtering must stay intact.
- Reconnect is not required. No recovery feature or fabricated loss on a technical interruption.
- Do not rebuild Forge for CSS or browser wiring. The proof host branch has a deliberately invalid root deployment configuration; NEVER merge its root Wrangler config into production.

## Evidence and known gaps

PASS before UI-007: provider deployment of 4.1.0/host; exact native Commander fixture reached real mulligan; 88 focused website tests. These do not prove a signed-in complete match.

NOT TESTED: complete signed-in live match, live Mountain payment exactly once, legal-response pauses, physical wide touch, current-release after screenshot. Prior browser retained old cached UI, then URL policy rejected a reload; do not circumvent that restriction through another browser surface or hidden browser commands.

UNFINISHED: native phase stops, own-main empty-window auto-advance, token quantity selection, combat/attachment relationship projection, detailed engine ending reason and saved match/deck-version history. Do not expose controls for missing native capabilities.

## Workspace and publication mechanics

Current workspace `/workspace/scratch/7fbb2c6b19de/release` is a SPARSE reconstruction, not a complete Git checkout. Missing local files are NOT deletions. Never deploy this sparse directory as the full website or upload it as a replacement repository tree.

Use a complete fresh clone if available. Otherwise preserve the exact remote base tree using GitHub create_tree with explicit changed blobs, create_commit, and update_ref with expected_sha and force=false. Inspect current branches before updates. Production starts at tree `c21dab38aa0fe0b134d6dfcd9768fa23c8faeeeb`; evidence starts at tree `c4aedde1654b6aa30c1f52a5107a71d521a1e866`. Refresh these if the corresponding commit changes.

Normal site Cloudflare trigger `61bc9aac-1b0b-45e3-8092-5a14a001f0af` deploys the production branch with `npx wrangler deploy`. `[skip actions]` suppresses unrelated GitHub workflows but allows this Cloudflare deployment. `[skip ci]` is for checkpoint/evidence commits that should not deploy. Keep native host branch untouched.

Useful local evidence: `deployment-readback.json`, `release-tests-final.log`, `website-launch-final.log`, `starting-player-work/local-checks/run-40391886971-redacted.log`. Exact private runtime logs may include hidden cards or credentials: do not publish them.

If interrupted: start by comparing production and the UI continuation HEAD, read the latest version of this file, inspect the commit diff, then resume the first unfinished step. Do not repeat the paid image build or claim current tests from a previous revision.
