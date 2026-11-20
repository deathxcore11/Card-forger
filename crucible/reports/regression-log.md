# Lost Memories regression log: faults that reached the owner

Same rule as `qa/regression-log.md`, kept here because Lost Memories is a test build and not a release: every fault
that reaches the owner gets a row and a test that uses the exact input that broke. Faults found by our own fault
hunts are in the lab reports, not here.

| Date | Seen in | What broke (as reported to the owner) | Why the tests missed it | Test |
|---|---|---|---|---|
| 2026-11-20 | playable Version 21 | X-Head Cannon + Y-Dragon Head + Z-Metal Tank made XYZ-Dragon Cannon in the duel, but the Codex wrote only the first two cards, which read back as XY-Dragon Cannon (or YZ or XZ, by play order). The real three-card recipe was never written. Found by the owner's second assistant from the game pack and bundle. | The pool holds one three-material fusion and no test melded it and then read the Codex; the fuzz never checks what a Codex entry reads back as. | `test-crucible-rules.mjs`, "Codex: a three-card fusion is written with all three cards" |
| 2026-11-20 | playable Version 21 | Super Roboyarou could not be made. It and Super Robolady name the same two materials, the engine treated the pair as unordered and always made Super Robolady. Same report. | No test asked that every printed fusion can be made from its printed materials. | Same test; it now checks all 41 printed fusions that have materials |
