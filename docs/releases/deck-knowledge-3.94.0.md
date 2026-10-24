# Deck knowledge and card discovery — website 3.94.0

Baseline: PR #40 merge `0f5eaf83631928eff1b261986deb3202ed7f7022` (web 3.93.3 / Android 0.5.3). Website feature source: `9444e606b1463c9e64059943b92558ba67752969`; release branch: `codex/deck-knowledge-web-release`. Foil renderers, masks, movement and materials are unchanged.

This is a **website-only release** for online testing. The published Android 0.5.3 beta (versionCode 12) keeps its bundled 3.93.3 interface, exact signed APK, checksum, download metadata and native source manifests. No 0.6.0 APK is published or advertised. The current-release endpoint reports the new website and the retained Android version separately, so an installed 0.5.3 app receives release notes without a false APK update. See [website and Android release cadence](web-and-android-cadence.md).

## Result and scope

Request preservation, spending policy, recognized strategic support and card explanations use the existing construction, planner, effect, graph, rules and Search infrastructure. A complete legal deck is no longer presented as evidence that all preferences or strategic strength have been established.

- The dated Scryfall vocabulary snapshot supplies 365 creature types and 223 keyword abilities, plus action/ability-word vocabulary. A catalog name establishes recognition, not full mechanical modeling. Source URLs, retrieval date and response hashes are retained in `mtg-vocabulary.js`.
- Explicit supported subtype/keyword requests survive model omissions. Recognized directives such as “only Angel creatures” and “without Angels” also become type restrictions, distinct from a tribal preference. Noncreature support spells remain permitted by an Angel-only creature restriction. Unknown prose remains reviewable, not verified.
- Deck generation reuses the existing animated CardStashy-logo progress pop-up, with live status and cancellation. Manual and Ask builds yield a browser paint before cached analysis, and Ask progress lives inside its active dialog’s top layer. Cancelled/closed builds cannot replace a newer view. Completion opens the deck automatically; failures restore the setup and choices. Budget rebuilds use the same progress presentation. Generated manual/Ask results use the existing artwork header, ownership summary, reference-printing badges and readable compact deck rows. Save and compact branded AI review are at the top, followed by a blank “Rebuild with budget” field; blank input cannot silently remove a spending cap. Longer plan/check details are below the cards. Generated results remain clearly distinct from tournament evidence.
- Numeric budgets default to strict caps. Only explicit flexibility enables target mode. Complete but over-cap/unpriced candidates cannot pass a finite cap. Flexible targets may present disclosed alternatives. Estimates exclude tax/shipping and are not checkout quotes.
- Selection and final checks share recognized tribal and effect evidence. Commander plans receive primary support checks even without an explicit style. Two supporting library copies are only a minimum sanity check: passing is **not** proof of adequate tribal density, consistency or competitive quality. Natural support access in the first 11 cards is shown separately from casting, tutors, mulligans and game execution.
- Corrected demonstrated life-gain ownership/variable-output recognition, Angel-or-Cleric alternatives, changeling and multiword creature types. Shared life-gain evidence is also used by the constructed assessment. Common entering-trigger, life-gain and life-payment blockers appear as conditional coexistence warnings; sequencing/removing the blocker can restore a route. This is not a complete rules simulator.
- Theme discovery can retrieve a second bounded page. The commander’s recognized roles are searched even when the separate build-around is unrelated. Already-loaded rules records can supply a bounded fallback pool when all provider searches fail. Strongest requests do not silently prioritize ownership over assessed strength; manual ownership preferences remain explicit.
- The original teaching corpus is preserved. 255 Magic keyword/action definitions resolve to exact entries in the existing dated official rule pack. Additional Yu-Gi-Oh! summoning and Pokémon type/Trainer reminders link to their own game’s sources. `scripts/build-keyword-references.mjs` regenerates Magic excerpts deterministically from that pack.
- Card properties link into existing Search: combined Magic card types/subtypes/keywords; Yu-Gi-Oh! exact archetype, monster type and attribute; Pokémon category/type/stage. Pokémon Ability-name and text links explicitly search **loaded full card data only**, because a complete remote Ability-name search has not been established. Shared names/text do not establish identical effects or synergy.
- Source-card return uses the existing history mechanism, including when the card was opened from Search itself. Old cross-game links cannot replace the current game’s query. Cache slimming preserves flavor-name aliases and related-card identity metadata; these do not themselves prove franchise identity.

## Evidence

`test-deck-plan-fidelity.mjs` uses the retained unmodified Scryfall snapshots from the initial audit and labeled synthetic prices/fillers. `test-card-discovery.mjs` checks every additional source reference and invokes the actual app search action. Existing effect, request/revision, Commander intent and shared construction checks remain relevant.

`tests/deck-knowledge-browser.mjs` runs the real application with synthetic providers, artwork and local state at 390 and 1440 px for all three games. It checks expanded reminders, hover/tap behavior, typed discovery, same-Search card return, explicit loaded-only scope and fixture health. Screenshots below are synthetic UI evidence, not physical-card appearance or live-provider proof.

- [Generated deck overview](deck-knowledge/generated-deck-overview-phone.png)
- [AI build progress](deck-knowledge/ai-building-phone.png)
- [Build progress pop-up](deck-knowledge/building-phone.png)
- [Generated deck rows](deck-knowledge/generated-deck-phone.png)
- [Magic phone](deck-knowledge/magic-phone.png)
- [Yu-Gi-Oh! phone](deck-knowledge/yugioh-phone.png)
- [Pokémon phone](deck-knowledge/pokemon-phone.png)

`tests/deck-build-presentation-browser.mjs` exercises the real builder with synthetic providers at 320, 390 and 1440 px, plus a real Ask-to-builder handoff with mocked model output: animated logo, reduced motion, cancellation/late response, automatic completion, shared card rows, blank-budget rejection, successful budget rebuild, failed-cap recovery, cancellation that preserves an earlier inline deck, and no automatic save.

The recovered feature candidate passed all 264 root test programs, the generated-deck presentation browser checks at 320, 390 and 1440 px, and six card-discovery browser cases (three games at 390 and 1440 px) before this scope change. These browser checks use synthetic providers. The web-only metadata changes receive a fresh root-suite run and regressions for unchanged native update detection, website update detection, release metadata and the retained APK identity. Final hosted checks and deployment verification are recorded separately when completed.

The old signed APK is intentionally not claimed to match the new website. `scripts/verify-android-release.py` remains strict and applies when a future Android patch is actually built from its selected website commit. Physical Android interaction is untested in this environment.

## Remaining limitations

This release does not supply the complete offline card catalog, a universal rules simulator, verified franchise/theme curation, exact-opponent-aware construction or evidence of professional/tournament deck quality. The AI cannot turn a missing ability model into verified evidence. The catalogue fallback is limited to loaded records. Date-stamped source packs and price records can become stale. New vocabulary is not automatically a new synergy model.

## Rollback

The clean baseline is tagged locally `codex/deck-engine-rollback-3.93.3`. Revert this release’s merge commit through a normal reviewed PR to restore its website source and release metadata; the retained 0.5.3 APK is unchanged by this release. Do not reset or force-push the production branch. A previously released Android APK cannot update over a higher versionCode: an installable Android rollback must rebuild the prior source with a new, higher versionCode and the established signing key. Saved finishes, conditions, quantities and editions are not changed by this patch.
