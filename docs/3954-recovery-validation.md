# Preserved 3.95.4 recovery checkpoint

Date: October 24, 2026. This is a recovery and validation record, not production
release approval or a claim that 4.0 gameplay/UI has been implemented.

## Source identity

- Public handoff base: `1b8678d5b1830aa61f0be889a78400b7f1a3d0ab`.
- Base tree: `ab08a8eaaa34b2186b80915e5637a03ddc3abfb8`.
- Recovered implementation tree: `54444fed968ba0e18bc2f1ab614680bec32521f2`.
- Recovery commit: `3a7d5536d40e7ad7ccf7305e843786c0248fccb2`.
- The local Git index and GitHub-created recovery tree have the same SHA.
- Supplied patch SHA-256:
  `369dc11453f2f9e246e37450ac8853f30e349bac5ce891a35e30421a6b226a95`.

The patch passed `git apply --check` against the exact base. After application,
each of its nine files matched the supplied byte count and SHA-256 manifest.
No force application, overlap resolution or changes to the supplied patch were
needed. The two previously untracked files were restored in full.

## Bounded recovered change

The recovered work precompiles the fixed creature-type patterns, resolves
eligible DFC front names to canonical card identities, guards conflicting
Oracle/printing/quote mappings, rechecks previous identity evidence against
current metadata, and corrects browser expectations for unverified generated
drafts while retaining a positive complete-result control.

The receiving-coder review inspected the identity/refresh/collision guards and
their adversarial tests. This is not a separate independent review of the final
variant and does not substitute for the remaining integrated replay.

APK/native files, scanner implementation and foil implementation are untouched.
The subsequent 4.0 scope documentation is a separate commit. It is not a new
runtime feature and does not change package/release version labels.

## Commands and actual outcomes

| Command/check | Outcome |
| --- | --- |
| `git apply --check` with the supplied preserved patch | PASS |
| Supplied patch digest plus all nine resulting file sizes/SHA-256 values | PASS |
| `node test-creature-type-cache.mjs` | PASS |
| `node test-mtg-reference-construction.mjs` | PASS |
| `node tests/ai-deck-build-browser.mjs --validate-fixtures` | PASS; fixtures only, no browser |
| `python -m unittest discover -s tests -p test_verify_deployed_assets.py` | PASS; 10 tests; does not verify the current live deployment |
| `node --check` on both implementation files and all three changed browser suites | PASS |
| `git diff --check` | PASS |
| First `npm test` (310-command aggregate) | FAIL at command 221, `test-scryfall-client.mjs:16`, the existing `<145 ms` queue deadline wall-clock assertion |
| `node test-scryfall-client.mjs` after that failure | PASS with unchanged assertion and implementation |
| Second `npm test` | PASS; all 310 commands completed with exit code 0 |

The first failure remains part of the record. An isolated pass and aggregate
rerun do not establish the root cause of a timing-sensitive failure or universal
performance. No test threshold was changed to get the later pass.

## Browser and live-access limits

An attempted local `node tests/deck-build-presentation-browser.mjs
--validate-fixtures` failed at Playwright module resolution. That file does not
implement a fixture-only flag, so this attempt is not fixture validation.
The installed runtime contains Playwright 1.62.1, but no local Chromium binary
was found. Installing its official headless shell failed with a truncated or
non-ZIP download and then an install-lock error. No successful local run of
that browser suite is claimed.

Direct production-asset requests to the custom domain and Worker address
returned HTTP 403 in this environment. Production deployment/version is
UNVERIFIED. The repository's default branch and PR #47 state were read through
GitHub; they are not a production response.

The reference site's public Commander lobby and Deck Preview were inspected
interactively. That establishes layout observations only, not CardStashy UI or
game-engine acceptance.

## Remaining release gates

- NOT RUN here: exact recovered revision's hosted AI/deck-presentation and Power
  browser suites. The repository's existing push workflows can provide these
  results on the preserved branch.
- NOT RUN: integrated real-provider R01 replay and the frozen 26-case benchmark
  against the recovered combined implementation.
- NOT RUN: end-to-end cold/warm device latency, phone p95 or representative
  hardware resource measurements.
- NOT RUN: new independent review of the final DFC variant.
- NOT RUN: production deployment verification or APK build/signing.
- NOT IMPLEMENTED: the 4.0 four-layout shared deck viewer, new lobby, rules
  engine, CPU gameplay, Draft or private friend sessions.

The handoff's earlier benchmark and isolated parser timings remain historical
evidence for their own exact source/content. They must not be relabeled as
measurements of this recovered combination.

## Rollback

Keep the recovery commit and scope documentation off the production branch
until release gates are addressed. Returning to the public handoff base only
changes source selection; it does not require removing collections, saved
decks or existing Android artifacts. Do not deploy from a draft branch merely
because the local aggregate passed.
