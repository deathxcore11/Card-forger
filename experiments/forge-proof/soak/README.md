# Engine soak gate

`Soak.java` plays full matches against the real Forge engine bundle (the same `forge-engine.jar` and
pack the app ships, and the bridge the host runs) on a desktop JVM, with no UI. A bot answers every
prompt through the bridge's own `/state` and `/action` API, the way the tables do.

Outcomes per match:
- `finished`: the game ended.
- `STALL`: no new revision for 25 s while the bridge is not waiting on the player. Writes
  `stall-<seed>-<time>.txt` with the state and thread stacks. **Any stall fails the gate.**
- `STUCK_DECISION`: the bot could not answer a prompt (the bot's limit, not the engine's).
- `FAILED ...`: the engine refused or stopped the match. Fails the gate.

Run it before every engine release (host deploy or app engine swap):

    experiments/forge-proof/soak/run-soak.sh <engine tgz> <website checkout> 1000 1100 1200

`<engine tgz>` is an app engine build (`forge-engine-android-*.tgz`); `<website checkout>` gives
`forge-rules/current` (the pack's own rules data may have expired) and `data/play-starters/precons.json`.

History: on 10 Nov 2026 the gate found the payment freeze (8 of 32 matches stalled in
InputPayManaOfCostPayment with busy=true). After the bridge's busy watchdog, 210 matches over 14
seeds (1000 to 2300) ran with 0 stalls.
