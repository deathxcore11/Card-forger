# Scanner investigation — 28 October 2026

Scope: card capture, OCR, name/set/number matching, review and printing identity for Magic: The Gathering, physical Pokémon TCG, and Yu-Gi-Oh!.

Starting source: `ef1773a56bbd0c24ebed369e706f3d8dc5ffbb02`, repository default branch `claude/edit-publish-github-bpm8zu`, website package 4.3.17. This is an isolated repair candidate, not a deployment receipt. The website, production data and APK were not changed by this investigation.

## Main finding

There is no single switch that makes this scanner reliable. Several independent bugs were throwing away useful title/set evidence or promoting uncertain text into exact identity. The implementation also lacks a dedicated visual set-symbol recognizer. It combines text recognition, low-resolution artwork/whole-card fingerprints and catalogue metadata. Recognizing artwork does not establish the set, edition or finish of a same-art reprint.

The repaired code retains more legitimate names, retries weak title reads, preserves set clues through lookup, and declines to certify contradictory or repaired identifiers. Camera geometry and physical-device calibration remain unfinished validation areas.

## Reproduced bugs and changes

| Area | Before | After / regression |
| --- | --- | --- |
| Type/keyword words in titles | Prefix filters discarded Land Tax, Effect Veiler, Thunder Dragon, Draw Energy and hundreds of other real names. | Structural type-line filtering preserves complete titles. Literal title alternatives retain numeric prefixes, accents, short suffixes and long names. `test-scan-parser-audit.mjs`. |
| Pokémon identity symbols | Punctuation stripping merged Nidoran genders and Unown forms, including cache keys. | Game-aware identity keys preserve those distinctions. Parser and camera-key tests. |
| Pokémon gallery/vault numbers | TG/GG/SV fractions could be rejected or disagree because of zero padding. | Prefixes and denominators survive parsing; TG3/TG30 and TG03/TG30 normalize consistently without becoming ordinary 3/30. |
| Repaired collector digits | O/I and missing-slash corrections lost provenance and could become exact printings. One clear observation could hide a different repaired retry. | Original readings and correction flags are retained. Repaired or conflicting observations remain review-only. Literal clear identifiers still verify. |
| Yu-Gi-Oh passcodes | Eight digits embedded in longer non-passcode tokens could become a card ID. | Complete numeric token boundaries are required. |
| Magic two-face names | A visible face such as Delver of Secrets was absent from an index keyed only by the combined name. | Explicit ` // ` face relationships index both faces against the same canonical printing. Arbitrary slash splitting is not used. |
| Magic power/toughness | The first fraction in a detail crop, such as a created 1/1 token, could veto the actual 4/4 card. | Only isolated, unambiguous stat lines can supply that veto. |
| Printed-name aliases | Review/AI lookup applied raw-name equality after an alias-aware catalogue lookup. | Shared identity normalization preserves legitimate printed aliases and Trainer subtitles. |
| Set clues discarded | AI returned `set`, but the client dropped it. Cold Magic search also omitted selected sets before truncating provider results. | AI and manual review retain a separate editable set field. Known names/codes constrain local and remote lookup, remain mandatory through hydration, and cannot silently fall back to another set. |
| Hydration identity | A provider response could substitute another ID or a contradictory collector number after local filtering. | Wrong-ID responses are rejected. Strict AI descriptors are rechecked after hydration. |
| Invalid/ambiguous set names | An empty normalized set could compare equal to missing metadata; YGO release names sharing one prefix could collapse together. | Nonempty exact release identity is required; shared-prefix releases remain distinct. |
| Manual shutter | The explicit shutter applied automatic sharpness rejection and could replace the tap's image with an earlier cached frame. | Manual capture retains the current available sensor pixels, with quality as advice. Automatic quality gates remain unchanged. Metadata-before-layout capture is safe. |
| Weak OCR blocks retry | Any plausible title words suppressed inverted/wider title retries, even when OCR confidence was poor. | Known confidence below the existing 70 threshold uses the existing bounded retries. Strong recovered titles lead search while all original observations remain evidence. Good/unknown-confidence fast paths remain 2–3 OCR calls. |
| Conflicting edition stamps | Both “1st Edition” and “Limited Edition” readings silently chose Limited. | Conflicting OCR requires review. Explicitly confirmed user defaults retain their deliberate precedence. |
| Cleared correction fields | Empty DOM fields could fall back to obsolete draft values. | Empty values really clear the name/number/set correction instead of resurrecting old OCR. |

The new AI handoff regression was run against the pinned original `scancam.js` and failed because the set was `undefined`; it passes with the repair. Camera, parser, catalogue, edition and weak-confidence regressions likewise exercise real production functions, using deterministic inputs/provider doubles where stated.

## Catalogue evidence

| Game | Catalogue records checked | Unique literal titles swept | Previously rejected titles recovered |
| --- | ---: | ---: | ---: |
| Magic | 100,457 | 34,173 | 221 |
| Pokémon | 22,055 | 4,570 | 34 |
| Yu-Gi-Oh! | 45,176 | 14,615 | 538 |
| Total | 167,688 | 53,358 | 793 |

This is text-parser/catalogue coverage, **not camera accuracy**. No previously retained literal title was lost. Eight generic-parser omissions remain: short/symbol-only names; Pokémon N/AZ have a separate identifier-guarded route. Exact IDs and manual lookup remain separate routes.

`test-scan-aquapolis-audit.mjs` exercises all 186 Aquapolis and 102 Base Set identities, including H numbering, a/b suffixes and Scoop Up. It preserves unknown edition/finish/price. Three real cross-set name/number collisions demonstrate why set evidence is necessary: Aquapolis/Skyridge Arcanine H2/32, Aquapolis/Skyridge Houndoom H11/32, and Base Set/Triumphant Dugtrio 19/102. The matcher keeps these review-only without set evidence and resolves them with explicit set identity.

## Validation and reproduction

Run `npm run test:scanner-audit` for the focused, bounded suite. It runs 41 existing scanner/printing commands plus seven new audit commands, independent of the unrelated full-app test chain. The new regressions are also included in `npm test`.

- Automated code/catalogue/controller checks: final result is recorded in `scanner-audit-2026-10-28-results.json`.
- New coverage includes 19 parser cases, catalogue/provider-set checks, manual shutter across all games, 50 edition assertions, 36 AI/manual set handoff assertions, the complete Aquapolis/Base identity pilot, and 20 confidence/crop-boundary scenarios. These counts use different units and should not be added into an “accuracy” denominator.
- Existing coverage includes 38,544 Yu-Gi-Oh code assertions, conflicting identifiers, provider bounds, cancellation, late responses, all six game-switch directions, duplicate guards, retained originals, printing choices and 24 catalogue/worker/capture fast-path combinations.
- Scanner browser fixture validators were exercised separately. Fixture validation is not browser execution.
- Android source transformation accepted the modified shared scanner. No native build or device execution was performed.

## Real-pixel diagnostic findings

The standalone native-Tesseract runner uses pinned public Lightning Bolt and Kyogre scans and a physical Hot Red Dragon Archfiend Abyss HSRD-EN041 photograph. The reference image hashes, source URLs and results are in `scanner-audit-2026-10-28-ocr.json`.

It ran 13 fixed-band experiments: original/480-pixel/blur/JPEG variants plus a manual-crop control. Only one produced exact expected title evidence and three produced the expected identifier; none supplied both in this limited first-band experiment. **These results are not an app recognition rate**: the runner uses native Tesseract/Pillow, does not replay the complete browser fallback sequence, and includes uncertain-geometry diagnostics.

The physical Yu-Gi-Oh photo's outer boundary competed with internal artwork shapes. Manual cropping recovered the title at native OCR confidence 95.16 while the footer stayed noisy. This isolates a useful future geometry/calibration case without licensing a blind relaxation of automatic cropping. Simply switching the title segmentation mode did not improve the control scans, so no blanket OCR-mode change was made.

The existing generic YGOPRODeck Dark Magician reference now serves a Replica image lacking normal physical printing identifiers. A test that downloads a changing generic card image is not stable proof of set/passcode recognition. The new diagnostic runner checks pinned image hashes and uses an actual printed-card photo for that case.

Reproduce the diagnostics with:

```sh
python scripts/audit-scanner-real-ocr.py --cache /tmp/scanner-ocr --download --output /tmp/scanner-ocr/report.json
```

Omit `--download` to replay cached exact bytes. Python Pillow and native Tesseract are required. No AI identification requests or paid APIs were invoked by these tests.

## Remaining gaps and release boundary

1. **Set-symbol vision is absent.** A trained/validated symbol matcher or a measured symbol-template method, with abstention on ambiguous symbols, would add information current artwork matching does not provide. A plain OCR model cannot read a logo as a set code reliably.
2. **Physical phone testing is NOT TESTED.** Focus distance, glare, foil finish, sleeves, exposure, motion and device-specific latency need a labelled image/video set from the actual devices. Include same-art reprints and unreadable/partial cards as negative controls.
3. **Actual browser checks are NOT TESTED in this environment.** The installed Playwright package lacked its matching Chromium executable. The exact-version download attempt returned an invalid/truncated archive. Hosted-only browser guards were respected; synthetic checks are not described as browser acceptance.
4. **Automatic thresholds were not loosened.** A manual capture can proceed where automatic capture waits. Actual auto/manual recognition parity remains unproved.
5. **The full app-wide `npm test` chain was not run.** This candidate was validated against the focused scanner/printing suite. Live provider changes, account-backed collection writes, fresh APK installation and full UI layout acceptance remain distinct checks.
6. **No publication occurred.** Package version, service-worker release version, production branch and APK were not promoted. The candidate is intended for review and later browser/device acceptance before release. Automatic approval review rejected the attempted creation of a GitHub review tree as an unapproved external write. The completed changes are supplied as a tested patch and source files in the data packet. No remote review branch or PR was created; no hosted CI or paid engine workflow was dispatched.

For the next validation pass, measure correct card identity, correct set/number, false confident matches, abstentions and time-to-result separately. A single success percentage would hide the wrong-printing problem this audit uncovered.
