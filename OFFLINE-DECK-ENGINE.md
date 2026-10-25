# CardStashy offline deck-engine foundation

Held for the incoming Play mega patch. Nothing in this package has been pushed,
merged, deployed or built into an APK. Production was checked at website 3.95.5,
source `fe1d753749af2324bd875e32ca8af8f8dbfd2ac9`, with no Play imports in the
served app. The Android release record still identifies interface 3.95.1,
APK 0.6.0 beta, version code 13.

## Implemented offline

- Upgrade the existing Commander bracket panel and move it above Power. Show
  restriction evidence, uncertainty, dates and clickable identified cards.
- Share dated Oracle-identity Game Changer membership between card details,
  generated-card badges, bracket checks and construction. The reviewed snapshot
  contains 53 identities. Add a bounded refresh script; policy dates require
  explicit review of official sources.
- Keep restrictions, intended table fit and Power separate. No automatic
  Bracket 2 for unknown data, tutor-count bracket shortcuts, or promise that a
  cut certifies a lower bracket. cEDH is not inferred from card count or Power.
- Add explicit Bracket 1–5 targets and Classic / Infinite engine choices in the
  shared Magic setup. Restrict official bracket targets to Commander. Classic
  does not promise the absence of every possible infinite interaction.
- Apply detected restriction exclusions in selection and final checks. Results
  that lack full table-fit evidence remain reviewable and provisional.
- Add an optional Commander Spellbook lookup from the saved deck Power panel.
  It checks exact quantities, Oracle identities when available, command-zone
  requirements, zones, startup, mana, steps and outputs. API lookup occurs only
  when requested and is cached for the exact list. A mana engine is not labeled
  as an automatic win. Indexed absence never means no combo exists.
- Bind generated-deck AI rebuilding to the exact selected list and its request.
  Reuse the existing dynamic answer suggestions and shared checked builder.
  Preserve format, budget, commander, bracket and explicit restrictions until
  the player changes them. A displayed price estimate never becomes a new cap.
- Add an opponent-list import to that bound conversation. Keep the opponent
  separate from the player's deck, invalidate stale work when it changes, and
  carry a conditional matchup profile into discovery, selection and the report.
  Search at most two additional answer lanes, with a small capped preference.
  Do not invent played results or promise a matchup advantage.
- Detect missing named-card, Saga and Suspend inputs; detect bounded Farseek,
  Equipment and Goblin searches with no remaining target. Preserve independent
  creature and other card utility. Skip optional pure search spells when the
  legal loaded pool has no eligible target; retain final-list checking.
- Make candidate ranking transitive across strategic, heuristic and unknown
  evidence classes; unknown strategic scores remain unscored.
- Include all new app imports in preload and offline asset inventories.
- Replace obsolete new-key/PWABuilder Android guidance. Prepare a separately
  tested tablet/unfolded-screen policy seam with idempotent pause/resume hooks.

## Executed checks

41 focused test files passed, including the new regression suite, the shared
flow, AI contracts/recovery/routing, budgets, Commander strategy/criteria,
bracket helpers, existing combo packages, matchup routes, native backend/auth,
preload and Power guards. See the accompanying validation log/results.
All eight current native bundle transforms also accepted the changed source.
These are focused code checks, not the full repository release matrix or
physical-device and complete-match acceptance.

Rechecking the supplied 100 captured lists finds 13 lists with missing search
roles and three missing defining inputs: Niambi (Teferi, Timebender), Face of
Boe (Suspend), and Ian Chesterton (Sagas). See audit-recheck-results.json.
This is not a new 100-deck generation run, price refresh or playtest. The
attached scripts reproduce the recheck from the user's original audit ZIP.

## Remaining integration and release work

1. Confirm the mega patch is actually served in production, including the real
   account-facing Play route. A branch push or green fixture test is insufficient.
2. Review current source and instructions. Reconcile this patch with the current
   release; never merge an old complete branch over it. The package supplies a
   portable diff, changed files and precondition hashes for review. Its local
   baseline commit is a source snapshot, not production Git ancestry.
3. Wire target/style choices into the new random Play pills. Share this request
   and evidence contract with the game and future roguelike. Avoid a duplicate
   builder, score engine or bracket badge implementation.
4. Finish full estimated-table-fit analysis and calibration. Current restriction
   floors are not a complete bracket estimator. Extra-turn/land-denial text
   patterns and the three target families are bounded, partial coverage.
   Spellbook's community tags do not replace official policy or execution proof.
5. Verify UI geometry, contextual follow-ups with the configured AI, API/CORS and
   failure handling in the actual app; rerun a fresh diverse generation sample.
   No paid AI calls or new 100-deck generation were made for this offline patch.
6. Reconcile pricing receipts throughout the final merged app. Existing price
   divergence and commander diversity findings are not solved by these narrow
   checks. Do not claim a full power-engine recalibration or quality certification.
7. Run the merged repository's full release gates, choose its next version and
   service-worker cache revision, deploy the website, and verify served bytes.
   This offline patch intentionally does not bump the live release record/cache.
8. Prepare the immediate hotfix plus Android APK from the exact verified web
   source, auditing all differences since Android interface 3.95.1. Preserve
   package and signing identity; locate the established key, never replace it.
9. Wire native posture/window events and Play guard hooks into the real engine.
   Hide Play on compact/portrait screens; pause timers/input/CPU on folding and
   show the gray overlay with the spinning app logo. Unfolding must resume the
   same board, turn, RNG and history. The seam alone does not implement this UI.
10. Adapt long hold and finger dragging, with cancellation, accessible tap
    actions, resize, background and restore tests on actual tablets/foldables.
    Build/sign/verify the APK and update its real download metadata only after
    the actual release artifact passes the coordinated verifier.

No game-engine rewrite, production change, signing-key change or migration is
included. The separate ongoing Play project must keep its own work isolated
until it completes its existing acceptance gates.

## Sources

- https://magic.wizards.com/en/formats/commander
- https://magic.wizards.com/en/news/announcements/commander-brackets-beta-update-october-21-2025
- https://magic.wizards.com/en/news/announcements/commander-brackets-beta-update-february-9-2026
- https://scryfall.com/docs/api/cards
- https://api.scryfall.com/cards/search?q=is%3Agamechanger&unique=cards
- https://spacecowmedia.github.io/commander-spellbook-backend/api.html
- https://backend.commanderspellbook.com/schema/

Official restriction guidance and list dates are separate from retrieval time.
Community provider classifications, local text patterns, construction heuristics
and a player's declared target remain separate evidence sources.
