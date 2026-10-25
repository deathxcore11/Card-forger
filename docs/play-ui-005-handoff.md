# UI-005 — portrait HUD and uninterrupted decisions

Owner: UI. Parent: `616911a059ef55cb745ef8d4a0a1f987b3bef3e1` (UI-003 / PR54), which is based on integration `353420fb`. Integration's later `3110e75` is evidence/harness only and does not overlap these files. This is a bounded follow-up, not a deployment or completed release.

## Reproduced problem and change

In the target fixture at 1180×757, Enter selected Ordinary Bear, I opened its inspector, and Enter on Close inspector removed the focused button. No element remained focused; the next Tab returned to History & stack at the beginning of the table. The private target stayed selected, but keyboard users lost their place.

The inspector now records its opening control and returns focus there on Close or Escape. It falls back to the current card, then History & stack if the original control no longer exists. History returns to its own entry. Escape closes the focused disclosure and returns to its summary. A context-menu Escape restores its origin. The native exit dialog retains its existing cancellation/concession behavior. No target, combat, command, session or engine state is changed by these presentation operations.

A final screenshot also revealed secondary controls extending beneath the hand when Controls is present. They now wrap within the portrait column, with matching portrait/Command-zone clearance. Cancel auto-pass appears in the decision dock instead of adding another header row. The approved tabletop composition is preserved.

The owner then requested a more finished turn HUD. Portraits now use a shared CardStashy crest as the no-photo fallback (the actual profile crop/photo remains intact), an inset turn/response emblem from the app’s existing icon family, stronger type hierarchy and a protected dark layer over the artwork. Turn and response stay separate text facts. A brief emblem pulse occurs only when its state changes, not when inspecting a card; reduced motion retains the static cue. Desktop battlefield and secondary-control clearance account for the refined HUD.

Production changes: `experiments/phase-engine/match-table.mjs`, `match-table.css` and `play-player-mat.js`. `ui-review.mjs` and `ui-review-index.html` add regression fixtures. The harness prevents simultaneous runs against its shared iframe, so results cannot mix.

## Evidence

| Check | Result | Boundary |
| --- | --- | --- |
| Focus and interruptions | 40 PASS | Production DOM handlers with a controlled session; target, combat and Controls scenes |
| Existing decision suite | 42 PASS | Production DOM with synthetic session; opening, targeting, combat, payment, controls, command zones and card cues |
| Existing table/artwork and host/navigation Node checks | 24 PASS | Presentation, public grouping, private previews, exact artwork/finish identity, host and exit navigation |
| Table layout matrix | 96 PASS | 12 scenes × 8 CSS viewport sizes; adds explicit control/hand and control/portrait clearance checks |
| Browser keyboard reproduction after fix | PASS | Actual Enter, I and Escape inputs against the controlled target scene |

The 40 checks include preserved private targets/combat assignments while opening Controls, changing Full Control, inspecting cards, opening card actions, inspecting History and cancelling Exit. They check that temporary yield cannot skip a pending choice, focus returns to the relevant control, no game action is submitted by interruptions, and the original target still submits once when explicitly confirmed.

The actual keyboard check verified `card-8` after Close, `inspect-card-8` after inspector Escape, initial safe focus on Keep playing in the exit dialog, native Escape returning to Exit match, and the unchanged Ordinary Bear target. The final screenshot is a rendered target fixture with the refined portrait HUD, not proof of engine card support or a live match. Visual review also caught unnecessary scrollbars on two-card battlefields; compact vertical padding removes the 2-pixel overflow while retaining scrolling for crowded boards.

Evidence: `docs/evidence/play-ui-005-focus.json`, `play-ui-005-keyboard.json`, `play-ui-005-decisions.json` `play-ui-005-layout.json`, `play-ui-005-node.txt` and `play-ui-005-focus-return.jpg`.

The first combat test mistakenly clicked the portrait instead of the offered Attack CPU control; its draft-created assertion failed. The corrected fixture uses the actual relation button. An early overlapping harness run mixed results; those were discarded, the runner now locks other suite controls, and final reports are separate completed runs. Focus checks settle synchronous/session microtasks; they do not claim animation timing coverage.

Reproduce browser: `experiments/phase-engine/ui-review-index.html` → Check focus and interruptions, then Check decision flows after completion. Node:

```sh
node --test experiments/phase-engine/test-match-ui-presentation.mjs experiments/phase-engine/test-match-ui-refinement.mjs test-play-artwork-views.mjs test-play-card-surface.mjs test-play-journey-ui.mjs test-play-session-navigation.mjs
```

Actual 200% browser zoom remains NOT TESTED. Ctrl+plus left the reported viewport and device-pixel ratio unchanged, so it cannot establish zoom coverage. CSS reflow is separate. Physical touch, live account/provider saves and the final combined full match remain outside this evidence.

## Shared release dependencies remain open

Safe automatic passing still needs complete authoritative action coverage; current unknown coverage must stop. Broader-deck required targeting, Commander tax/damage/designation, rejected-action atomicity, and outcome/clock/history contracts remain assigned to their existing owners. This UI change does not close or replace any of them. Recovery remains UNSUPPORTED.

Integrate after UI-003 (PR54), preserve its CPU/session dependencies and four-module packaging requirement, then run the combined journey against the resulting commit. No merge, deployment, engine/paid build, workflow dispatch or APK change performed here. Rollback is omission of this follow-up while retaining UI-003.
