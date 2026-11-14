# Smoke check: run before every release

Run on the build that will ship, with real inputs. Each row ends as Pass, Fail or
Not assessed, with a proof file. Rows go into the release record
(`qa/release-proof.md`).

If the owner's PC or a device is not reachable, the device rows are **Not assessed**.
Do not swap in a desktop browser and call it Pass.

## A. The app opens (app releases)

| # | Check | Proof |
|---|---|---|
| A1 | Install the signed APK over the last live version on a real device. It opens to Home with the collection intact. | picture of Home |
| A2 | Settings shows the new version number. | picture |

## B. A match plays (app releases; web when play files changed)

| # | Check | Proof |
|---|---|---|
| B1 | Quick Play against the CPU: the match starts and reaches the player's turn 1 main phase. | picture of the table on turn 1 |
| B2 | The fixed match: Mono-White Auras, played by controller on the Thor to a real result, each card cast once. | clip or end-screen picture |
| B3 | The same fixed match on a one-screen phone to turn 3 at least. | picture |

B1 blocks a release on its own.

## C. The scanner reads real cards (when scanner files changed)

| # | Check | Proof |
|---|---|---|
| C1 | Run the scanner over the real-photo set (photos taken by a phone camera of real cards on a table, not rendered card images). Record how many it named right out of how many. | the run's output file |
| C2 | Scan three real cards with the device camera: one Magic, one Pokemon, one Yu-Gi-Oh. | picture of each result |

The real-photo set and its right answers live in the project's shared files. If the
set does not exist yet, C1 is Not assessed and the record says so.

## D. Search gives right answers (when search files changed)

| # | Check | Proof |
|---|---|---|
| D1 | Run the fixed question list through the real search code against live data. Each question has its right answer written down beforehand. Record right out of total, and every miss. | the run's output file |
| D2 | Type three of the questions on the device. | picture of each answer |

A question list whose expected answers were copied from the code's own output proves
nothing. The right answers are written by reading the cards.

## E. The site is the site (every release)

| # | Check | Proof |
|---|---|---|
| E1 | The update-related site tests pass on the staged commit. | test output |
| E2 | After the push: live version, cache name and the APK's sha256 match the record. | command output |

## What changed decides what runs

A, B and E run on every app release. C and D run when their files changed. A
web-only release runs E, plus B, C or D when it touched them.
