> Retained parent capability/proof history. EXPERIMENTAL-CPU.md supersedes policy/stock-AI statements in this descendant; exact deck/rules/concession contracts remain.

# Three-format dated rules-data gate — isolated review candidate

Extends frozen0228 without changing Forge source, snapshot conversion, native gameplay, choices or Smart policy. This closes the local prototype's missing current-data admission dependency. It does not certify every card interaction, CPU fairness, or a production deployment.

## Contract
The existing four-key `{input}` envelope and snapshot schema are unchanged. All three formats use their native structural/pool checks **AND** bundled identity-level Standard/Modern/Commander verdicts. Unknown, ambiguous, unsupported, unverified or nonlegal identities reject; an explicitly selected unknown/unreleased native printing rejects without substitution. Main, commanders and sideboard are checked. No new deckbuilder, per-move network, separate validator service or handwritten card rules.

`initialization.legal` now means native conformance AND the declared bundled source verdict. `nativeLegal` preserves the separate native result. `rulesData` reports schema `cardstashy.rules-data-receipt.v1`, version, mode, asOfDate, validUntilExclusive, manifest/index/source SHA256, sourceUpdatedAt, engineRevision, scope and `decksVerified`. All exact source/roster digests and registered/instantiated flags remain. Supported definitions are not equivalent to complete interaction certification; unsupported controller prompts still fail closed.

Current bundle: `rules-20261026-scryfall20261025-native-e5a0f815`, official facts checked2026-10-26, bulk updated2026-10-25. Maximum seven-day freshness window: expires2026-11-02 00:00UTC. This is a bounded data freshness policy, **not a claim that legality cannot change during that window**. A known announcement, rotation or corrected source requires an earlier replacement/revocation. No admission is allowed after expiry. Already-started games remain pinned; no mid-game rules replacement.

Default mode is `current`. `-Dproof.requireCurrentRules=true` forbids offline mode. An isolated offline-practice run may explicitly set `-Dproof.rulesMode=pinned-practice -Dproof.rulesVersion=<exact version>`; its receipt never says current. Hosted release must require current mode and the immutable image's expected bundle version/hash. `proof.rulesData` is server-controlled only and defaults to `<proof.root>/rules-data/current`. No browser path/import override exists. `proof.requireExact=true` remains mandatory for hosted use; legacy aliases are only local plumbing fixtures.

## Reproducibility / provenance
`rules-data/current/{manifest.json,cards.json,official-format-facts.json}` is the immutable runtime payload. Manifest binds actual pinned native format-definition digests, index, official facts, native export, public bulk source and existing catalog hash. Image/checkpoint manifest must bind all three files and Java source; a mutable client-supplied manifest is not a trust root.

Source is public Scryfall Oracle bulk, read through the app's existing `createScryfallClient` metadata path. Current API uses `jsonl_download_uri`; gzip is bounded64MiB, hash/size checked. Recorded public source receipt is in `rules-data-tools/source/`. No user or private deck data was uploaded. The25MiB source gzip remains in the local proof workspace, not this source package. Exact archive retrieval:

```
node rules-data-tools/download-public-data.mjs --out=/tmp/rules-source \
  --receipt=rules-data-tools/source/bulk-source-receipt.json
# Copy the other recorded source files there, then:
python rules-data-tools/build-bundle.py --source=/tmp/rules-source \
  --catalog=/path/to/existing/catalog-expanded.raw.json --out=/tmp/rebuilt-bundle
```

A refresh uses `--client=/path/to/cardstashy/scryfall-client.js` instead of `--receipt`, reruns `NativeRulesDataExport` against the pinned engine, rechecks dated official facts, rebuilds and tests a new immutable bundle/image. The builder takes `--facts=<new filename>`; it derives a new version from dates/revision. Do not merely extend an old expiry. Native and official format hashes changing requires actual review, not a silent fallback.

The index maps33,334 native identities.272 unknown and3 ambiguous native names remain excluded/fail-closed (mostly digital/rebalanced or un-set variants; see mapping report). Exact full-face tuples resolve split/aftermath identities. Same-name collisions use native type/mana-cost face profiles, not fuzzy name matching. One recorded punctuation alias maps Ratonhnhaké:ton to its exact Oracle ID. An existing-catalog Oracle ID alias for Value Town is profile-checked. All28 Standard and107 Modern identities absent from the old direct-name audit now map and have legal source verdicts. No unresolved Modern split identity is silently admitted.

Official Standard/Modern bans and current pool facts were checked against Wizards' format pages, banned list and October12 announcement, with source URLs in the facts file. The source's identity-level legality adds the missing current-pool check for supplemental/reprint names. Representative Oracle printing games do not determine legality: a paper identity can have an MTGO-only representative. Tokens/emblems/art-series are excluded from mapping. Selected native edition release dates are checked against the declared as-of date; future native entries cannot silently enable future printings.

## Evidence actually executed
- NativeRulesDataChecks: current, stale, future bundle, wrong version, explicit offline mode, mandatory current, index tamper, split/punctuation identity mapping, real Angels/Keen native+source admission, unknown mapping, actual nonlegal source verdict, actual future Blood Crypt printing rejection.
- Actual HTTP/JVM initialization for Commander, Standard, Modern: current receipt, decksVerified, both roster flags, private libraries remain hidden. Missing/stale bundle fails before game creation. Every test JVM stops.
- NativeFormatChecks plus unchanged Commander baseline; transport/order/coercion and Smart exact-ability identity checks; Java/JavaScript digest corpus.
- Prior0228 genuine native terminal games: Standard turn10, Modern turn16. Prior0146 exact Angels/Keen terminal turn30 after allowing the real21s CPU window. The admission-only gate does not manufacture or replace those gameplay results.

Logs in proof root: `rules-gate-checks.log`, `rules-startup-checks.log`, `rules-startup-*-state.json`, `rules-bundle-build.log`, `rules-gate-contract-checks.log`, `rules-gate-formats-final.log`. Local receipt files contain no bearer capability and no opponent library order. This is a bounded review candidate, not a production-release claim.
