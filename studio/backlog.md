# Backlog: ranked small briefs

One row is one brief. "Seen" means in a device recording; "Read" means in the app code
only. New looks need a preview and the owner's yes. One native editor at a time.
Owning specs live in the project's shared `specs/` folder.

| Rank | Brief | Department | Evidence | Needs preview | Owning spec |
|---|---|---|---|---|---|
| 0 | Record one full match on the live build and mark each walk line | QA | No match recorded since 11 Nov | no | `qa/smoke-check.md` B |
| 1 | Clock sounds: no sound when a timer window opens; ticks only in the last 5 s; phase tick only on your own turn | Audio | Owner 14 Nov; Read `ui/TurnRing.kt:246`; measured: the cue is an old 1-second file, and the phase tick can play 100 to 200 times a match | no (fix) | `butter-pass-brief.md` B1 |
| 2 | Welcome back pop-up: tiles fit, packs merged, opaque close | UX, Art | Seen 14 Nov recording 0:00-0:04 | no (fix) | `butter-pass-brief.md` B2 |
| 3 | Settings: tabs fit the phone, Help shows the newest notes only | UX | Seen 14 Nov recording 0:11-0:25 | no (fix) | `butter-pass-brief.md` B3 |
| 4 | Every result names its cause (destroy, exile, bounce, sacrifice, discard): BUILT 14 Nov (cause plates, held card), with the builder; needs the device walk below | Game feel, UX | Seen on the rules engine (two real matches) and in test pictures; Not assessed on a device | approved 14 Nov | `match-table-master.md` |
| 5 | Nothing resolves in silence (draw, search, mill, "nothing happened") | UX | Read, same place | yes, same preview | `table-info-native.md` I3, M9 |
| 6 | The last three things stay readable on the table: BUILT 14 Nov (Last moves, left strip), with the builder; needs the device walk below | UX | Test pictures at phone, Fold, Thor; Not assessed on a device | approved 14 Nov | `table-info-native.md` I3 |
| 7 | CPU pace: stop shortening the CPU's moves while a response window is open or the queue is long; then measure a CPU turn against standard F2 | Game feel | Owner 14 Nov "CPU playing too fast"; Read `match/Director.kt` lengthOf(): every non-focal step drops to its minimum when a prompt waits on you or more than 6 s is queued, and think time is capped at 8 s a turn. Written full lengths match Arena's. Not measured | no (tuning) | `match-director-native.md` section 6 |
| 8 | Art ready before a card lands | Art | Owner 14 Nov "old art or pop-ins"; an art gate exists in code, not seen working | no (fix) once traced | `match-director-native.md` art gate, `loading-screens-brief.md` |
| 9 | Attachments as cards: equipment behind its host like auras | Art | Owner 14 Nov; Read `ui/ForgeTable.kt:3394` (count badge) | yes | `mobile-table-arena-parity-brief.md` M7 |
| 10 | The stack explains itself: large art card, text, who, aimed at | UX, Art | Owner 14 Nov; partly built, not seen | yes if the look changes | `table-info-native.md` I1 |
| 11 | Animation audit: list every table move against standards F1 to F4 | Game feel, Performance | Owner 14 Nov "clunky animations" | no | `match-punch-brief.md` |
| 12 | First performance reading: frame time on the table, Home and a dialog | Performance | Never measured on a device | no | `native-gap-audit.md` C |
| 13 | Tap, keyword and control changes announced | UX | Read: the engine bridge sends no event | yes | master N1 (host PR first) |
| 14 | Changed numbers coloured, inspect names what granted them | UX | Read: no base numbers in state | yes | master N1, `glance-marks-brief.md` G4 |
| 15 | Player states on the seat (monarch, initiative, day and night, dungeon) | UX | Read: zero mentions in the app | yes | master, special card types |
| 16 | One short match per card type | QA | Never done | no | `START-HERE-after-0457.md` phase 4 |

## Every result names its cause: what the polish pass left (14 Nov 2026)

Polish pass on the build of rows 4 and 6: art, game feel, UX and performance each returned
Concerns, from test pictures and code only. Fixed in the same branch before hand-over: a
card that leaves on a result's beat breaks or fades under its plate (it blinked out), Auras
leave with their creature in one beat (they lay loose for a beat), plates end with their beat,
a plate keeps off the numbers of a card that stays, plates stand in one column, Last moves'
header no longer comes and goes, rows slide to their place, two rows fit a phone, the held
card has a 44 dp touch box and no longer covers a name. Audio was skipped: no new sound
(a card leaving on a beat plays the death cue the table already had). Still open:

| Rank | Brief | Department | Evidence | Needs preview | Owning spec |
|---|---|---|---|---|---|
| C1 | Device walk of the cause line on a phone, a Fold and the Thor: Sheltered by Ghosts exiles, Feather of Flight draws, ward unpaid then paid, the creature destroyed, the held card returns. Record at 60 fps; check each card breaks or arrives under its plate, plate pictures are there on the first frame, Last moves does not jump, numbers stay readable under WARD and RETURNED on the phone, one run with reduce motion | QA | Not assessed on a device | no | `qa/smoke-check.md` B |
| C2 | A result's beat cannot be hurried: 1.6 s each, two in a row for a kill that frees a held card (about 3.7 s). A tap after the first second should move on | Game feel | Read `match/Director.kt` lengthOf(), `MatchController.next()` wired only to the beat caption | no (fix) | `match-director-native.md` |
| C3 | The CPU's rows in Last moves are ice blue (the approved preview) while the rest of the table marks the CPU in coral and you in blue or gold | Art | Seen in test pictures | yes (owner's call) | `match-table-master.md` |
| C4 | The held card cannot be reached with the controller (no ring, no "A: Read") | UX | Read `ui/CauseViews.kt` HeldCards: a plain tap target | no (fix), needs the Thor | `thor-two-screens-brief.md` |
| C5 | The held card is art only at 0.4 of a tile: no name until tapped | Art | Seen in test pictures | owner's call | `match-table-master.md` |
| C6 | A tap on a Last moves row should open that card | UX | Read: rows take no touch | yes | `table-info-native.md` I3 |
| C7 | Last moves text stays 9.5 and 10 sp on the Fold and the Thor while tile names grow | UX | Seen in test pictures | no (fix) | `ui/TextFloors.kt` |
| C8 | Phone: Last moves loses a row while mana floats (the pool takes its room) | UX | Read `ui/ForgeTable.kt` left strip | no (fix) once seen | `match-table-master.md` |
| C9 | A result with six plates composes all six in one frame; measure before changing | Performance | Read `ui/Battlefield.kt` trigger() | no | `native-gap-audit.md` C |
| C10 | `studio/standards.md` has no text size floor and no touch size rule; the only floors are in `ui/TextFloors.kt` | UX | Read | no | `studio/standards.md` |
| C11 | Dimmed gold tool buttons show a square dark box behind the round button (Fold, Thor) | Art | Seen in test pictures; not part of this change | no (fix) | `match-table-master.md` |

## The parity programme (owner, 14 Nov 2026: "a task force to transform this into an Arena clone, 1 to 1")

Arena's behaviour, flow, timing and feedback, screen by screen, in our own art, layout
styling, sounds and names. No Arena assets. The phases reuse the build order in the
project spec `START-HERE-after-0457.md`; the rows above are the first briefs of phases 0 to 2.

| Phase | Goal | Done when |
|---|---|---|
| 0. Butter | The faults the owner feels every session are gone: clock sounds, pop-up, settings, freezes | Rows 1 to 3 pass on a device; first performance reading taken |
| 1. See it | Everything built since 0.4.57 is seen in a recorded match, or logged as a fault | Row 0 done on the Thor and a one-screen phone |
| 2. The table explains itself | Every question names its asker, every result names its cause, nothing is silent, the stack reads like Arena's | Rows 4 to 10 pass a recorded match side by side with the same deck on Arena |
| 3. Any card explains itself | Keyword panels, granted-by, changed numbers, tap and control changes | Rows 13 and 14 pass; needs the engine bridge change |
| 4. Every card type | Vehicles, food and treasure, sagas, planeswalkers, equipment, dungeons, day and night, classes | Row 16: each type marked Seen, none Stuck |
| 5. Big moments and the deck builder | Opening hand, turn banner, lethal, match end; Arena-shaped deck builder on both Thor screens | A side by side recording of each moment |
| 6. Every other screen | Home, collection, packs, shop, settings, each compared with Arena's and brought to studio/standards.md | A polish pass with a device picture per screen |
| 7. Web port | The same on the site | The site walk |

Each phase ends with a recorded match on the Thor and on a one-screen phone, and a
polish pass. A phase is not done on code alone.
