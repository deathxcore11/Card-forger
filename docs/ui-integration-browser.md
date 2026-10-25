# Combined UI browser recheck

The full controlled run uses production UI modules with fixture providers/accounts/sessions. It does not establish real sign-in, provider saving, a complete match, physical touch, or actual 200% browser zoom.

`docs/evidence/ui-integration-current.json` records 34 deck-journey checks, 9 actual-session control checks, 40 focus/HUD assertions, 42 decision assertions, 96 layout cases, and actual Enter/I/Escape keyboard focus restoration. The report contains SHA256 and Git blob receipts for all218 served files. These hashes identify the tested snapshot independently of later integration changes.

The first run stopped before tests because the local checkout lacked `ui-review-catalog.json`. The successful run served the exact committed fixture from UI26da16e, Git blob `adb4c2ffab2ad0f6f29be5b4514eab8dcc0a7784`. The fixture is now restored locally. No production source was patched by the runner.

Portable reproduction, from the repository root:

```sh
CARDSTASHY_CHROMIUM_PATH=/path/to/chromium node experiments/phase-engine/ui-integration-browser.mjs
```

The runner requires Playwright at `CODEX_PRIMARY_RUNTIME_NODE_MODULES`. `CARDSTASHY_UI_ROOT` overrides the repository root; `CARDSTASHY_UI_OUTPUT` overrides the default `test-results/ui-integration-browser`. Set `CARDSTASHY_UI_BOUNDED=1` to check the newly added Commander public ledger and local-result history presentation only. Bounded mode rewrites only fixture inputs in its private HTTP server and records both underlying and served fixture hashes. Production modules remain unchanged.

## Bounded follow-up

`docs/evidence/ui-integration-bounded.json` checks the new Commander record and result-history presentation: 7 Commander checks, 8 saved-history checks, and 4 unavailable-storage checks. All19 pass with zero page errors. It verifies exact supplied tax/count/damage, previously public identity without a guessed hidden tax, no submitted game command, exact printing text, escaped card names, ten-result display bound, and unchanged outcome when storage is unavailable. This injects controlled fixture records; the separate flow/history tests establish real persistence.

An initial bounded run stopped on a syntax error in the added fixture override (missing object delimiter); no production defect was implicated. The corrected runner passed, and the initial report remains in the local run artifacts.

Visual review caught an actual overflow defect after adding history: with ten results expanded at1600×1000 and scrollTop0, the centered result panel started at-192px and its heading at-115px, above the scrollable area. `ui-integration-history-before.json` retains the failed geometry. The result host now uses a dedicated class, start alignment and a nonshrinking panel with automatic block margins. Short results remain centered; long results begin inside the scrollport. The corrected bounded run checks both the reachable heading at scrollTop0 and reachable exit controls at the bottom. Eight existing host/navigation/contract Node tests also pass after this change.
