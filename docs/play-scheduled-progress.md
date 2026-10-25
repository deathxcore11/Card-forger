# CardStashy Play development checkpoint

## October 24, 2026 — reference translation and CPU contracts

The supplied REA 6.7.0 archive was inspected directly. A guest Moxgate match
was exercised through opening-hand acceptance, land play, Bolt targeting,
payment and resolution. Official Arena documentation was checked for priority
controls, ninjutsu timing and payment/choice presentation. See
[reference observations](play-reference-observations.md) and
[CPU translation](play-cpu-reference-translation.md).

Added a standalone, versioned CPU observation/proposal contract with authored
fixtures. It rejects unauthorized evidence, stale decisions, unvalidated
proposals, absent response windows, unbounded loops and recurring mana deficits.
Review caught and corrected own-library identity exposure and unsafe aggregate
integer arithmetic. These are synthetic contract tests. The trusted engine
adapter and actual fair CPU policy remain unfinished; declaring a validation
witness in a fixture does not validate a real engine action.

Validation: 60 focused Node tests pass, including 18 new CPU reference tests.
This does not rerun or replace the separate actual-WASM mechanics evidence:
the original pinned runtime still has six passing scenarios and the preserved
missing-response-window ninjutsu failure. No playable board or CPU-strength
claim follows from this checkpoint.

The authoritative Rust ninjutsu correction is being developed separately in
an isolated worktree based on Phase commit
`71ccd8fe1715c45fe9e9bd78d391bec5ac8a4234`. Its current scope includes a typed
stack ability, paid activation costs, exact source/defender occurrences,
copied-ability controller handling and persisted entry continuations. Source
work in progress is not a corrected, rebuilt runtime and is not included in
this CPU-only checkpoint. Do not remove the failing runtime assertion.

Next: checkpoint/review the bounded source patch, then attempt a memory-limited
build with a serialized LLVM backend and MIR optimization disabled. The two
previous local LLVM builds exceeded the 8 GiB memory ceiling; changing Cargo's
job count alone did not solve that. Keep original artifact hashes distinct
from any corrected build. Then run actual rules/response/restore regressions
against the newly identified artifact before advancing the engine gate.

Keep all work on `codex/cardstashy-play-engine-20261024`. No production merge,
deployment, public Play activation, APK changes or migrations are authorized.
Check the current remote head before the next write and preserve newer work.

## October 24, 2026 — source candidate under verification

The separate source correction is now frozen, committed locally and exported
as a reviewable patch in
[the ninjutsu source checkpoint](../experiments/phase-engine/NINJUTSU-SOURCE-CHECKPOINT.md).
The exact base, candidate/tree and patch hashes are recorded there. Independent
immutable code review found no behavioral defects; protocol checks and patch
applicability pass. Nine new integration tests and updated continuation tests
are authored but have not run. A materially different memory-limited WASM build
is running; the runtime blocker remains open until actual execution passes.
The first compile found two missing exhaustive view matches and exited 101,
without an OOM kill. A bounded two-file correction now supplies ninjutsu labels
and an untargeted stack display; its immutable review is clean. The corrected
source is `d64f609e05ce221bfd6c7bd7f551df5f1a8102f5`; its rebuild is in progress.

The corrected build subsequently exhausted the 8 GiB ceiling and was killed;
there is no new WASM artifact. Do not repeat the unchanged LLVM attempt.
An additional source audit found a real granted-ninjutsu regression: Satoru
Umezawa's materialized hand keyword lacks a printed marker, and the new marker
guard rejected it. A focused correction now shares the existing marker builder,
adds consistent runtime-granted indices and preserves announcement facts after
paying a cost that removes Satoru. Native Cranelift regression prerequisites are
ready, but no behavioral native test has run yet.

The granted-keyword correction is now committed at
`a49b8aa7a1fedb9743a2fd1f77b8c39e258ef6db` and independently reviewed clean.
The current patch includes ten production-path integration regressions plus a
canonical-index unit test; neither successful compilation nor execution is
claimed yet. A bounded native Cranelift integration build is running from the
clean committed completion worktree. Do not run competing Rust builds.

The original browser runtime was rerun using twenty unchanged fixture records.
It still passes six cases and now preserves two explicit missing-stack failures:
printed ninjutsu and Satoru-granted ninjutsu. The latter positively proves that
the grant is offered/accepted and pays its real four mana/return cost. Its failure
is missing opponent response, not unsupported card data. The exact report is
`experiments/phase-engine/mechanics-evidence-2026-10-24-reference20.json`.

The mechanics loader now has an explicit local-build receipt option. Original
input hashes remain the default, and the preserved failure assertion is intact.
No new runtime receipt exists yet. The original inputs still verify; malformed
or absent opt-in receipts reject. A successful compiler run must be followed
by new artifact hashing and actual mechanics/restore execution.

The guest reference notes also include a completed Faithless Looting → madness
→ Fiery Temper sequence and a labeled Moxgate capture. This is reference-site
evidence, not a CardStashy board or completed madness implementation.

## October 24, 2026 — atomic priority deadline research slice

Verified the remote head at `70d1902c1add1dc7499b6e927c8af2c5eb7b482e`.
Worked in a separate local copy, leaving unfinished CI/build-preparation files
and upstream Rust work untouched. No production or APK changes.

Added an isolated priority-pass authority that stores the engine snapshot,
30-second deadline and command receipt in one compare-and-write record.
Nine new tests cover expiry/click races, duplicate replay, cold authority
reconstruction, competing writers and persistence/acknowledgement failures.
The full focused Node suite executed: 69 passed, zero failed/skipped.

An actual original-WASM check also passed: hash-verified inputs, engineered
position, reconstructed authority at the retained deadline, one real accepted
priority pass and durable receipt, next actor seat one, unchanged 20/20 life,
zero runtime fetches. Its storage adapter is in memory, and reconstruction is
within one process. This is not browser IndexedDB/cold-offline certification.
See [timed journal proof](play-timed-journal-proof.md) for evidence and next steps.

The preexisting native build log now shows ten ninjutsu integration tests
passed on source a49b8aa. This run inspected that completed log rather than
rerunning Rust. No corrected WASM was available or claimed, and both original
runtime ninjutsu failures remain intact. The optional paid CI preparation was
not committed or executed in this slice.

Next: obtain the corrected browser runtime without new paid commitments,
verify its exact provenance and run both preserved ninjutsu regressions. Then
connect/test the timed authority through the real worker/storage boundary;
add scheduler/countdown and complete explicit mandatory-choice policy. The
new authority is not mounted in the application. Full engine, UI, CPU,
Casual/Draft and reviewable-Practice gates remain open.

## October 25, 2026 — native verification and concrete browser build option

The clean committed source candidate `a49b8aa` compiled with native Cranelift
under the existing memory limit. Ten ninjutsu integration regressions passed,
including paid response priority, Stifle, save/restore, copied activations,
original source/defender identity, Rings and Satoru-granted ninjutsu. Additional
selections passed eight Kaito, ten resolved combat membership and fifteen
ability-referent tests. Forty-two structural/source-census checks also passed.
These are 43 behavioral integration passes plus 42 census passes, not a full
engine certification. See [native proof](../experiments/phase-engine/native-evidence-2026-10-25.json)
and the [updated source checkpoint](../experiments/phase-engine/NINJUTSU-SOURCE-CHECKPOINT.md).

Direct native execution requires `RUST_MIN_STACK=16777216`. One first Kaito
invocation omitted it and overflowed; its correctly configured rerun passed.
The keyword/index library unit selections and full parser-output projection
remain pending. A filter matching zero tests supplies no coverage.

The corrected browser WASM remains unavailable; the existing runtime's two
ninjutsu failures stay preserved. A bounded optional 14 GiB Intel macOS Actions
proof has been prepared for review, with exact source/tree/patch/fixture checks,
new runtime hashes and real mechanics execution. Ordinary commits cannot
allocate its runner. It has not run and does not establish a working artifact.
Execution requires separate approval because private Actions allowance is
unknown and overage can cost money. It contains no deployment or adoption.
The Play branch's Pages concurrency group is isolated by workflow/ref so a
research push cannot cancel another branch's website release.

Forge source study is recorded in [CPU findings](play-forge-cpu-findings.md).
It supplies concrete combat, target and payment requirements, independently
authored and not yet executed against a CardStashy policy. No Forge code was
imported and the selected engine was not switched. The owner supplied a Sanar,
Curiosity and Magmakin cleanup-loop reference; its exact rules and future
acceptance cases are tracked separately, without claiming engine support.

The delivery target remains one private complete human-versus-CPU match:
supported decks, usable player choices, stack responses, visible timer,
legal bounded CPU decisions, saved recovery and a real terminal result.
The board and complete human/CPU integration remain unfinished. Additional
reference documents and passing source checks do not close that product gate.

## October 24, 2026 — desktop account deck setup and import review

Continued from remote `bbf01b5ca30c93762be3d1bf66041b0ff69ae541` and the local
unfinished setup implementation. Current repository tree has no AGENTS.md.
The owner clarified first beta delivery: complete 1v1 CPU practice with account
profile and saved/imported decks; friend invitations/shared links follow stable
1v1, while three/four-player Commander is a later feasibility decision.

The Play branch now contains account-scoped saved-deck selection and clipboard
import review through the existing profile, deck tiles and four deck views.
The shared viewer JS/CSS and its category-metadata callers were verified against
the current default branch; only those changes were selected, with no whole
branch merge. The setup route is desktop Magic only; CPU match creation and
Draft remain disabled. No production, APK, migration or paid build action.

Fixed duplicate imported previews, stale preview after typing, and keyboard
focus/caret restoration. Name lookup and imports reject late account results.
16 import checks, 19 setup cases and seven menu/renderer cases pass (27 Node
reported tests including the grouped import file). Browser checks pass in two
themes at 1280/1440/1920 widths using the actual Play handlers and shared
renderers with fixture account/data. The 69 engine contract tests still pass.
See [setup checkpoint](play-setup-checkpoint.md) and its captured browser report.

The corrected browser engine remains the gameplay blocker; preserved ninjutsu
failures remain intact. Next: exact printing/finish resolution for retained
import hints, supported-deck preflight, corrected runtime verification, then
human choices/payment/mulligans, CPU, board/inspector/timer and result recovery.
Setup alone is not a playable match or a narrowing of the later Casual/Draft
scope. Do not publish this branch without separate release authorization.

Broader regression outcome: all 313 package test commands completed across
resumed runs after restoring missing verified baseline test dependencies and
the unchanged existing APK fixture. Relevant shared-view and Play checks were
rerun after the final metadata-caller sync. No APK build occurred.

## October 24, 2026 — bounded priority scheduler

Started from verified remote head `adfe4fa744512a09f240be4024b006c891116b04`.
The complete recursive tree contains no AGENTS.md. Used an isolated, exact-ref
copy of the experiment modules; existing workspaces and UI edits were untouched.

Added `priority-scheduler.mjs` around the timed priority journal. It reads the
authority's retained deadline, projects countdown seconds and the last-five-second
warning, coalesces refreshes, submits at most one timeout per cycle and stops
polling at another actor or mandatory choice. Unknown write acknowledgement
stops for recovery rather than retrying a mutation or inventing a result.
Stop invalidates late callbacks; an already-submitted mutation still belongs
to the authority and must be recovered from its durable receipt.

Executed: `node --test experiments/phase-engine/test-*.mjs`: **77 passed,
zero failed/skipped**, including eight new scheduler tests. Executed
`priority-scheduler-engine.mjs` against the original hash-verified WASM and
20-record subset: restored 30-second deadline, exactly one accepted pass,
one durable receipt, next actor seat one, unchanged 20/20 life, zero fetches.
Exact input/source hashes are in
`experiments/phase-engine/priority-scheduler-evidence-2026-10-24.json`.
This uses an engineered position and in-memory storage in one process, not
browser cold-offline validation or a mounted countdown.

The corrected WASM remains unavailable. No unchanged memory-failing build was
repeated, no paid build was launched, and neither preserved ninjutsu failure
was changed or rerun in this slice. Native evidence remains historical.
Mandatory prompts explicitly stop without a guessed action; that is a safety
boundary, **not** the complete no-stall/timeout product policy.

Next: corrected provenance-verified WASM and both ninjutsu regressions first;
then wire scheduler/status projection through worker/storage and the actual
board, completing human choices, pregame, CPU and result recovery. Resume must
construct/recover an authority before restarting a failed scheduler. Call
scheduler.refresh after accepted external commands and foreground events.
All full Practice gates, Casual and Draft remain open. Nothing deployed.

## October 25, 2026 — PC layout and explicit initial mode scope

Verified remote Play head `adfe4fa744512a09f240be4024b006c891116b04` and its
complete tree: no AGENTS.md. Confirmed local edited-source baselines against
remote Git blob hashes before changes; restored the reference index from the
exact remote content before appending new attachment identities.

Owner made playable CPU the number-one goal and then supplied two annotated
PC layout references. Owner now explicitly selects Standard/Commander only,
CPU Practice with selectable difficulty and private Friends; Draft is deferred
until these work. Added the corresponding setup flow in a full-width desktop
workspace, independently scrolling deck browser and right-side inspector,
anchored match controls, format/search filters and account-scoped preferences.
Shared card/deck/finish rendering remains in use. Both start paths stay disabled.

Final selected regression command passes 43 Node tests; browser fixture passes
light/dark at 1280/1440/1920/2560 desktop widths and 900×650 reflow. The initial
text-wide stale-action assertion needed narrowing to the actual button after
copy changed; all final checks pass. Captured source hashes, exact checks and
limits are in [desktop layout checkpoint](play-desktop-layout-checkpoint.md).
No new engine test or successful runtime build is claimed. Preserved ninjutsu
failures remain untouched. No paid build, production merge, deployment or APK.

Next slice returns to corrected browser runtime and authoritative human
controls, then CPU/board/timer/recovery to finish an actual private 1v1 match.
The larger-memory job remains prepared, unrun and unapproved. Do not repeatedly
retry the same memory-failing command. Do not spend the next run extending menus
or Draft while the core playable match remains unfinished.

Integration note: the concurrent scheduler checkpoint `5eb07f6f5659d7276ef003ac02eef1bc5b63ff53`
completed before this UI branch update. Its four engine/scheduler files are
preserved unchanged; only this shared progress document needed an append merge.
The UI source bytes in the 43-test and browser evidence did not change. The
other checkpoint's 77 engine tests are its recorded execution, not a new run
by this UI follow-up. No whole-branch merge or runtime substitution occurred.

## October 24, 2026 — authoritative human choice ingress

Started from verified remote `cdc839477ed11ae4f0e340e38b8433e372fedf6e`;
complete tree contains no AGENTS.md. Used an isolated exact-ref experiment copy.
The browser human worker now accepts bounded engine interaction submissions
through the durable journal, without requiring AI-candidate membership.
Mulligan bottoming and Head Games noncandidate selection pass real original-WASM
checks. Invalid/stale selections reject; duplicate recovery cannot apply twice.

Executed 86 focused Node tests, all passing. Full browser regression reproduced
six baseline games, the scripted human game and original offline checks, plus
pending bottom-choice cold-offline resume. A final targeted browser run verifies
the final unknown-adapter-result guard. Exact hashes/results and the one corrected
focused-harness setup failure are recorded in
[human interaction checkpoint](play-human-interaction-checkpoint.md).
No screen controls, corrected engine, competent CPU or playable match are claimed.
Ninjutsu assertions remain intact; no original mechanics rerun in this slice.

A materially different local WASM attempt is running from clean a49b8aa source:
`-Zhint-mostly-unused=yes` only for the engine library, serialized LLVM, opt 0,
MIR opt 0, 256 codegen units, one job, no incremental. No source or card stripping.
It has a 20-minute ceiling, no paid infrastructure. Existing source and original
runtime are untouched. Do not launch competing Rust builds. If scratch survives,
log: `/workspace/scratch/04b6689e06e8/engine-ninjutsu-build/wasm-unused-a49b8aa.log`;
lock: `engine-ninjutsu-build/local-build.lock`; target: `wasm-unused-target`.
There is no successful artifact or receipt at this checkpoint; record completion
separately and preserve all provenance gates.

Next: corrected WASM + both preserved ninjutsu regressions, then actual controls,
payments/targets/cancel, pregame, CPU, board/countdown and result recovery. New
interaction history is an input trace, not yet portable raw-action replay.
Production, website-release branch, APK and schemas are unchanged.

### Local build completion

The mostly-unused compiler experiment finished with exit 101 / rustc SIGKILL.
Cgroup `oom_kill` increased from 4 to 5. No engine_wasm.wasm or build receipt
was produced. Corrected source stayed clean. The build lock is released and
this attempt is no longer running. Exact flags, source/tree identity, final
compiler phases and full-log hash are preserved in
`experiments/phase-engine/wasm-unused-build-evidence-2026-10-24.json`.
Do not repeat this unchanged build. Both original ninjutsu failures remain open.

Reviewed the prepared higher-memory job before requesting permission. Its
hardcoded 69-test expectation was stale after the scheduler and human work;
updated it to all 86 current guards and explicit zero skipped/cancelled tests.
Executed the same TAP guard invocation locally: 86 pass, zero fail/skip/cancel;
CI script syntax passes. The optional workflow itself was **not run**.
Its existing 45-minute job, 40-minute script deadline, private artifact limits,
exact-source patch checks and eight real mechanics assertions remain intact.
The higher-memory run still needs explicit approval for potential Actions
charges; no approval marker commit has been created.

## October 25, 2026 — approved remote proof blocked before execution

The owner explicitly approved one prepared higher-memory build. Rechecked the
Play head `d9e7a792a3cd08c041493b3d13844686d48e7810` and complete tree
(no AGENTS.md), then made the empty approval commit
`f1021d3d5504d70610eb65fab3cd9005127cb661` using a guarded ref update.
No source bytes changed in that approval commit.

[Actions run 40150756588](https://github.com/deathxcore11/Card-forger/actions/runs/40150756588)
failed at 2026-10-25 01:28:30 UTC before a runner was allocated. The `verify`
job has runner ID 0, zero steps and zero artifacts. GitHub's authenticated
workflow-summary annotation states:

> The job was not started because recent account payments have failed or your spending limit needs to be increased. Please check the 'Billing & plans' section in your settings

This is an account billing/spending-limit gate, not a compiler or engine-test
failure. GitHub does not identify which of those two causes applies. No build,
checks or provenance verification ran in this job; there is no corrected WASM.
No billing setting was changed, and the charged amount was not inspected.
The prior 86 local guard passes remain historical evidence only. Both original
WASM ninjutsu regressions remain unchanged and unresolved.

Exact job metadata and the observed annotation are preserved in
`experiments/phase-engine/remote-proof-blocked-evidence-2026-10-25.json`.
The owner must resolve GitHub Billing & plans before a remote proof can start.
Do not create another approval marker or automatically re-run paid builds.
Only one attempt was triggered; no publication, deployment, APK or migration.
Independent no-charge human-controls/CPU/recovery work remains available, so
this build blocker does not establish that all useful development is blocked.

## October 25, 2026 — response counter/recovery proof and approved retry

Verified Play head `d52fdcb0912ef320e6c6ccdd736cf891cc590055` and complete
instruction tree before creating an isolated, blob-verified experiment copy.
Added a real Stifle response driver with unchanged upstream card definitions.
Its Basalt untap control passes, including fresh-process restore of both stack
entries and an identical accepted suffix/final state. Printed and Satoru-granted
ninjutsu remain failing at the absent stack window on the original runtime.
No assertion was removed or weakened. All 86 Node guards pass; the unchanged
original mechanics suite still reports six passes and two ninjutsu failures.
See [response checkpoint](play-ninjutsu-response-checkpoint.md) for exact
reports, source hashes, commands and limitations.

The owner corrected the Actions allowance and instructed continuation. Retried
only approved run `40150756588`: attempt 2 / job `121043947174` started at
2026-10-25T01:40:24Z on the Intel macOS runner. Checkout and Node setup passed;
build/verification remains in progress at this checkpoint. The job uses
`f1021d3`, not this new harness. No compiled runtime or corrected regression
pass is claimed yet. Inspect this active run before any build work; do not
launch another paid attempt or competing mutation. This checkpoint uses
`[skip ci]` to avoid allocating unrelated hosted jobs while the approved proof
uses the small account budget; its listed local checks actually ran.

Next: capture the remote result/artifact and verify its source/runtime receipt,
then execute this response suite on the corrected bytes if available. The
actual playable CPU/board/choices/countdown/result milestone remains unfinished.

## October 25, 2026 — precon data and explicit CPU deck selection

Verified Play head `3fabbea87408b560beaaef67c1bfcecb9f4dd6c8` and its full tree:
no AGENTS.md. The owner supplied DeckCheck precons and clarified that Practice
must allow choosing the CPU's exact deck from precons, the existing Meta tab,
permitted online meta lists or the app's Random Deck builder, within the existing
CardStashy UI. Difficulty remains separate. Captured these requirements in the
handoff and [opponent deck source checkpoint](play-opponent-deck-sources.md).

No DeckCheck catalog was scraped. MTGJSON's public source is now retrievable;
added an isolated precon normalizer and exact-source verifier. All ten parser
regressions passed. Actually parsed the 2026-10-24 catalog (3,131 product rows,
198 Commander Deck rows) and three complete source decks: Upgrades Unleashed,
Turtle Power! and Counter Surge. Preserved commanders/main/side and all product
extras, printing IDs and finish flags. Initial plain-source-note and Unicode-name
failures were corrected with regression cases before the final catalog pass.
Exact input/code hashes and counts are committed in the source evidence JSON.
These checks do not establish current format legality, engine support or CPU
piloting; the parser/picker is not mounted in the product. No all-precon claim.

The single approved remote proof remains running on attempt 2 at this checkpoint:
run `40150756588`, job `121043947174`, source `f1021d3`. Do not launch a competing
paid build. Preserved original ninjutsu assertions and the newly saved Stifle
proof are unchanged. This commit uses `[skip ci]` to reserve the small Actions
budget for that approved job; the ten new local tests and exact-source verifier
actually ran. No production/website-release/APK/schema changes or publication.

Next: obtain and verify the corrected runtime/artifact if this active job succeeds,
run both original mechanics failures and the new real Stifle response/restore
suite, then continue human controls/CPU/board/timer/recovery. Wire the selected
CPU source through exact-list validation and durable match identity as part of
that playable milestone; do not spend another slice only expanding menus.

## October 25, 2026 — focused source tabs and deterministic shelf rotation

Verified remote Play head `44bf1ef09db4c6ff4c9aa1f4766296bb5a291495`
and full tree (no AGENTS.md). Inspected all six new owner screenshots and the
Moxgate Y'shtola guide. Indexed exact attachment IDs and hashes. Owner wants a
broad sourced library with rotating choices, explicitly avoiding overwhelming
screens. Recorded My Decks / Precons / Meta / Build, Random inside Build, one tab
at a time and a shared player/CPU browser with the persistent right inspector.
See [rotation checkpoint](play-library-rotation.md).

Added an isolated deterministic shelf selector and existing-Meta-feed adapter:
source-date freshness, explicit cEDH scope, duplicate-list grouping retaining
source/printing variants, archetype variety and previous-visit avoidance.
Twenty precon/shelf tests passed, zero fail/skip/cancel; syntax passed. This is
presentation/data-layer code with authored fixtures, not mounted tabs or CPU
play. Existing product code and the engine regressions are unchanged.

Inspected the existing MTGO and EDHTop16 adapters. Live official MTGO index was
retrieved and hash-recorded; the selected October 24 Standard Challenge page
failed with a 25-second/zero-byte timeout. Web retrieval also timed out. No event
parser result or new live meta deck import is claimed; the inline check exited
1 with missing-file ENOENT. Exact outcomes are in the shelf evidence JSON.
No unofficial paid connector, new backend, messages or bulk restricted scrape.

At 2026-10-25T02:00:54Z the approved corrected-engine run `40150756588`
attempt 2 / job `121043947174` is still in build/verification, with no artifacts.
Do not launch another paid run. User explicitly asked about CPU break testing;
we stated that six earlier simple engine games and focused tests do not prove a
complete CPU match on the user's real decks. That product gate is still open.
This checkpoint skips unrelated hosted CI while the approved budgeted job runs;
its 20 listed local tests actually executed.

Next: prioritize this active build's completion, exact artifact/provenance and
preserved printed/Satoru ninjutsu plus real Stifle/restore cases. Then connect and
break-test the first complete human-vs-CPU match (pregame, choices, legal bounded
CPU, board/inspector, visible 30-second response countdown, recovery, terminal
result). Shelf tabs are recorded integration work, not a reason to defer that
match. No publication, production merge, website-release change, APK or migration.

## October 24, 2026 — browser worker timer and atomic human-command integration

Verified remote Play head `afe351e89b1740b8dd4580000d2bf30c81461265` and the
complete recursive tree (no AGENTS.md). Worked from isolated exact-ref experiment
modules; existing dirty workspaces and the website-release branch were untouched.
The owner requested a pushed testable candidate, followed by live release only
after successful testing. This checkpoint does not meet that playable gate.

Added optional `human-timed` worker mode. The existing human/CPU command journal
now saves the response clock, accepted action, policy RNG and receipt in the
same compare-and-write record. Explicit actions and expired timer passes share
one serialized revision gate. Resume validates the persisted decision and retains
its absolute deadline. A timeout never invokes the CPU chooser for the human.
Mandatory choices stop with `timeout-needs-choice`; the complete no-stall product
policy is still unresolved. The existing untimed diagnostic modes remain available.

Executed **92 Node tests, zero failures/skips/cancellations**, including six new
timer/journal cases: early ticks, human/timer races, lost-ack recovery, retained
deadline, mandatory selections and corrupt clock refusal. CI proof's future
guard count is updated to 92; no hosted job was triggered by this change.

Executed the real browser timer harness against the original SHA-verified runtime
and three-card fixture: human keep and CPU keep reach human Priority; an early
tick leaves the revision unchanged; the browser closes, the local server stops,
and a fresh offline browser resumes the same deadline. The scheduler waits for
the real 30-second deadline and commits one legal pass. A duplicate request
returns its durable receipt with no second history entry. Chromium 153.0.8010.0.
Evidence: `experiments/phase-engine/browser-timer-evidence-2026-10-24.json`.
The first launch failed because Playwright's default executable was absent;
the existing explicit Chromium path resolved that environment issue.
This is a diagnostic worker/storage test, not the visible countdown, full board,
all-prompt offline coverage, CPU strength, or a playable Standard/Commander match.

At the latest check the approved run 40150756588, attempt 2, job 121043947174,
remains in build/verification. No corrected artifact or new ninjutsu pass is
claimed. Both original regressions and the Stifle/restore tests are unchanged.
No new paid run, production merge, deployment, APK, migration or public activation.

Next: inspect the active build result and provenance; run the preserved mechanics
and Stifle/restore checks on corrected bytes if available. Connect accepted command
refreshes and foreground events to the scheduler, then the actual player choice,
payment/cancel, board/inspector/countdown and bounded CPU controls. Finish a complete
private 1v1 match and terminal-result recovery before calling this ready to test.
Standard/Commander and CPU first; Friends follows, Draft remains deferred.


### Approved remote proof completion — October 24, 10:07 PM Eastern

Run 40150756588 attempt 2 finished. Crucial distinction: **compilation, 86 Node
checks and all eight real-WASM mechanics cases passed on the runner**, including
both preserved printed/Satoru ninjutsu response/restore regressions. The workflow
failed only at artifact delivery: unpacked evidence was 338,743,397 bytes, above
the 268,435,456-byte cap. Its fallback deleted pkg before upload. The corrected
runtime therefore cannot be retrieved from the saved artifact. No local corrected
WASM, Stifle regression, or browser match is claimed.

Downloaded artifact 12583223712 and verified its GitHub SHA-256
c3d2dca39a560dde36db946bfd7b42186dfcbd3f1415faa2471a5e5f966b53d3.
Durable reports, receipt, exact source commit object and file hash inventory are
in experiments/phase-engine/remote-proof-2026-10-25/. The receipt pins corrected
source tree 60fc8715ad91f5c91b81f8a8335e238c623ec957 and WASM hash
a86578b23adcd26c38a68871e745305f3acb249158e1b424065cc6e6b6c3bfee.
These are remote execution evidence; the missing bytes cannot be independently
reverified here. The original-runtime failures remain valid and unchanged.

Fixed future successful-build packaging to gzip the exact pkg directory before
applying the unchanged 256 MiB delivery cap. Exercised the tar command against
the available original runtime: 12,414,391-byte archive, every extracted file
byte-identical. This is a packaging round-trip check, not a corrected build.
CI script syntax passes. No second paid build was launched; existing one-attempt
approval has been consumed. Recovering a deliverable corrected runtime requires
a separately authorized build with this packaging correction. Independent
controls/board integration work can continue; do not repeat the original OOM
builds or describe the uploaded evidence archive as containing a runtime.

## October 24, 2026 — visible human/CPU research table and approved rebuild

Verified head 3684bebbe18ceb0c8d0f22909719e78eb57ab613 and recursive instruction
tree (no AGENTS.md). Owner said to deliver the runtime and controls now, approving
the packaging-corrected build after the earlier explicit billing explanation.
Created approval commit b6502b5df93af729c0ce2d3006a0b3d304c5b273 with a guarded
ref update. Run 40153568000 / job 121049996121 is active; no additional attempt.

Implemented an isolated visible table, controller, explicit selection/confirmation,
inspection/context menu, bounded worker CPU fixture policy, saved/import snapshot
bridge and separate construction/support admission. Final local Node result:
110 pass, zero fail/skip/cancel. Real browser with original pinned WASM: 187
human button commands and 386 accepted total commands reach GameOver at turn
22. Cold-offline bottoming and terminal recovery pass without a duplicate move
or changed final record. A separate visible 30-second expiry check passes:
warning, one human priority pass, one CPU response, next human choice, unchanged
life. The countdown reads fresh authority time and preserves menu/inspector DOM.

Actual engine admission accepts a 60-Forest Standard construction control and
rejects 60 Grizzly Bears for both Standard legality and copy limits. This is
not realistic Standard gameplay, all-card support or CPU strength evidence.
The table uses the old three-card Forest/Bears Modern diagnostic fixture and
text cards, not the user's account decks/art. Both original ninjutsu regressions
remain untouched and blocking on the old runtime. No product readiness claim.

Exact outcomes/source hashes, corrected test-harness failures and next steps:
[visible table checkpoint](play-visible-table-checkpoint.md). Runtime/data remain
external. App-route mounting, shared exact printing/finish rendering, broader
human target/payment/cancel schemas, proper pregame, admitted real deck versions,
calibrated difficulties and Practice history remain required. Standard/Commander
CPU first, then Friends; Draft stays deferred. Nothing published, deployed,
merged into production, migrated or added to an APK. Continue with active build
delivery/provenance and preserved ninjutsu/Stifle tests before another engine run.


## October 24, 2026 — human casting/targets/manual payment and owner pause

Continued from 311be2ab026ab5f97bba95645b7e6e0448cfc762. Added a bounded human
cast-announcement command independent of AI candidate membership. The worker
binds seat zero, requires an authorized visible hand instance, leaves targets
empty for the engine's staged prompt, and requires explicit Auto/Manual payment.
The same durable journal handles admission, exact receipts and rejection. Human
transport is versioned v3; older research human saves are not silently migrated.

Ordered engine target sequences now reach the human projection, including
viewer-authorized player targets. Added explicit zero-count selection and
single-target replacement; neither changes the game until confirmation.
Real original-WASM checks pass for Lightning Bolt: announce without guessed
targets, choose opponent, recover/reject a stale target capability, cancel before
payment without moving the card/tapping land, announce again, choose Mountain
mana, explicitly pay, retain real stack/priority, and deal three to the selected
opponent. The browser exercises the visible manual-cast/target/cancel/mana/pay
buttons and finishes at revision 14. These are four-card Modern controls fixtures,
not a general payment/face/mechanic certificate or mounted account Play flow.
Exact code/input hashes are in the two casting evidence files. All 116 current
Node guards pass with zero failures/skips/cancellations. The earlier complete
six-game/browser recovery regression also finished successfully on its recorded
pre-cast source bytes; it is not a claim that every newer UI change has that
whole regression receipt. The later full visible table still reaches the same
386-action terminal result, with its own exact source hashes.

The packaging-corrected approved run 40153568000 / job 121049996121 remains
in progress at the latest observed status. Do not trigger another paid build.
Its exact approved source has 92 Node guards; current future CI guard count is
116. Both preserved ninjutsu failures remain unchanged on the original runtime;
corrected delivered bytes have not been obtained here. Required next step when
resumed: download the run's artifact, verify receipt/source/fixture/runtime,
execute mechanics and real Stifle fresh-process restore, then run these controls
on the verified corrected runtime. Do not substitute the old binary.

Owner asked to avoid consuming their weekly ChatGPT allowance merely while
GitHub builds. Saved current work and paused the hourly Continue CardStashy Play
continuation; the GitHub job itself continues independently. No further polling
or active implementation is needed until the owner asks to resume. This is a
resource-saving pause, not completion of the Play goal. The account route, real
eligible saved/imported deck matches, exact art/finish binding, complete pregame/
payment/combat schemas, difficulty calibration and Practice history remain open.
No production publication, website-release change, APK, migration or external
message. No additional paid attempt is authorized by this pause.

## October 24, 2026 — corrected runtime delivered and locally verified

Owner clarified that useful parallel implementation should continue, and then
explicitly approved finishing project fixes and publishing functional Practice /
Quick Play for live owner testing. Release approval is now provided once the
actual end-to-end gates pass. The requested morning completion is a goal, not an
unsupported promise. The brief pause was reversed; hourly continuation is enabled.
The separate Power/bracket/builder work remains offline and follows Play.

Run 40153568000 / job 121049996121 finished SUCCESS. Retrieved artifact
12584327345, verified ZIP SHA-256
edb82685e8f71de64006da5f8cd188d738939c106ae19d67ad4281158cff513b,
extracted only expected pkg files and verified JS/WASM against the receipt.
Reconstructed source commit 5169f7fe03f93a6afe36fec767c3cda10120dcdd from its
exact commit object; clean worktree, pinned base, source tree and binary-diff /
fixture hashes all validate. Both CI builds produced the same JS/WASM hashes.
No assertion was removed, weakened, replaced or bypassed.

Actually executed locally on the delivered bytes:
- all eight original mechanics assertions PASS, including printed and Satoru
  ninjutsu, Head Games recovery, token counts, Bolt/Counterspell and finite mana;
- all three Stifle cases PASS, with fresh-process exact response-suffix recovery,
  paid costs retained, no improper damage and zero network calls;
- human cast/ordered targets/manual mana/cancellation driver PASS;
- complete visible table PASS: 187 human button commands, 386 total accepted
  commands, turn 22, winner seat 1; offline bottoming and final-record recovery;
- visible Bolt/manual payment/cancel flow PASS at revision 14;
- real visible 30-second timeout PASS, including near-expiry warning, one human
  pass, one legal CPU response, next human decision and unchanged life.

Exact outcomes/source hashes: experiments/phase-engine/delivered-proof-2026-10-25/.
These remain Modern fixture / small-card controls tests, not the account-deck
Standard/Commander beta, calibrated CPU or all-card certification. Main route,
exact art/finish binding, eligible real lists, remaining schemas, proper pregame,
Practice history and end-to-end production verification still need work.

Preserved the entire downloaded ZIP durably as
CardStashy-Play-Verified-Runtime-40153568000.zip, Library
libfile_d318ce26c60481919a7063890c856e89. GitHub artifact expires after one day;
retrieve this archive if scratch is lost. Do not pay for another identical build.
It contains the receipt, source patch/commit object, licenses and runtime, not
executable card data. The pinned card fixture remains independently hash-bound.

Prepared one small artifact-only staging job, no Rust compilation or deployment.
It verifies the existing archive, preserves exact decompressed code, creates
three <=16 MiB compressed runtime chunks and a pinned checked card-data asset,
then appends only those assets to the guarded Play head. Cloudflare documents a
25 MiB individual static-asset limit; source:
https://developers.cloudflare.com/workers/platform/limits/ . Local package
round-trip is exact: 37,986,854 compressed WASM bytes, three chunks, plus
3,536,582 bytes of pinned card rules (6,137 records; metadata is not support proof).
An initial local path-construction typo was caught and fixed before triggering.
The script is inert outside its exact approved private-branch Actions event.

The new chunk/decompression/hash loader passes its real browser-worker startup
probe (Chromium 153, local origin about 4.76 seconds), with exact final WASM hash
and Standard/Commander registry presence. This is not a production CSP, real
network speed or card-support claim. All 118 focused Node guards pass, zero
fail/skip/cancel. Runtime asset files remain outside service-worker precache and
public Play adoption until actual app integration. No new subscriptions, budget
increases, APK, migrations, production merge or public feature activation.

Next: complete/verify the artifact-only staging job, then wire the real account
setup into a configurable authoritative worker using the staged runtime and
source card database. Replace research hardcoded decks with frozen player/CPU
snapshots and strict construction/support checks. Use shared profile/art/finish
components. Complete one real eligible Standard/Commander match, history/recovery
and served-asset verification before using the owner's release approval.

Owner further clarified that the other chat will integrate its older-deck /
bracket/badge/builder improvements after this Play release, to improve future
CPU strategy and synergy. Keep that handoff clean and do not make the Play
release wait for those separate improvements. A basic beta CPU still needs its
own legal/fair/recoverable match path; do not represent future strategic work
as already implemented Hard difficulty.

### Asset staging transfer correction

Run 40156164006 / job 121057921505 failed before any branch write. GitHub CLI
reported `transform: short source buffer` while requesting the gzip card fixture
through the Contents raw media route. Checkout and artifact download occurred;
no runtime was rebuilt or modified. Changed only that PUBLIC immutable pinned
fixture fetch to curl/raw.githubusercontent.com, with no credentials and the same
required gzip SHA-256/card count. Archive/source/code integrity checks remain
unchanged. Local full package round-trip with the pinned rules file passed;
script syntax passes. Retry uses a new exact approval commit because the script
bytes changed; do not rerun the unchanged failed job.
