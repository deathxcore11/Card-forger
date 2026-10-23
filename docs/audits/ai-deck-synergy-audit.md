# CardStashy AI and deck construction audit

Source: production release merge `5b98a8981f9b97e7e0c4fbc02847b0cc3f248876`, web 3.93.2 / Android 0.5.2 shared-source baseline. Audit branch: `codex/ai-deck-synergy-audit`. No production module, foil file, saved deck, account, APK, or deployment was changed.

## Verdict

The app has substantial construction and safety infrastructure. It is capable of assembling real, format-checked lists and refusing many unsupported requests. It has **not established professional deck-design quality**, and reproduced gaps prevent claiming that it reliably fulfills an arbitrary strategic request.

The largest weakness is not the absence of Cat/Angel labels. It is inconsistent interpretation of rules and preferences between the request contract, candidate selector, pairing graph and final acceptance gate. A legal list and a useful strategic plan are separate achievements.

## What the current system does

The language model interprets chat into a bounded `build_deck` call. The active app passes that call through `createDeckExperience` and `createDeckPipeline`; Magic construction calls `prepareMtgDeck` and the existing deterministic `buildDeck`. Scryfall provides card records. The builder searches bounded theme/role pools, ranks candidates, fills roles/lands, and generates budget variants. The pipeline checks exact lists and compares assessed candidates. The player must save explicitly.

Important: the active app uses the shared pipeline branch in `ai-tools.js`, not only the older direct `prepareMtgDeck` branch. Auditing only the older branch would miss the current budget/ready semantics.

Good existing foundations:

- Real card resolution, format/copy/color checks, commander validation, required/excluded exact cards, ownership accounting and unknown-price handling.
- Bounded AI tool execution, stale-request/account/workspace guards and explicit save.
- Creature-type parsing, Cat/Angel tribal payoffs and changeling recognition in `planner.js`.
- Effect-aware token ownership, blink targets, conditional/net mana and command-zone access in `mtg-effects.js` and the engine graph.
- Distinct structure, plan and coverage diagnostics in Commander analysis, with explicit uncertainty.
- A separate Magic matchup feature accepting actual lists and dated source context. It is not connected to the Ask build request as an opponent-aware construction objective.
- Community role-tag supplements exist (`mtg-tags.json`, dated 2026-10-15). They supplement removal/counter/wipe/draw/ramp/discard; they are not a complete strategic rules database.

## Taxonomy must keep different concepts separate

| Example | Correct dimension | Existing source |
| --- | --- | --- |
| Legendary | Supertype | Scryfall `type_line` |
| Creature, Artifact, Instant | Card type | `type_line` |
| Cat, Angel, Human | Subtype | `type_line` / individual faces |
| Flying, Lifelink | Keyword ability | `keywords` and Oracle wording |
| Rewards another Cat attacking | Conditional payoff | Oracle clause, controller, event, target and cost |
| Gains life when an Angel enters | Conditional life-gain provider | Oracle event and resulting effect |

A shared label does not prove synergy. An Angel can be an irrelevant expensive body; a non-Angel can be essential interaction. Lifelink is one way to gain life, not an interchangeable description of every life-related card.

Primary references: https://scryfall.com/docs/api/cards and https://magic.wizards.com/en/keyword-glossary .

## Ranked demonstrated gaps

### 1. User preferences can disappear before construction

`ai-build-contract.js` protects a fixed `THEMES` regex that includes Angels but omits Cats and Lifelink. The actual production contract accepts a model proposal changing a mono-white Modern Cats request to `style: artifacts`. It also accepts dropping Lifelink from a request for Angels and Lifelink while retaining Angels. `builder.requestedIntent('Cats')` does recognize Cat later; the problem is the missing protection before that point.

This is a guardrail failure if the model drops the preference, not evidence that the live model drops it every time. “white Modern deck” is also not captured as an explicit white color restriction by the current narrow parser, unlike “mono-white”.

Small first correction: carry the user's explicit requested subtypes and abilities through the existing contract, with provenance and negation handling, and validate them at the final-result boundary. Avoid replacing a short theme regex with a claim to understand unrestricted natural language.

Relevant modules: `ai-build-contract.js`, `ai-ask-loop.js`, `builder.js`.

### 2. The success gate does not establish adequate requested-theme support

A controlled test ran the actual complete construction/assessment/selection pipeline with real Arahbo and Leonin Vanguard records, synthetic prices, synthetic generic fillers, and a mocked thin discovery pool. It returned:

- 100 cards, loaded legality checks passed, within the $700 reference target.
- One noncommander Cat in the entire library.
- No final plan issues.

This does not prove that live Scryfall searches normally produce this list, nor that every Cat deck needs a fixed universal Cat count. It proves that final “complete/checked” acceptance does not establish that the requested Cat plan has adequate access/support. One particular supporting library card has only an 11/99 chance to appear among the first 11 naturally seen cards, before searches or extra draws.

`inspectDeckPlan` checks Magic land quantity and whether colors have a land source, then exact required/excluded cards. It does not enforce the requested theme's functional prerequisites or access targets. Commander criteria can describe recognized or missing routes, but final construction acceptance does not require a strategically adequate plan.

Upgrade: define a plan and its actual prerequisites before selecting cards, then assess supported enablers, payoffs, costs and access probabilities. Provide a qualified/partial result when the loaded pool cannot satisfy it. Keep essential off-theme interaction; do not impose one tribal percentage on every deck.

Relevant modules: `deck-construction.js`, `deck-pipeline.js`, `commander-criteria.js`, `engine-map.js`.

### 3. Rules semantics disagree across subsystems

Unmodified Scryfall records reproduce:

| Card / case | Observed result | Why it matters |
| --- | --- | --- |
| Tainted Remedy | `themeSupport` calls it Lifegain support; `scoreCard` adds 3 life-theme points | It changes opponents' life gain into loss. This does not establish that it provides your life-gain events. It may belong in a different, deliberately chosen plan. |
| Righteous Valkyrie | Pairing provides no `lifegain` tag | Its variable life-gain effect is missed by the narrow numeric provider pattern. |
| Righteous Valkyrie | Pairing needs `sub:Cleric`, omits `sub:Angel` | The “Angel or Cleric” alternative is reduced incorrectly by the pairing regex. Commander inference recognizes both. |
| Changeling Outcast | Tribal helper accepts it as Cat; pairing provides only Shapeshifter | Construction and displayed dependencies disagree about the same type-changing ability. |

These are bounded semantic failures, not proof that the entire effect parser is naive. The existing `mtg-effects` system already handles several harder cases correctly and should be extended, not discarded.

Upgrade: share evidence-backed mechanical descriptors between selection, pairing and scoring. Include subject/controller, action/event, target/type alternatives, conditions, costs, limits and source Oracle identity/hash. Keep unsupported effects explicit. Add counterexamples whenever a new recognizer is introduced.

### 4. The engine graph can show support while overlooking self-interference

With Soul Warden, Ajani's Pridemate, Hushbringer and Torpor Orb in the tested list, the graph still lists Soul Warden as a life-gain provider for Pridemate with no blocker condition, and the inspected Magic plan raises no self-interference issue. Hushbringer/Torpor Orb suppress the creature-entering trigger while present.

This does not mean the deck can never function: sequencing/removal and Hushbringer's own Lifelink can matter. It means the displayed relationship omits an important condition and the builder does not surface this conflict. The same general risk exists for “cannot gain life”, graveyard replacement, casting restrictions and incompatible resource engines; those additional classes require their own tests.

Upgrade: identify common self-conflicts and conditional support. Distinguish unconditional, conditional and blocked links. Avoid pretending that a handful of checks is a complete Magic rules simulator.

### 5. Budget target and hard spending cap are conflated

The shared policy deliberately treats the entered number as a target. It permits 10% overage capped at $5, and if no candidate meets the target it can return a complete, over-budget list with `budgetStatus: outside-target`. A direct selection diagnostic returned `ok: true` for a $900 candidate against a $700 request. The active Ask wrapper returns `ready: true` / `complete: true` whenever the shared result is `ok`, including that outside-target status.

The UI does disclose overage and unknown prices. Thus this is not proof of a hidden checkout cost or a wholly missing budget system. It is a semantic mismatch for a chat request saying “under $700” or a strict maximum. “Ready” is not “all requested constraints verified”.

Upgrade: preserve **hard cap** versus **flexible target** as distinct user choices. A hard cap must never be relaxed automatically. Give legal-complete, budget-verified and theme-verified separate result fields and an aggregate request-satisfied status. Keep unknown quotes unknown.

Relevant modules: `ai-build-contract.js`, `deck-construction.js`, `ai-tools.js`, `deck-experience.js`.

### 6. “Build against this opponent” has no connected construction contract

`build_deck` has no opponent ID, list, source date, matchup mode or sideboard objective. `my_decks` returns summaries rather than full lists to Ask; `meta_decks` returns archetype summaries. The separate matchup route does accept actual player/opponent lists and official rule excerpts, but the generic construction path does not use that request.

A color alone does not identify an opposing strategy: mono-black aggro, discard, sacrifice and control present different problems. Current generic construction cannot substantiate “this list is tuned against that exact black deck” from the build tool's data.

Upgrade: connect to the existing matchup feature. Resolve the actual opponent list or choose a dated source; establish format and best-of-one/best-of-three; derive relevant threats and legal answers; assess requested swaps against both budget and plan integrity. If only a color is provided, disclose assumptions or request the missing matchup choice. Do not fabricate matchup win rates.

### 7. Candidate search is bounded but strategically narrow

`prepareMtgDeck` searches each theme/role query once, takes the first response page (up to 175 entries), and requests EDHREC order even for 60-card formats. It ignores `has_more` / `next_page`. The controlled fixture supplied a next-page marker; no second page was requested. The tests intentionally mock discovery and do not measure search relevance.

The builder uses real card records, so this is not imaginary-card generation. It can still miss the relevant package because the retrieval pool is incomplete or ranked for a different format. Greedy role/subtype/curve weights and cheap completion can then produce a complete list from the wrong pool.

Upgrade: bounded role-specific discovery with coverage targets, format-relevant ranking, needed effect/ability queries and selective paging. Use existing tournament lists as dated references where appropriate, not as proof that every modified list remains competitive. Measure missing essential packages rather than trying to load the whole catalogue per request.

### 8. Default ownership priority can outrank assessed strength

`normalizeDeckRequest` defaults `preferOwned` true. Within a budget class, `chooseDeck` compares owned share before `comparePower`. A controlled comparator diagnostic selected the higher-owned candidate despite a lower supplied Power assessment.

Using owned cards first is a legitimate preference when the player selects it. This observation is not a calibrated 90-versus-20 real deck result. The concern is silently applying that priority to “strongest for $700” when the player intended strength within a whole-deck budget.

Upgrade: make the objective explicit: strongest within cap, minimize purchases, theme-first, or simpler plan. Report tradeoffs. Do not substitute an internal heuristic score for competitive evidence.

## What would materially improve the product

1. **Request fidelity and honest result gates first.** Preserve subtype/ability requirements and hard caps; separate complete/legal/priced/on-plan verdicts. This is the smallest first patch with clear regression tests.
2. **Unify and extend the existing effect evidence.** Start with life gain/Lifelink, type alternatives/changeling, common trigger blockers and enabler/payoff direction. Reuse `mtg-effects`, the planner and engine map. Do not create another disconnected label system.
3. **Plan-aware candidate generation and optimization.** Choose an executable package, mana/curve/access requirements and a closing route; search missing pieces; compare bounded alternative packages. Preserve uncertainty for mechanics not modeled.
4. **Connect exact opponent analysis.** Reuse the existing matchup context and dated meta feeds; support sideboard objectives in the correct formats. “Black” is not an archetype and a qualitative review is not a measured win rate.
5. **Independent quality evaluation.** Use held-out real-card requests, deceptive rules counterexamples, actual live model interpretation and blind experienced-player review. Compare constrained outputs against suitable baseline lists. Existing unit tests mostly prove safeguards and deterministic behavior, not tournament strength.

## Proposed acceptance examples

- Mono-white Cats, mono-red Goblins, Angels plus Lifelink, and unlisted subtypes: the original request survives interpretation and follow-ups.
- “Under $700” never produces a success claiming compliance above $700 or with unknown required prices. A flexible target may show a clearly labeled alternative.
- Variable life gain and “Angel or Cleric” alternatives are represented correctly; opponents' life events receive the correct direction.
- Changeling agrees across construction, graph and explanation, with the proper zone/ability conditions.
- Hushbringer/Soul Warden shows a conditional/conflicting route; removing the blocker updates the explanation.
- A thin candidate pool produces a qualified result rather than asserting that a theme's plan is fulfilled.
- Two actual mono-black opponents with different plans lead to evidence-specific recommendations, or a clear explanation when the same package remains suitable. No unsupported win-rate claim.
- Opening access/curve checks reflect the exact list, quantities, command zone and available mana. They are not a complete game simulation.

## Verification and limits

Executed the diagnostic `node scripts/audit-deck-synergy.mjs`. Observed values are saved in `ai-deck-synergy-observations.json`. It runs production modules unchanged, disallows network, and retains 12 unmodified Scryfall records with source IDs and SHA-256 hashes. Its synthetic fillers, discovery responses, assessment values and prices are labeled in code/report. The assertions deliberately reproduce present behavior; they are not passing acceptance tests for the proposed upgrades.

Existing checks completed with passing output:

- `test-ai-goal-handshake.mjs`
- `test-ai-deck-build.mjs`
- `test-shared-deck-flow.mjs`
- `test-power-commander-intent.mjs`
- `test-mtg-effects.mjs`
- `test-magic-matchups-controller.mjs`

These establish meaningful existing safeguards and integration behavior. They do not refute the reproduced counterexamples. The actual-app browser AI test explicitly mocks model and provider responses and states that typo interpretation itself is not evaluated.

**Not tested:** live authenticated production model prompts, current provider/model configuration, actual $700 market optimization, current tournament competitiveness, physical Android UI/performance, independent expert playtesting, or every game/format. The deep semantic probes here concern Magic; shared request/result observations also affect common infrastructure. No professional-strength or whole-catalogue verification claim is justified.

## Smallest first patch recommendation

Fix the request contract and final verdict boundary before changing scoring weights: preserve Cat/Lifelink preferences, distinguish strict spending caps from flexible targets, and retain explicit theme/budget validation states in Ask's result. Introduce failing regressions for the reproduced cases, then repair those specific paths. Next repair the evidenced life-gain/alternative-type/changeling semantic disagreements and self-conflict disclosures. Keep matchup construction as a separately reviewable capability rather than claiming it works because a matchup review screen exists.

This audit implements no such production fix yet. It records falsifiable examples and an upgrade order. Rollback of the audit itself is deletion/reversion of its docs, diagnostic script and retained fixtures; the production source is unchanged.
