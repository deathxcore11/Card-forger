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
