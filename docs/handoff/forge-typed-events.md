# Forge bridge: priority view and typed event details

Additive fields for the native table (and later the web table). A table that doesn't know
them ignores them; no existing field changed shape.

## `priority` (every running publication)

```json
"priority": {"holder": 1, "viewerHolds": true, "waitingOnViewer": true, "stop": "main"}
```

- `holder`: Forge's priority player id (same as the board's `priorityPlayer`).
- `waitingOnViewer`: the engine is waiting on this player (a prompt or a live input).
- `stop`: why the table stopped for you, or `null` while Forge is working or someone else is
  deciding: `mulligan`, `choice`, `payment`, `declare_attackers`, `declare_blockers`, `stack`
  (something on the stack you can answer), `main` (your main phase), `phase_stop` (a stop you
  set), `full_control`, `combat`, `priority`.
- Use: hold CPU playback while `stop` is `mulligan` (nothing from turn 1 before the keep), and
  drive the mat edge line from `holder`.

## Event details (`events.items`, schema unchanged: `cardstashy.forge-events.v1`)

Only what Forge reported is said; a field is left out when Forge gave nothing to tie it to.

| Event | New field | Values |
|---|---|---|
| `zone` | `cause` | `destroy`, `sacrifice`, `countered`, `token` |
| `zone` | `by` | card whose spell or ability was resolving (e.g. the removal spell) |
| `life` | `cause` + `sources` | `damage` or `lifelink`, matched by exact amount to the damage Forge just reported |
| `life` | `cause` + `source` | `effect`: the resolving card (drain, gain) |
| `counters` | `source` | the resolving card that put or removed them |
| `damage` | `lifelink` | `true` when the source has lifelink |
| `countered` (new type) | `source`, `spell`, `by` | a spell or ability removed by a resolving counter effect |
| `transform` (new type) | `card` | a card that transformed (face shown after) |

Exile is already `zone.to = "Exile"`; casts, triggers (with `source`), resolves, attacks,
blocks, damage (source, target, amount) were already sent.

## Parked (not in this change)

Effect durations, payment dry-run during manual payment, potential blockers during your attack
preview, and stable why-not codes. `tapPreview` on actionable cards already carries Forge's own
auto-tap plan.

## Proof

`android-app/forge-engine/test/EventsMatchTest.java` plays a real CPU match on the bundled
engine (compile against the bridge port and `forge-engine-android-e5a0f81-pods.tgz`, as
FriendMatchTest). 2 Nov 2026, seed 20261102, 10 turns, Commander: 91 events, every running
publication carried `priority`, every priority input had a stop; seen: `zone/sacrifice`
(Aether Spellbomb), `zone/destroy` by Fateful Absence, `zone/token` (Clue) by Fateful Absence,
`life/damage` from Silver Myr. Stops: mulligan, choice, main, stack, payment. Countered,
transform and lifelink did not come up in those two decks.
