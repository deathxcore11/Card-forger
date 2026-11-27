# Duel Summoner: feel v2 (27 Nov)

The owner's brief (27 Nov, 4:03 PM ET): getting around has to be the best part of the game, very fun and never a burden, with challenging platforming in some places and a vast kill area where you trick and zoom around hitting the whole corner.

Every number below lives in one table, `src/data/feel.js`, and `applyFeel()` writes them into the sim. With `?debug`, a FEEL button opens a slider for every number, applied live, and "copy table" puts the current table on the clipboard. The ride gym is `?gym=1`.

## The table (starting values)

| Group | Number | Value | What it does |
|---|---|---|---|
| foot | top | 9 m/s | run speed |
| foot | accelT | 0.15 s | from a stand to top speed |
| foot | stopT | 0.10 s | from top speed to a stop |
| foot | air | 0.8 | air control, a fraction of the ground's |
| foot | coyote | 0.12 s | a jump still counts after leaving a ledge |
| foot | buffer | 0.15 s | a jump press is remembered before landing |
| foot | jumpH | 2.2 m | a full held jump (a tap is half) |
| foot | hopWindow / hopGain / hopCap | 0.1 s / 5% / 16 m/s | a jump within 0.1 s of landing keeps its speed and adds 5%, up to 16 m/s |
| ride | cruise | 14 m/s | the card settles here on the flat by itself, so it never stops dead |
| ride | push | 18 m/s | with the stick held forward |
| ride | top | 30 m/s | downhill |
| ride | turnLow / turnHigh | 4.2 / 1.5 rad/s | sharp turns at low speed, a wide carving arc at top speed |
| ride | headOn | 60° | a wall met squarer than this: a pop off it on the ground, a bail in the air; a glancing wall deflects the card along it |
| ride | deflectKeep | 0.85 | speed kept off a glancing wall |
| ride | crouchMax | 0.35 s | the longest ollie crouch |
| ride | ollieLo / ollieHi | 1.2 / 2.6 m | a tapped ollie and a full crouch |
| ride | magnet | 2.0 m | rails snap within this when airborne or on an ollie near one |
| ride | wallMin / wallT / wallSink | 10 m/s / 1.2 s / 1.2 m/s | ollie into a steep face at speed: ride along it, sinking slowly; ollie off it |
| trick | landTol | 30° | off straight that still lands |
| trick | bailT | 0.6 s | a bail |
| trick | repeat | 0.75 | each repeat of the same trick in one combo is worth this much of the last |
| trick | flip / grab / spin180 / grind / revert / wallRide | 300 / 200 / 260 / 120 / 180 / 220 | points |
| trick | meterPerPoint | 1 / 2500 | the special meter fills from banked combos |
| trick | specialMul | 3 | a special is worth 3x the two tricks it joins |
| trick | bigAirT | 0.75 s | air that counts as Big Air (a full-crouch ollie on the flat gives about 0.86 s) |
| hit | knock / knockUp | 14 / 7 m/s | a small enemy ridden through is thrown |
| hit | trickKill | 120 | points a ridden-through enemy adds to the combo |
| hit | hitstop | 0.04 s | on a real slam |
| cam | fovMin / fovMax | 70 / 85 | the view widens with ride speed, from cruise to top speed |
| cam | lag / lookAhead | 0.12 s / 4 m | in the table; not yet wired to the chase camera |
| cam | speedLines | 18 m/s | speed lines start on the card |

## Controls

Keyboard:

| Key | Does |
|---|---|
| WASD | move |
| Mouse | look |
| Space | ollie or jump (hold to crouch) |
| C | ride or slide |
| J | flip (with a direction: 8 flips) |
| K | grab (with a direction: 4 grabs, held keeps scoring) |
| L | grind (with a direction: Edge Grind, Rim Ride, Spine Slide, Lip Slide; the lean balance meter as before) |
| Q / E | spin |
| Shift | revert (and still the dash on foot) |

The pad layout is unchanged. Manual is down then up on landing, or a flick on the ground.

The specials are two trick buttons together in the air once the meter is full:

| Buttons | Special |
|---|---|
| flip + grab | Royal Flush |
| flip + spin | Full House |
| grab + spin | Straight Flush |
| flip + grind | Four of a Kind |

Banking a combo with a special in it fires the chorus strike.

## Measured (tools/feeltest.mjs, the gym, sim at 60 Hz)

| Measure | Result |
|---|---|
| Time to top speed on foot | 0.15 s |
| Time to a stop | 0.10 s |
| Ollie, tapped | 1.27 m |
| Ollie, full crouch | 2.60 m |
| Rail snap (approached at 25°, aimed 0 to 1.9 m off, 12 to 18 m/s, the ollie let go 0.3 to 0.6 s before) | 20 of 20 |
| Wall ride (the gym mesa's face, 15 to 55° glancing, 12 to 20 m/s, an ollie just before) | 20 of 20 |
| Kickers (tools/ramptest.mjs) | 40 of 40 |
| Quarters | 20 of 20 |
| Rails | 20 of 20 |

## The ride gym (?gym=1)

A flat 200 m arena (it blends back into the desert by 150 m out), with:

- a 24 m bowl, 3 m deep
- a long downhill run of 14 m over 85 m
- one kicker, rail and kicker line ending in a quarter pipe, with the rail starting 8 m past the first kicker's lip, where the card comes down
- a 12 m square block mesa, 6 m sheer, with the free chest on top as the reward (ride its face with a wall ride)
- 40 husks that keep coming back, 25 to 60 m out
- no stage clock and no offers
- a one-line control card at the bottom

## Not done yet

- Every trick does not yet have its own clearly different card and body pose. The existing poses are flip roll or pitch, grab tilt and manual tilt.
- The camera's lag and look-ahead are in the table but not wired.
- Enemies thrown by the card burst and shake, but there are no ragdoll arcs yet.
- A head-on bump with a small enemy kills it. A big one (golem or hunter) hops the card over it.
- Landing squash and the bank flash are the existing ones.
