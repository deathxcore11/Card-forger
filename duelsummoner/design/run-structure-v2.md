# Duel Summoner: run structure v2 (plan, 27 Nov)

The owner changed the run flow on 27 Nov at 4:04 PM ET. It replaces the 23 Nov flow, where the gate woke up and you walked through a door. This file is the plan only: it gets built after the feel pass and the ride gym. The door and gate code stays in place and removable until the new flow passes the bots.

## The flow

1. **Stage clock.** The clock is 12 minutes, as the owner chose on 24 Nov, unless he changes it. There is no door near the start and no gate to wake.
2. **On the clock.** Hordes build up on the stage clock. Elites and mini-bosses come at set clock marks.
3. **When the clock ends**, the stage boss comes after the player with its own enemies and systems. It is not a place you walk to.
4. **The boss dies, and the portal opens:**
   - It opens at a seeded spot 120 to 200 m from where the boss died.
   - A red wind guides you when you are close. There is still no beam.
5. **Overtime starts at once:**
   - Its enemies come for you, can be killed early, and get harder with time.
   - Staying longer pays more XP and score at rising risk.
   - Toll Shades only come after about 2 minutes of Overtime.
   - You leave by walking into the portal.
6. **Stage 3** has no portal. It is endless Overtime until death, and the run is scored.
7. **Going further through secrets** comes later; that is still undecided.

## What changes in the code (when built)

- `src/sim/stages.js`:
  - A stage state of clock, then boss, then overtime-with-portal (or endless).
  - The clock events (hordes, elites and mini-bosses at marks) are kept.
  - The gate waking and the Toll Bell pull are switched off behind a flag (`opts.flow = 'v2'`), not deleted.
- `src/sim/specials.js`: the stage boss starts by hunting the player from the edge of the screen at the clock's end, with its own adds.
- Portal:
  - A seeded spot 120 to 200 m from the boss's death, on reachable ground and never inside a block.
  - Entering it moves the whole build down to the next stage, as the Descent Circle does today.
- Overtime:
  - Enemy health grows 22% every 30 s, from the roster rules.
  - XP and score multipliers rise with time.
  - Toll Shades are allowed only after 120 s of Overtime.
- The view:
  - A red wind guide is shown within about 60 m of the portal.
  - The portal mesh is a block model when one exists.
  - There is no light beam.
- The bots, a balance and pace check:
  - The stage clock reaches the boss, and the boss kill rate is measured.
  - Time spent in Overtime before leaving, and deaths in Overtime.
  - Stage 3 endless survival times.

## Open questions for the owner

- The stage clock: still 12 minutes?
- The Overtime reward curve: how much more XP per minute stayed?
- Does dying in a Stage 1 or 2 Overtime end the run, or keep the score so far? The plan assumes it ends the run, as death does now.
