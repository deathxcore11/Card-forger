# Release proof: the record every release card is built from

One record per release, saved in the project's shared files beside its proof folder
(pictures, clips and logs are too big for this repository). Copy the block below.

Rules:

- A **Pass** row must name a proof file, and that file must exist and not be empty.
- A **Fail** row says what was seen.
- A **Not assessed** row says why (for example "PC offline, no device").
- "Proof" is something captured from the real thing: a device picture, a clip, the
  output of a run over real inputs. A passing unit test on a made-up input is not
  proof and goes in the Notes column at most.
- Check the record before the card is posted:
  `node scripts/check-release-proof.mjs <record.md> <proof folder>`

## Template

```markdown
# Release record: app 0.0.00 (vc000) / web 0.0.000

Commit: <sha>
Built from: <hand-off file>
Checked by: <thread>, <date and time>

| Item | Verdict | Proof | Notes |
|---|---|---|---|
| A1 opens over last live version | Not assessed | | PC offline |
| B1 match reaches turn 1 | Pass | b1-turn1-thor.png | Thor, Quick Play |
| <each change in this release, one row each> | | | |
```
