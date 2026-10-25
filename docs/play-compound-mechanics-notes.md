# Compound mechanics and loop notes — October 24, 2026

Owner attachment: Pasted text.txt, Library libfile_367d0909c88c819195846e44227df547.
SHA-256: 8293aee0d1a6787742cec1c1aff9234dd27f1045368c1161dd897e27a90f7eb6.

Treat the attachment as a fixture backlog and architecture proposals. It is not
an authoritative rulebook, an inspected description of Arena internals, an
executed CardStashy result, or evidence of 99% support / 1 ms loop shortcuts.
Do not replace the existing rules authority with heuristic keyword code.

## Useful executable follow-ups

- Deathtouch plus trample: lethal assignment, multiple blockers, indestructible,
  prevention and actual damage. CPU strategy must evaluate the real position;
  blanket always/never rules are proposals to test, not universal policy.
- First/double strike: separate damage steps and the legal ninjutsu windows.
  Distinguish entering before normal damage from entering after that step or
  during end of combat. Never award damage retroactively.
- Lifelink: simultaneous life changes and subsequent state-based checks,
  including a controller who would otherwise have lethal damage.
- Fight/bite: correct damage source, deathtouch, surviving source, prevention,
  legal targets and spell-specific excess damage behavior.
- Aristocrats: simultaneous deaths, last-known information, exact trigger count,
  appropriate trigger ordering and priority. Sacrificing a target must not be
  assumed to defeat every multi-target spell or non-targeted effect.
- Blink: new object identity, attachments, counters, temporary effects, damage,
  delayed references and once-per-turn state, with proper permitted knowledge.
- Cast versus copy versus casting a copy; real triggers and their timing.
- Replacement ordering and repeated applicability to the same event. Separate
  replacing a death with exile from exiling an already populated graveyard;
  these are not interchangeable operations in a death-trigger test.
- Commander tax: casting from command, other zones, commander abilities and
  appropriate command-zone state-based choices. Preserve existing source identity
  and the tested Satoru cost/grant behavior while extending commander cases.

## Loop guardrails

Keep the existing finite-resource/shortcut requirements. A repeated heuristic
hash, fixed count of 5/25 iterations, or elapsed time is not sufficient evidence
to assign a rules draw, lock a human's source, or fabricate a win/loss.

The sample hash omits information needed to distinguish rules states: precise
object identity, pending choices/targets, relevant permissions/continuous-effect
expiry, remembered state, RNG and finite-resource effects among others. A hash
for CPU search pruning may be deliberately approximate, but it cannot become a
rules-terminal oracle. Privacy-filtered observations also cannot replace the
authority's full state for deciding rules equivalence.

A shortcut must be a chosen finite count validated by the engine, retaining
costs, triggers, restrictions and opponent interruption. Applying a numeric delta
without proving those conditions can skip mandatory choices and responses.
Follow the pinned engine's explicit shortcut contract where supported; validate
it with actual executable definitions and adversarial interrupted cases. The
existing three Basalt cycles remain finite-cycle evidence only.

Arena implementation and numeric behavior claims in the attachment remain
unverified. Fetch current primary rules and exact card text when converting each
entry to an actual engine test. None of these new compound cases is certified
merely because the earlier token, ninjutsu or counterspell fixtures passed.

This backlog must not delay the first complete account-facing Practice/Quick Play
slice by becoming another broad research-only milestone. Use representative
required interactions to prove the chosen eligible deck versions, then expand.
