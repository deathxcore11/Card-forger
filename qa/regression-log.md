# Regression log: bugs that reached the owner

Every bug the owner hits on a released build gets a row here and a test that uses the
exact input that broke. "Test" is the file name; "owed" means it has not been written
and the bug is not closed.

| Date | Released in | What broke (as the owner saw it) | Why the tests missed it | Test |
|---|---|---|---|---|
| 2026-11-13 | version to confirm | The scanner failed on real photos of cards. | Checked on clean inputs, not camera photos. | owed (smoke C1) |
| 2026-11-13 | version to confirm | Matches never started. | Nothing started a match on the shipped build. | owed (smoke B1) |
| 2026-11-13 | version to confirm | Search gave wrong answers. | Expected answers were not written from the cards beforehand. | owed (smoke D1) |

The three rows above were written from the project's report of that night, not from
a re-run. The thread that owns each area confirms the cause when it writes the test.
