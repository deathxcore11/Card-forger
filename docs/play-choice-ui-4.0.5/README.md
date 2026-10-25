# CardStashy 4.0.5 — choice interface and hand layout

This website release fixes a bounded UI milestone. The native rules engine, Smart-pass assessment, card definitions and deck admission are unchanged. It does not establish complete Commander or Standard support.

## What changes

- Native replacement descriptions and exact option indices produce readable controls. Clear, verified two-option outcomes can be committed in one click; Controls retains explicit confirmation.
- Hallowed Fountain offers the payment consequence and the tapped/no-payment branch. At one life the misleading payment control is disabled using the exact pending PayLife cost, current life and native preview evidence. A payment reaching zero life retains confirmation.
- Mandatory choices do not display the priority-only Smart/Full Control switch. Unmapped choice families retain their existing behavior.
- Hand overlap fits ordinary hands at the checked viewport sizes; large hands retain scrolling.

## Evidence

[Choice regression](choice-regression.json) uses Chromium, the shipped WASM, actual authority, journal, session and table components in engineered states. It verifies paid/declined Fountain, basic Forest play, one-life eligibility, confirmation mode, one accepted submission, duplicate retry idempotency and stale rejection. Native checks also cover two-life payment and both Abandoned Air Temple entry states. These are not complete matches or recovered user-session histories.

Recordings: [pay life](pay.webm), [enter tapped](tapped.webm), [basic land](basic.webm), [one-life choice](low-life.webm).

Eight focused choice contract tests pass. [Layout regression](layout-regression.json) passes five controlled viewport/hand cases, including reachability and single drag submission. Actual touch/browser zoom and multi-replacement engine ordering remain unverified. The layout zoom case uses a smaller CSS viewport.

## Remaining recovery work

The reproduced opening CPU turn still stops with unknown response coverage. Commander mechanics including Misleading Signpost attack redirection and Leyline Tyrant variable red-mana payment remain unfinished. The catalog audit found explicit gaps in 176/198 Commander lists and 49/128 Standard lists; the other lists are not certified by that audit. Native action assessment work is not compiled or release-ready, and no paid engine build was started for this update.

Base production commit: `ee7dfd51a0334073d22911874fc23a1c404abf69`.
