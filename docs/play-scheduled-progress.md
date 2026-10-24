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
