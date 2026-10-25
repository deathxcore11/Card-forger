# CardStashy 4.0.1: Play UI and CPU patch

Owner-directed as-is publication, 2026-10-25. This supersedes the earlier requirement to wait for every broader-deck/engine milestone. Gameplay source is the tested integration commit `8ba7b21821a25a5faaa688edeecf86668349b41c`; this release changes only version/cache metadata and documentation. Engine runtime remains `a86578b23adcd26c`. Android remains 0.6.0 beta, version code 13, bundled interface 3.95.1. Publication is established only by the deployment receipt and live checks, not this document alone.

## Included

- Both latest UI handoffs: deck-source browsing, temporary selections, explicit deck saving, local Quick Play, portrait HUD, legal-play/activation cues, readable hand artwork and keyboard-focus restoration.
- CPU survival fix (including Ghalta), bounded large-board block search and fewer repeated previews; Easy/Medium beta and Hard experimental policy selection. Relative strength is not established.
- Required public target selection and trigger ordering; public Commander designation, tax/cast-count and damage ledger with hidden-state redaction.
- Authoritative result reasons, account-scoped local recent-result summaries and explicit post-match deck saving. Technical CPU errors do not manufacture a win/loss.
- Engine-offered single-color mana choices, fixing the reproduced Ghalta payment blocker.

## Evidence

**PASS:** 442 focused Node checks rerun before release; zero failures. Prior unchanged-source complete combined Medium starter browser match: 282 accepted actions, 142 human commands, turn 14 CPU win, Chromium 153, 1920×1080, seed 691087302. Ending, local history and Save pass through actual production components with fixture account/backend. All 243 requested source/runtime files were matched to the frozen candidate. Version/cache-only differences are checked separately before publication.

**PASS, bounded:** 34 deck checks, 9 session-control checks, 40 focus/HUD checks, 42 decision checks and 96 layout cases; 19 Commander/history/scroll checks. CPU target/order replay on all three workers and exact corrected Tramplesaurus direct-policy matches on all three difficulties. Diagnostic Tramplesaurus data is not admitted into production.

**NOT TESTED:** real owner sign-in/provider saving, actual 200% browser zoom, physical-touch acceptance, final combined browser matches on every difficulty. Fixture tests do not establish these.

## Hotfix register

| ID / owner | Known state | Acceptance for the follow-up |
| --- | --- | --- |
| HF-ENGINE-001 / integration | **FAIL:** shipped WASM can change library-knowledge metadata after rejecting an illegal action. Snapshot-order fix is prepared but uncompiled. | Approved one-attempt pinned engine build; native and WASM rejection-state checks pass, artifact hashes verified, then adopt and regress. |
| HF-FLOW-001 / integration | Current engine lacks complete safe-priority certification. Smart/yield conservatively stops on unknown coverage; legacy flag misses legal actions including face-down paths. | Compile the prepared versioned capability export; prove every claimed actionless window, stale revision rejection, mana handling and mandatory-choice stops. |
| HF-DECK-001 / integration with rules/CPU dependencies | Exact broader lists remain blocked when unsupported. Corrected 44-record Tramplesaurus data is diagnostic only; Calling All Angels still lacks 44 compiled records. | Preserve exact lists, package verified data, admit only demonstrated mechanics and complete human/CPU UI matches; no blanket unlock. |
| HF-CPU-001 / integration with CPU dependency | Distinct CPU forfeiture clock is not implemented. Hard is experimental; strength ordering and strategic handling of unknown effects are unproven. | Separate computation/pacing/loading/error clocks and truthful terminal reasons; tactical and complete-match fixtures on each advertised tier. |
| HF-CHOICE-001 / integration | Single-color mana is verified; unobserved batch/combination mana and broader strategic choices remain outside proof. | Reproduce each shape through actual offered actions and production UI; preserve legality and hidden information. |
| HF-UI-001 / integration with UI dependency | Real owner save, actual 200% zoom and physical touch are **NOT TESTED**. | Exercise the actual signed-in setup→match→result→save journey, zoom and target devices; record reproducible failures separately. |
| HF-APK-001 / integration | APK is behind the website: 0.6.0 beta / interface 3.95.1. Owner requested web 4.1 with an aligned APK, provisionally 0.9 beta. | Build from the accepted 4.1 web source, test Android auth/navigation/touch/back and Play support, verify signed package/version/checksum, publish web and APK together with truthful metadata. |
| HF-FRIENDS-001 / integration | Invite-only 1v1 is newly requested for 4.1; current Friends play is not implemented. | Authoritative shared match, two independent authenticated sessions, authorized invites, separate player views, private hands/deck order/choices, rule-authorized reveal duration and recipients, stale/replayed command rejection. Complete APK↔APK and APK↔web invited matches. A card that permits looking at cards must reveal exactly its permitted information, only to the entitled player(s). |
| RAT-001 / rules follow-up | Rat/manifest remains **UNSUPPORTED**; separate audit contains known failures. | Keep separate from admitted starter scope; require mechanic and hidden-information evidence before claiming support. |
| RECOVERY-001 / deferred | Reload/crash recovery is explicitly **UNSUPPORTED**. Local result history is not resumable match state. | Do not advertise resume. Any future recovery needs an explicit implementation and independent acceptance. |

One bounded macOS engine build was approved before the as-is release instruction; the owner reconfirmed that it should continue after 4.0.1 publication as part of 4.1 testing. It has not been dispatched at the time of this release preparation. No automatic paid retry is authorized. The prepared manual workflow does not run on push. Stress testing is scoped to recorded mechanics/positions; a finite suite cannot establish every Magic interaction. Friends and APK alignment are acceptance targets for 4.1, not features advertised in 4.0.1.

## Deployment and rollback

Promote the metadata-only release descendant of `8ba7b218` to the existing production branch with an expected-head lease. Keep existing Worker configuration, database, APK and engine artifacts unchanged. Bump the service-worker cache to `cardforge-shell-v320-play-ui-cpu-patch`. Verify Cloudflare's deployment result, served release metadata and representative application/runtime bytes, then inspect the live entry. Record any unavailable live acceptance honestly.

Rollback baseline: production commit `2af11c9a1326e0db75b875d9c122e3dea01055d7` (v4.0.0). If a release-breaking live failure appears, make a new rollback commit restoring that tree with a fresh cache identity and promote it under a fresh lease; do not overwrite unrelated concurrent work or remove account data.
