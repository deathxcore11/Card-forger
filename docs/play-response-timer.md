# Response windows and timer contract

Owner instruction, October 24: people must be able to respond, and a timer
should prevent unnecessary waiting.

First response-window default: **30 seconds**, with a visible countdown and
near-expiry warning in the future UI. The authority owns the deadline. Reads,
menus, rejected commands and refresh cannot create a fresh deadline for the
same accepted decision. Store its absolute deadline and stable timeout command
ID with the match checkpoint.

At expiry, only an actual engine-approved PassPriority for the same expected
seat, revision and prompt may be proposed. Revalidate immediately before commit
and record the accepted command once. A stale timer cannot act on a new turn,
seat, cost/target choice or resolved stack. A timeout pass has the same rules
meaning as the player passing; it must not silently resolve an entire stack.

Mandatory targets, blockers, searches, payments and mulligans need separate
countdown, time-bank and timeout behavior. The current clock returns
`timeout-needs-choice` for these decisions. It never guesses a sacrifice,
discard, life payment or target, skips a required action or invents a loss.
A complete no-stall product policy for those windows remains open. Diagnostic
resource ceilings, crashes and interrupted execution do not become game wins.

The research clock uses an absolute wall-clock deadline. Suspension suppresses
automatic proposals while wall time continues; resuming retains that deadline.
This policy is explicit in saved clock data. Trusted multiplayer time,
reconnection grace, accessibility timing, repeated legal actions/time banks,
and the complete match scheduler must be resolved before the released timer.
Per-revision deadlines alone do not prevent deliberate repeated-action stalling.

Implemented here: `priority-clock.mjs` with deterministic tests, plus an actual
WASM check of a restored deadline, current actor, accepted legal priority pass
and duplicate rejection. This is a standalone authority contract. The countdown
UI, live worker scheduler and atomic integration into the game's journal have
not been implemented by this checkpoint.

Repeated combos need a bounded, engine-validated finite-count shortcut and an
opponent interruption point. Do not force a full countdown on every cosmetic
iteration or let "infinite" suppress priority. Revalidate costs, resources and
outcomes if an opponent interrupts. Shortcut scheduling and the whole-turn
anti-stall policy are still pending; the Basalt test proves only three explicit
finite cycles, not a released repeat-loop control.
