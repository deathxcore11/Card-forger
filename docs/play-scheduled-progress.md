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


## October 24, 2026 — configured matches, account bridge and combined builder patch

Continued from verified remote dd98a04d04f016baa8e97a482a73ccce9206be8c;
recursive instruction census contains no AGENTS.md. Owner now explicitly asked
to integrate the uploaded offline deck-engine patch into this Play patch before
website release, with the other chat handling APK afterward. This supersedes
the earlier instruction to hold those builder changes until Play is live.
Owner also emphasized 16:9, ultrawide and future tablet/foldable scalability.

Added account-local immutable match records, printing/finish sidecars, shared
rules adapter, configurable Practice worker/client and account/setup coordinator.
Original deck source rows, commander/sideboard lists and profile are hash-bound.
IndexedDB compare-and-write prevents concurrent overwrites; terminal history is
written atomically with its accepted journal. Resuming uses stored inputs,
never a regenerated opponent. Account generation changes retire old workers and
clear projections. None of this writes inventory, auth schema or collection data.

Executed on the delivered exact corrected runtime and full pinned rules data:
- 140 focused Node guards pass, zero failed/skipped/cancelled.
- Configured Standard control reaches actual GameOver: 187 human commands,
  386 accepted actions, turn 22, winner seat 1. The deck is deliberately land-heavy
  Plains/Savannah Lions, not a viable or competitive Standard deck.
- Cold browser/offline recovery at bottoming and GameOver preserves exact journal,
  receipts, printing/finish rows and final timestamp/result. Zero offline requests.
- Concurrent worker write rejects rather than overwriting; illegal Standard /
  copy-limit list rejects. Commander initialization gives 40/40 life and two
  command zones retaining declared Satoru printings. No full Commander match claim.
- Account/setup coordinator runs with the real worker, accepts one keep command,
  retires on simulated account change and resumes the original digest/revision.
- Visible activated-ability controls pass with delivered bytes: Basalt mana taps
  immediately; untap uses a real stack/response and resolves after passes.
Exact reports: experiments/phase-engine/account-proof-2026-10-25/.
Original failing-runtime evidence and corrected ninjutsu assertions are unchanged.

Verified every payload hash and patch hash in CardStashy-Offline-Deck-Engine-Patch.zip,
Library libfile_45eb800c31208191b44668a6201284d1. Applied its diff to exact current
Play source, preserving existing Play edits, rather than replacing whole files
from an old site. APK_GUIDE.txt was excluded; no native release work was performed.
All 41 supplied focused test files pass against the combined source. First isolated
runs missed existing gzip fixtures/home preload dependencies; restored only
Git-blob-verified current fixtures/source and reran failures successfully.
This is a focused integration check, not the full repository release matrix.

Connected Random opponent deck to the same shared pipeline and random-seed helper
as the app builder. It carries format, Commander bracket target and Classic /
Infinite-mana intent; rechecks construction before choosing a list, preserves
request provenance, rejects silent constraint changes, ignores cancelled/stale
account results and creates no owned cards. CPU and player lists stay distinct.
Both use one right inspector with Your deck / CPU deck switches and shared deck
views. Seven opponent-builder/selection guards and 34 existing setup/menu guards pass.
Browser tests use the actual handlers/renderers with a stub builder and account;
no live random-generation quality, paid AI call or real-auth match is claimed.

Setup browser checks pass in both themes at 1280x720, 1440x900, 1920x1080,
2560x1080, 3440x1440 and 1024x768, plus 900x650 reflow. Inspector is capped at
520px and the footer remains in view in those landscape setup cases. A caught
short-window/footer overflow was fixed by extending the bounded layout down to
900px and removing its unnecessary minimum page height. A separate synthetic
44-card table/long-rules fixture passes all six widths: 240–420px inspector,
no horizontal overflow, visible footer, keyboard context-menu recovery and
44px controls. Visual screenshots were inspected locally. Geometry evidence is
not physical-device, touch-dragging or final real-art certification.

Release gates remain UNMET. The main app still has setup only and its match
start stays disabled. Practice coordinator is not yet mounted into that route.
The new candidate only admits the existing Medium research policy; Easy/Hard
are not calibrated and must not be silently aliased. Current named-card coverage
is execution evidence, not all-card or complete CPU support. Required next work:
mount actual setup-to-table lifecycle with shared exact artwork/finish, resolve
printings, support/pilot viable eligible real deck versions, finish pregame /
mandatory-choice policies and human decisions, results/history/concession and
full account-to-match acceptance. Do not turn on a fixture-only public button.
Friends follows CPU; Draft is deferred. Preserve the broad complex-card scope.

Owner approval permits releasing a verified functional candidate without asking
again. It does not convert these narrow fixtures into that candidate. No website
release merge, production publication, APK, schema change, new subscription,
budget increase, repeat paid engine build or external message occurred here.
Keep the current runtime archive/receipt and original regression evidence.
Use guarded branch updates; never merge the whole old Play branch over release.


### Existing artwork reuse and owner mat clarification

Owner explicitly directed the work back to a complete player mat using existing
app art, familiar legal placement, auto/manual mana and app styling. APK posture
and native work belong to the other builder; leave notes, do not build Android.
Added play-card-surface.js to capture the existing exact selected/catalog
printing and supported finish into a frozen row, reuse magicArtworkSources,
finishAttrs/attachFinishPreview and shared artwork-error fallback. Wrong
printings are not substituted; unknown/private instances never gain images.
The table now accepts those shared decorator/lifecycle hooks for card and
inspector art. Three art guards, the existing finish-preview regression and
241-module preload/offline inventory checks pass. A real-browser presentation
probe shows the repository's existing Chishiro scan on the table and inspector
with shared finish metadata at 1920x1080 and 1024x768; hidden-instance art stays
absent. This uses a scan fixture, not a real-account gameplay proof. The main
app route still needs to mount the coordinator/table and pass these hooks and
captured rows; drag/highlight and complete card-choice integration remain open.
No new artwork system, generated replacement art, paid AI generation or APK.

Art-probe visual QA follow-up: the first isolated art page omitted the existing
finish-effects.css, causing the finish layer to occupy layout space. Added that
shared stylesheet to the probe (the actual app already loads it), reran the
browser check, and verified the overlay is absolutely positioned on the same
card. Inspected the corrected card/inspector screenshot. The shared art report
now includes hashes for the served root modules and stylesheet. No runtime,
foil algorithm or unrelated game behavior changed.


## October 25, 2026 — explicit numeric human choices

Started from verified remote 2c3b70e8228fdddd9cc0025fb023b81c7f1acacd; complete
recursive tree has no AGENTS.md. Used an isolated copy with unchanged modules
verified against remote Git blob hashes, leaving newer local integration files
untouched. No Rust build, infrastructure spend, release, APK or schema change.

Added engine-authored Number schema projection, bounded uint32 submission,
explicit numeric drafting/confirmation and labeled number controls. No default
number is chosen and typing never submits. Unknown/malformed schemas remain
unavailable; the engine validates every accepted input independently of AI lists.

Executed all 143 focused Node tests: pass, zero failures/skips/cancellations.
Executed number-controls-engine.mjs on the exact delivered corrected runtime;
receipt/source/tree/diff/fixture and JS/WASM hashes verified by the existing loader.
Walking Ballista in an engineered position reaches ChooseXValue, rejects an
out-of-range value without mutation, restores the pending prompt, rejects its
stale capability, accepts explicit X=2 with four generic mana due, and recovers
its accepted receipt without applying twice. Zero network calls. Exact hashes
and outcomes: account-proof-2026-10-25/number-controls.json. Two initial driver
assertions incorrectly looked for an x_value field; source inspection corrected
the assertion to the actual concretized pending cost, and the final run passed.
No engine code or regression assertion was changed.

UI source is implemented but no browser rendering/input test was run in this
slice. This is one X announcement, not full Ballista resolution, all numeric
payment families, all-card support, CPU calibration or account-facing completion.
Original failing and corrected passing ninjutsu evidence remains unchanged.
Next: repeat numeric entry in the actual account table, then finish the remaining
human schemas/pregame and real eligible Standard/Commander complete-match gates.
The owner-approved functional beta release gate remains unmet; nothing published.


## October 25, 2026 — shared deck context, player-mat host and rendering work

Started from verified remote 2c3b70e8228fdddd9cc0025fb023b81c7f1acacd; the recursive
tree still contains no AGENTS.md. Owner reiterated that the combined release must
retain the other chat's bracket, Power, badges/emblems, wiki and builder changes,
and approved continued work. The ZIP integration remains intact.

Added play-deck-context.js using the existing mtgPower/shownPower and bracketEstimate
functions. Exact main/side/commander lists and declared bracket/style/goal produce
a context key. The captured Power, bracket floor, requested target, uncertainty,
dated membership/guidance and rules version stay with the frozen deck. Standard
gets no Commander bracket. Unknowns stay unknown. Explicit Any overrides older
builder intent. These facts do not authorize gameplay or certify CPU strength.

Added play-player-mat.js, the application's host around the actual Practice
coordinator, rules worker and table. Existing app account/setup readers and exact
artwork lookup are wired into an internal Play action; account changes retire it.
The host uses the same captured art, shared finish renderer, rarity emblems,
frozen Game Changer badges, ruleText/ruleCardContext and wiki links. Exact card
context reaches the existing Rule Dex dialog. Emblems stay above foil layers.
A collapsible right-rail panel preserves both decks' Power and Commander bracket
context without crowding the mat. No second scorer, builder or wiki was created.

Added explicit Exit confirmation through a bounded seat-zero Concede command.
Cancel sends nothing. Confirm uses the real engine, durable journal and atomic
result store; duplicate receipt recovery cannot create another loss. The result
records whether its terminal reason was concession or ordinary engine terminal.
Crashes, ceilings and failed persistence still do not invent losses.

Executed against the delivered provenance-verified runtime (no rebuild):
- 142 focused Phase Node guards pass, zero failed/skipped/cancelled.
- 49 setup/menu/opponent/art/context Node guards pass. The integrated ZIP's
  foundation test and 243-module preload/offline-inventory checks also pass.
- Real application-host browser probe starts the Standard control from simulated
  account/catalog inputs, keeps frozen artwork and Power/wiki metadata, preserves
  an open context disclosure after Keep, verifies Cancel leaves the whole record
  unchanged, and verifies rapid duplicate confirmation produces one real engine
  concession, one loss and one history action. Cold browser/offline restart
  restores exactly the same terminal record and contexts with zero requests.
- The same host initializes the Commander control at 40/40 life. It displays the
  requested Bracket 3 as unverified while retaining unknown table fit and the
  incomplete dated evidence. No automatic Bracket 2 or fabricated certainty.
- Complete clickable configured Standard control again reaches GameOver at turn
  22: 187 human commands, 386 accepted actions, winner seat 1; cold-offline
  bottoming and terminal recovery preserve the record. This remains the
  land-heavy Plains/Lions control, not a viable real account deck.
- Existing Chishiro scan/finish and sourced Menace help pass at desktop/tablet
  widths. Opening/closing help and the keyboard context menu send no commands.
  Rarity emblem stacking, exact selected-card context and hidden-image guards pass.

Rendering: the host coalesces received updates with requestAnimationFrame. Twenty
inspection updates produced one host paint and no engine move in the browser
probe. Live busy checks and stale-choice handling prevent old controls from
submitting during that short paint delay. Card nodes, decoded images and selected
Oracle/inspection artwork now survive unchanged revisions; derived power/damage/
counter text updates separately. A hidden-card transition clears art, emblems
and stale private text. Cache listeners retain instance IDs, not old projections.

Recorded 60-sample synthetic 44-card render/forced-layout timings alongside exact
source hashes. Measurements varied under concurrent browser verification; do not
advertise a production speedup, FPS guarantee or physical-device result. The
latest art fixture measured approximately 8.2 ms median, 18.3 ms p95 and 29.1 ms
worst for synchronous rendering/layout, excluding worker/network/GPU completion.
This still leaves room for rendering work; copied card art alone is not an
optimized match. Geometry passes 1280x720 through 3440x1440 and compact landscape
reflow on the recorded synthetic sources. Reports pin the exact bytes tested.

The first host browser run caught a real title-variable shadowing error in the
table header; renamed the footer variable before successful reruns. Isolated
command working-directory/path mistakes were corrected and are not passes.
The current handoff does not claim the full repository release matrix was rerun.
The complete-control receipt predates the final defensive hidden-text branch;
that branch is covered by the explicit art/cache privacy probe.

Owner supplied the existing Scry/Rule Dex screenshot 1792900666166.jpeg, SHA-256
72db868ff7b7e308dca7e177b446c4ccc8a6a4c3becde1cf06783ab93c5cf97c.
It confirms reuse of current keyword help, source links and selected-card context.
The raw browser screenshot is not committed.

Added the 21 real browser/worker modules and table stylesheet to the branch's
offline asset inventory. Runtime binary assets remain owned by their immutable
hash-checked loader cache, avoiding a second shell-cache copy. The host's cold
proof uses a scoped test service worker; the actual app SW/CSP/served-asset and
full signed-in route still need acceptance. See play-apk-handoff.md for the
requested later native handoff; no APK or signing work occurred here.

Release remains gated: PLAY_MATCH_RELEASE_READY is false and the public start
button remains disabled. The internal host/concession/control proofs are not
a full owner-ready Standard/Commander beta. The existing policy is still Medium
research tactics; Hard/Easy are not silently aliased. Next: complete actual
owner-route/pregame, viable eligible real deck versions and remaining human
choices/drag/placement, CPU coverage/difficulties, history/return/opponent copy,
and production offline/CSP checks. Tokens/combos/ninjutsu/Head Games remain required
scope. Friends follows stable CPU; Draft is deferred. Use the existing release
approval after actual gates pass; do not ask again for routine release permission.

All work stays on the private Play branch. No production merge/deployment, public
activation, schema migration, subscription/budget increase, new paid engine build
or external message. Original failing evidence and corrected passing assertions
are preserved. Exact new receipts: experiments/phase-engine/player-mat-proof-2026-10-25/.

### Token/stat display and concurrent numeric integration

Kept the newer remote numeric-choice commit 5b9989ca8f4b632b06bf2178ba3f363f1c5bee5b.
Its complete recursive tree also contains no AGENTS.md. Combined its explicit
number projection/session/table changes with this host, concession and cached
card rendering; retained its original proof. Numeric confirmation returns the
command promise and uses the live busy guard to prevent duplicate submissions.
All 150 combined focused Phase Node guards passed, zero failures/skips/cancelled.
The 243-module preload inventory still passes. No rebuild or paid job launched.

The authorized seat projection now carries finite engine base/current stats,
token/emblem identity and exact token image references when present. Hidden
objects retain none of these details. The shared card view displays current
power/toughness separately, green above baseline and red below it, plus base
stats, named counters and marked damage. It does not add counters a second time,
subtract damage from toughness or infer a missing baseline. Token identities
stay distinct; no independent UI token generator or guessed token foil/art.

Executed stats-engine-proof.mjs on the exact corrected delivered runtime:
Raise the Alarm produced two distinct 1/1 Soldiers; Parallel Lives produced four;
Giant Growth changed a 2/2 to 5/5 with no counter and expired at cleanup;
Travel Preparations produced a persistent +1/+1 counter and 3/3; Afflict changed
2/2 to 1/1 without inventing a negative counter and expired at cleanup. All five
passed, zero network requests. These are engineered legal-card positions with
accepted actions, not random real-deck matches. Disfigure was absent from the
pinned fixture; the driver refused that input before testing, then used the
available Afflict definition. No binary/definition substitution or source edit.

The shared table numeric browser probe passes blank initial input, invalid
range/fraction rejection, focus/text retention on a timer-only update, explicit
zero and rapid duplicate confirmation producing one transport command. This
uses a simulated schema/transport. The separate actual-runtime number proof
was repeated on the combined journal/command bytes and passed its X=2/manual
payment, rejection, restore and idempotency checks with zero network calls.
Neither proves full Walking Ballista resolution or all numeric cost families.

Current token/stat art fixture, privacy/cache checks and six viewport geometry
cases pass. The final pre-numeric layout run measured 14.5 ms median, 20.1 ms p95,
26.7 ms worst synchronous render/layout, excluding worker/network/GPU. These
different concurrent-run timings are not a production performance comparison.
Reviewed the existing scan/finish, readable stat chips and bounded inspector
visually. Most crowded-board cards remain deliberately text-only test fixtures.
The complete control-game receipt predates these display/numeric changes; each
receipt pins its own tested source hashes. Do not claim the final byte set has
completed a real signed-in, eligible deck match.

Dice/coin outcome presentation remains required, not implemented by these tests.
Source observation: the engine distinguishes DieRolled (including ignored rolls),
CoinFlipped player/won, replacement choices and starting-player d20 contests.
The UI must consume a durable authorized outcome stream; a `won` boolean must
not be relabeled as heads/tails, and cosmetic randomness must not decide rules.
Persist/restore/timeout and actual-card browser checks are still needed there.
Tokens/counters have this narrow verified coverage; combos/ninjutsu/Head Games
and broad supported-card gameplay still require their recorded acceptance gates.
PLAY_MATCH_RELEASE_READY stays false. No production publication occurred.

The actual application-host browser probe was repeated after numeric integration:
passed frozen Standard/Commander context, 40-life Commander initialization,
one-paint inspection coalescing, cancellation, single explicit engine concession
under duplicate click, and cold offline terminal recovery with zero requests.
Its simulated account/catalog/control-deck and concession limits still apply.

## October 25, 2026 — durable rules-backed dice and coin results

Continued from verified remote dc622d5c08f2d9f734317f929387773faefc664c,
which includes the combined numeric-choice/player-mat work above. No applicable
AGENTS.md was added. Kept all work isolated to the Play branch.

Added random-outcomes.mjs and an adapter/journal display path for DieRolled,
DieRollIgnored and CoinFlipped. Each accepted submission route passes relevant
events through get_viewer_transition_snapshot_js for seat 0, then an explicit
scalar-only whitelist. Unknown events, identities, raw legal actions and engine
saves do not reach this display. Rejected submissions produce no displayed roll.
The CPU packet is unchanged and gains no engine saves, future draws or events.

The latest twelve authorized outcomes are stored in the existing atomic local
match journal alongside the accepted engine state, revision and receipt. Resume
validates the bounded ordered timeline; older saves without this optional field
remain readable. Failed persistence restores the last engine checkpoint, clears
pending outcomes and requires recovery. Duplicate/lost-ack receipts replay the
same outcome and cannot reroll. No database version/migration/schema change.

The bounded right inspector now shows Recent rolls & flips. Modified die values
can exceed the natural face range; ignored natural rolls are labeled ignored.
A coin reports the engine's won/lost result; it is never fabricated as heads or
tails. Symbolic no-number rolls remain symbolic. The UI generates no independent
randomness, roll command, cosmetic rule result, damage or game win/loss.

Executed random-outcomes-engine.mjs with exact corrected runtime/source/receipt:
Component Pouch's real activation rolled d20=1; Tavern Swindler's real activation
won its flip and left the player at 23 life after its three-life cost. Both went
through the production rules adapter and atomic journal. Restoring retained the
same timeline/game RNG; replaying the last accepted receipt changed no engine
state, timeline or durable record. Zero network requests. The first driver
attempt looked for object_id on ActivateAbility; the actual payload is source_id.
Corrected the test driver and reran; no engine/API/assertion was weakened.

All 157 focused Phase Node guards and 49 shared setup/menu/opponent/art/context
guards pass with zero failures/skips/cancellations. The 243-module offline
inventory passes. Shared numeric/table browser checks pass explicit zero, range
validation, duplicate confirmation, timer-only input/focus retention, modified
d20=22 display, ignored d20=1 display and CPU coin-loss text. Those outcome rows
are projection fixtures; actual accepted dice/coin actions are the separate
runtime receipt. Current art/wiki/privacy-cache and six-width geometry probes
also pass. Application-host recovery/concession probe passes on these bytes.

These narrow checks do not finish die-replacement ordering/tied keep choices,
coin replacements, pregame starting-player roll-offs, the complete no-stall
mandatory timeout policy, broad human schemas or calibrated CPU difficulties.
No tested-card name was added to account admission merely from a log projection.
Actual eligible real Standard/Commander deck versions and a complete owner-facing
account match are still required before public activation. PLAY_MATCH_RELEASE_READY
remains false. Existing 30-second priority policy and original failing/corrected
passing ninjutsu evidence remain intact. No production, APK, new paid build,
subscription/budget change or external message. New exact receipts are under
experiments/phase-engine/outcome-proof-2026-10-25/.

Final complete-control browser repeat on this outcome-enabled byte set passed:
187 human commands, 386 accepted actions, turn 22, winner seat 1; pending
bottoming and terminal records recover cold offline with zero network requests.
Atomic terminal result, concurrent-writer rejection, account-generation guards,
exact source-row copies and Commander 40-life/command-zone initialization pass.
The driver still uses the land-heavy Plains/Savannah Lions control and simulated
accounts/printing rows. It does not certify a currently eligible competitive
Standard deck or finish the public account route. Retained its full hashed
receipt as complete-control-match.json, separate from the earlier byte sets.


## October 25, 2026 — explicit card-name human input

Continued from remote 9767b7ed814ce3829dd4dca2f96971994b989fb4, with no AGENTS.md
in the complete recursive tree. Isolated current modules were matched against
remote blob hashes. Preserved newer numeric, player-mat, stats and outcome work.

Added explicit arbitrary Text schema projection for engine card-name prompts,
local text drafting, confirmation and labeled table input. Only authorized
explicit arbitrary schemas are exposed. UTF-8 byte bounds match the engine's
256-byte limit; blank/control/malformed Unicode input is rejected without a move.
Names remain text, never HTML. The engine owns final name legality. Restricted
option/text families remain unavailable; no arbitrary fallback for other schemas.
Existing fixed-route browser harnesses now serve the added shared projection
import. Added table-text-browser.mjs for blank/byte-bound, timer/focus and duplicate
confirmation checks; its syntax passes, but browser execution is pending.

Executed: all 160 focused Node tests pass, zero failures/skips/cancellations.
Executed text-controls-engine.mjs: Pithing Needle resolves into a real name prompt;
unknown name and restored stale capability reject without mutation; Basalt
Monolith is accepted and retained on the entered Needle; recovered duplicate
receipt does not apply again. Zero network requests. This is an engineered
three-definition case, not inhibition-effect or broad card-name certification.
Initial test omitted Basalt from the loaded database and was correctly rejected;
added its unchanged, hash-bound fixture definition and retained an explicit
unknown-name rejection regression. No engine code or existing assertion changed.

Scratch source files survive but their referenced Git worktree metadata is gone.
The original source-checkout loader failed closed and was not weakened. The new
self-contained delivered-byte driver verifies the exact recorded ZIP digest,
its embedded receipt, expected source identities, JS/WASM hashes, compressed and
decoded pinned rules hashes, and selected definitions before execution. Source
provenance is the verified archive's historical receipt, not a newly verified
Git source tree. Exact report: account-proof-2026-10-25/text-controls.json.
No replacement binary, rebuild or external request was used.

A browser launch attempt failed before page execution: cached /tmp/chromium is
zero bytes. New text controls are therefore NOT browser-verified here; the
previous head's numeric/browser results remain historical. Restore a functioning
Chromium and run table-text-browser.mjs plus table-number-browser.mjs, then repeat
actual host and complete-match gates. Final Node checks and browser-script syntax
pass. Public release remains disabled; viable real Standard/Commander matches,
remaining schemas/pregame/difficulty and account-route acceptance are unfinished.
No production, APK, schema, paid build, new subscription or external message.


## October 25, 2026 — browser restored and initial card-placement gestures

Verified remote 028e15b6f1bf3c7a9d29c2458b4f62d92957636b and the complete
recursive instruction tree (no AGENTS.md). Isolated modules match remote Git
blob hashes. No overlapping source workspace was modified.

The zero-byte /tmp/chromium was unusable. A normal Playwright installation
attempt received invalid empty archives; a separate HEAD request reported an
HTML response rather than ZIP, with ample free storage. Located a functioning
Chromium 153.0.8010.0 under verification-inputs/browser, checked --version and
used CARDSTASHY_CHROMIUM_PATH. Browser size/hash and executed checks are saved in
placement-proof-2026-10-25/browser-restored.json. Nothing needs buying or signing.
Browser binaries remain test dependencies outside the repository/product.

Added pointer placement over existing epoch/revision-bound offered choices.
A visible own hand card with exactly one offered PlayLand/CastSpell can be
picked up; its offered battlefield/stack destination glows. A visual clone
follows the pointer; only an accepted engine projection moves the real card.
Drop submits the same choice token as the existing button. Different targets,
faces/cost choices or missing offers retain the explicit controls instead of
choosing a default. This does not make AI candidates exhaustive human legality.
No new engine actions, payment assumptions, rules shortcuts or card admission.

Clicks still inspect. Escape, wrong destination, pointer cancellation, lost
priority, busy/error/terminal transitions, stale tokens/revisions and full
rerenders cancel the gesture without a move. Timer-only paints retain it.
Keyboard buttons stay available; eligible cards get destination descriptions.
Listeners and visual clones retire with the table. The new module is in the
existing shell offline inventory; browser harnesses serve its shared import.

Executed on final source bytes:
- all 164 focused Node guards pass, zero failures/skips/cancellations;
- real Chromium pointer test passes click-only inspection, offered destination
  glow, Escape/wrong-drop cancellation, retained drag on timer paint and one
  command per land/spell drop using the shared table/session (simulated transport);
- actual delivered-runtime Forest/Bears driver verifies land placement through
  the offered command, stale-token rejection without mutation, cast cancellation,
  real automatic payment plus stack/priority, and recovered duplicate receipt;
- numeric and text browser checks pass, including explicit confirmation, byte/
  integer validation, timer input/focus retention and duplicate-click suppression;
- synthetic 44-card geometry passes all six recorded desktop/landscape widths;
  inspected the 1920 screenshot. Timing is diagnostic, not a performance claim.

The engine driver rechecks the exact recorded runtime archive, receipt, JS/WASM
and pinned rules hashes. Source provenance is its verified historical archive
receipt, not a freshly reconstructed Git source checkout. No binary substitution,
Rust build or regression assertion change. Exact hashes/outcomes and scoped
limits: experiments/phase-engine/placement-proof-2026-10-25/.

Limits remain: initial placement applies only to currently offered unambiguous
moves, including the narrow Bears cast surface. This is not all-card dragging,
physical touch-device certification, a full owner-route game or another complete
match receipt. Actual eligible Standard/Commander match acceptance, remaining
human schemas/pregame, fair calibrated Easy/Medium/Hard and final account route
remain required. Public readiness stays false. No live release, APK, schema,
subscription, budget increase, paid engine build or external message occurred.
Next: carry authoritative announcement/target/payment/combat affordances across
supported real deck versions and finish the complete owner-facing match gate.


## October 25, 2026 — explicit human combat assignments

Started from verified remote 20f28bc7f38225270bdcdf634499f49f7f888f18;
complete recursive tree contains no AGENTS.md. Used an isolated current-byte
workspace and retained the newer placement gestures and browser fixes.

Added human-only explicit relations schema projection, bounded source/target
edges, optional numeric band groups and local assignment drafting. Sources
with atMostOne cannot select two defenders; engineValidated sources retain
multi-target capability for effects such as Palace Guard. The engine remains
authoritative for menace, must-attack, blocking capacity, banding and all other
combat restrictions. No AI candidate membership supplies human legality.
The table provides attacker/defender and blocker/attacker rows, clear and
explicit confirmation. Drafting/clearing changes no engine state. New accepted
revisions clear the draft; timer-only renders retain it. Keyboard buttons and
existing card inspection/placement remain available.

Executed all 168 focused Phase Node tests: zero failures/skips/cancellations.
Executed shared table/session Chromium 153 checks with simulated transport:
local two-attacker drafting, clear, keyboard selection, timer retention,
duplicate-confirm suppression and one-source/two-target blocking projection.
Repeated existing pointer-placement and numeric-entry browser checks; both pass.

Executed combat-controls-engine.mjs against the exact delivered ZIP, embedded
receipt, JS/WASM hashes and compressed/decoded pinned rules hashes. Engineered
four-Bears position accepts an explicit two-attacker subset absent from generated
attack candidates. A separate opponent-turn position accepts Palace Guard
blocking two attackers and rejects an ordinary Bear blocking two, unchanged.
Both cases reject bad/stale capabilities, restore pending combat and recover
the accepted receipt without duplicate assignments. Zero network requests.
These are real runtime checks; the shared browser driver uses separate projection
fixtures. Source provenance is the verified archive's historical receipt,
not a newly reconstructed source checkout. No Rust build or binary substitution.

Driver corrections before final success: initial seat-one journal use correctly
failed because the human route is fixed to seat zero; replaced that setup with
a genuine seat-zero blocking decision on the opponent turn. A controller-swapped
fixture was unsuitable and discarded. The actual persisted combat field is
blocker_to_attacker, not blockers; final assertions inspect exact assignments.
The first browser follow-up referenced a module-scoped fixture from page.evaluate;
the corrected harness exposes its fixture explicitly. No engine/assertion was
weakened. Final byte-scoped reports: experiments/phase-engine/combat-proof-2026-10-25/.

Limits: this does not certify all combat restrictions, banding semantics,
damage-assignment order, real account/deck admission or a complete new match.
Existing original failing/corrected passing ninjutsu evidence is unchanged.
Public release stays disabled. Actual eligible Standard/Commander decks,
remaining human schemas/pregame, complete mandatory timeout policy and calibrated
Easy/Medium/Hard still need acceptance through the owner-facing account route.
No production, APK, schema, subscription/budget change, paid build or messages.
Next: carry these authoritative combat controls into full real-deck/account match
gates, then complete remaining decisions and pregame without widening admission
from these narrow fixture passes.


## October 25, 2026 — combat editing, validation and bounded layout follow-up

Started at 20f28bc7f38225270bdcdf634499f49f7f888f18; during implementation the
remote advanced to 94229c4e0ff35a1c81afc6e1092ad4cb7a56eb9b with overlapping
combat work. Reconciled against that exact current head and its instruction
tree (no AGENTS.md). Kept the canonical validInteractionRelations/setRelations
APIs, all four concurrent combat guards, original runtime driver, browser test
and its historical evidence. No old whole-branch merge or discarded checkpoint.

The table now uses individual combat choices in place of incomplete preset
combinations when a relations prompt exists. Stable instance numbers distinguish
same-name creatures; source inspection stays available. Assignment rows scroll
inside a bounded area with confirmation/clear controls above them. Band inputs
use the existing dark/glass colors. Local typing remains local until confirmation;
invalid or fractional group values disable confirmation, timer-only updates keep
the input and focus, and a retired input cannot change a later revision. Explicit
Clear/None clears those local band drafts. No automatic combat submission.

Added toggle/group convenience methods over the preserved canonical session API.
Bounded projected edges to the pinned engine's 1024-element relation domain.
Kept actual special blocking-capacity decisions with the engine. No CPU packet,
card admission, engine source, binary or rules interpretation was replaced.

Executed after reconciliation: all 173 focused Node guards pass with zero
failures/skips/cancellations. Both the adapted existing combat browser test and
new drafts browser test pass on Chromium 153. The latter covers destination
replacement, local clear, explicit no-blockers confirmation, invalid band values,
group zero, timer/focus retention and duplicate/stale-event suppression. Geometry
passes 1280x720, 1920x1080, 3440x1440 and 1024x768; visually inspected the selected
combat fixture. This fixture deliberately has no card art or real account.

The additional delivered-byte driver again accepts a legal two-Bears attack
subset absent from generated candidates, accepts Palace Guard blocking two
attackers, rejects ordinary Bear multi-blocking and forged/stale endpoints,
restores pending combat and replays the accepted receipt without duplication.
Exact ZIP/receipt/JS/WASM/rules hashes verify; zero network calls. Source provenance
remains the archive's historical receipt, not a fresh source checkout. Its first
local assertion used an incorrect blocked_by field; corrected it to the actual
blocker_to_attacker mapping and reran. No engine assertion was removed/weakened.
This repeats narrow coverage, not two independent all-combat certifications.

A larger earlier-byte control run reached genuine GameOver after 386 actions,
187 human button commands and turn 22, and passed pending-bottoming cold recovery.
Its process later exited 137 before all final checks completed; cgroup oom_kill=6
was observed in the shared 8 GiB environment. A subsequent serialized final-source
run stalled during runtime loading and was interrupted (exit 130) before gameplay.
Neither is counted as a passed final complete-match suite or new cold-terminal
certificate. Partial outcomes and exact source hashes are retained separately.
No resource ceiling/interrupt/timeout was converted into a match result.

Updated the configured-match browser driver to exercise the actual individual
attacker and explicit no-block controls, including zero available attackers,
and to support a separate output directory. That full modified driver remains
UNVERIFIED to completion. Targeted final combat browser/runtime checks passed;
prior generic complete-match receipts remain bound to their original sources.

All new outcomes: experiments/phase-engine/combat-followup-proof-2026-10-25/.
Original/concurrent combat reports are preserved unchanged. The runtime was only
locally recompressed for a verification server, with exact unchanged decompressed
WASM and pinned rules hashes; no runtime asset or Rust build was committed.
Next: finish a bounded serialized complete-match run through the modified driver,
then viable supported real Standard/Commander lists, remaining human choices/
pregame/mandatory timeout policy, fair calibrated difficulties and actual owner
route acceptance. Public readiness remains false. Existing release approval is
recorded. No production, APK, schema, paid build, new subscription/budget or
external message occurred. Do not publish a fixture-only Play button.

Broader verification attempt: ran the unchanged current configured-match browser
suite serially after the recovery probe. Its persistent-browser run again stopped
making visible progress during runtime download after the first 16 MiB; no new
completed game or final report was produced. The observed cgroup oom_kill count
remained 6, so this run does not establish another OOM. A cross-command SIGINT
attempt could not resolve the sandboxed process ID (ProcessLookupError); no
successful termination is claimed. Treat the broader suite as incomplete,
not passed or an engine loss. Its captured startup log is retained with this
slice. Next verification should use an outer bounded process lifetime and isolate
the persistent-profile/runtime-loading path before another full-suite attempt;
the separate ephemeral-browser account/recovery path passed on final bytes.

## October 25, 2026 — editable explicit ordered choices

Started from verified remote ac6f1d209fcdeb3a07180d5ea2aeaa57e8b6e142.
The complete recursive repository tree contains no AGENTS.md. Compared local
integration modules with remote blob hashes before editing; three untracked
research probes were excluded from this change. No upstream engine edits.

Ordered human selections now show individual numbered occurrences with local
Remove, Move earlier and Move later controls. Repeated targets remain separate
occurrences when the engine permits repetition. Unique selections retain their
constraint. A full sequence disables additional entries (single-target prompts
retain replacement behavior), and the session enforces the engine-projected
maximum even when called directly. Edits are local until explicit confirmation;
wrong prompts, invalid indices/edges, retired revisions, closed sessions and
in-flight confirmation cannot edit that draft. Accepted revisions clear it.
No generated AI candidate list establishes human legality and no rules/payment
choice is fabricated. Final submission uses the existing authoritative route.

Executed all 182 focused Node tests, zero failures/skips/cancellations. Chromium
153 shared-table/session checks pass local repeated-occurrence removal, moving,
capacity, timer paint preservation and explicit keyboard confirmation with the
exact edited sequence submitted once. Repeated numeric, text and individual
combat browser checks pass on the final session/table bytes. These checks use
simulated transport; they do not establish a new actual-engine multi-target
fixture. Reports and source hashes: experiments/phase-engine/sequence-proof-2026-10-25/.

Rechecked the locally retained delivered archive SHA-256 edb82685e8f71de64006da5f8cd188d738939c106ae19d67ad4281158cff513b,
WASM a86578b23adcd26c38a68871e745305f3acb249158e1b424065cc6e6b6c3bfee and
glue 7317b542201dea626776001e91f8d2fcbe92ae8108c9003da6c7ed41f59149cc.
Browser loader continues to verify the exact decompressed WASM and pinned rules
identities. Source provenance remains the delivered historical receipt, not a
fresh source reconstruction. Original failing and corrected passing ninjutsu
assertions/evidence remain unchanged. No new Rust build or binary substitution.

An initial 240-second bounded run on baseline bytes loaded the runtime, verified
pending-bottoming cold offline restore and reached 100 human commands/revision
206 before timeout (exit 124). It did not complete. The shutdown error is an
interrupted browser context, not an engine loss. The former 16 MiB loading stall
did not reproduce in this run; no speculative runtime-loading fix is claimed.
The final-byte run uses a separate output/profile and a 600-second outer limit.
Its exact result is recorded below once the process finishes.

The longer sequence-byte run (BEFORE the strict-write change below) reached
engine GameOver: revision 386, winner seat 1, turn 22, 187 human commands and
one human cast. It wrote practice-partial.json, then exited 137 during terminal
cold-browser recovery; shared cgroup oom_kill increased from 7 to 8. The full
suite remains FAILED/INCOMPLETE: Commander, illegal-list and final account-change
assertions did not execute to completion. No terminal recovery pass follows
from the earlier pending-bottoming success.

A separate fresh-process offline probe against that exact persistent profile
FAILED: session revision 152, expected acknowledged terminal revision 386. Kept
the failing assertion/log and the exact terminal partial receipt. Do not replace
that stored game with the expected terminal receipt or call this a recovery
success. The root cause of the rollback is not established. This is a newly
observed release blocker, separate from supported-deck/owner-route acceptance.
The cached shell in this diagnostic used pre-strict storage bytes, exactly as
recorded in the partial report. A new script, practice-terminal-recovery-browser.mjs,
requires explicit prior profile/origin/partial paths and asserts that the exact
acknowledged revision/result survives; it does not start a substitute game.

Source inspection found journal writes using the browser's default IndexedDB
durability. Changed ONLY readwrite record transactions to request durability:
strict and refuse a browser which does not report honoring it. No relaxed-mode
fallback, schema change, migration, result reconstruction or automatic command
retry. This hardens acknowledgement semantics but is NOT a verified fix for
the observed rollback. Its full forced-crash match repeat is still REQUIRED.

After this storage change, all 183 focused Node tests pass, zero failures/skips/
cancellations. The added contract test covers the strict request and fail-closed
unsupported branch. A lightweight actual Chromium IndexedDB check reports strict
write durability and preserves the acknowledged journal across page reload.
That is not a killed-process or complete-match guarantee. Sequence/combat/number/
text browser reports remain bound to their exact unchanged session/table bytes;
the pre-strict configured-game report retains its original storage source hash.

Next: serialize fresh-process crash/recovery checks with strict record writes,
assert exact accepted revision/receipts/result across termination and fix the
rollback cause before claiming offline reliability. Then complete viable real
Standard/Commander lists, remaining human decisions/pregame/mandatory timeout
policy, fair calibrated difficulties and the signed-in owner route. Do not spend
another run merely polling the old process or repeat a paid engine build. Existing
release authorization applies once actual gates pass; public readiness stays false.
No production/APK/schema change, paid build, subscription/budget increase or
external message occurred. All partial and failing outcomes are preserved beside
the scoped successful tests in sequence-proof-2026-10-25/.


## October 25, 2026 — forced-process storage checks and explicit pregame

Owner requested continuation. Began from verified a77a2856fb03aeb4aecf187a9126f0d06eb8174a;
complete recursive tree contains no AGENTS.md. Current modules were compared
with that tree before editing. Three local exploratory probes were excluded.
No changes to upstream engine source, executable runtime or card definitions.

Added play-pregame.js and connected it to the existing gated account candidate
handler. The player explicitly chooses You, CPU or Choose randomly before a
match starts. Shuffle seed and starting seat use independent cryptographic
random values; the exact seed/first values pass to the existing flow and engine
journal. There is no fake coin face, pre-confirmation match creation or reroll
on duplicate confirmation. Cancel/Escape starts nothing. Changed accounts,
account generations and selected decks refuse start. Account lifecycle cleanup
also destroys the pending pregame. The existing release flag stays FALSE;
this does not enable the public Play button or claim complete pregame rules.
The engine still governs opening hands, mulligans and format-specific turns.

The prompt uses the existing panel/buttons and current base/style/menu CSS;
Return to setup is secondary. Corrected a box-sizing overflow caught by the
first geometry run. Final Chromium checks pass keyboard confirmation, duplicate
click protection, stale selection/account rejection, cancellation and destroyed
controls, plus 1280x720, 1920x1080, 3440x1440 and 1024x768. Inspected the 1280
screenshot with actual base/menu styles. No screenshot is a user deliverable.
Added the module to the shell inventory and bumped its cache version. App and
service-worker syntax checks pass. Product activation remains disabled.

Final focused Node run: 209 tests, zero failures/skips/cancellations. This count
is 183 Phase guards + 23 setup checks + 3 pregame checks, not 209 new engine
mechanics. A broader unmodified menu-test attempt lacked store.js/views.js in
the isolated copy and did not execute; it is not counted as passing. The setup
test's missing pure import module was restored from the pinned remote before
the final successful 209-test run. No assertion was weakened or removed.

Storage isolation: practice-crash-storage-browser.mjs uses actual strict record
transactions and simulated journal payloads. At acknowledged revisions 12, 152
and 386 it immediately SIGKILLs its owned isolated Chromium process group,
reopens offline, checks the exact pre-write journal hash, then kills/reopens
again and compares the whole record, timestamps and result. All six restarts
pass, including terminal receipt/result, frozen finish and account separation.
This is stronger than a page reload but does NOT certify an engine restore,
OOM survival or power-loss persistence. The helper owns only its explicitly
spawned test process group and never attaches to user browser sessions.

Actual-engine repeat: practice-crash-engine-browser.mjs uses the unchanged
configured list/controls with isolated owned Chromium processes, SIGKILL at
pending bottoming and at terminal, and the current strict record module.
Pending-bottoming offline recovery, source immutability and concurrent CAS
checks pass. The game reaches genuine GameOver: revision 386, winner seat 1,
turn 22, 187 human commands and one human cast. During terminal cold recovery
the outer process exits 137; shared cgroup oom_kill increases from 8 to 9.
The terminal restart, Commander/illegal-list/account-change tail is incomplete,
not a passing complete-match suite or an engine loss.

A subsequent READ-ONLY metrics probe against this exact profile (not a new game)
finds journal revision/history/receipts 76, no terminal result, versus acknowledged
terminal 386. It exits 1 and preserves the discrepancy. Engine string is 296250
characters; summed receipt JSON is 370465 characters at that recovered revision.
These metrics do not prove what caused the rollback or describe the missing
terminal record's size. Strict writes alone have NOT resolved the observed
post-OOM recovery failure. Do not reconstruct a final save from the partial
receipt, remove that assertion or generalize the six storage-only successes.
The original a77a2856 failure (152 vs 386) remains unchanged as historical evidence.

The archive, glue and compressed rules hashes were rechecked against the
recorded delivery. The actual loader verifies decompressed WASM/rules hashes.
No binary substitution, new Rust build or paid workflow was used.

Reports, source hashes, raw partial/failing outcomes and helpers are under
experiments/phase-engine/strict-crash-proof-2026-10-25/. Independent verification
in another active local workspace was detected after this failed engine run;
left it untouched, wrote a local coordination handoff and launched no further
large engine test. Guard the branch update and preserve any concurrent work.

Next: resolve repeated full-runtime recovery memory failure AND the acknowledged
revision discrepancy; distinguish test-environment persistence effects from a
product storage/engine bug with explicit read-only evidence and repeatable
process ownership. Do not call crash recovery fixed from strict-mode reporting
alone. Continue the actual signed-in Standard/Commander real-deck flow, remaining
human decisions/mandatory timeout policy and calibrated difficulty gates once
recovery is trustworthy. Existing release approval applies after actual gates,
not to this fixture-only candidate. No production, APK, schema/migration,
subscription/budget increase, paid build or external message occurred.


## October 25, 2026 — explicit pregame and strict-write crash reproduction

Started at freshly verified remote a77a2856fb03aeb4aecf187a9126f0d06eb8174a.
The complete recursive remote tree has no AGENTS.md. Existing experiment modules
match the remote Git blob identities; excluded three old untracked research probes.
No concurrent local engine/browser test was running when this slice began.
Read current handoff, engine evaluation, human-route proof, mechanics acceptance,
response timer, CPU-context and linked core art/release/CPU requirements.

The private app candidate now mounts explicit pregame before starting the player
mat, replacing its unconditional human-first start. Player/CPU/random first seat
and an independent crypto shuffle seed are resolved only after confirmation.
No invented coin/die face. Changed account generation, selected lists, format,
difficulty or profile invalidate confirmation. Duplicate submit, retired controls
and unknown startup outcomes cannot create a second match. Cancel/close restores
app input; the preserved newer app creates its player mat only after confirmation. Public readiness remains false;
no enabled public Play button or production publication follows.

All 186 focused tests pass (zero skips/failures/cancellations). Actual Chromium
153 pregame checks pass keyboard confirmation, cancel, source/account changes,
duplicate confirmation and failed-start lockout at four desktop sizes. Visually
reviewed 1280x720 capture. A separate browser proof executes the exact app action
with test-only admission enabled and simulated dependencies: no start before
confirmation, explicit CPU-first once, duplicate entry blocked, close/cancel
cleanup and startup error handling. These are not signed-in app or engine proofs.

Reverified retained archive SHA-256
edb82685e8f71de64006da5f8cd188d738939c106ae19d67ad4281158cff513b and WASM
a86578b23adcd26c38a68871e745305f3acb249158e1b424065cc6e6b6c3bfee.
The unchanged loader checks delivered runtime/rules identities. No Rust build,
binary substitution or change to original/corrected ninjutsu evidence.

Added an isolated browser process-group helper and crash harnesses. Actual strict
IndexedDB record storage passed six SIGKILL/offline restarts at revisions 12,
152 and 386, preserving complete journals, frozen inputs, receipts and terminal
metadata. A second stress run passed 386 sequential acknowledgements and six
restarts with simulated journals up to 1,631,725 bytes. These isolate storage;
they are NOT engine-match durability or power-loss guarantees.

The real-engine strict-write game again reached engine GameOver, revision 386,
turn 22, winner seat 1, 187 explicit human commands and one human cast. It passed
pending-bottoming SIGKILL/offline recovery and continued the actual game. After
terminal SIGKILL and offline restart it exited 137; shared oom_kill rose 9 to 10.
The complete suite is FAILED/INCOMPLETE. Terminal whole-record comparison,
Commander initialization, illegal-list and final account-change assertions did
not finish. Terminal partial receipt and failure log are preserved.

A fresh read-only browser inspection (no engine loading, service worker bypass,
no journal reconstruction) found stored revision 87, 87 history/receipt entries,
result null, versus acknowledged terminal 386. Same frozen input digest. This
reproduces rollback WITH strict storage: do not call strict writes a fix. The
record inspected has 305,380 engine characters and 442,084 receipt characters.
The root cause is unresolved; memory failure and rollback remain release blockers.
Original earlier rollback evidence remains unchanged.

Proof files: experiments/phase-engine/pregame-crash-proof-2026-10-25/.
The executed full-game harness is practice-crash-engine-browser.mjs. A separate
practice-crash-engine-compact-browser.mjs replaces potentially huge terminal
assertion diffs with exact whole-record SHA-256 comparison and compact revision
metrics. It is syntax checked but its full-match repeat has NOT executed. This
is diagnostic hardening, not an engine/storage correction.

Next: use compact whole-record comparisons and checkpoint exact acknowledgement
versus fresh storage at bounded revisions/blob sizes to isolate rollback without
an enormous assertion diff. Record profile/origin before any next long run.
Then verify real eligible Standard/Commander decks, remaining explicit choices,
mandatory-timeout policy, fair calibrated difficulties, and signed-in owner flow.
Do not start another paid engine build. The pregame does not settle format-specific
pregame/coin winner rights or the complete mulligan matrix. Owner release approval
still applies once actual gates pass, but they remain unmet. No production, APK,
schema, subscription, budget increase or external message changes occurred.

Concurrent checkpoint handling: before ref update, remote advanced to
632165e75da235e34cda4b0617ed67491b912bd2. Preserved its app.js, menu CSS,
service-worker changes, all reports and progress entry. Rebased this slice as
only failed-start/profile pregame hardening, additional stress/compact diagnostics
and this separate revision-87 evidence. Repeated pregame and exact app-entry
browser checks against that newer app/CSS; both pass. The app keeps its newer
lazy player-mat creation behavior. Bumped only its existing private shell cache
version for the changed pregame bytes. No old whole-branch overwrite.


## October 25, 2026 — bounded projection caching and pre-engine rollback isolation

Started at freshly verified remote 7ff5f30072e3015c6d971ee92d7c42d490ce6ea8,
tree e07fc35724ccbcc651ba21ca9c24c6ff87a8c27b; recursive tree has no AGENTS.md.
Compared the existing experiment modules to remote blob identities before edits.
Read the required current handoff, engine evaluation, human-route proof,
mechanics, timer and CPU-context requirements. Existing app/pregame/cache,
original failures, corrected mechanics evidence and production are preserved.

Implemented a journal-local board/choice projection cache for each accepted
revision. The 250 ms countdown polls reuse that projection instead of calling
the expensive engine summary again. Clock inspection remains live on every
read. Engine mutation invalidates the cache, including rejected submissions;
failed persistence clears it before rollback. Returned read projections are
cloned so a caller cannot alter the next status. No durable schema, receipt,
command identity, engine binary, timeout policy or CPU packet changes.
The first new test caught a returned-object alias; corrected before final tests.
No measured browser speedup or fix for persistence is claimed.

Executed 186 Phase module tests plus 3 pregame tests: zero failures/skips/
cancellations. New checks cover 20 repeated status polls using one engine
projection, caller mutation isolation, cache invalidation after a move,
terminal rejection/exact receipt replay, and live countdown without deadline
renewal. Setup tests were not included in that count. Syntax checks pass.

Reverified the retained delivery ZIP edb82685e8f71de64006da5f8cd188d738939c106ae19d67ad4281158cff513b
and decompressed WASM a86578b23adcd26c38a68871e745305f3acb249158e1b424065cc6e6b6c3bfee.
No Rust build, new paid job, substituted binary or altered ninjutsu assertion.
The existing loader verifies runtime/rules bytes during the browser run.

New practice-crash-checkpoints-browser.mjs records explicit profile/origin,
reads the whole saved record in a storage-only page BEFORE loading the engine,
and compares compact whole-record SHA-256 digests. It retains normal game
commands and adds crash checkpoints near accepted revisions 100/200/300.
It uses the existing isolated process-group helper. No save reconstruction,
replay repair or removed assertion. The old compact driver attempt was
interrupted (exit 130) after pending-bottom restore; not a completed test.
The first new diagnostic failed on an incorrect inspection-page MIME type;
fixed that test server and repeated from a fresh profile. Both logs retained.

Final actual-engine run FAILED, exit 1, with compact evidence instead of an
enormous diff. Exact records survived SIGKILL/offline restart at revisions
2, 101 and 200 (459488, 899889 and 1801586 bytes). The same configured game
then acknowledged revision 301, 3057063 bytes, digest
3a8229300468d02a260dbf3a9ead3e38a725cc28ababc40e6e97205c9804e409.
The cold storage-only read BEFORE any engine restore returned revision 214,
1951149 bytes, digest
9b51224ee2b1a69be3857c280bddad1712667274d581f4f34926d58eb7a239e5.
The cgroup oom_kill counter stayed 10 throughout this final run and the
following storage probe. This reproduces rollback without a newly observed
OOM and locates this discrepancy before rules-engine restoration. It does NOT
establish the browser/storage/environment root cause or prove earlier OOMs
were assertion-diff failures. Terminal/Commander/illegal-list/account-change
tail did not execute in this failed checkpoint run.

Followed with a serialized storage-only size probe:
practice-crash-storage-large-browser.mjs uses the unchanged strict account
storage and simulated journals with a 2 MiB engine string. All six SIGKILL/
offline restarts pass at revisions 12/152/386 with records
2133468/2534168/3204589 bytes, including exact terminal metadata and whole-record
comparison. Consequently raw record size alone is not established as the cause.
These repetitive synthetic payloads do not reproduce actual engine content,
WASM memory use or the final failing game history.

Evidence and exact source hashes:
experiments/phase-engine/recovery-checkpoints-proof-2026-10-25/.
The game profile/origin are retained in cold-reads.json for read-only follow-up
while scratch survives. No full-game, power-loss, all-card or offline reliability
certificate follows from the passing unit/storage checks.

Next: isolate actual serialized game payload versus synthetic payload, short
versus long-lived database connections, and the same real-origin record from
worker versus window. Capture the pre-kill acknowledged payload locally before
the next bounded checkpoint; do not reconstruct the missing revision afterward.
Fail fast on the cold digest before loading the engine in a future diagnostic.
Keep recovery blocked until an actual corrected candidate preserves complete
matches and receipts. Then real eligible Standard/Commander decks, remaining
choices/mandatory-timeout policy, calibrated Easy/Medium/Hard and signed-in
owner flow still require gates. Existing release approval applies only after
those pass. No production, APK, schema/migration, subscription/budget increase
or external message changes occurred.

## October 25, 2026 — real-payload worker failure and bounded connection lifetime

Started from freshly verified remote f5186f5a028e1adbc2fc97860ee0d5f565bfc344.
Recursive remote tree is complete and contains no AGENTS.md. Existing local Phase
modules match remote blob identities. Required handoff/engine/human-route/mechanics/
timer/CPU-context and linked core release/art/CPU requirements were read. No
concurrent engine test was running at the start; mutations remain isolated here.

Implemented owned record connection lifetime per transaction, closing on complete
or abort, plus closed-handle rejection; injected databases stay caller-owned.
This avoids holding a connection across runtime loading and abandoning it on
failed validation. The whole-record schema, strict transaction request, CAS,
receipts, frozen input and terminal result rules are unchanged. It is NOT a
verified crash-recovery fix. All 187 Phase module tests pass serially, zero
failures/skips/cancellations. The new meaningful lifecycle test checks success,
abort and retired-handle behavior. No measured speedup or durability guarantee.

Read-only export of the old actual-game profile, without engine loading and with
service-worker bypass, found revision 216 (old failing harness had resumed 214).
The 1,975,063-byte record was exported locally; its SHA-256 is preserved, not a repaired
or reconstructed revision 301. Using that payload with synthetic repeated revision
numbers, unchanged original storage passed window-long at 399 but worker-long
failed cold read with NotReadableError: missing file/data irrecoverable. No WASM
was loaded in this storage-only test. Baseline stopped there; no third-case pass.

Candidate storage passed worker-long at 399, then FAILED worker-rotate: acknowledged
399, recovered 368, different whole-record hashes. Thus neither connection lifetime
nor engine execution is established as the root cause. Preserve this failure; do
not call closing databases a recovery solution. The local captured input supports this smaller reproduction without another paid
build; it is not uploaded. This is not a
valid reconstructed gameplay journal; it deliberately isolates storage bytes.

The real-engine checkpoint harness now exports acknowledged records before killing
the browser and checks the cold digest BEFORE engine loading, failing fast without
advancing an already discrepant save. Runtime package was regenerated locally from
retained delivered bytes, verifying WASM a86578b2...3bfee, glue 7317b542...149cc and
rules 0dbc4d30...2b9 against the existing receipt. No build or binary substitution.
Original ninjutsu failures and corrected assertions remain unchanged.

That real-engine candidate preserved exact pending bottoming and checkpoints 101
and 200 across SIGKILL/offline restore. It acknowledged 301, then the next browser
attachment failed ECONNREFUSED before inspecting storage. The test is incomplete,
not a rollback or complete-match pass. Added bounded retry for that specific
DevTools startup race in persistent-browser-process.mjs; a port file can precede
listener readiness. No second browser, gameplay retry or assertion removal.
A subsequent independent read-only cold inspection found exact revision 301 and
whole-record hash 7a65b11903d1c31973316622be4d5ca89849aa9a97716148c9e2a7ff51918595.
That inspection is not engine recovery. Its exact acknowledged record was retained locally.
The cgroup OOM kill counter remained 10 during these tests.

Evidence: experiments/phase-engine/durability-isolation-proof-2026-10-25/.
The exact initial failing payload harness is retained separately from its updated
per-case reporting version. Historical evidence is unchanged. Public Play stays
gated; no release readiness follows from any control or storage test.

Continuation after the helper race: practice-crash-continue-browser.mjs resumed
that exact revision 301 and reached engine terminal 386, turn 22, seat 1 winner,
40 additional human commands. Exact 4,658,063-byte terminal record survived SIGKILL,
was compared before engine loading, then restored with matching result/receipts/
timestamp and hash 54864267d84b355f2894d0144c14513799d6803d1d7da13b6572e14add87bb8d.
Account retirement, Commander initialization and illegal-list assertions passed.
The continuation suite still FAILS its final zero-network assertion: seven server
requests were counted despite the offline context. Request paths were not captured
in this driver, so their origin is unresolved; do not report zero network or a full
suite pass. No OOM counter increase. This limited terminal success does not cancel
the separate candidate worker rollback 399 -> 368 or certify reliable recovery.
Original incomplete and continuation failure reports both remain intact.

Next: use the retained exact payload to implement/test a storage representation
that survives repeated worker kills, investigate the seven unexpected requests
with per-path request logging, then repeat complete games. Do not rerun the same
connection-lifetime hypothesis as a fix. Account-facing real eligible Standard/
Commander matches, remaining decisions/mandatory timeout policy and calibrated
Easy/Medium/Hard still gate release. Public readiness stays false. No production,
APK, server schema/migrations, subscriptions, budget increase or paid build changed.

Automatic review rejected the raw compressed saved-match blob uploads as sensitive
private-data egress. No raw records were uploaded; the commit includes source,
hashes and scoped reports only. Local raw exports are excluded and may be pruned.
Future exact-payload reproduction requires those explicit local inputs or a newly
recorded test run, not an invented replacement. Remaining useful code/report work
was completed without asking for additional access or payment.

## October 25, 2026 — owner-scoped session-only beta and anti-stall clocks

Owner explicitly changed the first beta's priorities during this run: saved
progress/resume may be deferred; intentional Back/Exit can forfeit; publish a
usable core for owner/friends to test rather than spending hours circling future
features. Stronger difficulty and extra modes may follow. This supersedes the
previous requirement to solve whole-journal IndexedDB crash recovery before any
initial beta. Original rollback/NotReadableError evidence remains valid; do not
say it is fixed. Latest current handoff begins with this scope correction.

Started at freshly verified remote 05a9f5d4086dbfb082a8b847747ee9d529d03596,
complete recursive tree with no AGENTS.md. Retained source modules copied to
isolated save-fix; required current handoff and linked rules/controls/timer/CPU
contracts reviewed. No Rust build, spending, binary substitution, server schema,
APK, collection/scanner/finish change or external message.

Implemented explicit sessionOnly:true bind/ack and account-flow option. Product
mat defaults to it. Frozen deck/printing/context and exact revision receipts stay
in that worker's in-memory journal; no large match IndexedDB read/write occurs.
Historical durable research mode remains explicit default on lower-level clients
so its old tests/evidence are not rewritten. Session resume/recover is refused;
fatal/unknown outcomes retire the session with no invented result, while rejected
human choices remain correctable. Before-unload warns only on a live accepted
nonterminal match; terminal/detach/account-change/error removes it. In-app Back
opens existing concession confirmation and restores the current route before
navigation; Cancel does not act. Finished matches close without another loss.
Browsers cannot guarantee an asynchronous concede on tab kill/refresh: no claim
of reliable persisted abandonment scoring. UI explains no resume and explicit
Exit forfeiture. Existing engine concession is used, never a synthetic winner.

Implemented authority-owned anti-stall budgets for session-only mode: 30-second
legal priority response remains; 90 seconds human inactivity, paused for CPU
thinking, reset only by accepted HUMAN actions; 5-minute own-turn wall-clock cap
never renewed by legal repeated actions or CPU responses. Inspection, rejected
inputs and automatic passes cannot reset idle. Budget expiry before a late
command/after async CPU selection is revalidated and submits a real Concede once
with timeout reason/request ID in accepted trace. Mandatory choices are never
strategically guessed. Session-only budgets refuse durable resume. Scheduler
keeps idle running after a mandatory response clock expires, handles independently
expired hard turns, and stops at terminal. UI shows separate clocks, warning at
30s for budgets and5s for reaction, without rebuilding a focused input. Defaults
are initial beta settings, not calibrated competitive timing.

Pinned manifest is now cache-first with full runtime/rules identity validation;
invalid cached manifests are evicted, invalid downloads fail closed, aborts retain
their reason. No weakening of chunk/glue/WASM/rules hashes. All new static imports
are in the current SW inventory; shell cache version updated. Existing historical
browser harnesses need new static module routes if rerun; their captured outcomes
remain historical, not newly executed against these files.

Executed 250 focused Phase/pregame tests, zero failures/skips/cancellations, plus
2 exact app-navigation extraction tests. An initial new scheduler test used an
inconsistent mock state (waiting+expired); corrected to the actual authority's
expired state without removing its timeout assertions; final250 all pass.

Actual Chromium153/default clocks/delivered runtime: session-only account/setup
coordinator starts with IndexedDB access throwing in the served authority; idle
Mulligan decision expires after a REAL90-second wait and engine yields winner1,
revision1, no guessed bottoming/payment. Cancel Exit preserves revision. A new
independent session has revision0 and reuses the validated runtime cache (one
manifest request across the starts). Complete visible control game reaches engine
GameOver revision384,turn22,winner1,187human commands,onehuman cast, with explicit
attack/no-block choices. Confirmed Exit in a third session yields one engine loss.
No match IndexedDB access. These use simulated account/setup readers and a land-
heavy control, NOT actual signed-in owner flow or general real-deck readiness.
The full browser run binds its exact route bytes; later scheduler terminal guard
and presentation cleanup are covered by final250 and the final UI proof, not a
repeated complete game. Do not collapse these scoped outcomes into one broad pass.

Final lightweight browser proof passes1280x720/1920x1080/3440x1440: separate clocks,
visible decisions, warning boundaries, stable numeric input/focus during polls,
requestExit dialog and cancelled Exit without an action/navigation. Visually
reviewed1280; fixed touching timer labels with spacing and repeated final UI proof.
Text-only projected table, not full artwork signoff. Existing shared artwork and
emblems/Power/bracket/wiki hooks are preserved in the product host.

Owner asked specifically for correct flying blocking. Exact corrected WASM/glue/
receipt and unchanged6137-rule fixture pass3/3 engineered combat cases: Bear->flyer
explicit relation rejected with semantic/combat/counters/damage/RNG unchanged;
flying blocker accepted; Reach blocker accepted; real combat damage checked.
Earlier driver assumptions hit correctly skipped/filtered capabilities; first two
reports retained separately, no rules assertions removed. No network. These are
engineered combat positions, not complete legal histories or all-abilities support.

Independent next-deck probe: a 60-card mono-green creature list passes the pinned
engine's Standard gate and completes315actions,turn16 in a both-seat policy Node
mirror, with12casts and combat. Record exact list/trace in green-deck-probe.json.
It is NOT independently verified current Standard legality; optional abilities,
human choice/UI paths, all draws and CPU strength are unproved. Do not promote
all9 names to full coverage from one game. Jasmine compiled restriction has an
Unimplemented node; Isamaru absent. This is a better NEXT browser fixture, not a
release certificate or an excuse to broaden supported pools silently.

Next concrete work: finish the actual selected/imported-deck account launch and
review eligible real deck versions through the mat, including exact art and the
CPU's supported decisions. Keep a basic honestly labeled CPU for the first beta;
strong difficulty tuning may follow. Do NOT return to crash-resume as a release
blocker for the session-only scope. No more full-game repeats unless new behavior
or unresolved failures justify them. Source public activation remains false and
setup button disabled: no fixture-only public Play release. Current website head
was freshly read as fe1d753749af2324bd875e32ca8af8f8dbfd2ac9; verify again before
selected-source integration. Owner release approval remains sufficient once the
concrete account-facing beta passes its actual core gates. Production unchanged.
Evidence: experiments/phase-engine/session-beta-proof-2026-10-25/.

## October 25, 2026 — substantial-list human controls and artwork preparation

Continued at freshly pushed9ede66e1f8fb057e0487dbfec3fe96d0a13d9724 after the
owner asked to continue and requested a ready/working/remaining list. Owner again
prioritized core rules/playability and deferring strength/modes/resume, with a
published beta for owner/friends bug testing. No new approval/payment requested.

Fixed an actual account-launch integration gap: createPlayerMat now awaits an
optional prepareArtwork callback before capturing artwork/context and creating
its flow. The app passes its existing account-guarded resolveNames loader for
both exact selected lists and sideboards. Frozen setup is checked again after
the await; stale account/deck changes cannot start a worker. Preparation gets a
clone, source lists remain untouched, missing exact printing still never becomes
a falsely claimed printing. Existing renderer and finish/rarity/wiki hooks are
reused. Bumped private shell cache for these bytes. No inventory or schema writes.

New actual-host/capturePracticeArtwork browser proof passes: no lookup/flow/start
before metadata resolves; main/opponent/side exact-print metadata available when
captured; later source edits cannot alter frozen captures; account/selected list/
opponent changes during loading prevent start; rejected preparation shows a
recoverable setup error and creates no flow; session-only resume rejects early.
Dependencies/metadata loading/flow are simulated in this focused host proof.
It does not establish a signed-in owner match or final rendered artwork quality.

New green-deck-browser.mjs runs the exact60-card24Forest/36creature list through
the real account/setup coordinator, session-only authority and visible controls.
Its server explicitly overrides coverage TEST-ONLY for that list; production
practice-coverage.mjs is unchanged. Authority IndexedDB getter throws. Exact
runtime/rules bytes remain verified by the normal loader. Actual human driver
uses published castSpell opportunities and inspector->Cast-auto, never bypassing
gameplay UI with direct engine commands. It completes revision236/turn12 with
CPU winner1 and114human commands:105prioritypasses,3lands,2casts,2individual attacks,
1no-block,1Keep. Human actually casts ScavengingOoze and Tarmogoyf. Exact Forest
printing/finish observed. No reported unsupported prompt/game error in that run.
This is one substantial-list visible-match proof, not all9cards/optional abilities,
independent current Standard legality, actual signed-in account or release proof.
Do not promote test-only admission to production supported-card certification.

Reports in session-beta-proof-2026-10-25/green-browser.json and
card-preparation.json bind their exact source bytes. Current252focused checks and
three flying/reach engine assertions remain the preceding checkpoint; no unrelated
broad repeat was needed for this host-only preparation change. Navigation tests
and syntax checks were rerun and pass. Runtime/binaries/pool unchanged. No paid
build, raw saved-match upload, deployment, APK/server schema/subscription change.

Next core work remains real selected/imported-list admission and actual app launch
at known tested scope, then current-release selected-source integration/publication
for owner testing. Advanced difficulty and resume remain deferred. Do not repeat
old storage experiments or polish menus instead of finishing that launch. Current
public match flag/button are still gated; no live beta is claimed by this proof.

## October 25 — early deck admission, exact printings and full player-mat launch

Parent checked twice: `d78fde04be2742a013713310845f3b66ef9ce4e1`;
complete recursive tree `184bc5915925bcd529530e7ba596fbe8d1b18ea5`
contains no AGENTS.md. Changes remain isolated to Play; no release/APK/schema,
paid build, new service or spending-cap change.

Implemented:
- Lightweight `reviewPracticeSetup` rejects missing/invalid selections,
  unsupported main/side/commander names, signed-out state, Friends and unavailable
  CPU settings BEFORE mat module load, artwork preparation or worker creation.
  It uses the same card coverage helper as authoritative admission. Passing this
  review explicitly leaves construction legality pending the real engine gate.
  No coverage names were added and no format or copy-limit gate was weakened.
- Menu lists per-seat unsupported names (escaped), exposes only the beta Medium
  policy for selection, and wires its future Start action to both release flag
  and preflight. `PLAY_MATCH_RELEASE_READY` remains false.
- Selected saved/imported list can be copied as the CPU's exact list with
  `Use selected deck for CPU`; selecting a different human list cannot alter it.
  Account changes clear both. This supplements the existing Random opponent.
- Launch now resolves requested printing IDs, including reference selections and
  sideboards, into a per-launch in-memory cache using the existing card API.
  Exact ID/name/face checks reject a substituted printing; account changes clear
  pending metadata. Source rows, finish choices and collection stay untouched.
  Name-only imports use existing catalog metadata. Actual artwork capture still
  uses CardStashy's shared finish/wiki/badge hooks.

Executed evidence (`experiments/phase-engine/launch-proof-2026-10-25/`):
- Final sequential focused command: **284 tests pass**, zero fail/cancel/skip.
  This includes the existing Phase guards, pregame, navigation, account/import
  setup, new preflight and exact-printing preparation checks. `focused.tap`.
- Actual player-mat host/capture browser: preparation wait/order, frozen rows,
  scope/selection changes, rejected preparation, resume rejection, and an
  unsupported sideboard rejected BEFORE any module/flow load all pass.
- Extracted actual app entrypoint + real pregame and preparation constructor:
  explicit CPU-first, duplicate guard, cancel/close and unknown-start failure
  pass. Remaining account/setup/mat dependencies simulated, release flag true
  only in the test. Final app source hash in report.
- **New full integration match passes:** real setup controller and real paste
  parser select an imported 60-card mono-green list, preserve the saved source,
  choose a separate saved CPU deck, explicitly confirm pregame, prepare metadata
  (saved opponent exact Forest fetched once), then use the actual product
  `createPlayerMat` host with real flow/worker/table and delivered runtime.
  Human visible controls reach engine GameOver at **revision 236, turn 12,
  CPU winner 1, 114 human commands**, including Scavenging Ooze/Tarmogoyf casts.
  Authority IndexedDB access is forbidden. The original pool remains unchanged;
  this harness uses the SAME explicitly test-only ten-name pool as the earlier
  green coordinator test. This advances integration, not broad pool certification.
- `player-mat-match.json` binds all served module/page/runtime hashes. Shared
  Power/foil/wiki dependency modules are stubbed and enumerated; metadata/API and
  account readers are simulated. This is NOT an actual signed-in owner/site
  session, real art/foil visual signoff, independently current-Standard legality,
  all optional card abilities, graded CPU or production readiness.
- Driver-only diagnostic edit/hash timing is recorded in
  `harness-identity-note.json`; served bytes were captured before launch. Final
  driver captures its own identity before launch. No gameplay/assertion changes
  occurred during the game. Small later setup/menu changes are separately tested.
- Two initial harness attempts were driver setup errors (embedded newline
  escaping; nested-path runtime URL mapping), fixed without engine/source or
  assertion changes. They do not count as passing games. No new OOM kill (10).

Next concrete work: finish an explicitly reviewed eligible REAL deck-version
pool (including current format metadata and required optional choices), then
exercise the actual app account entrypoint with shared art dependencies and
selectively integrate into the CURRENT website-release head. The existing
18-name production pool and a test-only green list are still insufficient for
promising arbitrary owner decks. Do not reopen save/resume or calibrated CPU
strength as initial-beta blockers. Owner publication approval remains active;
no new approval is needed when the core gates pass. The beta has NOT shipped.
