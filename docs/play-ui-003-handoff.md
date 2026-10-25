# UI-003 — deck journey, Quick Play and runtime controls

Owner: UI. Implementation started on UI-004 `e4086bc6f73c44a19895074e22314f803e7f596d`; final handoff is based on integration `353420fb07fc09d3cf4d1eae25437c470a7476b9`. This is a UI handoff for sequential integration, not deployment or complete-release certification.

## Behavior

- Play has Your decks, Precons, Community, Meta and Random sources. Both Practice seats use the existing shared four-view deck inspector and artwork. Precons reuse the existing Commander catalog. Community uses saved online references and accepted friends' shared lists; it does not claim a new public showcase. Commander Meta is explicitly cEDH. Source failures remain retryable. Explicit Meta refresh bypasses the existing cache TTL.
- External, pasted and generated lists stay temporary. Save deck makes an account-scoped copy in the normal Decks list, preserving rows, sideboard, commander declarations, selected printings/finish metadata and provenance. It does not add inventory. Concurrent saves coalesce; failures allow retry; account changes retire the result. Post-match Save uses the frozen original player selection. No match-result/statistics persistence is added.
- Random uses the existing checked builder for either seat. Cancelling, changing format, choosing another list or changing account retires late results. The animated brand mark communicates actual building, without invented percentages.
- Quick Play preserves the player's chosen list, considers available same-format supported candidates, and uses existing deck Power estimates with an Easy/Medium/Hard target. It is estimated local CPU pairing, not public matchmaking or a balance guarantee. A mirror list is disclosed. Missing estimates are disclosed. Changes to the selected list, format, difficulty or CPU selection invalidate the pairing. Practice lets the player choose both lists. Social stays unavailable.
- Easy, Medium and Hard read the delivered CPU v3 module. Hard retains Experimental beta wording. The integration parent already contains the reconciled preflight, worker and policy forwarding; this patch does not replace them. Unknown CPU config versions fail conservatively. Both-seat deck admission remains authoritative.
- Turn controls bind the actual SESSION-001 v1 methods and require supported capabilities plus a current revision. Smart/Full Control, temporary yield, Cancel auto-pass and separate own/opponent phase stops are available when supported. No UI code submits an automatic pass. With current unknown engine coverage, the UI says automatic passing is paused; it does not promise empty-window skipping.
- Commander has separate visible Command-zone objects using their actual identities and the existing inspector/actions. Life comes from accepted state. Tax, commander damage and designation after zone changes are **still an authoritative projection dependency**; no values or cast counts are inferred here.
- The owner's gray-hand-card screenshot exposed a real CSS bug: the battlefield land cue's top offset overrode the hand cue's bottom alignment, stretching the opaque Play label over the entire Forest. Battlefield land rules are now scoped to battlefield presentation. The hand cue stays a small footer. Blue/cyan frames legal plays/casts; green frames legal activations; inspection/selection remain distinct. Unavailable hand cards keep full artwork and normal brightness. Accepted tapped permanents rotate and use mild dimming, independent of selection.

## Evidence

All evidence is local browser or Node evidence unless explicitly attributed to another handoff. The preview uses the managed HTTP host; no new server or deployment was created.

| Check | Result | Layer |
| --- | --- | --- |
| Setup, source adapters, exact save, account retirement, quick invalidation, builder cancellation, menu/pregame/navigation | 62 PASS | Node, including existing regressions |
| Table cues, public grouping, private previews, exact artwork/finish identity | 18 PASS | Node |
| Deck browsing/save/random/Quick Play and all three difficulty selections/preflight | 34 PASS | Browser; production components, fixture providers/account/save/builder result |
| Opening, targets, combat draft, drag destination, clocks, turn controls, Command zones and visible card cues | 42 PASS | Browser DOM with controlled session |
| Home → setup → cancel → pregame → keep → synthetic result → failed Save → retry → Home | 15 PASS | Browser host; synthetic outcome, not a real match |
| Table layout | 96 PASS | 12 scenes × 8 CSS viewport sizes |
| Setup/host layout | 56 PASS | 7 scenes × 8 CSS viewport sizes |
| Changed cue/control/Commander layouts after final CSS fix | 9 PASS | 1180×757, 1280×720, 590×378 |
| Actual integration session and UI controls | 9 PASS | Browser; controlled client and captured real-engine capability |

The 590×378 case is a reflow check, **not actual 200% browser zoom**. Layout reports do not constitute visual approval. `play-ui-003-playable-art-fixed.jpg` is an actual 1180×757 rendered fixture crop with the repaired Forest artwork and activation cue; it is not a live match or card-support certificate.

`ui-session-controls-review` additionally runs the actual integration match-session/priority-flow and UI adapter against a controlled client with the exact unknown-coverage capability captured by SESSION-001's real-engine fixture. It checks Full Control, yield stopping on uncertainty, separate phase stops and no automatic mutation. Its report identifies its evidence boundary; it does not run a live engine or complete match.

The earlier UI-004 real-engine combat evidence is retained in the parent. CPU-006's six completed worker matches are separate CPU evidence. Neither is represented as a new full-app match in this handoff.

Reproduce:

```sh
node --test test-play-deck-sources.mjs test-play-setup.mjs test-play-opponent-build.mjs test-play-journey-ui.mjs test-play-menu.mjs test-play-starter-deck.mjs test-play-pregame.mjs test-play-session-navigation.mjs
node --test experiments/phase-engine/test-match-ui-presentation.mjs experiments/phase-engine/test-match-ui-refinement.mjs test-play-artwork-views.mjs test-play-card-surface.mjs
```

Browser entrypoints: `ui-deck-review.html` (Check deck journey), `ui-journey-index.html` (Run synthetic journey), `ui-review-index.html` (Check decision flows / changed layouts), `ui-session-controls-review.html` (actual session controls). They must be served with this integration parent and unchanged runtime dependencies. Provider/account/build results in these fixtures are expressly synthetic.

## Integration and remaining work

Production files changed: app.js, play-menu.js/css, play-setup.js, play-deck-sources.js, play-quick-match.js, play-cpu-options.js, play-opponent-build.js, play-player-mat.js, play-turn-controls.js, experiments/phase-engine/match-table.mjs/css. Other changes are tests, fixture pages and evidence. No CPU, engine, authority, preflight, projection, foil-system or session file is changed in the handoff.

Add the four new root modules (`play-deck-sources.js`, `play-quick-match.js`, `play-cpu-options.js`, `play-turn-controls.js`) to integration-owned asset/service-worker packaging. Keep its existing CPU/priority-flow assets. New runtime imports must not be absent from an offline/cached package. Do not replace the integration session or CPU adapters with older UI checkout copies.

NOT TESTED here: live signed-in provider/save calls, a complete match through the final combined app, actual browser zoom, physical touch, owner account and new-player usability. Commander tax/damage projection, complete safe action coverage, broader decks/CPU target coverage, engine rejection atomicity, outcome/history and final release checks remain required dependencies. Recovery remains UNSUPPORTED. User-visible automatic empty-window skipping is not completed by these controls.

The main project remains one combined release. Do not interpret this bounded UI handoff as dropping the outstanding features or authorizing deployment. No paid engine build, workflow dispatch, APK change or production release performed. Rollback: omit this UI commit while preserving integration parent 353420fb.
