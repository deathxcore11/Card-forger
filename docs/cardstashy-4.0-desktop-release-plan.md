# CardStashy 4.0: desktop website release

Status: development scope and acceptance contract, not a final support declaration
or release receipt. The first shipping format/card pool is still a release blocker.
Product direction updated October 24, 2026.

## Platform decision

The owner's latest instruction takes precedence over the older native-first
practice blueprint:

| Surface | 4.0 scope |
| --- | --- |
| Desktop website | UI redesign and the supported Magic Play experience |
| Phone/mobile website | Existing collecting and deck tools remain usable; new Play is unavailable |
| Tablet/foldable browsers | Do not treat a wide viewport as desktop eligibility; Play remains unavailable until explicitly included and tested |
| Published Android APK | Defer changes while website 4.0 is developed and debugged |
| Later APK update | Port the selected accumulated fixes and redesign after website stabilization; exclude Play |
| APK gameplay | Separate future release decision; 4.1, 4.5 and 5.0 are possibilities, not commitments |

Play availability must be enforced at the route/session boundary as well as in
navigation. A hidden button, desktop-site toggle or widened phone viewport is
not an eligibility check. Do not introduce Play dependencies into the current
native bundle, rebaseline Android, change its release record or replace its APK.

This platform change does not silently remove the blueprint's desktop offline
goal. Prove an actual browser-local engine/runtime and cold-start offline path,
or resolve that requirement explicitly before claiming the full Play scope.

### Unsupported and uncertain devices

Desktop eligibility is a conservative product-support decision, not a security
claim that browser signals can prove physical hardware identity.

1. Reject native/APK contexts and identified mobile/tablet/foldable contexts.
   A mobile browser's desktop-site setting does not opt it into Play.
2. Require an explicitly tested browser/runtime configuration and the actual
   engine, storage, input and content-package capabilities for that release.
   A wide viewport, mouse or keyboard alone does not establish eligibility;
   touch support alone does not exclude an otherwise supported desktop.
3. If classification or a required capability is uncertain, do not create or
   join a Play session. Show a readable unavailable reason and retain normal
   collection/deck access. Do not offer a manual-game fallback or an override
   that bypasses the supported-runtime boundary.
4. Apply the same admission result to Home/pack entrypoints, direct routes,
   resumed sessions and friend invitations. Client display checks do not
   replace server authorization or per-seat private-state filtering.
5. Recheck runtime/package readiness at session creation and resume. Losing a
   capability during play takes the recovery path; it is not an automatic
   concession or loss.

Acceptance fixtures cover an ordinary desktop, a touch laptop, Android/iOS,
tablets, foldables in both postures, desktop-site requests, resized windows,
missing capabilities and unknown signals. Record the exact tested browser and
runtime versions before adding them to the support manifest.

## What 4.0 must ship

The current release target includes all three named modes: rules-enforced
Practice, rules-enforced private Casual, and a supported Draft-to-deck-to-play
flow. They are launch requirements, not three ready labels that can hide
unfinished behavior. A Practice-only release would be an explicit product-scope
revision; do not silently redefine 4.0 when the other modes are incomplete.

**Unresolved shipping decision: first constructed format and exact card pool.**
No format, draft product or card-pool manifest has been selected or proved yet.
This specification cannot be called final and no supported-pool claim can ship
until those decisions are recorded. A mode is not a format, and Draft also
needs its own selected product/cube and limited construction rules.

The release owner must freeze a shipping support manifest containing:

- The first constructed format, player count and supported commander/partner
  configuration where relevant; current format/rules-data version.
- Exact executable card identities and definition versions, supported faces,
  tokens and generated objects, and any unsupported mechanics or choices.
- The first Draft product/cube, its exact pool and collation version, seat and
  match rules, basics policy and supported limited deck construction.
- Engine/adapter/CPU/playbook versions, required runtime capabilities, tested
  browsers and installed offline package/integrity requirements.

An imported, AI-generated, random, saved, source/meta or post-draft deck starts
only after independent construction-legality, exact-card executable-support and
CPU-pilotability checks for the selected mode. Unsupported rows are identified;
they are not removed, substituted or silently moved to a manual mode. Metadata
or canonical identity changes invalidate the relevant prior support result.

Two frozen decks completing games prove the foundation for those versions and
covered mechanics. They do not establish support for all decks generated by
the builder, every legal card, Commander generally or an entire draft product.

### Casual is rules-enforced

Casual changes the social/competitive context, not rules authority. The same
authoritative engine validates costs, targets, timing, land allowances, combat,
priority, stack, triggers and terminal outcomes for Practice and private Casual.
Do not permit an illegal action because the match is friendly or a player is
learning. Explain the rejection without changing accepted state.

A manual sandbox is outside 4.0. If separately requested later, it needs its own
mode name, setup disclosure, state/result contract and explicit selection. It
must never be a fallback for engine errors, unsupported cards, disconnects or
devices. Do not inherit the reference site's manual meaning of Casual.

## Release baseline and recovered work

At takeover, the inspected GitHub default branch was
`096e21e5cb70427f2dcfc83a0c8f90973368ac52` (website 3.95.3).
[PR #47](https://github.com/deathxcore11/Card-forger/pull/47) was open and draft
at `1b8678d5b1830aa61f0be889a78400b7f1a3d0ab`, with tree
`ab08a8eaaa34b2186b80915e5637a03ddc3abfb8`. This is repository evidence;
direct production-asset requests returned HTTP 403, so deployment was not
independently verified.

The supplied preserved patch was applied only after checking the exact tree and
`git apply --check`. Its SHA-256 is
`369dc11453f2f9e246e37450ac8853f30e349bac5ce891a35e30421a6b226a95`.
All nine resulting files matched the supplied size and SHA-256 manifest.
Keep this recovery separate from the redesign. Restoring work is not evidence
that its remaining release gates have passed.

## Product invariants

- Preserve the existing card popup and printing-specific foil/name treatments.
- Saved lists, source lists, CPU decks, virtual packs and draft pools never add
  owned inventory automatically.
- Keep rules legality, executable engine support, strategic judgment, price
  coverage, ownership and reference provenance distinct.
- Back/Close restores the originating deck, search or AI conversation and its
  useful selection, filters and scroll position.
- Retain CardStashy's artwork, soft glass, aura and rounded controls. Borrow
  interaction principles from references without copying their branding or code.
- Initial Play modes are Practice, Casual and Draft. Ranked and public
  matchmaking remain later work.

## Implementation sequence and exit evidence

| Stage | Concrete result | Evidence required before advancing |
| --- | --- | --- |
| 0. Recover baseline | Preserve and review the unfinished deck repair, parser optimization and DFC identity guards; track unresolved deck-quality findings separately | Exact revision, focused and aggregate results, reference replay, relevant browser checks, measured latency, and explicit quality-register disposition |
| 1. Shared deck viewer | Detailed list, overlapping card stacks, full-art grid and names-only presentations of one exact list | All six entrypoints in every view; same identities/quantities/zones; retained filters, sorting, selection and return context; read-only permissions; keyboard and pointer QA |
| 2. Website cohesion | Blended compact header/Home composition, softer shared tabs and consistent deck entrypoints | Reference-based before/after screenshots and interaction checks; loading, empty, error, unavailable, stale and recovery states; regression checks on existing mobile tools |
| 3. Engine proof: hard Play gate | An authoritative engine adapter completes supported CPU games and actual offline save/resume | Frozen rules/runtime/rights fit; two frozen executable decks; recorded seeds in both seats; valid terminal traces; privacy/legality fixtures; cold-start airplane-mode resume without duplicate actions |
| 4. Desktop Practice | Lobby, full-window table, legal choices, payment preview/manual selection, local teaching, recovery and history | Real engine state drives UI; supported deck preflight; measured CPU budgets; exact deck versions; offline/resume proof |
| 5. Draft | Validated products/cubes, bounded draft bots, pool-to-deck review and Practice handoff | Pack/pick integrity, basics policy, construction rules, save/resume and strict separation from owned inventory |
| 6. Private Casual/friend sessions | Rules-enforced private matches, explicit invitations/codes, accepted seats, authorized commands and reconnect | Same rules authority as Practice; per-seat privacy; stale/duplicate command rejection; disconnect policy; hidden-data tests; no manual fallback |
| 7. Stabilize and release | Reviewable website 4.0 candidate, measured behavior and a rollback record | Exact final revision and passing required checks; supported-browser evidence; known coverage limits; production verification after deployment |
| 8. Later APK batch | Bring selected non-Play website improvements into Android | Separate source selection, existing signing/release checks and explicit exclusion of Play |

The stages are dependency order, not release dates. Stages 1 and 2 are existing
app/deck presentation work and may progress independently of the engine spike.
Stage 3 is a firm prerequisite for the integrated Play lobby, opening-hand flow,
battlefield, payments, coaching and Draft-to-match interface. Do not build that
whole Play experience around an unproved engine contract. A minimal diagnostic
harness is permitted for the proof; it is not a finished Play interface.

The engine gate passes only with reproducible complete CPU games, tactical and
hidden-information tests, and cold-start offline create/save/terminate/restart/
resume tests at both human and CPU decisions. Retain engine snapshots, pending
choices, policy/deck versions, seeds, action traces, terminal reasons and measured
decision/resource bounds. Turn/time diagnostic limits are failures or
inconclusive results, never fabricated wins. Sign off the exact evidence before
Stage 4 integration starts.

## Stage 0: quality and latency are separate work

| Finding | Required disposition | Current status |
| --- | --- | --- |
| Q01 Vehicle crew balance | Evaluate actual eligible crew bodies, usable power, timing and competing resource commitments in the exact delivered list; repair the package or retain an explicit unsupported/unmet result | OPEN; parser speedup is not closure |
| Q02 Weak theme density, including Aura packages | Evaluate exact library density, legal hosts, prerequisites and access; retain useful independent card roles without claiming a supported central plan | OPEN; legality and a full card count are insufficient |
| Q03 Missing win-condition support | Establish supported resource-to-output-to-closing routes, usable zones, startup costs and shared failure dependencies; keep unknown coverage distinct from known absence | OPEN; more mana/draw/tutors alone do not establish a win |
| Q04 Qualified reference selection | Replay the real R01/source case on the recovered combination; check DFC identity, full-list qualification, quotes, ranking, provenance and post-edit rechecks | OPEN; isolated helper tests do not establish the integrated result |
| P01 Build latency | Measure stage times in cold/warm conditions on the actual revision; compare exact outputs and cancellation; report device/context and resource bounds | OPEN for integrated/device claims; historical parser-only timings remain scoped evidence |

Each item needs an owner, exact reproducible input/revision, observed behavior,
expected behavior, retained evidence, fix or explicit supported-scope limitation,
and regression coverage. A known incomplete or unsupported deck must not acquire
a complete/supported/strong label from a faster run, source popularity, a high
heuristic score or aggregate test success. Rebuild, improve, swap, recheck and
save-time assessment apply the same final-list gates. Keep actual deck-quality
findings visible even if the release only supports a bounded pool.

## Shared deck viewer acceptance matrix

Every cell below remains a release requirement. Partial local validation of the
new four-view implementation is recorded in the [deck viewer review](4.0-deck-viewer-review/README.md).
Source existence or a renderer-only check does not close an entrypoint.

| Entry point | Detailed list | Overlapping stacks | Full-art grid | Names only |
| --- | --- | --- | --- | --- |
| AI receipt/result | Required | Required | Required | Required |
| Meta/source deck | Required | Required | Required | Required |
| Random deck result | Required | Required | Required | Required |
| Saved/imported deck | Required | Required | Required | Required |
| Post-draft deck review | Required | Required | Required | Required |
| Practice deck selection | Required | Required | Required | Required |

For every cell and every layout transition, compare the exact deck/version,
canonical cards, selected printing/finish where available, quantities, commander
and all actual zones. Switching presentation never regenerates a deck, silently
resolves to another printing, changes quantities or persists an edit. Preserve
sorting/grouping, filter text, selected cards, selected tab and useful scroll
context. Test empty/one-card/large groups, long names, DFC faces, unavailable art
and delayed metadata without changing list identity.

Open a card and go Back: return to the same deck/view and state. Close the deck:
return to the original AI conversation, search, random receipt, meta source,
saved list, draft pool or Practice selection with its scroll/selection intact.
Verify read-only origins cannot edit or add owned cards; saving a copy is a
deliberate independent action. A source fixture with writable controls is a
failure even when its screenshot looks consistent.

## Concrete design review and interaction evidence

Capture baseline and candidate screenshots with the same viewport, text scale,
game, exact deck/data fixtures and theme, and identify both source revisions.
Review at representative desktop and wide desktop widths, keyboard zoom/large
text, reduced motion and the existing phone/tablet/foldable collection surfaces.
New Play remains desktop-only. Do not treat screenshots of static ready labels
or an animation as functional evidence.

Required reviewed scenarios:

1. The compact Home/header before and after: one continuous artwork surface,
   Card of the Day above collection value,
   a few personal decks, Community Meta decks and one News block. Search uses
   the typed query; game/account changes do not leak the previous workspace.
2. All four deck views and all origins above, including sorting, selection,
   filters, card inspection, Back/Close, export, permissions and failures.
3. The Mill-style contextual glossary by hover, keyboard focus and tap. Reuse
   existing inline/Oracle/reference help, retain source/context and selected
   face, keep rules terms distinct from strategy tags, and show unknown coverage
   honestly. Pin/dismiss help without covering a pending choice.
4. After the engine gate, the actual opening hand, accepted starting-player
   result, format-correct mulligan/bottom/keep, crowded hand and deliberate play.
   Repeated clicks or skipped animation never reroll or duplicate actions.
5. Settings opened during a target/payment decision: preserve the pending
   choice and return focus on close; test motion, sound/haptics and control
   changes without changing rules facts or the running deck.
6. Loading, empty, stale, unavailable, invalid, disabled, selected, editing,
   confirmation, error, offline and interrupted/recovered states. Include
   refresh/restart during CPU thinking, stale choices, incompatible save
   versions and failed content downloads. Recovery must not count a concession.

Map each changed component to the supplied images or an observed public flow
and the existing CardStashy component it reuses. Compare spacing, hierarchy,
density and interaction outcomes; do not copy branding/assets or reproduce a
reference's rules mistakes. Keep the existing card popup mostly intact; the
deck viewer is the redesign priority. Screenshots complement executable checks
and never replace them.

### Table material, coin flips and finishing quality

The user's October 24 follow-up adds explicit reference-based acceptance for
artwork-led deck selection, a finished textured table, fanned opening hands,
card lift/inspect, readable zones, purposeful motion/sound and real engine-owned
coin flips. The five-capture mapping, result/replay contract and screenshot plus
interaction-recording gates are in [Play art and motion](4.0-play-art-and-motion.md).
These are required design/validation work, not completed product features. The
in-chat layout walkthrough is not final visual sign-off. Retain format-correct
pregame selection and mulligans; do not copy a friendly redraw or equate a die
contest with a coin flip. Both the engine gate and finishing-quality review must
pass before enabling the released Play flow.

## Latest Home and pack composition

Blend the header controls into one compact pill-like shell instead of a large
separate masthead. Use one continuous daily artwork background that bleeds into
the page rather than repeating the same image in a second daily-card pill.
Order the overview as Card of the Day (with its existing collectible packs),
collection value, and a few of the user's saved decks. Follow it with
Community Meta decks and one News area. Keep the selected game, search/AI,
profile and normal navigation understandable at each supported size.

Provide a desktop Play entry only with truthful availability. Draft belongs
alongside the relevant pack actions and must use validated draft products and
its own session flow once ready. Existing collectible pack opening remains the
same collection-oriented, tactile feature: preserve its sampler, reveal,
printing/finish identity, explicit collection actions and cancellation behavior.
A practice/draft pool never changes owned inventory just because it was opened.

## Initial UI audit and reuse map

Inspected implementation: plain JavaScript modules and static CSS/HTML, not a
React or Tailwind project. Preserve existing routing, account boundaries and
state contracts.

| Area | Existing implementation | Target change |
| --- | --- | --- |
| Saved Magic deck | `views.js` (`deckCards`, `deckList`, `deckRow`) | Reuse exact rows, counts, grouping, filters and existing card-detail actions in the shared viewer |
| Saved Pokemon/Yu-Gi-Oh! deck | `tcg.js` (`deckCardsTab`) | Keep game-specific zones, identities, selected printings and edit permissions while sharing presentation |
| Generated/AI result | `deck-experience.js` (`deckResultMarkup`, `createDeckExperience`) | Retain scoped receipt, explicit save, budget rebuild and warnings; use the same four presentations |
| Shared/Wiki source deck | `shared-deck-view.js` | Retain source attribution, zone boundaries and independent-copy behavior; share the viewer without granting edit access |
| Current layout controls | `workbench-ui.js` | Four deck presentations now share the saved deck preference; unrelated collection/search controls retain three modes |
| Card popup and effects | `views.js`, `tcg.js`, finish modules | Reuse with minimal polish; do not replace or flatten the finish system |
| Home | `home-search.js`, `home-today.js`, `views.js`, `tcg.js` | One compact blended header; artwork with value, daily card/packs and a few personal decks; Community Meta decks; one News block; collectible packs retain existing behavior |
| Glossary | Existing local terms, Oracle/card references and inline help | Add contextual discoverability around inspection; do not invent a disconnected dictionary or model-authored rules |
| Play | Existing draw/goldfish/tabletop utilities | Useful presentation patterns only; they are not an authoritative Magic engine |

Live reference inspection used the public Moxgate Commander lobby and its Deck
Preview on October 24. The lobby keeps deck selection, a prominent selected-deck
preview, seats and primary actions together. The preview groups overlapping
cards by curve/type and keeps deck counts and confirmation visible. These
observations inform spatial hierarchy only. CardStashy must apply its own
format/zone rules rather than inheriting the reference's generic bench or
Commander sideboard controls.

The supplied screenshots and the public lobby/preview are sufficient for the
first viewer/lobby design pass. Further reference requests should identify a
specific missing interaction such as targeting, stack responses or payment.

## Gameplay requirements retained from the handoff

### Desktop Play library and precon context

The user's October 24 clarification adds an explicit library requirement:
bring together preconstructed decks across known sets/products, existing meta
lists, the user's built/saved/imported lists and random opponents. "Pre-context"
is interpreted as both source decklists and the CPU's versioned knowledge of
their plans. This is a requirement, not a claim that a Play library is built.
Desktop/PC comes first. Mobile translation follows a proven desktop experience;
Yu-Gi-Oh! character decks and themed battles remain future examples.

- Browse by set/product, source and format with actual artwork, readable names,
  commander(s), card/zone counts and a concise strategy preview. Reuse the four
  deck views for both player and opponent previews, preserving the return path.
- Precons, Meta, My decks and Random are clear choices within one cohesive
  library. Do not make the user hunt across unrelated builders to start a match.
  Existing collection tools and explicit Save ownership behavior remain separate.
- Ingest the complete known product index with provenance, fetched/list versions,
  release/preview state and verified deck contents. Not every set has a precon;
  do not manufacture a product or list to fill a set tile. Missing source data
  is a recoverable library state, never an invented complete deck.
- Commander and 60-card construction are distinct choices. "60-card" describes
  size, not a substitute for Standard/Modern/other actual format rules. Preserve
  main, command zone, extra deck where applicable, and sideboard. Preserve all
  declared commanders and validate supported partner/selection rules; a parser's
  single commander label is not sufficient evidence for a multi-commander deck.
- Library presence, release/format legality, engine card coverage and tested CPU
  play are separate facts. Enable a match only for a complete exact list whose
  format, player count and mechanics are supported. Give a clear reason when a
  browsable deck cannot start; there is no silent manual-rules fallback.
- CPU playbooks reference the exact normalized list and rules/card-data version:
  mulligan plan, mana development, setup/payoffs, attack/block priorities,
  responses/protection, tutors, closing lines and conditional combo resources.
  Recompute/invalidate on list changes. Builder hints propose priorities;
  they do not execute card rules or prove piloting strength.
- Easy/Medium/Hard use versioned planning budgets and policies under the same
  rules and information privileges. Opponent selection can be explicit or
  random within eligible format/card pools. Freeze the selected opponent and
  random seed/list version before the game; refreshes cannot swap its cards.
  History and the save-opponent action retain that actual list.

Current source audit: `loadPrecons` reads MTGJSON's product index; the empty-query
`preconList` and ten-at-a-time `finderPrecons` favor Commander products. The
MTGJSON parser exposes only the first commander as its label, flags multiple
commanders, and excludes sideboard cards. These are known integration gaps for
the Play library, not complete coverage of all sets or 60-card decks. An
attempt to download the current index in this environment returned HTTP 403;
live index completeness has not been verified.

Requested product checks, as of October 24, 2026:

| Example | Verified primary-source state | Required follow-through |
| --- | --- | --- |
| Teenage Mutant Ninja Turtles | Wizards publishes Turtle Power!, a 100-card Commander list with Partner—Character select choices | Resolve the exact list, preserve commander choices, prove the new mechanics and CPU play; not currently certified playable |
| Star Trek | Wizards names Federation Fleet, Landing Party, Klingon Fury and We Are the Borg for November 13; its October 20 decklist page still marks each full list as awaiting reveal | Keep announcement/preview status distinct; ingest actual complete lists when supplied, then validate all cards and format before enabling Play |

Sources: [Turtle Power! decklist](https://magic.wizards.com/en/news/announcements/teenage-mutant-ninja-turtles-commander-decklist),
[Star Trek Commander decklists](https://magic.wizards.com/en/news/announcements/star-trek-commander-decklists),
and the existing application's [MTGJSON product index](https://mtgjson.com/api/v5/DeckList.json).

The existing firm engine proof gate still precedes an integrated Play menu or
board. This library coverage and CPU-context work can be audited independently;
it does not make a disabled entry point a working game.

#### Approved Play interaction choices — October 24

The user approved these additions after the library discussion. They are
development requirements; implementation and validation are still pending.

- **Quick Practice:** remember the last valid player deck, format and difficulty.
  Show the selected opponent before starting. Revalidate both exact lists and
  engine compatibility on entry; remembered choices never bypass the gate.
- **Opponent shelf:** Precons, Meta, Random and My decks share artwork-led
  selection, a concise grounded "how it wins" preview and the four-view deck
  inspector. Either side can use an eligible personal deck. Retain the selected
  deck/source and Back context rather than sending users across unrelated tools.
- **Independent help controls:** CPU difficulty and player assistance are
  separate settings. Legal-action highlights and payment previews can remain on
  against Hard. Easy enforces the same rules; it does not gain hidden information
  or permit illegal beginner actions. Persist assistance with the match record.
- **Useful post-match return:** open the player's deck at Matchups → Practice
  history with Rematch, Save opponent deck and up to three meaningful moments
  from the actual match. Ground explanations in engine events and information
  available to the player at the time. Do not invent choices, hidden knowledge,
  winning alternatives or a coach's claimed certainty about an unknown hand.
- **Reproducible matches:** freeze exact deck snapshots, engine/card/CPU versions,
  seat/format settings, all relevant random streams and the accepted action log.
  A shuffle seed alone does not reproduce an unseeded CPU. Replay must reproduce
  the actual match and pending choices, giving bug reports a concrete trace.

### Engine and match behavior

- Engine-owned legal actions, current-revision validation, stack, priority,
  targeting, costs, combat, triggers and terminal outcomes for supported cards.
- Fair Easy/Medium/Hard policies use permitted observations, never the other
  player's hidden hand or future library order.
- Full browser-content play surface without the ordinary header/search or
  app-added financial frames. Do not force OS/browser fullscreen.
- Inspection is separate from playing. Keyboard/tap controls complement drag.
- Payment has a legal preview, manual override, cancellation before commit and
  stale-state rejection. Do not automatically sacrifice/discard/pay life.
- Actual format-correct mulligans and first-turn draws; no generic free redraw
  or cosmetic four-player switch presented as rules support.
- Confirmed Exit/Concede from a started CPU match records exactly one loss.
  Cancel changes nothing. Crashes and suspension take a recovery path.
- History freezes both deck versions, rules/CPU versions, difficulty,
  assistance settings and result. Copying an available CPU list saves a deck
  without changing owned inventory.
- Future friend sessions transmit only the authorized view for each seat.

### Contextual CPU behavior and Arena-style interaction

The [local CPU proposal review](4.0-cpu-proposal-review.md) evaluates the user's
heuristic/difficulty design against the source and primary research. It retains
local scoring and engine authority, corrects the zero-lag/metadata assumptions,
and records uncertainty, multiplayer, latency and deterministic-replay gates.

The CPU consumes a permitted observation, engine-legal actions, independent
mechanic facts and a separately versioned deck playbook. The builder's strategy
analysis can propose priorities; it is not executable rules or independent
proof that the CPU can pilot that deck. Neither a high builder score nor a fast
generation time certifies playing strength.

Use bounded evaluation/planning to compare development, attacks, blocks,
responses, removal timing, protection and required combo resources. React to
observed public state and legitimately revealed information, not to the player's
private hand or future draws. Difficulty changes tested planning/evaluation
budgets, not information privileges. Retain cancellation and stale-revision
validation even when a candidate was legal when planning began.

Selecting or dragging a card requests legal actions and engine-approved targets
or destinations. Highlights and drop affordances come from that result. A card
type label or animation cannot make a move legal. A rejected/stale drop explains
why and restores the uncommitted presentation. Tap/keyboard alternatives use
the same command path and distinguish inspection from playing.

Automatic mana payment proposes engine-legal sources and choices for the exact
cost, and previews what remains available. Players can select/tap sources
manually and override an uncommitted proposal. Colored/generic/colorless costs,
X, hybrid/alternative/additional costs and spending restrictions retain their
actual supported meaning. Prompt before strategic sacrifices, discards or life
payments. Canceling a preview is safe; committed hidden-information actions do
not acquire a general undo promise.

### Automatic consequences and deck-linked match history

Rules-enforced play automatically tracks marked damage, life totals, counters
(including +1/+1 counters), temporary/continuous modifications, zone changes,
deaths and engine-defined terminal outcomes for supported cards. Damage is not
the same state as a +1/+1 counter. Cleanup, expiry, replacement effects and
state-based consequences follow the engine, not UI bookkeeping or visual
guesswork. Pause for actual targets, optional choices, blockers and responses.

On-board cards display the current effective power/toughness and relevant
counters, marked damage, attachments, tapped state and granted abilities such
as hexproof when the engine supplies them. Use compact readable numbers/status
marks with text alternatives; preserve the original printed face and finish.
Do not paint a temporary +1/+1 effect as a permanent +1/+1 counter.

Selecting the card opens the right-hand desktop inspector with its exact face,
printed text, current derived characteristics, attachments, and effect sources
and expiry. Explain which Aura, Equipment, counter or other effect caused the
change when the engine can establish that provenance. Reuse sourced contextual
keyword help. Keep targets, stack/priority and pending choices visible while
inspecting; a hover preview supplements explicit selection and keyboard focus.
Do not assume a modifier is understood merely because the artwork glows.

Usability checks include a creature with several simultaneous modifiers,
changed/granted abilities, attachment removal, temporary-effect cleanup,
damage plus counters and long rules text. Board and inspector must agree with
the same accepted engine revision. Sleek presentation is evaluated with novice
task completion; no claim of universal confusion-free play substitutes for it.

On a valid terminal result, persist the immutable result once, then open the
player deck's **Matchups → Practice history** context with the new match
selected. Show the result clearly and preserve the game's inspection/log route.
If result persistence fails, expose retry/recovery before claiming it was saved.
Finalization/retry/resume cannot write a duplicate result or redirect a newer
unrelated view. Engine errors, crashes and diagnostic limits are not wins or
voluntary losses. Confirmed started-CPU concession is one loss.

Each record retains match ID, exact player and opponent list versions, selected
format, rules/engine/CPU/playbook versions, difficulty, assistance, terminal
reason and provenance. An unsaved/generated player list retains a session deck
snapshot and return context; match completion never silently saves over a deck
or adds owned inventory. Later edits cannot change a historical matchup.

The opponent deck in a completed CPU game, including a randomly generated CPU
opponent, can be inspected and explicitly copied into Saved decks. Copy the
actual frozen list played, its zones and permissible provenance. Do not rebuild
it, copy a newer template, add owned quantities or manufacture tournament
results. Private human lists remain subject to availability/consent.

Practice outcomes can appear alongside the deck's matchup tools, but remain
labeled CPU Practice. Keep them separate from human competitive results,
simulations, published meta records and heuristic Power scores. Display sample
size and configuration; do not turn one win into a general matchup percentage,
automatically revise the deck, claim self-learning or change a deterministic
Power score without a separately reviewed calibration contract.

The later RPG/roguelike Journey reuses the same rules authority, immutable match
records, local coaching and opponent-copy capability. Tag the mode/run and
freeze the actual run-deck version. Virtual rewards, packs and run upgrades
remain separate from owned inventory and normal saved-deck edits.

Acceptance adds damage versus counters and end-of-turn cleanup fixtures,
automatic lethal/death/terminal chains, repeated terminal events, failed result
writes, restart during finalization, exact opponent copying and post-match deck
edits. Verify the correct deck/history return path and unchanged ownership for
ordinary Practice and a future Journey-tagged record.

## Decisions still requiring evidence

The platform is now decided. The first supported format/card pool, actual engine
and browser-local runtime, offline package size, tested CPU budgets, multiplayer
recovery policy and first draft products are still unproven. Do not assign a
cost, schedule, coverage percentage or ready label without measurements.

An external Moxgate Challenge Link is not the requested integrated Play engine,
and an online engine service is not cold-start offline support. Choose the
integration deliberately after the engine/runtime proof.

Current primary references:

- [Moxgate FAQ](https://www.moxgate.com/faq/): describes its rules-enforced Forge
  mode separately from its manual Casual mode.
- [Moxgate Developer API](https://www.moxgate.com/developer/): documents external
  Challenge Links; that handoff is not an embedded CardStashy engine.
- [Forge README](https://github.com/Card-Forge/forge/blob/master/README.md):
  describes Java implementation and Java 17+ for the desktop package.
- [Forge license](https://github.com/Card-Forge/forge/blob/master/LICENSE):
  GPL version 3. No Forge code or dependency has been added here. Its desktop
  package documentation does not establish a browser-local runtime fit.

## Recovery and rollback

Keep baseline recovery and 4.0 work in separate commits/branches. Do not change
the production branch until a concrete tested candidate is reviewed for release.
Rollback should select the last verified website revision without deleting user
collections, decks, match history or recovery saves. Version new match schemas;
an incompatible save must remain identifiable rather than being silently
reinterpreted. APK artifacts stay outside this release.
