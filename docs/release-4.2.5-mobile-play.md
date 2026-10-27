# 4.2.5 · Play on tablets and foldables: handoff

Thank you for checking this release. These notes cover what 4.2.5 changed in Play and where it lives, and they list the open findings from an automated audit. Those findings were not independently confirmed, so please check them before you fix them.

Forge remains the rules authority throughout.

## How it should behave

### Who can play
Rules live in `desktop-play.js`.
- **Touch devices** are admitted when the shortest viewport side is at least 600 CSS px, in either orientation.
- **Tablets held sideways** stay admitted when the browser's bars take height. This needs a screen of at least 600 px and a window of at least 600 × 520.
- **While a text field has focus,** only the width counts. This stops an on-screen keyboard from triggering the notice or the pause.
- **Phones and cover screens** see "Play needs a bigger screen".
- **Browsers:** any browser with container queries, `:has()` and pointer events can play.
- **Chrome's desktop-site mode** on large Android tablets reports a desktop user agent with touch as the only input. It plays by the touch rules.
- **Desktops** can play at any window size and never pause.
- **The Android app** still does not offer Play (`reason:'native'`). Native Play is ready on the app session's branch and ships in a later release.

### Pause
Logic lives in `play-forge-player-mat.js`.
- A touch device whose screen becomes too small shows "Unfold to keep playing".
- The match resumes as soon as the screen fits again.
- After `PLAY_SMALL_SCREEN_LIMIT_MS` (5 minutes) the player concedes.
- If conceding is refused, the table closes and says why.

### Layout by shape
Rules live in `play-forge-table.css`.
- **Width/height of 1.15 or less** (upright tablets, unfolded Galaxy Z Folds either way round): the upright table.
  - CPU panel and zone counts across the top.
  - Board across the middle.
  - Hand above your panel.
  - Floating mana and the decision card beside your panel.
  - The space above the decision card follows its real height. `forge-table.mjs` sets `--dock-live` from a ResizeObserver.
- **600–900 px wide and wider than 1.15:1** (Pixel Fold sideways, split screen): the compact table, with the board widened over the empty left column.
- **Wider screens:** the side-column table, unchanged from 4.2.4.

### Cards
Logic is `previewOnly`, `peekAction` and the click handler in `experiments/forge-proof/forge-table.mjs`.
- There are no magnifier buttons.
- **Touch:**
  - A tap on any card while you hold priority opens it large. If Forge offers the card, the popup has one Play (hand) or Use (board) button.
  - Dragging a card up out of the hand plays it. Hand cards are `touch-action:none`; board cards leave every swipe to the browser.
  - During targets, attackers, blockers and discards, one tap picks.
- **Mouse:** hover previews; clicking an offered card plays it, and clicking any other card opens the preview.
- **Keyboard:** I previews a focused card.

## Tests
- `tests/play-table-mobile-browser.mjs` runs in CI on 11 device sizes. It covers: everything on screen, the hand clear of the decision card, 44 px controls, tap to open, Play from the popup, finger drag up (plays) and back (nothing), and the opening hand.
- `tests/forge-table-touch-browser.mjs` covers long press.
- `test-play-forge-peek.mjs` covers click and tap routing.
- `test-play-screen-gate.mjs` covers admission, the keyboard rule and the pause timer.

## Open audit findings (unconfirmed; please verify first)

### Upright table
- Board card names stay at 9.5–10 px even when pieces are large.
- On crowded boards on tall tablets, pieces get small while zone height stays empty. The fit formula in `forge-table.mjs` and `--fit-*` should use the free height.
- A pile of identical creatures can split across two rows.
- Pixel 9 Pro Fold (791×820): the two battlefields can overlap and run under the hand.
- Opening the Match menu reflows the header pills; the panel covers the CPU's commander and hand.
- The History & stack panel covers the CPU panel and life total.
- At 900 px or less, the CPU hand fan collapses to thin slivers.

### Side-column and compact tables
- Galaxy Tab S9 sideways (1024×640): the decision dock clips End turn and the stack, which can only be reached by scrolling the dock.
- Busy boards on 1024-wide tablets shrink pieces to 42–60 px.
- Desktop: keyboard focus on a hand card scrolls the whole table up. Consider `overflow:clip` on the table's scroll containers.
- The CPU hand count is visually hidden and the fan stops at 10 backs.
- Cards in the Zones menu (graveyard, exile, command zone) do nothing when clicked, so their text can't be read.
- The target arrow appears to start from the neighbouring hand card.
- Playable lands and artifacts sit in a hard-edged dark rectangle because the row clips their glow.
- Zone count labels are 8.5 px and truncated ("GRAVEY…").

### Touch
- Dragging a hand card down or sideways onto the decision card plays it. That panel is a drop target by design; consider removing it as a drop target on touch.
- The drag ghost shows the board-style name banner and P/T chip, and the source card stays in the hand.
- Some inspector, stack and Zones-menu buttons are 32–36 px on touch.
- Long press on portraits, mana icons and life totals is not guarded against the browser's image menu or text selection.

### Menus, gates and pause
- The pause card loses focus on resume and can be hidden under an open Exit dialog.
- Touch scroll trap in the two-column Play menu on landscape tablets: swiping inside a column never scrolls the page back to the Play CPU button.
- Some Play menu, pre-game and result controls are under 44 px with 10 px labels.
- The Play menu status line repeats "first" when neither deck is chosen.
- Game progress shows raw Forge input names, e.g. "Turn 5 · InputSelectTargets".
