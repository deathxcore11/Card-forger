# Studio standards: what "like butter" means

Each line is a rule a reviewer can check on a device. "Measured" numbers come from the
Arena recordings of 10 and 11 Nov 2026 (project specs `arena-watch-1110.md`,
`arena-vs-ours-match-study-1111.md`). "Proposed" numbers are starting points to confirm
after the first device measurement; do not treat them as measured.

## Art
- A1. No card lands on the table, the stack or the hand before its art is ready. A card
  without art waits in its travel, it never pops in afterwards.
- A2. Anything attached to a card is drawn as a card: an aura or equipment sits behind its
  host with its name bar showing, stacked when several. Never a text tab or a bare count.
- A3. One look everywhere: dark glass, gold edge, whole cards. Arena's behaviour, never its art.
- A4. A dialog is opaque. The page under it never shows through its card while it opens or closes.

## Game feel
- F1. Every move has three parts: a start (lift or glow), a travel, a landing. None may be skipped.
- F2. Pace, measured on Arena: a cast takes about 2.5 s from hand to table; a land about 1.0 s;
  an opponent turn with one land and one creature about 5.9 s; combat strikes 0.4 s apart.
  The CPU never plays faster than these.
- F3. Anything the player must read is held at least 900 ms, even when nobody can respond.
- F4. The table never jumps. A layout change is animated or does not happen during play.
- F5. Reduced motion keeps the holds and the words and drops the travel.

## Audio
- S1. Every sound means one thing, and the player can say what.
- S2. A sound the player did not cause plays at most once per event. Nothing plays on a
  timer window opening or resetting.
- S3. Loudness tiers by peak (from `match-sound-brief.md`): killing blow about -1 dB; big hits
  -1 to -3; casts and landings -4 to -6; cards and ticks -8 to -12; buttons -10 to -16.
- S4. A warning sound is rare by design. If it is heard more than a few times a match, it is wrong.
- S5. Proposed: no single cue more than 20 times in a ten-turn match, card draws and mana aside.

## UX
- U1. No label wraps inside a word or one letter per line, at 360 dp wide and up.
- U2. Every control on a screen is reachable without sideways scrolling on a phone.
- U3. Every question names the card that asks it. Every result names the card that caused it.
- U4. Nothing sits over the battlefield unless it is part of play.
- U5. A long page starts with what matters now. History is behind one tap.
- U6. The game stops only when the player truly has an answer.

## Performance
- P1. Measure before judging. Every screen gets a frame-time reading on a real device
  before anyone says it is smooth or slow.
- P2. Proposed: no frame over 32 ms during a card travel or a dialog opening.
- P3. Proposed: a tap is answered on screen within 100 ms.
- P4. A freeze is a bug with a log, not a feeling. `FreezeReport` output goes in the bug report.

## QA
- Q1. Pass, Fail or Not assessed. A Pass has a proof file from the real thing.
- Q2. Every bug the owner hits gets a regression test with the input that broke.
- Q3. One recorded full match per release.
