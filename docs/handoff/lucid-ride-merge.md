# Merge note: `claude/lucid-ride-5cz864` into the next release

For the main updater (the session that publishes `claude/edit-publish-github-bpm8zu`).
Nothing on this branch is live. It is based on live 4.2.4 (`0bdd8ee`) and has no
version bump, `sw.js` CACHE change, release record or update notes: those stay yours.

## First: Play switches itself off on 2026-11-02 00:00 UTC

This is not on this branch. It is in the Forge host and needs the host owner this week.

- `deploy/forge-host/src/release-policy.mjs:16` pins the bundled rules data with
  `validUntilExclusive: '2026-11-02'`. From that instant `validateReleasePolicy` throws
  `rules_data_policy_not_current`, the adapter reports not ready, and every Play start
  returns 503 `exact_native_adapter_unavailable`. Friends see "Play is temporarily
  unavailable. Please try again shortly." until a new image ships.
- The image has its own clock check: `NativeRulesData.java:32` throws `rules_data_stale`.
  It also refuses a bundle valid for more than 7 days after its as-of date, or one whose
  source is more than 2 days older than that date.
- The deploy scripts call the same check with the real clock
  (`create-release-policy.mjs:34`, `release-configuration.mjs:48`), so after the cutoff
  even a redeploy of the current image fails.
- The unit tests pin `now` to 2026-10-26, so CI stays green while production is dark.

What to do before Sunday 1 November:

1. Rebuild the rules bundle as `experiments/forge-proof/combined-browser-proof/candidate/build-context/native/RULES-DATA.md`
   describes (fresh Scryfall Oracle bulk, rerun `NativeRulesDataExport`, recheck the dated
   official format facts, `build-bundle.py`).
2. Update `EXPECTED_RULES` (version, three shas, `sourceUpdatedAt`, `asOfDate`,
   `validUntilExclusive`) in both copies of `release-policy.mjs`, the rules manifest pin in
   `scripts/compose-next-context.py`, and the fixture receipts.
3. Rebuild the image, run the host's checks and the probe, and deploy.

The forge-adapter patch in `docs/handoff/forge-engine-handoff.md` can ride the same
rebuild. Longer term, either schedule a weekly refresh that alerts 72 hours before expiry,
or add a grace window that shows "rules as of <date>" instead of turning Play off.

## How to merge

```sh
git fetch origin claude/lucid-ride-5cz864 claude/edit-publish-github-bpm8zu
git checkout claude/edit-publish-github-bpm8zu
git merge --no-ff origin/claude/lucid-ride-5cz864
npm test                      # unit suite (each file can also be run alone)
```

Then do your usual release: bump `APP_VERSION`, `package.json`, `release-record.js`,
update notes, and the `sw.js` CACHE name. The CACHE bump is required this time: commit
`8527132` stops other pages overwriting the saved start page, and only a new CACHE replaces
start pages that are already poisoned. `index.html` also gains preload links.

If the Play/table session lands first, merge theirs first and this second. This branch
touches only one Play file, `play-forge-player-mat.js` (one line in `updateExit`, commit
`a6ced32`). If it conflicts, keep their version and re-apply that line, or drop the commit.

Release once without `[skip actions]` so CI runs the whole suite.

## What is on the branch

| Commit | Change | Evidence |
|---|---|---|
| `d21b356` | Browser-test servers serve `.mjs` as JavaScript (15 servers) | Without it the app never boots in those tests |
| `95b1ca2` | Sets release-family buttons keep their 42 px touch target | sets-browser |
| `2e93df2` | Tab pill follows its tab at once on resize, no overflow at 320 px | sets-browser catalogue scenarios: fail on 4.2.4, pass here |
| `adfb3a5`, `85fdf70`, `97c8ce4` | Nav-count tests ignore the hidden Play button (Wiki, Home, Wiki reader) | Stale since 4.0.0 |
| `399cede` | Forge engine patches for the host owner (pacing, attachments, combat arrows, stack targets, faster JIT) | `docs/handoff/forge-engine-handoff.md` |
| `5570e74` | Finish test serves Zekrom's measured image; Sets label check counts words, not the icon | Both stale since 3.92.0 / 4.1.6 |
| `641e8ff` | Wide Chrome tablets get the Play entry on Home and Decks (it was never rendered) | Tablet: Play opens from both; phone: entry leads to the space explanation; desktop unchanged |
| `4319f7c` | Deck tile counts the main deck (50/60 · 5 sideboard, not 55/60); TCG tiles say "value unavailable" instead of $0; gallery price no longer hidden under the qty badge; shared links list the sideboard and every quantity | Unit tests fail on 4.2.4, pass here; screenshots |
| `5e23dba` | Focus stays clear of the sticky header, bottom nav and buy bar; scanner settings icon visible in light theme | Keyboard Tab probe: 45 fully hidden focus stops before, 0 after; icon contrast 1.2:1 → 13.3:1 |
| `5a87bb9` | Pokémon/Yu-Gi-Oh! Decks › Import opens again (threw since 3.92.0); Pokémon rows read Pokémon, Trainers, Energy; Meta footer no longer prints `${esc(label)}` | Unit tests |
| `8527132` | Service worker: other pages (account deletion, Android sign-in return) never replace the saved start page | Unit test fails on 4.2.4, passes here |
| `86e2581` | Unit suite green: test-actions fake DOM + interval unref; module graph follows nested imports, 30 missing preloads added, deploy verifier covers them | test-actions, test-preload, verifier unit tests 10/10 |
| `a6ced32` | Concede stays available when Forge sends a prompt the table cannot answer yet (blocked trampler, Scry, Surveil 2+, divided damage) | See "Play prompts" below |
| `40f6d81` | Wizards Fan Content Policy notice, verbatim, in Settings › Info and on shared deck links | Unit tests |

Later commits on the branch:

| Commit | Change |
|---|---|
| `a36df23` | Concede rule moved beside the native panel (`nativePromptUnanswerable`); also covers face-down-only choices and methods the panel does not render |
| `919723a` | Power test finds the legal checkmark by its drawn path |
| `10d525a` | game-switch fixtures serve the startup modules under `experiments/` (all 311 scenarios timed out since Play landed) |
| `fceefd8` | Shared sideboard counts the shared pool; uncategorised rows still lead (review follow-up) |
| `7c67910` | Home Play pill readable in light theme; Decks tabs keep their animation and one-line labels (review follow-up) |
| `cd21bf6` | Service worker never saves other pages or `no-store` replies, so the Android sign-in return and its one-time code are never stored (review follow-up). Checked in Chromium: on 4.2.4, after the sign-in return, the offline app opened as "Returning to the app"; here it opens as CardStashy |

## Test status

- **Unit suite:** 328 of 328 files pass, each run on its own. On live 4.2.4, `test-actions` and
  `test-preload` fail.
- **Browser tests:** a full local sweep of the 83 CI browser commands was run against this
  branch before the latest commits. Each failure was rerun on its own, on both this branch and
  live 4.2.4:

| Test | Result |
|---|---|
| finish-milestone, sets, power-release, wiki-reader, game-switch | Fixed here (stale tests or fixtures). game-switch now boots; its full run takes about 25 minutes, so check it in CI |
| set-experience, ygo-history | Pass when run alone on both trees; they time out only when the machine is loaded |
| card-responsive | Fails the same way on the pre-tonight tree when the machine is loaded: the test holds a touch across two steps and the long-press menu opens. Pass when quiet |
| scanner | Downloads real reference images from Scryfall, TCGdex and YGOPRODeck ("hosted CI only"); not reproducible offline |
| tilt | Its first step reproduces an old bug against a 3.92 baseline file; that step no longer reproduces in this Chromium. Pre-existing on 4.2.4 |

- **Review:** an independent review of every change, with each finding checked by a second
  reviewer, ran against the branch. Its findings so far are fixed in `fceefd8`, `7c67910` and `cd21bf6`.

## Publisher: CI is red for a reason no test fixes

The GitHub artifact storage quota is used up. Jobs pass their tests and then fail at
`upload-artifact` ("Artifact storage quota has been hit"). To fix it, delete old workflow
artifacts, or set `retention-days` on the uploads. The deployed-asset verifier's own unit test
also expects `CACHE` to match `^cardforge-shell-v\d+$`, but recent names are descriptive
(`cardforge-shell-play-faster-table-v338`). Either keep a `v<number>` name or relax that
check.

## Also found, for the UI session

- The icon pack (`icons.js`, 4.1.5) writes two `class` attributes on most icons. Browsers keep
  the first, so the check icon never gets its `check` class. Restoring it would let
  `.deck-flow .check { display:flex; min-height:44px }` match checkmark icons, so fix the
  generator and check those rules together.

## For the Play / host owner (not changed here)

- **Play prompts.** `a6ced32`/`a36df23` only give the player a way out. The bridge still needs to
  answer these prompts. In `ForgeHttpBridge.java`:
  - set `prefs.setPref(FPref.UI_SELECT_FROM_CARD_DISPLAYS,false)`;
  - treat `-1` bounds in the `order` case as unbounded, which routes Scry and Surveil
    through the existing order dialog. Also normalise `remainingMin`/`remainingMax` in the
    order DTO, or the panel will read "Leave -1–-1 in the source";
  - add DTOs for `assignCombatDamage` and `assignGenericAmount`. `match-table.mjs` already
    has an assign-damage fieldset.
- **Diagnosis.** Give each gateway startup stage its own exit code, and keep a few
  fixed-vocabulary log lines. Today every startup failure reads "The table stopped
  unexpectedly".
- **Access and budget.** Play admits any signed-in account. The 40 starts a day are shared
  by everyone, and failed starts count, so one account can lock everyone out. Use the trial
  allowlist or a friends table, and give each account its own share.
- **AI spend.** `AI_LIMITS_ENABLED` is `"false"` in production. Set a hard monthly limit on
  the OpenAI project now, then rework the limiter to count per user and per question.

## For the UI session (not changed here)

- **Game-tab art** is about 0.9 MB on every cold load, drawn at most 214 px wide (Pokémon
  288 px):
  - `game-tab-ygo.png` is fully opaque, and lossless WebP saves 129 KB with identical pixels;
  - the Pokémon photo only compresses well if cropped to the strip the tab shows.
- **Play on phones.** Play modules (`play-card-support.js` alone is 722 KB) load at startup
  on every device, including phones that cannot play. A lazy Play route saves about
  0.32 MB gzip per cold load and needs the Play/table session.
- **Light theme.** Contrast failures found by the audit:
  - Play seat labels are #674407 on slate, about 1.5:1;
  - the power score on dark deck tiles takes page ink;
  - Collection list prices are about 3.4:1;
  - with no daily art, Card of the Day is white on white. The cause is `polish.css:275`,
    which hides `.hh-shade` for `.no-art`.
- **Forced colours (Windows High Contrast).** Selected tabs and nav lose their marker; only
  2 files handle `forced-colors`.
