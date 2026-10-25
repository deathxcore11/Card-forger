# Human single-color mana choice

The combined starter browser run reached `ChooseManaColor` after a Scarecrow Guide activation while paying for Ghalta. The delivered engine's raw interaction correctly authorizes seat 0, but its `manaGroups` schema is not supported by the current human interaction projection. The previous seat projection offered no alternative, so the table could not continue.

`seat-surface.mjs` now exposes only actual engine-offered `ChooseManaColor` actions whose prompt is SingleColor and whose batch count is one. The existing epoch/revision-bound choice registry retains the exact engine action; the UI displays a color label and submits the token. There is no invented color, hidden capability handle, UI legality calculation, or altered manaGroups schema. Other group/combination/batch/Phyrexian formats remain outside this fix.

**PASS:** ten seat-surface tests, including new wrong-seat, stale/reordered-action, empty-offer and unsupported-shape checks. Actual delivered-WASM fixture: Ghalta manual announcement, Scarecrow Guide mana activation, all five offered colors, green accepted, return to ManaPayment, remaining real published payment choices, Ghalta on Stack and then Battlefield. A real Chromium click on the production table's **Choose green mana** button reached the real engine through a controlled transport and returned the rendered table to ManaPayment. This is a focused rendered interaction proof, not a full app match.

Clock actor dependency checked: raw viewer interaction has `canSubmit=true` and `authorizedSubmitters=[0]`, so the existing authority clockContext already selects seat 0. Only the projected unsupported schema had `canSubmit=false`. No match-authority, interaction-surface, human-command or UI production file changed.

```sh
node --test experiments/phase-engine/test-seat-surface.mjs
CARDSTASHY_MANA_BROWSER=1 node experiments/phase-engine/human-mana-engine.mjs
```

The browser runner uses the configured `CODEX_PRIMARY_RUNTIME_NODE_MODULES` Playwright and `CARDSTASHY_CHROMIUM_PATH` executable (with the existing test browser as fallback). [Evidence](evidence/human-mana-001.json).
