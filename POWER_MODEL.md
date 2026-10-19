# Power evidence contract

## What the numbers mean

Power is a provisional heuristic estimate, not a measured win percentage. A complete, legal list is a prerequisite for an overall rating. An incomplete, illegal or unresolved list has `score: null`; structural diagnostics can remain available. Unknown mechanics are not automatically perfect or proven weak.

Magic separates:
- **Eligibility:** format size, copy limits, loaded legality, commander presence/eligibility, supported partner pairing and color identity.
- **Structure:** role, resource, curve and consistency diagnostics. These do not establish a winning plan.
- **Strategic estimate:** supported access, deployability, output, interaction and recovery.
- **Coverage:** partial or limited, with named unresolved capabilities.
- **Competitive reference evidence:** similarity to loaded placing lists, not tournament results for an untested list. A generic off-meta card-popularity proxy is not presented as Magic competitive Power.

A supported placing-list reference is not capped by an unrelated, incomplete strategic route parser. The reference blender retains its existing structural input; the strategic estimate remains visible separately. This avoids treating unmapped prowess, equipment or combo engines as disproven merely because a reference list has small printed bodies.

## Versioned strategic model

`mtg-routes-v1` evaluates recognized combat/token, bounded one-carrier Equipment, control, nonland-mana commander output and repeated creature-output routes. It does not simulate all Magic rules.

- Natural access uses exact finite-library probabilities at 11 drawn cards, or 18 for control-finisher access. These are versioned analysis windows, not predicted winning turns. Command-zone cards are not library draws.
- Expected-best available output preserves optionality: adding a useful optional body or expensive optional activation cannot dilute an unchanged stronger mode.
- Combat combines printed magnitude, rate and evasion with accessible printed pressure scaled continuously against format starting life. It is not a deployed-board or lethal-damage probability.
- Each optional mode keeps its own output, costs and activation colors. Body and unconditional ETB output can coexist; unsupported loyalty, sacrifice, counter-removal and variable output are not assumed free.
- Deployment checks expected resources and demonstrably absent colors. Conditional resources retain requirements. A Mox Amber cannot bootstrap a colored legend that cannot already be cast.
- Route execution combines access, deployment and output geometrically. Interaction and recovery contribute modestly, using feasible-cost access rather than raw role counts.
- Weights are 80% route execution, 12% early interaction and 8% recovery. A distinct backup has a bounded 8% opportunity contribution inside execution. These are disclosed model choices, not established competitive calibration.
- Ranking uses unrounded values. Display scores are rounded. Unsupported estimates are not ranked as numeric zero.

Limitations include shared mana budgets across several spells, exact colored-pip probabilities, fetch sequencing, mulligans, tutoring, cost reductions, alternative wins, unknown combos, opposing decisions and full disruption recovery. Low coverage requires review; it is not proof that the deck has no valid plan.

## Effect and goal constraints

Timing text such as “Activate only as a sorcery” is not a spells theme. Typal retrieval and support distinguish actual creature type, compatible token production, changeling/type conversion and separate nontribal support. Filtering is not net acceleration. Noncreature or opponent-owned tokens do not satisfy owned-creature-token payoffs. Self-transform is not general blink.

Constructed Magic evidence distinguishes casting from cycling/channel/activated costs, temporary interaction from hard answers, and printed bodies from conditional abilities. Text length is not card quality. Simplified solitaire output does not validate a real winning turn; its unmodeled abilities are disclosed.

Strongest, theme, fun, chaos and intentionally weak are distinct goals. Legality, identity, budget, required/excluded cards and colors remain deterministic constraints. Subjective fit is an explained review judgment, not a fabricated fun/chaos score. Automatic strength optimization cannot silently replace subjective intent.

The existing AI tool loop permits at most two proposals. The app validates the first and returns specific repair failures, caches unchanged reads, guards cancellation/account/deck/collection versions, and exposes a reviewable preview. No autosave and no AI request on ordinary clicks. Unknown prices remain unverified; no implicit $25 cap and no fabricated free basic lands.

Optional coaching samples the initial hand, not the post-draw window used by some Power diagnostics. The shared client/server hand profile distinguishes Speed Duel's initial4 and first-turn4/5 from GOAT's initial5 and first-turn6/6. TCG/Traditional use initial5 and first-turn5/6; other YGO coaching profiles remain unresolved until their draw rules are explicitly sourced, rather than inheriting a modern default. The server derives these values from the selected format, checks sample size/zone/copies, and does not trust supplied profile numbers. YGO has no normal mulligan. Pokémon setup distinguishes a mandatory no-Basic redraw from a weak but Basic-containing hand, with unknown setup remaining unresolved; Magic retains its own keep/mulligan assessment. These are bounded context checks, not complete setup or gameplay validation.

## Validation scope

Public tests use public card text and independent synthetic scenarios. Controlled damage/restoration checks cover compatible creature tokens, Kinnan hit eligibility, output prerequisites, costs/colors, optionality, missing details and incomplete preview/save/reopen flows. Existing frozen all-game reference benchmarks remain regression checks, not proof of broad metagame calibration. Pokémon and Yu-Gi-Oh! retain their existing broad strategic models with the bounded capability corrections below; shared eligibility and unavailable-score presentation apply across games. These are not newly calibrated all-game battle models.

## Commander availability and recast scenarios

The existing Power panel includes a collapsed Commander availability check. It reruns the same supported library-route model with commander battlefield/casting benefits unavailable while retaining the original library size and all declared commander color identities. Command Tower does not lose identity-based colors merely because a commander is absent. Explicit commander-required library clauses are disabled; printed bodies and other independent abilities remain. A card can have both independent usefulness and a commander-linked benefit. Unmapped support is not labeled dead.

This diagnostic does not impose an automatic dependency penalty or predict survival. It lists normal printed casting-cost scenarios with zero, one or two previous command-zone casts, adding generic {0}, {2}, or {4}. Prior casts, not the number of removals, determine tax. Partners are tracked separately. Alternative command-zone casting costs still incur tax, but reductions, variable costs, noncasting entry methods and casting from other zones need separate review. See [Wizards Commander format rules](https://magic.wizards.com/en/formats/commander) and [Commander Masters release notes](https://magic.wizards.com/en/news/feature/commander-masters-release-notes).

This is not a turn sequence, protection-target check, post-wipe recovery simulation or removal-frequency model. Unmapped static commander bonuses, named synergies and secondary commander abilities remain partial. The main estimate is unchanged by the counterfactual; it is inspectable context, not a second win-probability number.

## Cross-game goal scope

The new goal-aware proposal, deterministic validation and one-correction path is implemented for Magic. Pokémon and Yu-Gi-Oh! retain existing strongest/default seed or type handoffs into their manual builders; non-strongest goals and unsupported explicit constraints require review rather than silently becoming strongest. This release does not claim automatic fun Fire Pokémon construction, combined Blue-Eyes/Dark Magician goal validation, or new all-game strategic understanding. Verified basic-land purchase accounting is Magic-specific; existing other-game accounting is not newly validated by this patch.

## Important unmodeled conversion guard

A numeric combat/control component is not an overall verdict when an explicitly evidenced central spell engine is outside the model. The bounded guard requires an explicit Spells commander plan supported by a majority of nonland library copies, a non-answer storm output, and mass spell recursion. A storm answer such as Flusterstorm, recursion alone, or an optional unmapped commander does not trigger it. Only a selected, independently modeled resource-output plan can exempt the guard; one weak optional outlet cannot claim coverage of the central spell engine. This is a coverage detector, not proof of a winning combo and not a storm power estimate.

When this conjunction is present, overall strategic Power is unavailable. Named card evidence and missing storm-copy output, graveyard fuel/recasting and spell-cost sequencing remain visible, along with clearly labeled partial-route diagnostics. Loaded competitive placing-list evidence remains a separate source; the parser does not invent a replacement numeric score. The guard is deliberately bounded and does not establish coverage for every unmodeled archetype or format.


## Bounded Equipment and known-no-output coverage

Equipment uses actual fixed equipped-creature stats and direct keywords, a compatible distinct physical carrier, casting colors/costs and an explicit equip/attach mode. Printed full-cost equip remains available when an optional reduction is unmodeled. Granted activated/triggered text cannot donate free stats or keywords. Metalcraft checks actual accessible artifacts, including artifact lands with a land-play/sequencing caveat. One best coherent arrangement is assessed; overlapping alternatives are not summed. Tutors, stacking, reconfigure, cloak, variable bonuses and full sequencing remain unresolved.

A no-route result is not automatically unknown or zero. Only a fail-closed full-text classifier can identify a loaded list made entirely of conservative nonclosing primitives: basic/mana-only production, land-only search, own card draw, creature-only answers and carrierless support Equipment. Unconsumed text, alternate faces, player damage, mill, non-land tutoring, recursion or alternate wins remain unknown. A fully covered nonclosing list has execution0 and only the existing feasible interaction/recovery contributions, with “No closing plan found.” This is not a prediction of zero wins. Adding an actual carrier/finisher restores a route; adding unknown conversion restores unavailable status.

## Important Aura coverage and solitaire legality

A bounded coverage guard recognizes a central positive creature-Aura package with compatible carriers and explicit enchantment-count scaling or enchantment-entry counter output. It requires multiple positive Aura names, a majority of nonland copies in the linked package, and positive Auras making up at least half that package. One optional Aura, generic enchantment density, opponent-only Auras, a payoff without providers or a Role-heavy body plan with two incidental Auras is insufficient. These are disclosed coverage-detector choices, not calibrated strength thresholds. Its attachment, scaling, entry-counter, Role and layered combat output remain unmodeled; overall strategic Power is unavailable while supported printed-body components remain diagnostic. Conditional flying is not intrinsic evasion.

The simplified goldfish cannot cast a creature Aura without a legal modeled target. Unsupported target restrictions are skipped and disclosed. This legality guard does not implement Aura stat scaling, Role replacement, every granted ability or realistic combat. The model is still not a winning-turn forecast.

## Format eligibility and cross-game capability scope

All35 exposed profiles remain visible. The frozen reference population covers only five formats: Magic Standard, Modern and Commander; Pokémon Standard; and Yu-Gi-Oh! Advanced TCG. The other30 do not acquire reference calibration by reusing generic tests. None of these regression checks establishes empirical Power-scale or win-rate calibration.

- Magic: Limited uses the unused pool rather than a15-card cap. Oathbreaker remains unavailable until a Signature Spell can be represented and verified. Commander-family outside-deck roles remain unresolved rather than blanket-banning Companions. Standard Brawl's colorless-commander exception permits one basic land type under CR903.12e; this is not blindly transferred to Arena100 Brawl. Duel Commander uses its own declared reference feed.
- GLC: independently versioned organizer rules/bans replace Expanded substitution. Common-type intersection, singleton/shared-name rules, Rule Box and ACE SPEC exclusions, printing-specific bans and unresolved reprints are checked. Inapplicable four-of and ACE SPEC checklist weights are omitted; evolution copy targets respect singleton. This is rule-consistent structure, not a calibrated GLC strategy model.
- Speed Duel: six Extra/Side cards and optional initial Skills follow the sourced baseline. Declared unsupported Skill state remains unresolved; physical logos and event-specific lists are not certified by provider pool membership. GOAT uses uncapped original Main/Fusion size and six-card first-turn scenarios; intermediate Side sizes retain variant uncertainty. Edison, Master Duel and Duel Links still lack required ban-list coverage.
- Pokémon: Special Energy is not automatically every type. Printed production and known recipient restrictions are checked; unknown conditions remain explicit. Conditional attack bonuses no longer receive a fabricated50% chance. Printed two-/three-Prize liability is visible, not an arbitrary penalty or predicted prize race. Other scaling, sequencing and matchup assumptions remain provisional.
- Yu-Gi-Oh!: search effects require a recognized opening activation mode and a matching target. Impossible or unresolved prerequisites do not count as independent opening starters. This does not solve complete combos, shared Normal Summons, all costs or interruption. Format hand windows do not calibrate the existing role weights.

The benchmark reports executed, asserted, skipped and failed cases separately. Held-out-reference cases are actually asserted, null cannot satisfy a numeric band as zero, and unchanged/source-invalid cases have explicit reasons. Thresholds were not retuned to make the new model pass. Rule/coverage regressions, reference overlap and empirical battle calibration remain distinct.
