# Next session: open items (from lucid-ride, 27 Oct 2026)

## Emergency
1. **Play turns itself off Mon 2 Nov, 7 pm Eastern (2026-11-03 00:00 UTC).** The rules data
   expires. Rebuild the Forge host with the weekly rules refresh before then. Steps:
   `docs/handoff/lucid-ride-merge.md` ("Play switches itself off") and
   `docs/handoff/forge-engine-handoff.md` ("How to apply").

## Ready, waiting on the UI session or publisher
2. Website 4.2.7: fold `4f6df1b` from `claude/lucid-ride-5cz864`, then bump the version and the
   sw CACHE. Unit tests 332/332.
3. Forge host patch `docs/handoff/forge-adapter-427.patch` (bridge sha `eb643c04…`), for the same
   host rebuild: pacing, attachments, arrows, keywords as strings, designations, commander tax,
   event log, payment. Update the old sha `f51b3360…` pins listed in the handoff doc.

## Should do
4. Review the event log code once more before the host deploys it. A review was started and
   stopped early to save usage. It is proven in 5 live games: 0 gaps, 98 of 98 CPU draws hidden.
5. Prompts the bridge still cannot answer (only Concede shows): Scry or Surveil ordering of 2+,
   damage assignment for a blocked trampler, divided damage. Fix notes are in lucid-ride-merge.md.
6. Not yet seen live: night (it uses Forge's isNight()) and Class levels above 1.
7. The scanner offline cache was reverted (3f0d8f4). Redo it with versioned files.
8. Host access and budget: any signed-in account can play; 40 starts a day are shared by all.
   AI limits are off in production, so set an OpenAI monthly cap.

## Next patch plan (from the live 4.2.7 review)

Engine (bridge, ships in the host rebuild):
1. Trustworthy glow. `selection.actionable` is Forge's "can start" list, not "can finish", so
   Food glowed while tapped out. Split it into completable and startable actions, with a
   reason per card ("Need 2 mana", "Wrong timing", "No legal target"). Only completable ones glow.
2. Smart passing. `smartStop` always stops at declare attackers and blockers, even with no
   attackers, and auto-pass counts unaffordable abilities as actions. Skip combat stops with no
   attackers, and judge "can respond" by affordability. Keep mandatory choices and requested stops.
3. Separate auto-pay from Smart (`maybeNativeAutoPay` needs Smart today), so a player can keep
   auto-pay and still hold priority.
4. Already built, not deployed: the event log and `payment` (forge-adapter-427.patch). Review first.

Web (UI session):
- Plain-English prompts ("Activate Food: pay {2}, sacrifice it, gain 3 life"), never internal
  names like InputPayManaOfCostPayment. The button names the real next step.
- CPU playback replays `state.events` instead of comparing snapshots.
- Drag sends the drop target too (blocker onto attacker), shows legal drops, keeps tap fallback.
- Attachments tucked under their host; never stack look-alikes whose attachments or combat differ.
- Layout: zone names, commander size, a bigger battlefield, clear "whose decision". Test on Fold and tablet.
- Separate Auto-pay and Full Control toggles (needs engine item 3).

Order: engine 1-3 and the event log review, then the host rebuild with the rules refresh
(before Mon 2 Nov, 7 pm Eastern), then the web patch, then drag, attachments, layout and effects.
