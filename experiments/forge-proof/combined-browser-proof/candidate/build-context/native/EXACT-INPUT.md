> Retained parent capability/proof history. EXPERIMENTAL-CPU.md supersedes policy/stock-AI statements in this descendant; exact deck/rules/concession contracts remain.

> This exact-snapshot contract remains. RULES-DATA.md adds the required dated bundle gate; FORMATS-PROOF.md records Standard/Modern extension.

# Exact existing CardStashy snapshot initialization — bounded Commander candidate

This extends accepted0058 Smart. It does not create a deck builder, replacement import syntax, hosting authority, or Magic rules.

## Existing entry seam
Use `createPlaySetup().snapshot().selected` and `.opponent` unchanged (existing saved/imported CardStashy structured snapshots). `core.js` text export loses commander designations, so do not round-trip through text. `cards[]` already includes commander copies; `commander` / `commanders[]` designate those copies. Native conversion moves exactly one copy per valid designation into Forge's Commander section. It does not add commanders. Raw import `rows[]`, pricing selections and unrelated metadata are preserved in source digests, not silently treated as the current gameplay roster.

## Trusted startup (one provisional match JVM)
Server-owned fixed file `/run/cardstashy/match-input.json`, exact content:
```
{"input":{"format":"Commander","humanDeck":EXISTING_SNAPSHOT,"opponentDeck":EXISTING_SNAPSHOT,"difficultyPolicyVersion":"forge-default-smart-v1"}}
```
Launch `cardstashy.forge.ForgeHttpBridge` with `-Dproof.matchInput=/run/cardstashy/match-input.json -Dproof.requireExact=true` before `-cp`. Missing/invalid input fails closed; hosted mode cannot fall back to the three old local precon aliases. Envelope max262144 bytes; serialized input max131072; bounded nesting/rows/copies. No arbitrary HTTP file path/import endpoint.

A single provisional, authenticated, cost/capacity-bounded container validates then plays. No separate validator JVM required. Host must not mark playable merely because the process exists. A rejected receipt has no created game, publishes failed, and must cause confirmed container cleanup before capacity release.

## Identity and legality
- Each canonical `cards[]` / `side[]` row requires exact name and integral qty. Names resolve to one installed native rules identity; unknown/ambiguous/custom/unsupported definitions reject.
- Explicit row `set`/`setCode` and `collectorNumber`/`collector_number` constrain actual native printings; no `CardDb.getCard` fallback. `finish` foil/nonfoil and boolean foil supported. Other explicit finishes reject. Unspecified printing uses a deterministic native representative and is labeled as such, never presented as an exact user-selected art.
- Source `printingId` / Scryfall UUID mapping and stale raw importer provenance are NOT converted into printing guarantees. Existing app canonical cards currently often carry only name/qty. Per-instance chosen art remains a separate integration limitation.
- One commander or a natively legal two-commander pair; designations must refer to exactly one unambiguous row in cards. Native conformance checks qualification/partners, quantity, singleton/color identity. Native card-pool filter applied separately. Explicit companion designation currently rejects.
- Receipt legal means pinned Forge Commander format checks, not a newly maintained official rules/ban/rotation service. Native definitions loaded is distinct from full interaction coverage. Unknown native prompts fail closed; the candidate does not certify every possible imported deck interaction or optimal AI play.
- Current implementation admits Commander and this one audited Default/Smart policy only. Standard and Modern are release requirements still pending implementation/verification; unsupported formats/policies reject, never silently become Commander. Native Commander sideboard semantics are inherited from pinned Forge.

## State receipt (server-only host consumes then strips)
`/state.initialization` schema `cardstashy.forge-exact-initialization.v1` contains engineRevision, policyVersion, aiProfile Default, controlMode smart, supported, legal, errors, requestDigest, humanDigest, opponentDigest, humanRosterDigest, opponentRosterDigest, registeredRosterVerified, nativeRosterVerified, viewerId, seats summaries and interactionCoverage.
- Source digests use the existing HOST sorted-object / JSON.stringify domain; arrays and source metadata are preserved. Java canonicalizer matches numeric-index property enumeration, shortest double spelling, UTF16/lone-surrogate escaping.
- Registered deck hashes must match resolved manifests; actual instantiated Library+Hand+Command+Sideboard rosters must match before actions are accepted / status becomes running. Forge's non-paper detached Command rules effects are not extra deck copies. Trusted verifier reads pre-deal native identities only to compare unordered hashes. No library order or hidden native card IDs are serialized. `seats` has counts, public commanders and warnings, not full rosters.
- Host must verify flags, engine/policy, source digests, viewer ID and no errors. `supported/legal` without both roster flags is not playable. Browser sees only the original human-private/public projection after host strips the receipt.

## Reproducible local evidence
Requires existing pinned Forge compiled modules/assets (`e5a0f8156da70ffc7866f923bed371c0111707cd`, GPL3), official JDK21, classpath from `adapter/classpath.sh`.
Compile all adapter Java sources with that CP to an isolated classes directory, prefix it before CP. Set `ROOT` to the actual Forge proof root/assets directory and `PROOF_CLASSES` to those compiled classes for `adapter/test-exact-startup.py`.
- `NativeDeckInputChecks fixtures/bootstrap-existing.json <receipt.json>`: actual saved Angels fixture + actual existing `parsePlayDeckImport` result; source unchanged;100=99+1; registered exact roster; unknown/fractional/invalid-print/missing or duplicate commander rejected; native legal Tymna/Tana98+2; illegal count distinguished from loaded definitions; unknown policy rejected.
- `NativeDigestChecks fixtures/digest-corpus.jsonl`: >3000 Java/JS canonical examples, including extreme doubles, integer-property keys, controls, supplementary Unicode and lone surrogates.
- `adapter/test-exact-startup.py`: actual JVM valid receipt with both native roster flags; hidden libraries absent; unknown card fails before game; requireExact with missing input fails rather than aliases.
- Existing BridgeContractChecks and BridgeSmartIntentChecks rerun against this candidate.
- Actual receipt/state evidence under original proof root `logs/exact-bootstrap-state.json`, `logs/exact-startup-checks.log`, `logs/deck-input-checks.log`, `logs/exact-contract-checks.log` (not capability files).

These are local native/HTTP tests, not browser or production acceptance. Accepted0058 remains immutable; no Forge source modifications.
