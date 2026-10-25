# UI-001 — Readable match state and card actions

Base: `2af11c9a1326e0db75b875d9c122e3dea01055d7` (4.0.0). Branch: `codex/play-ui-layout-20261025`. Coordinator: issue #50. No deployment or engine rebuild.

Production changes are limited to `experiments/phase-engine/match-table.mjs` and `match-table.css`. Turn ownership and required actor are independent. Phases use readable names. Opening-hand decisions have their own heading. Card cues use offered, available, seat-authorized commands with exact instance references: blue Play/Cast, green abilities, purple choices, gold inspection. Inspection does not submit a command. Cards retain the shared artwork, finish and rules hooks. The hand is separate from two independently scrollable battlefield areas; the inspector is bounded. A short decorative turn banner never blocks input or waits before engine work. Reduced-motion disables it.

The existing pass token is labeled **Pass response** when the stack is nonempty and **Continue** otherwise. This does not implement End turn or direct stack resolution. Integration browser drivers using the literal `Pass priority` must update their locator; the token and command path are unchanged.

## Evidence

- PASS: 8 new focused presentation tests, including independent turn/actor, public-only grouping, exact-instance action cues, unavailable/unauthorized/busy/terminal cue removal and ambiguous-source exclusion. Run `node --test experiments/phase-engine/test-match-ui-presentation.mjs`.
- PASS: 70 focused tests including those 8 plus 62 pre-existing local placement, card stats, seat projection, interaction, session and timer checks. The latter are coordinator workspace guards, not added by this patch; the standalone 8-test file is reproducible from this commit.
- PASS: 56 mounted synthetic layout cases (7 scenarios × 8 CSS viewport sizes), recorded in `play-ui-001-layout-report.json`. Scenarios: early turn, crowded board, rejected mana choice, combat damage, hidden card canary, available actions, mulligan. Sizes: 1280×720, 1920×1080, 2560×1080, 3440×1440, 1024×768, 900×650, 1180×757, 590×378. Assertions cover page containment, column/reflow separation, reachable action dock, hand placement, both seat indicators, bounded inspector, unique instances and hidden-name exclusion. 590×378 is a reflow viewport, not an actual browser-zoom measurement.
- PASS: keyboard context menu (Shift+F10), Escape close, Exit confirmation and Keep playing cancellation; mounted selection/current-stat/clock checks.
- PASS: `node --check` and `git diff --check`.
- NOT TESTED: owner's signed-in live match, full match against this patch, real touch device, native APK, actual 200% browser zoom, first-time-player comprehension timing and uninterrupted Home-to-Home recording.
- UNSUPPORTED: session recovery in this beta. Smart auto-pass, Full Control and phase stops await SESSION-001 and are not implied by a missing card cue.

## Reproduce the browser review

Serve the repository with the existing static development workflow and open `/experiments/phase-engine/ui-review-index.html`. Click **Run layout matrix**. The fixture mounts the real table and artwork hooks over synthetic projected states; it does not prove rules legality or a completed match. **Check selection and clocks** checks inspector selection, retained card nodes, current stats, clock updates and one pass submission. The fixture files are review-only and are not additions to the production asset allowlist.

The source for the shared art import closure was checked against the release tree. Three initially older preview dependencies (`mtg-effects.js`, `style.css`, `finish-effects.css`) were replaced with exact release contents before the final matrix. They are not changed by this patch.

## Remaining contracts

SESSION-001 must provide authoritative priority coverage and revision-checked automatic passing; the current legacy choice list is partial and cannot establish emptiness. UI-002 separately owns Home/Play navigation, setup, loading and return flow. Accurate terminal reasons and detailed rejected-action messages need authority/session data. Do not claim a timeout is a normal loss or infer rejection causes from the displayed mana.

Reference principles: the supplied Moxgate capture illustrates local card cues and explicit player identity. Wizards' MTG Arena mobile overview documents near-hand castables, card inspection, direct combat interaction and explicit Full Control: https://magic.wizards.com/en/news/mtg-arena/mtg-arena-state-game-january-2021-01-21 . CardStashy keeps its own artwork, branding and legal-action contract.
