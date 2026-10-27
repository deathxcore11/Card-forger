# 4.2.3 · Play table: handoff notes

Thanks for picking this up. These notes cover what 4.2.3 changed in Play, where each piece lives, what was checked, and the open items, so you can fix, extend and add the engine work with confidence. Forge remains the rules authority. Nothing in this release decides legality, auto-passes, or reveals hidden cards. Every table feature only reads the accepted native state.

## What changed for players

- **Obsidian table.** A stone mat with a gold border. The board sits in the middle. Each player's panel, zone counts and commander are at the sides. Floating mana and one decision card are at the bottom right. Every permanent is a small card showing its colours, name, real art and current P/T. Tapped cards tilt instead of turning sideways. Pieces resize so both rows fit, and a long creature row wraps onto a second line.
- **Card preview.** Hover a card, press and hold on touch, or use the magnifier or I key. The whole card appears beside it with a compact panel showing:
  - current P/T (raised or lowered against the printing);
  - damage, counters, tapped, attacking or blocking, and "can't attack yet";
  - keywords in plain words, falling back to the bundled Comprehensive Rules sentence;
  - rules text, only when it differs from the printed card.

  The old inspector no longer opens for cards. History & stack still opens the side panel.
- **Highlights by meaning.** These come from Forge's own selection lists:
  - cyan: you can play or use it;
  - orange: a legal target (players too);
  - red: pick to discard;
  - gold check: already chosen.

  Attacking red and blocking blue take priority.
- **Arrows.** All are drawn from state only:
  - attacker to defender, in red;
  - blocker to attacker, in blue;
  - while choosing targets, source to each chosen target, in gold;
  - stack item to its targets, when Forge sends them.
- **Paced CPU turns.** A burst of CPU changes from one poll is revealed one beat at a time, in this order:
  1. lands;
  2. taps;
  3. each spell shown large for a moment ("CPU · name");
  4. arrivals;
  5. life change as a rising number.

  The whole sequence is capped at about 3 seconds. It is visual only, and every card is already where Forge put it.
- **Decision card.** Shows whose turn it is, one supporting line, Smart / Full Control, and one large next step. The help paragraphs and the Highlighted choices / Match details drop-downs are gone from Play (the proof page keeps them). The stack is listed plainly when it is not empty.
- **Discard.** Cleanup discard reads "Choose N cards to discard". N comes from `selection.max` or Forge's message.
- **Pre-game.**
  - Versus screen with both decks' real art.
  - 3D coin flip (your picture vs the CPU deck's art) that lands on Forge's result.
  - "You won / CPU won / Draw" banners.
  - Concede dialog and Play menu in the same style.
- **Layouts.** The look applies from the opening hand on and at every size. Short landscape screens (200% zoom, phones or foldables held sideways) get a compact version of the same table instead of the stacked layout.

## Where things live

| Area | File | Notes |
|---|---|---|
| Table behaviour | `experiments/forge-proof/forge-table.mjs` | `enhance()` runs after every render through the MutationObserver. Everything it injects is idempotent; keep it so. Also contains the preview (`showPeek`/`peekHtml`), CPU pacing (`paceCpu`/`spotlight`), arrows (`relations`/`drawArrows`), glide, drag and drop, and keyboard handling. |
| Decision card | `experiments/forge-proof/native-panel.mjs` | The hosted branch omits hints and diagnostics and keeps the split title (the heading text is unchanged for screen readers). |
| Session projection | `experiments/forge-proof/forge-session.mjs` | Passes through `attachedTo`, `attachments`, `attackTarget` and `blockingIds` when the engine sends them (validated integers only). |
| Table look | `play-forge-table.css` | "The Obsidian look" block applies on every size; positions live in the `min-width:901px` blocks, with the short-screen block last. The intro and coin rules are at the top. |
| Pre-game / results | `play-forge-pregame.js`, `play-forge-player-mat.js`, `play-menu.js`, `play-menu.css` | Copy-only changes in tested strings were avoided. |
| Art | `assets/play/*.webp` | The mat; turn and result banners built from the phase kit's blank frames plus icons (no generated card art). |
| Dev fixtures | `experiments/forge-proof/table-fixture.html`, `pregame-fixture.html` | Not deployed (`.assetsignore`). Table states: `?state=main`, `targets`, `attack`, `cpu`, `dense`, `discard`, `opening`. Pre-game screens: `?screen=menu`, `intro`, `choice`, `flip`, `landed`, `result`, `failed`, `interrupted`. |

## Engine requests (to unlock more on the table)

1. **CPU pacing on the host.** The client can only sequence what one `/state` poll returns. A short pause between visible AI actions (about 0.4–0.9 s, not during Smart auto-pass of empty steps) lets each step show on its own.
2. **Relations on native cards:**
   - `attackTarget: {kind:'player'|'card', id}`, so attacks on planeswalkers and battles get arrows;
   - `blockingIds: [attackerId…]`, so blocks pair correctly with several attackers;
   - `attachedTo` and `attachments`, so the preview lists auras and equipment.
3. **Stack targets.** `targets: [{kind, id}]` on stack items gives arrows from the stack line to the target, including CPU spells aimed at you.

## Verified

- Full per-file suite (`package.json` test list) on the release tree. The only failures are `test-actions` and `test-preload`, which also fail on 4.2.1 and 4.2.2.
- `experiments/phase-engine/test-match-ui-presentation.mjs` has two failures that are identical on 4.2.2. That file is not in the release list.
- Every Play test file passes.
- Fixture captures:
  - sizes: 1920×1080, 1366×768, 2560×1080, 1440×900, 1180×820 touch, 960×540 (200% zoom), 820×1180 and 390×844;
  - every table state, plus a simulated CPU burst and a simulated block.
- An independent review found eight defects, all fixed in this release:
  - the side panel covering the CPU while choosing targets;
  - an image-error loop;
  - focus loss on redraw;
  - the discard count;
  - floating mana on small screens;
  - the hand arc;
  - dock scrolling;
  - drag-back casting.

## Known limits and good next steps

- **Phone portrait** keeps the existing stacked layout (now in the Obsidian look). Your hand is below the board and needs a scroll. A dedicated portrait layout is still to do. The APK "unfold to play" gate the owner described is not built yet.
- **Arrows** are drawn only where certain (see the engine requests). With several attackers and no `blockingIds`, blocks show highlights but no arrows.
- **Keyword hints** are hand-written for about 25 common keywords, with a rulebook fallback for the rest. Extend `KEYWORD_HINTS` as needed.
- **The pre-game copy** in the menu status line could be trimmed further, but `test-play-journey-ui` checks "Keep this page open".
- **Attachments** are not shown until the engine sends them (see above).
- **Real-device checks** still owed: a signed-in live match on desktop, a foldable/tablet and a phone, plus touch long-press and the drag-to-play gesture.

Questions about any of this are welcome. The fixtures reproduce every state named here without a server.
