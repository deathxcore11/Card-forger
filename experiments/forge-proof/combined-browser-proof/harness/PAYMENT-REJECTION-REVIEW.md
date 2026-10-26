# Payment rejection continuation

Base: `f81df780835feb2533b1877108da3b70f50343ee`, recovered from the prior lead's actual local checkout and verified against its saved checkpoint. This preserves the hosting patch and native payment fix. Published proof remains `f17bbe490156499c0b0249d043260b815a9e4cc1`; production reference supplied by the checkpoint is `7a91d7757ff1ac7e1d83a904a294b48a44ed1f32`. Neither remote reference was changed here.

## Reproduced findings

The native bridge already returns specific reasons such as `stale_revision`, `native_engine_busy` and `ok_disabled`. The old GatewayDriver discarded the response body, MatchAuthority persisted only accepted/rejected state, and the client displayed `host_request_rejected`. The same 18 transport regressions produce 17 failures against the unchanged f81 host/client and pass on this continuation. This establishes diagnostic loss, not the cause of run 40324277781's touch rejection.

A separate UI ordering failure is reproduced: a poll accepts the next revision while the action acknowledgement is still pending; after the acknowledgement, the session begins waiting for a newer revision even though it already has one. Re-reading that same current revision is ignored, leaving controls busy at a stable native decision. The fix only starts that wait when the session has not already accepted a newer revision. It preserves duplicate-submission guards, monotonic state acceptance and the wait when no newer state exists. This is a confirmed local UI stall, not an established explanation for the historical native rejection.

The existing f81 native payment fix is preserved without further gameplay edits. Expanded real native controller fixtures pass nine Smart/Full Control Auto/manual scenarios. During nine explicitly held payment submissions, nine stale requests and nine busy requests are rejected without changing the published receipt or observed life, hand, stack and tapped-land counts. Every scenario completes with exactly one spell on the stack and two tapped lands. The identical fixture fails all nine scenarios against the pre-fix bridge. These are local native tests, not browser matches.

Review caught an edge case in the new diagnostic read: an outer deadline could otherwise erase already-confirmed rejection headers while waiting for an error body. The driver now reports epoch-bound rejection immediately to the authority. Optional diagnostics can refine the safe reason, but cancellation cannot change a known rejection to unknown. Without confirmed rejection headers, uncertainty remains pending and blocks further dispatch. Five authority regressions cover both cases; disabling the early confirmation fails the two affected cases.

## Changes

- `candidate/host/src/vendor/host001/action-rejection.mjs`: fixed reason allowlist; all other native text becomes `native_action_rejected`.
- `candidate/host/src/vendor/host001/gateway-driver.mjs`: bounded diagnostic read after verified rejection, with early outcome confirmation; no POST replay.
- `candidate/host/src/vendor/host001/session-authority.mjs`: safe reason in durable rejected receipts, preserving confirmed outcomes across diagnostic cancellation.
- `candidate/ui/play-forge-host-client.js`: validates rejected receipt command identity and presents fixed useful messages. Mismatched receipts block further submissions. No automatic retry.
- `candidate/ui/experiments/forge-proof/forge-session.mjs`: avoids waiting indefinitely for a revision already accepted before the action acknowledgement.
- `candidate/build-context/native/adapter/src/cardstashy/forge/NativePaymentTransitionChecks.java`: adds actual duplicate/stale payment checks. Native gameplay/runtime classes remain unchanged.
- `harness/action-diagnostics.{json,mjs}`, `browser-journey.mjs`, `artifacts.py`: retain safe request/observed revisions, prompt IDs, operations, HTTP outcome, allowed reasons and hashed command/generation correlation. First 64 receipts and any failing receipt are retained. Unknown transport outcomes remain unknown. No raw bodies, cards, credentials or command/generation IDs are published.
- Regressions: `test-native-action-rejection.mjs`, `test-rejection-deadline.mjs`, `test-action-diagnostics.mjs`, `test-payment-receipt-order.mjs`, `test-artifacts.py`.
- Source inventories, build pins, workflow manifest pin and source verifier refreshed. Prior UI inventory is preserved as `UI-PARENT-SHA256.json`; the verifier permits exactly the two declared UI-file changes. Historical run evidence remains unchanged.

## Evidence and limits

Final source checks: 135 harness Node, 41 harness Python, 179 hosting Node and 22 hosting Python PASS. Container Python: 46 PASS / 2 FAIL from the unchanged procfs-dependent tests. Payment ordering tests improve from 5 PASS / 1 FAIL to 6 PASS.

Current local verification is recorded in `evidence/payment-rejection-continuation/verification.json`. Native before/after evidence and the six actual local workerd/SQLite passes are alongside it. SQLite uses synthetic verifier/match bindings and makes zero account/provider/outbound calls.

The workspace's PID namespace does not match its `/proc` mount. Existing zombie-observation tests fail here; the native cleanup guard correctly rejects that environment. No cleanup implementation, gate or test was disabled. The full local aggregate must not be called green.

The latest historical browser run passed one natural desktop Medium Commander game, result/rematch/navigation and cleanup with synthetic accounts, then failed wide-touch payment after nine actions. Its sanitized receipt did not retain the native reason or a comparable per-action trace. This continuation adds that evidence for the next approved run; it cannot recover the missing historical reason.

## Remaining proof

1. Independently review the exact continuation source and manifests.
2. After separate approval, build and attest one fresh image from these exact inputs. Keep the existing cleanup preflight and bounded execution gates.
3. Run desktop and wide-touch against that image through actual controls. Confirm one payment and one resulting spell, native choice handling, desktop completion/rematch and resource cleanup. Compare safe action receipts if either case fails.
4. Physical device, real account persistence, full production boot, live hosting, broader decks/formats and deployment remain separate unproved scopes.

No paid run, remote publication, production deployment, APK change or live acceptance occurred in this continuation. The historical touch cause remains unresolved.
