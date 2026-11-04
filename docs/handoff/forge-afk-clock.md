# Forge host: AFK clock (friend matches)

Randall's standing rule: every match mode has a turn countdown, and an AFK player's turn is
skipped. A client can't skip a sleeping or closed app, so the host enforces the same clock in
**friend matches** (two people, two seats). CPU matches are untouched: the site client's own
clock is enough there, and the phone's local engine never starts the host clock.

## What the host does

While the game waits on a human, the host holds one window per seat:

| Waiting on | `afk.reason` | Time |
|---|---|---|
| your own turn (priority) | `turn` | 90 s (paused while a prompt interrupts, then resumes) |
| a prompt: keep/mulligan, attackers, blockers, targets, payment, any choice | `prompt` | 30 s (starts over on any input) |
| a chance to respond on the other seat's turn | `response` | 30 s |

The clock is off while the engine is busy (`busy: true`, i.e. the other side's play is being
resolved or told).

## Published state (`afk`, additive, on every publication; null when there is no window)

```json
"afk": {"own": true, "reason": "turn", "total": 90000, "deadline": 1762268000000,
        "remainingMs": 61500, "serverNow": 1762267971500, "strikes": 1, "strikeLimit": 3}
```

- `deadline` / `serverNow` are epoch ms on the host clock: draw the ring from `remainingMs`
  at receipt, or from `deadline - serverNow`. Never from the device clock.
- `own:false` is the **other seat's** window (shown only while this seat has none), so both
  clients draw the same ring. It carries no strikes. It updates without a new revision, so an
  action sent against the current revision stays valid.

## At expiry: the safe answer

| Situation | Answer |
|---|---|
| mulligan prompt | keep the hand |
| London mulligan (cards to bottom) | Forge's Auto, then OK |
| declare attackers / blockers | OK with none declared (never attacks, never blocks) |
| priority (own turn or response) | pass |
| payment | cancel the payment |
| yes/no prompts | no |
| choices | cancel if it can be cancelled, else the minimum (first N) |
| combat damage / divide prompts | skip if allowed, else all to the first target |
| input needing cards | pick the first unchosen card |

If the engine refuses the answer (the board moved), it retries 3 s later, up to 4 times.

## Strikes

- One strike per **turn** in which a window expires (the mulligan counts as turn 0).
- Three strikes in a row **concede** (same path as `op: concede`).
- Any input the player sends (any accepted `/action`) clears the strikes; a prompt's window
  starts over. The clock's own answers never count as the player being there.

## Not done

- Holding the clock while the *client* is still playing back the other side's moves: the host
  only knows the engine is busy. If the client needs more time, say so and an `op` to extend
  or pause can be added.
- Reconnect grace after the three strikes (a concede is final).

## Config (system properties, for tests)

`cardstashy.afkTurnMs` (90000), `cardstashy.afkPromptMs` (30000), `cardstashy.afkStrikeLimit` (3).
A value of 0 turns the clock off.

## Proof

`android-app/forge-engine/test/AfkClockTest.java`: a real friend match on the bundled engine
with 3 s / 1.5 s clocks. Seat 1 plays, seat 2 never touches the table. The clock kept seat 2's
hand (strike 1, turn 0), passed its turns (strikes 2 and 3) and conceded at the third; seat 1
won with 0 strikes, saw seat 2's window as `own:false`, and seat 2 never attacked or blocked.
16 s, `AFK_CLOCK PASS`.
