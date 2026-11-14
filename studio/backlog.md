# Backlog: ranked small briefs

One row is one brief. "Seen" means in a device recording; "Read" means in the app code
only. New looks need a preview and the owner's yes. One native editor at a time.
Owning specs live in the project's shared `specs/` folder.

| Rank | Brief | Department | Evidence | Needs preview | Owning spec |
|---|---|---|---|---|---|
| 0 | Record one full match on the live build and mark each walk line | QA | No match recorded since 11 Nov | no | `qa/smoke-check.md` B |
| 1 | Clock sounds: no sound when a timer window opens; ticks only in the last 5 s | Audio | Owner 14 Nov; Read `ui/TurnRing.kt:246` | no (fix) | `butter-pass-brief.md` B1 |
| 2 | Welcome back pop-up: tiles fit, packs merged, opaque close | UX, Art | Seen 14 Nov recording 0:00-0:04 | no (fix) | `butter-pass-brief.md` B2 |
| 3 | Settings: tabs fit the phone, Help shows the newest notes only | UX | Seen 14 Nov recording 0:11-0:25 | no (fix) | `butter-pass-brief.md` B3 |
| 4 | Every result names its cause (destroy, exile, bounce, sacrifice, discard) | Game feel, UX | Read `match/Director.kt` resolutions() | yes, preview made | `match-table-master.md` |
| 5 | Nothing resolves in silence (draw, search, mill, "nothing happened") | UX | Read, same place | yes, same preview | `table-info-native.md` I3, M9 |
| 6 | The last three things stay readable on the table | UX | Read: history is only in the match menu | yes, same preview | `table-info-native.md` I3 |
| 7 | CPU pace: measure a CPU turn against standard F2 and slow it to match | Game feel | Owner 14 Nov "CPU playing too fast"; think time exists in code, not measured | no (tuning) | `match-director-native.md` |
| 8 | Art ready before a card lands | Art | Owner 14 Nov "old art or pop-ins"; an art gate exists in code, not seen working | no (fix) once traced | `match-director-native.md` art gate, `loading-screens-brief.md` |
| 9 | Attachments as cards: equipment behind its host like auras | Art | Owner 14 Nov; Read `ui/ForgeTable.kt:3394` (count badge) | yes | `mobile-table-arena-parity-brief.md` M7 |
| 10 | The stack explains itself: large art card, text, who, aimed at | UX, Art | Owner 14 Nov; partly built, not seen | yes if the look changes | `table-info-native.md` I1 |
| 11 | Animation audit: list every table move against standards F1 to F4 | Game feel, Performance | Owner 14 Nov "clunky animations" | no | `match-punch-brief.md` |
| 12 | First performance reading: frame time on the table, Home and a dialog | Performance | Never measured on a device | no | `native-gap-audit.md` C |
| 13 | Tap, keyword and control changes announced | UX | Read: the engine bridge sends no event | yes | master N1 (host PR first) |
| 14 | Changed numbers coloured, inspect names what granted them | UX | Read: no base numbers in state | yes | master N1, `glance-marks-brief.md` G4 |
| 15 | Player states on the seat (monarch, initiative, day and night, dungeon) | UX | Read: zero mentions in the app | yes | master, special card types |
| 16 | One short match per card type | QA | Never done | no | `START-HERE-after-0457.md` phase 4 |

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
