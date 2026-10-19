# CardStashy 3.85.15 candidate

Baseline: d6db27b42aaab7313a8820150156d11d3a97874e (3.85.14 / shell231).

## Focused changes

- Homepage make/create-deck intent uses Ask rather than a card-name search.
- User-authored constraints, with source provenance, override model-supplied combo defaults. A plain red/Goblin request cannot acquire an infinite-combo ban from a required schema boolean.
- Actual no-infinite-combo requests retain the restriction and offer app-owned unverified-draft, revision and cancellation choices. Consent is bound to the captured request and workspace. It never comes from model arguments.
- Explicit budget/format choices preserve the other request fields and run existing tools without another model invocation. Vague affordability does not silently become $25 or unlimited. Unknown prices remain unverified.
- Fun/theme preferences and a required card that repeats the exact seed can use existing Pokemon/YGO builders. Multiple hard requirements and unsupported guarantees remain explicit limitations.
- Reviewed unverified drafts remain labeled after explicit saving. No automatic saves or collection changes.
- Saved YGO rarity badge, thin rim and supported finish resolve from the same saved printing. Unresolved identity borrows no cached variation; independent price frames remain intact.

## Root-cause evidence

The released validator accepted a model-supplied avoid_infinite=true without requiring player intent, and the builder returned a terminal refusal with no implemented continuation. Controlled production-loop tests reproduce this. The user's actual provider arguments were not captured, so the exact runtime arguments remain unknown. Screenshots additionally show an invented-budget validation/repetition loop and a blanket TCG restriction refusal. These paths have targeted regressions.

## Test evidence categories

1. Deterministic/unit: production contract, loop, tools, builders, renderer and explicit save callbacks; synthetic catalogue/model responses. Local focused checks pass; complete suite and exact-commit hosted jobs are tracked separately.
2. Actual app with mocked dependencies: hosted AI recovery and YGO printing suites capture screenshots and geometry reports. These do not prove real model interpretation or real catalogue availability.
3. Real configured services: not yet executed on changed candidate. Preview has been reported unconfigured for AI; production availability is not candidate validation. No production secrets were copied, permissions changed, or paid model calls made by these tests.
4. Not executed/blocked: genuine provider conversations and actual-card semantic/coherence checks until an authorized real-provider test route is available. Do not call the candidate ready from mock tests alone.

## Release / rollback

No database migration, data rewrite, or destructive persistence operation. Production remains on baseline until real-service testing and applicable release requirements are met. The user's current request authorizes publishing after tests; it does not make an unexecuted core journey a pass.

Rollback: create a new production commit restoring the baseline application files while using a newer service-worker cache key, then verify served bytes and reopen smoke checks. Avoid a destructive history reset; leave saved cards/decks intact. New draft disclosure fields are additive and do not require migration.

Status: NOT READY while real-provider journey remains unverified. This is a review candidate, not a release declaration.
