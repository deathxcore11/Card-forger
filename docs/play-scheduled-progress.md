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
