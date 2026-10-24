# CardStashy Play: handoff for a separate development chat

Prepared October 24, 2026. This document lets a **new chat** continue the game
work without relying on the originating conversation. Read the linked source
documents and actual references; this handoff is an index and current decision
record, not a claim that the game is built.

## Latest owner instruction: split the work

The owner has put Play development on hold **in the originating chat**. That
chat is finishing and publishing the website-only Home redesign, shared deck
views and bug fixes as **3.95.4**, with **no Play or Draft button**. It is not a
4.0 gameplay release. A separate chat can continue the game on its own branch.
The published APK is outside both the current website release and this game
development task. Do not make an APK or add gameplay to its bundle.

| Item | Starting identity and boundary |
| --- | --- |
| Private repository | `deathxcore11/Card-forger`; use authorized GitHub access |
| Dedicated game branch | `codex/cardstashy-play-engine-20261024` |
| Website development branch | `codex/cardstashy-4-desktop-foundation-20261024` |
| Snapshot before this handoff | `997cfcb38a6d9e802ea575b8868f7736c5685a08` |
| Website review | [PR #48](https://github.com/deathxcore11/Card-forger/pull/48); verify its current head/status rather than assuming this snapshot is final |
| Production branch at the preceding checkpoint | `claude/edit-publish-github-bpm8zu`; inspect current remote state before drawing conclusions |
| Game publication | No deployment, merge into production, APK release or live Play activation is authorized by this handoff |

The primary agent creates the dedicated game branch after committing this
handoff. Verify the remote ref exists and read its current commit before work;
do not assume the snapshot SHA already includes this file. The website branch
may advance independently. Keep game changes isolated, reviewable and off
production. Do not merge an old whole branch later in a way that restores old
website controls or discards the website-only release. Any future integration
needs an explicit, tested source selection and release review.

## Start here in the new chat

1. Confirm authorized access to the private repository, inspect the dedicated
   branch and any applicable `AGENTS.md`, and create an isolated checkout/worktree.
   Do not overwrite unrelated work or infer that current production is the old
   source snapshot. This app uses plain JavaScript modules/CSS/HTML, not React
   or Tailwind.
2. Read all documents in the following table before treating a requirement as
   settled. The owner's latest split above supersedes older wording about what
   ships together; the 4.0 documents retain the **future game** targets.
3. Retrieve the original references using
   [the machine-readable reference index](cardstashy-play-reference-index.json).
   Read the available ChatGPT Library skill before Library operations. Exact
   Library IDs are recorded for thirteen images, with names, checksums and
   requirement mappings. A fresh chat does not inherit attachments, tool
   sessions, signed URLs, prior authorization state or scratch files.
4. Reproduce the bounded engine diagnostic if its exact inputs are available.
   Record missing/expired inputs honestly. Do not silently replace a binary,
   turn a source API into a tested feature or present this small test as the
   finished engine gate.
5. Continue engine/privacy/recovery proof before building the integrated game
   experience. Progress independently on source audits, exact deck manifests and
   contracts where useful. Keep actual results distinct from proposed features.

At this checkpoint the GitHub connector can read/write the private repository,
while direct Git CLI authentication is not available. Use the connector for
authorized private source/branch operations and the CLI for an already available
local checkout as appropriate. A new chat must inspect its own available access;
do not assume cached credentials or turn the repository public to obtain files.

| Required source | Why it matters |
| --- | --- |
| [Desktop release plan](cardstashy-4.0-desktop-release-plan.md) | Platform, exact-pool gate, all four deck views, gameplay/history/library requirements and unresolved decisions |
| [Play art and motion](4.0-play-art-and-motion.md) | All supplied image mappings, persistent right inspector, context menus, input ownership, table/coin/motion acceptance |
| [Engine evaluation](4.0-engine-evaluation.md) | Candidate source findings, executable evidence, fairness and pregame gaps |
| [CPU proposal review](4.0-cpu-proposal-review.md) | Local policy architecture, research, difficulty/hidden-information/performance corrections |
| [Experiment README](../experiments/phase-engine/README.md), [driver](../experiments/phase-engine/phase-smoke.mjs), [captured evidence](../experiments/phase-engine/evidence-2026-10-24.json) | Reproducible research inputs, exact assertions and limitations |
| [Patch-notes draft](cardstashy-4.0-patch-notes-draft.md) | Planned game coverage; draft wording is not a shipped feature inventory |
| [Home review](4.0-home-review/README.md), [deck viewer review](4.0-deck-viewer-review/README.md) | Reuse the existing design and know what was actually validated |
| [Recovery checkpoint](3954-recovery-validation.md), [deck request/result contract](deck-builder-request-and-result-contract.md), [synergy audit](audits/ai-deck-synergy-audit.md) | Preserve the Random Deck repair and keep quality findings separate from speed |

Original engineering PDF/ZIP/TXT handoffs were referenced earlier, but this
handoff has **no authoritative current filenames or Library IDs for them**.
Their original contents were not re-reviewed here. Use actually available
attachments or request those originals again if needed; never invent their
contents or identifiers. The current repository documents are the current
requirements. An older native-first blueprint cannot override desktop-first.

## Product identity and scope to preserve

CardStashy should feel like one cohesive collecting, deck and play product.
Preserve its card artwork, printing identity, foil/name effects, warm glass/aura,
rounded controls and familiar navigation. Keep the existing card popup mostly
intact; the shared deck viewer was the redesign priority. Reference sites inform
space, readability and interaction; do not copy branding, proprietary textures,
code, personal browser chrome or rules mistakes.

The Home work uses a compact blended header with search and navigation, one
continuous daily artwork surface, Card of the Day/collectible packs above
collection value, then personal decks, Community Meta decks and News. This is
website work the game branch reuses, not a reason to add financial panels to a
match. The collectible pack opening remains its existing tactile collection
feature. Draft is a separate future session beside relevant pack actions; draft
pools, practice cards and CPU decks never add owned inventory automatically.

Future Play is **desktop website/PC first**. Mobile website keeps current deck
and collection tools. Phone, tablet, foldable, native/APK and uncertain devices
cannot create/join/resume Play merely by widening a viewport, requesting desktop
mode or hiding a button. Use tested browser/runtime/storage/input/content
capabilities and enforce admission at session/routes as well as navigation.
Touch laptops are not automatically phones. Capability loss takes recovery,
never an automatic concession. Mobile translation comes only after desktop is
proven; 4.1/4.5/5.0 were possibilities, not promised APK game releases.

The retained future 4.0 target names **Practice, rules-enforced private Casual
and Draft-to-deck-to-play**. A narrower gameplay release needs an explicit scope
decision. Casual must enforce the same rules; there is no manual sandbox/error
fallback. Ranked, public matchmaking, Journey/RPG/roguelike, Yu-Gi-Oh! character
battles and other games' play engines are later work.

## Existing implementation and open work

The Home composition, shared four deck presentations and recovered Random Deck
parser/build-time repair exist on the website development line. The full local
JavaScript aggregate passed 312 commands at the recorded viewer checkpoint;
focused viewer and generated-deck browser checks also passed. Consult their
exact reports and current hosted checks: a prior success is not a certificate
for a newer head or every source/format/device combination. The originating
chat is separately resolving website validation and publication.

The four presentations are detailed list, overlapping stacks, full card-art
grid and names only. `deck-viewer.js`/`.css` reuse original card rows/actions;
Magic main/side counting and display-preference invalidation bugs were fixed.
Keep exact cards, quantities, zones, commander(s), printing/finish, ordering,
filter, selection, source permissions and Back/Close context in every view.
Existing `views.js`, `tcg.js`, `deck-experience.js`, `shared-deck-view.js` and
`workbench-ui.js` are the reuse points. Post-draft and Practice entrypoints are
not implemented. The complete six-entrypoint/four-view release matrix remains
open; a renderer-only fixture is not proof of an integrated entrypoint.

No integrated authoritative rules adapter, graded CPU, Play lobby/board,
gameplay auto-tapper, persistent game inspector, Draft, private friend sessions
or match-history flow is certified. `desktop-play.js` at the snapshot is only a
conservative future-admission helper with disabled entries; the website-only
release removes visible Play/Draft controls. Goldfish/tabletop/mana/deck-analysis
helpers are useful references, not the game engine.

Random Deck speed must remain repaired while deck quality is tracked separately:
vehicle crew balance, weak theme/Aura density, missing supported closing routes,
qualified real R01/source replay, the frozen 26-case benchmark and physical-device
latency remain open findings. Fast generation and green helper tests do not
establish a complete, strong or CPU-pilotable deck.

## Engine investigation: exact provenance and actual evidence

The candidate is `phase-rs/phase` commit
`71ccd8fe1715c45fe9e9bd78d391bec5ac8a4234`, workspace **0.117.0**,
MIT/Apache-2.0 top-level notices. It has **not been adopted** into CardStashy.
Forge is a mature tactical/rules reference with GPL notices; no Forge code was
imported. Manabrew's browser-local Forge report is evidence of another technical
approach, not our distribution, runtime or performance proof.

Two local source builds of Phase were OOM-killed at the research container's
8 GiB limit: first two jobs with ordinary `wasm-dev` settings, then one job with
optimization/debug information disabled. Cumulative cgroup `oom_kill = 2`.
Neither produced a binary. This does not measure gameplay RAM or performance.
The isolated toolchain was `nightly-2026-04-19`, wasm32 target, wasm-bindgen CLI
**0.2.121**. Upstream engine instructions/skills must be read before source edits;
no third-party Rust source changes were made for this diagnostic.

A completed artifact for the **exact pin** was retrieved from upstream run
`40129115223`, artifact `12574954346`, name `wasm`. The enclosing workflow was
still in progress when retrieved; its whole deployment was not certified.

| Input | SHA-256 / fact |
| --- | --- |
| Artifact ZIP | `47485d739b924120d9a795cc6b522ddd10c91ede91fdb3c5e997cd6d888eb7b0` |
| `engine_wasm_bg.wasm` | `6057521d851bb8544eaeea467f741b90cd2941aa5ba2fddb17e1bcc3d9933f8f`; 40,060,780 bytes |
| `engine_wasm.js` | `47c42e78d34eeaad37d74b8163e5319d0578ba0ee8bd3476cfb70131de6287c9` |
| `runtime_card_export_fixture.json` | `ee062b8ad351e067723b79fc8462aaea19202ef9756d35b2101334eb3e350107` |

The checked-in optional driver verifies JS/WASM/fixture hashes before loading.
It is excluded from product imports, service-worker cache and production assets.
No third-party runtime binary or card fixture is committed to this repository.
Exact artifact URLs can expire: reacquire the same artifact or explicitly
version/revalidate a new build rather than silently substituting one. Before
adoption, resolve dependency notices, card-data/assets rights, hosting/offline
size and actual tested runtime compatibility.

What passed: three shuffle seeds × two starting-player settings, with both seats
driven by a deliberately **ungraded legal-choice smoke policy**. Each submitted
action belonged to the current engine legal set and was applied. All six runs
reached engine GameOver after 384–930 accepted actions, terminal turns 22–57.
The source fixture has Forest, Grizzly Bears and unused Lightning Bolt; the
decks are unequal land-heavy lists (56 Forest/4 Bears versus 57 Forest/3 Bears)
under the engine's Modern configuration. **Modern is not a selected shipping
format**, these are not realistic quality decks, and all six winners were seat
1. No balance, seat symmetry, strategy, independent rules correctness or broad
card support follows.

For one game, a fresh Node process reloaded the exact runtime/data and restored
engine plus policy RNG at action 80's Priority choice. Every remaining accepted
action, final turn and terminal result matched. Parent/child made zero `fetch`
calls under a throwing guard. This is **not** browser cold-start airplane-mode,
all-prompt recovery, idempotent history or latency evidence. Initial filtered
views redacted unknown card names/IDs and zeroed game RNG seed/position; ordered
opaque library IDs remained. That is not a complete privacy audit. The smoke
function uses its supplied actions/RNG but is not isolated from authority in a
worker. Do not feed raw saves, events or whole filtered state into the CPU on
the strength of this test.

Previous local paths, useful only if this workspace still exists:

- Repository: `/workspace/scratch/73ad2ed2de87/cardstashy`.
- Candidate checkout: `/workspace/scratch/73ad2ed2de87/engine-spike/phase`.
- Exact extracted runtime: `/workspace/scratch/73ad2ed2de87/engine-build/pkg`.
- Toolchain: `/workspace/scratch/73ad2ed2de87/engine-toolchain`.
- Source-build logs: `/workspace/scratch/73ad2ed2de87/engine-build-wasm.log`
  and `/workspace/scratch/73ad2ed2de87/engine-build-wasm-serial.log`.
- Versioned driver outputs: repository `test-results/phase-engine/` (ignored).
  The README specifies `CARDSTASHY_PHASE_PKG`, `CARDSTASHY_PHASE_SOURCE` and
  optional `CARDSTASHY_PHASE_OUTPUT`; use Node 24 and the exact external inputs.

These paths are transient, not a promise of cross-chat persistence. Durable
source, input hashes and captured evidence are in the repository.

## CPU architecture and unresolved fairness

Use authoritative legal actions → bounded local decision policy → accepted
engine events → UI/log/inspector. No expensive cloud language model is required
for the opponent. Wiki/Oracle metadata, roles and builder strategy are useful
explanations or deck-playbook hints; they do not execute rules, calculate layers
or establish a probability of winning.

Phase's default CPU is **not approved**: presets set
`determinization_samples = 0`; the search then evaluates authoritative hidden
state, and the WASM proposal path uses `rand::rng()` without our recorded CPU
stream. Enabling sampling alone is not a fairness proof. Build a whitelist,
seat-scoped permitted observation and legal-choice packet, independent saved
policy RNG and exact-deck playbook. Do not send full authority and trust the
policy to ignore fields. Previously revealed information, future draws,
candidate generation, timing, reasons and logs all need adversarial testing.

Easy/Medium/Hard use identical rules and information rights. Vary measured
planning budgets, evaluation/sequence quality and seeded plausible variation;
do not hardcode an untested 20% mistake rate or promise depths 1/2/3 equal whole
turns. Assistance is independent: highlights/help can stay on against Hard.
Contextual play includes mulligans, development, combat, actual threat/removal
timing, responses/protection, prerequisites and supported closing lines.
Hidden-information search and multiplayer Commander need explicit models;
alpha-beta alone is not a general solution. The CPU must act in response and
mandatory windows during either player's turn, not only its own turn flag.

Use small persistent workers, stable ordering, bounded node/iteration work,
cancellation and a wall-clock watchdog. Revalidate seat/revision/action/costs
before committing once. Record chosen actions and any cutoff fallback, because
a seed alone cannot reproduce hardware-dependent early stopping. Measure
cold/warm startup, p50/p95/worst decision time, main-thread frames, memory and
serialization on supported PCs. Do not promise zero lag or calibrated win odds.

## Pregame, coin and rules gaps

At the pin, card coin effects consume seeded `RandomDraw::Outcome` and emit
`CoinFlipped { player_id, won }`; replacements can suspend for keep choices.
Upstream suspension/persisted-wire tests were read, **not run by CardStashy**.
The six smoke games exercised no coin effects. The wire lacks a distinct
heads/tails-call contract, `UntilLoss` caps at 1,000 wins, and pregame emits a
seeded **d20** contest whose winner starts without offering Play/Draw. A coin
animation cannot disguise a die or a missing rules choice.

Define supported format-correct pregame/randomizer/call/play-draw/mulligan/bottom
and first-draw procedures. Real coin effects use one committed engine outcome;
animation, repeated clicks, refresh, difficulty and frame timing cannot reroll
it. Retain actor/call/individual outcomes/choices where applicable, correct
replacement mechanics and authorized logs. Skip/reduced motion reveals the
same result. Save/restart before/after toss and at follow-up choices must not
duplicate effects. A readable two-sided CardStashy coin, shading/shadow/settle,
text result and optional sound are separate visual acceptance from rule fidelity.

## Approved Play library, setup and deck context

Provide one cohesive artwork-led shelf: **Precons, Meta, Random, My decks**.
Both sides can use an eligible built/saved/imported deck. Browse real products,
sets, commanders, source and actual format; preview the exact cards in all four
views with a grounded concise plan. Quick Practice remembers the last valid
player deck/format/difficulty, shows the opponent before start and revalidates
both exact lists. Freeze random opponent identity, deck version and RNG before
the match; refresh never swaps its cards.

Do not confuse a set catalog, a real precon list, construction legality,
executable card coverage and tested CPU piloting. Not every set has a precon.
"60-card" is a size, not Standard/Modern/another format. Preserve main,
sideboard, command zone and all declared commanders/partner choices. Missing
lists or unsupported mechanics produce a clear recoverable unavailable state,
not a fabricated deck, silent substitution or manual mode.

Known importer gaps: `loadPrecons` reads MTGJSON's product index, while empty
`preconList` and ten-item `finderPrecons` favor Commander; the parser labels
only the first commander, flags multiples and excludes sideboard. Current index
download returned 403, so completeness was not verified. On October 24,
Wizards had published TMNT **Turtle Power!** with Partner—Character select; the
four Star Trek Commander products were named for November 13 but full decklists
were awaiting reveal. Recheck current official sources before new claims. Do
not invent unrevealed contents or certify those mechanics from metadata.

Version deck playbooks against exact lists/rules: mulligan, mana, setup/payoff,
combat/response priorities, tutors, protection, closing/combo prerequisites and
shared resources. Editing a list invalidates/rebuilds relevant analysis. A high
builder Power score, meta popularity or fast generation is not CPU mastery.

## Required game presentation and interactions

After the engine gate, use the full **browser content area**, suppressing normal
header/search and collection-finance framing during the match, without forcing
OS/browser fullscreen. Warm subtle table texture, quiet center, fanned bottom
hand, opponent/zone anchors, stack/phase/priority and readable board density
should use available space deliberately. Preserve printing/finish and current
effective state. The thirteen references include existing CardStashy tiles;
they are not a request to replace our shell with a competitor's purple UI.

Click or drag pickup selects the **exact visible card instance** and pins art,
brief rules, printed text and current derived state in the right rail. Log is
above, selected-card reading below, with required decisions always visible.
Pointer transit into sourced terms/nested help and inspector scroll must work
without losing selection. Temporary hover enlargement does not replace the
pinned card or cover a mandatory target/payment/response. Mill-style keyword
help supports hover, focus, click and keyboard access with sources/context.

Right-click selects and opens a scoped CardStashy game menu; visible/keyboard
Context Menu or Shift+F10 alternatives are required. Inspect, legal play,
abilities, mana and attack/block choices use current engine actions, including
unavailable reasons and stale revalidation. Merely opening/closing a menu cannot
play, reveal, tap, change counters/zones, save a deck or add inventory. Collection
gesture handlers must not capture board input. Unknown faces stay hidden.
Escape closes only the innermost menu/help and restores focus/selection without
canceling an underlying mandatory choice. Current `cardQuickMenu` modal/sheet
and transient `rule-hover.js` are reuse references, not a persistent game rail.

Drag highlights current legal destinations/targets; ghost/drop is uncommitted.
A legal drop opens exact target/payment choices, then uses the same command
path as explicit/keyboard Play. Invalid/stale drops restore the card and explain
why. Inspect remains separate from confirm/target input; suppress trailing click
after drag/hold. Selected duplicates with different effects remain distinct.

Automatic mana previews engine-legal payment for exact colored/generic/colorless,
X, hybrid, alternative/additional and restricted costs only where supported.
Manual tapping/override remains available before commit; prompt for strategic
discard/sacrifice/life costs. Distinct Cancel/Auto controls preserve the pending
action. Cancellation restores uncommitted state, not a universal post-resolution
undo or a reversal of revealed hidden information.

Engine consequences track life, marked damage, +1/+1 and other counters,
temporary/continuous modifiers, granted abilities, attachments, cleanup,
state-based deaths and terminal results. **Damage, counters and temporary +1/+1
effects are different.** Board and inspector must agree at the accepted revision,
show effective power/toughness, tapped/attack/block state, known effect sources
and expiry. Do not infer current state from printed art or a glow.

Animate accepted events and legal payment taps, never intended actions. Cards
deal/lift/travel/tap/settle with restrained cues; sound is separately controllable.
Mute/reduced motion/skip and missing optional art/sound cannot change rules or
hide a decision. Settings during a prompt preserve it and return focus. Retain
actual interaction recordings as well as before/after screenshots at desktop
widths, both themes, large text, crowded boards/hands, long rules and failures.

## Results, recovery, Draft and friends

Persist a valid terminal result **once**, then return to the player's exact deck
at **Matchups → Practice history**, selecting that match and retaining inspection/
log. Failed persistence has retry/recovery; stale completion cannot redirect a
newer view. History freezes both deck snapshots, format/seats, engine/card/CPU/
playbook versions, RNG/action trace, difficulty, assistance and terminal reason.
Confirmed Exit/Concede from a started CPU match is one loss; Cancel does nothing.
Crashes, engine errors, time ceilings and disconnects are not invented losses.

Provide Rematch, explicit Save opponent deck and up to three grounded moments
from actual events/knowledge. Copy the **actual frozen opponent list** with zones
and permissible provenance, including random CPU lists; never regenerate it or
add owned cards. Unsaved player lists retain a session snapshot/return route.
CPU Practice history stays distinct from human competition, simulated matchup
scores, published meta and heuristic Power; no automatic self-learning or broad
win-rate conclusion from a tiny sample. Future Journey reuses these contracts
with run/mode tags and separate virtual rewards/inventory.

Draft needs exact supported product/cube, collation/packs/seats/picks, bounded
bots, basics policy, limited construction, recovery and pool→deck→Practice
handoff. Existing collectible packs are not a draft engine. Private Casual/friend
sessions need explicit invitations/codes, accepted seats, server authorization,
per-seat observations, stale/duplicate command rejection, reconnect and a defined
disconnect/recovery policy under the same rules authority. No public matchmaking
or manual fallback is implied.

## Firm next gates and definition of done

1. Freeze/evaluate the actual engine/runtime/rights fit and a proposed exact
   constructed format, player count, card/face/token pool and two executable
   deck versions. First shipping format/pool and Draft product remain unresolved.
2. Extend isolated proof with independent tactical/rules fixtures: legal costs/
   targets, priority/stack, combat/lethal, removal/protection, attachments,
   counters versus damage, cleanup, supported coin/pregame and real deck plans.
   Record terminal reasons and resource bounds; a diagnostic ceiling fails or
   stays inconclusive.
3. Enforce CPU observation isolation and adversarial equivalence under changed
   hidden hands/future libraries with identical permitted knowledge/policy seed.
   Test reveal history, candidate packets, reasons/logs, multiplayer assumptions
   and same-knowledge difficulty behavior. Default Phase CPU is not the answer.
4. Prove actual browser cold-offline create/save/terminate/restart/resume at human,
   CPU, stack, target and payment choices; replay RNG/action streams and ensure
   no duplicate action/result. Measure startup/package/memory/decision/render
   cost and interruption/cancellation on supported desktop configurations.
5. Sign off that engine gate **before** integrating lobby/opening hand/table/
   payments/coaching. Then implement and review the actual interaction/reference
   matrix, complete all deck entrypoints, history/opponent copying, Draft and
   private Casual. UI polish and functional proof are both mandatory.
6. Produce exact-revision evidence, honest patch notes and known limitations in
   the game branch. Leave a concrete reviewable candidate. **Do not deploy,
   merge into production, turn on public Play, or release an APK from this new
   chat without a separate explicit release instruction.**

The local CPU design is plausible and the narrow runtime spike is useful
progress. The supported game, fair difficulties, full offline recovery and
finished Play interface remain development work.
