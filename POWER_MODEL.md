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

`mtg-routes-v1` evaluates recognized combat/token, control, nonland-mana commander output and repeated creature-output routes. It does not simulate all Magic rules.

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

## Validation scope

Public tests use public card text and independent synthetic scenarios. Controlled damage/restoration checks cover compatible creature tokens, Kinnan hit eligibility, output prerequisites, costs/colors, optionality, missing details and incomplete preview/save/reopen flows. Existing frozen all-game reference benchmarks remain regression checks, not proof of broad metagame calibration. Pokémon and Yu-Gi-Oh! retain their existing strategic models; shared eligibility and unavailable-score presentation apply across games.
