# Forge CPU source findings for CardStashy Play

## Scope and source pin

Read-only reference study of Card-Forge/forge at commit
[`4ddcfe30639ce59e17b2248f9f0d1b51f4fd328c`](https://github.com/Card-Forge/forge/commit/4ddcfe30639ce59e17b2248f9f0d1b51f4fd328c),
the observed `master` head on 2026-10-25, committed 2026-10-24 at 20:45:51 UTC.
No Forge code was imported or executed. This document records observed source
behavior and independently authored future requirements; it does not measure CPU
strength or propose replacing CardStashy's rules engine.

The repository's [LICENSE](https://github.com/Card-Forge/forge/blob/4ddcfe30639ce59e17b2248f9f0d1b51f4fd328c/LICENSE)
contains GPL version 3. The
[AiAttackController header, lines 5–8](https://github.com/Card-Forge/forge/blob/4ddcfe30639ce59e17b2248f9f0d1b51f4fd328c/forge-ai/src/main/java/forge/ai/AiAttackController.java#L5)
explicitly permits GPL version 3 or later. Treat source reuse as a license review
constraint. The requirements below describe behavior to implement independently,
without copying Forge implementation code.

## Observed decision paths

### Combat

`PlayerControllerAi.declareAttackers` delegates to `AiController`, which creates an
`AiAttackController`, arms a deadline, requests attackers, removes attackers whose
attack costs cannot be paid, and validates or repairs the final declaration.
Sources: [PlayerControllerAi.java:839–845](https://github.com/Card-Forge/forge/blob/4ddcfe30639ce59e17b2248f9f0d1b51f4fd328c/forge-ai/src/main/java/forge/ai/PlayerControllerAi.java#L839),
[AiController.java:1368–1420](https://github.com/Card-Forge/forge/blob/4ddcfe30639ce59e17b2248f9f0d1b51f4fd328c/forge-ai/src/main/java/forge/ai/AiController.java#L1368).

The attack policy compares forces and life pressure, chooses an aggression level,
holds back creatures needed as blockers, then calls `shouldAttack` and the rules
attack check before adding each attacker to combat. Inputs include predicted
kills and survival, first strike, evasion, trample, combat effects, creature value,
and useful tap abilities. Profile probabilities affect willingness to trade.
Sources: [AiAttackController.java:1260–1335](https://github.com/Card-Forge/forge/blob/4ddcfe30639ce59e17b2248f9f0d1b51f4fd328c/forge-ai/src/main/java/forge/ai/AiAttackController.java#L1260),
[1517–1600](https://github.com/Card-Forge/forge/blob/4ddcfe30639ce59e17b2248f9f0d1b51f4fd328c/forge-ai/src/main/java/forge/ai/AiAttackController.java#L1517).
These are heuristic choices, not evidence of optimal combat.

### Target, mana, and committed action

The ordinary heuristic path sorts spell abilities and stops at its first approved
play. `canPlayAndPayFor` determines targets and X before testing dependent costs,
timing, and restrictions. The ability API dispatches damage decisions to
`DamageDealAi`. Its burn policy compares player damage with killable creature
targets, accounts for predicted prevention, and filters creatures already expected
to die; it can reserve mana for a second damage spell.
Sources: [AiController.java:2108–2217](https://github.com/Card-Forge/forge/blob/4ddcfe30639ce59e17b2248f9f0d1b51f4fd328c/forge-ai/src/main/java/forge/ai/AiController.java#L2108),
[878–995](https://github.com/Card-Forge/forge/blob/4ddcfe30639ce59e17b2248f9f0d1b51f4fd328c/forge-ai/src/main/java/forge/ai/AiController.java#L878),
[SpellApiToAi.java:77](https://github.com/Card-Forge/forge/blob/4ddcfe30639ce59e17b2248f9f0d1b51f4fd328c/forge-ai/src/main/java/forge/ai/SpellApiToAi.java#L77),
[DamageDealAi.java:253–277](https://github.com/Card-Forge/forge/blob/4ddcfe30639ce59e17b2248f9f0d1b51f4fd328c/forge-ai/src/main/java/forge/ai/ability/DamageDealAi.java#L253),
[328–358](https://github.com/Card-Forge/forge/blob/4ddcfe30639ce59e17b2248f9f0d1b51f4fd328c/forge-ai/src/main/java/forge/ai/ability/DamageDealAi.java#L328),
[607–657](https://github.com/Card-Forge/forge/blob/4ddcfe30639ce59e17b2248f9f0d1b51f4fd328c/forge-ai/src/main/java/forge/ai/ability/DamageDealAi.java#L607),
[DamageAiBase.java:88–103](https://github.com/Card-Forge/forge/blob/4ddcfe30639ce59e17b2248f9f0d1b51f4fd328c/forge-ai/src/main/java/forge/ai/ability/DamageAiBase.java#L88).

Execution proceeds from `PlayerControllerAi.playChosenSpellAbility` through
`ComputerUtil.handlePlayingSpellAbility`, computer cost payment, and stack
addition. Mana cost payment calls back into the controller, which delegates to
`ComputerUtilMana`. It spends floating mana first, prioritizes scarce colored
requirements, distinguishes test payments from actual activations, and prepays
filter activation without consuming the last source of another required color.
Sources: [PlayerControllerAi.java:854–860](https://github.com/Card-Forge/forge/blob/4ddcfe30639ce59e17b2248f9f0d1b51f4fd328c/forge-ai/src/main/java/forge/ai/PlayerControllerAi.java#L854),
[ComputerUtil.java:83–135](https://github.com/Card-Forge/forge/blob/4ddcfe30639ce59e17b2248f9f0d1b51f4fd328c/forge-ai/src/main/java/forge/ai/ComputerUtil.java#L83),
[CostPartMana.java:161–175](https://github.com/Card-Forge/forge/blob/4ddcfe30639ce59e17b2248f9f0d1b51f4fd328c/forge-game/src/main/java/forge/game/cost/CostPartMana.java#L161),
[PlayerControllerAi.java:1258–1259](https://github.com/Card-Forge/forge/blob/4ddcfe30639ce59e17b2248f9f0d1b51f4fd328c/forge-ai/src/main/java/forge/ai/PlayerControllerAi.java#L1258),
[ComputerUtilMana.java:618–663](https://github.com/Card-Forge/forge/blob/4ddcfe30639ce59e17b2248f9f0d1b51f4fd328c/forge-ai/src/main/java/forge/ai/ComputerUtilMana.java#L618),
[777–836](https://github.com/Card-Forge/forge/blob/4ddcfe30639ce59e17b2248f9f0d1b51f4fd328c/forge-ai/src/main/java/forge/ai/ComputerUtilMana.java#L777),
[931–998](https://github.com/Card-Forge/forge/blob/4ddcfe30639ce59e17b2248f9f0d1b51f4fd328c/forge-ai/src/main/java/forge/ai/ComputerUtilMana.java#L931),
[1260–1270](https://github.com/Card-Forge/forge/blob/4ddcfe30639ce59e17b2248f9f0d1b51f4fd328c/forge-ai/src/main/java/forge/ai/ComputerUtilMana.java#L1260).

## Privacy, randomness, and time limits

Optional Monte Carlo refinement compares a capped set of heuristic-approved
plays, with optional pass, using capped rollouts and playout lengths plus soft
decision and turn budgets. It seeds simulations and reshuffles hidden hand and
library slots in copied games while preserving visible cards and zone sizes.
Sources: [FlatMonteCarloPicker.java:35–53](https://github.com/Card-Forge/forge/blob/4ddcfe30639ce59e17b2248f9f0d1b51f4fd328c/forge-ai/src/main/java/forge/ai/simulation/FlatMonteCarloPicker.java#L35),
[116–131](https://github.com/Card-Forge/forge/blob/4ddcfe30639ce59e17b2248f9f0d1b51f4fd328c/forge-ai/src/main/java/forge/ai/simulation/FlatMonteCarloPicker.java#L116),
[391–403](https://github.com/Card-Forge/forge/blob/4ddcfe30639ce59e17b2248f9f0d1b51f4fd328c/forge-ai/src/main/java/forge/ai/simulation/FlatMonteCarloPicker.java#L391),
[1060–1072](https://github.com/Card-Forge/forge/blob/4ddcfe30639ce59e17b2248f9f0d1b51f4fd328c/forge-ai/src/main/java/forge/ai/simulation/FlatMonteCarloPicker.java#L1060),
[HiddenInfoShuffler.java:37–87](https://github.com/Card-Forge/forge/blob/4ddcfe30639ce59e17b2248f9f0d1b51f4fd328c/forge-ai/src/main/java/forge/ai/simulation/HiddenInfoShuffler.java#L37).
This observed protection is not a fairness audit of every AI path, and pooling
actual hidden cards still supplies deck-composition information. A separate,
option-gated mana-smoothing shuffle exists at
[AiController.java:2676–2716](https://github.com/Card-Forge/forge/blob/4ddcfe30639ce59e17b2248f9f0d1b51f4fd328c/forge-ai/src/main/java/forge/ai/AiController.java#L2676).

The shared priority deadline can cause passing, while combat retains or repairs
partial decisions. It is cooperative, not a demonstrated hard wall-clock bound:
the evaluation cleanup cancels, joins for up to two seconds, then attempts a
`Thread.stop` fallback that comments identify as unsupported on some runtimes.
Sources: [AiController.java:1431–1453](https://github.com/Card-Forge/forge/blob/4ddcfe30639ce59e17b2248f9f0d1b51f4fd328c/forge-ai/src/main/java/forge/ai/AiController.java#L1431),
[2246–2265](https://github.com/Card-Forge/forge/blob/4ddcfe30639ce59e17b2248f9f0d1b51f4fd328c/forge-ai/src/main/java/forge/ai/AiController.java#L2246).

## Future actual-engine acceptance cases

These cases are independently authored and **not executed**. They are proposed
tests through CardStashy's real game engine and CPU action application, not mock
candidate-list tests or claims of observed Forge outcomes. Unless stated, no
other permanents, modifiers, replacement effects, prevention, or responses exist;
all relevant creatures have been controlled since before the turn began.

| Case | Engine setup | Required behavior and resolved result |
| --- | --- | --- |
| Free lethal attack | Opponent at 5 life, no blockers; CPU has untapped Centaur Courser (3/3) and Grizzly Bears (2/2); CPU declare-attackers step. | Declare both against the opponent. Actual combat resolves for lethal damage. |
| Avoid losing a creature for no gain | Both players at 20 life; CPU has untapped Grizzly Bears (2/2); opponent has untapped Centaur Courser (3/3); empty stack and hands; CPU declare-attackers step. | Declare no attackers. The engine advances combat without losing the Bears. |
| Choose burn lethal | Opponent at 3 life and controls a vanilla 5/5; CPU holds Lightning Bolt, controls an untapped Mountain, and has priority. | Cast Bolt targeting the opponent, pay once, and resolve lethal damage. Do not spend the spell on the 5/5. |
| Filter mana without consuming unique blue | CPU at 3 life, holds Counterspell, controls untapped Forest, Island, and Izzet Signet; no floating mana. Opponent's Lightning Bolt targeting the CPU is on the stack and CPU has priority. | Tap Forest to pay for Izzet Signet's `{1}, {T}: add {U}{R}` ability; preserve Island, then tap it for `{U}`. Pay Counterspell's `{U}{U}` using Signet's blue and Island's blue, target Bolt, and resolve the counter. Forest, Island, and Signet are tapped; one red remains immediately after payment; Bolt is countered and CPU remains at 3 life. |

Common requirements for these future cases:

- Validate every proposed and committed action with the engine's legality and
  cost checks. Membership in a capped candidate list is not a legality test.
- Verify payment and zone/life changes after action application and resolution;
  hypothetical evaluation must not consume real resources or mutate the game.
- For the same public observation, own hand, permitted knowledge, and seed,
  substituting unobserved opponent hand/library cards must not change the CPU's
  chosen action. Any probabilistic belief model must use permitted inputs.
- Exhausting a work budget must return an engine-validated pass when legal, or
  an engine-validated completion of required decisions. Optional search caps must
  not suppress mandatory legal actions or leave partial state mutations.
