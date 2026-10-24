# Play references: tool review and observed guest match

October 24, 2026. This record separates an uploaded tool's documented capability,
visible reference-site behavior, and CardStashy implementation requirements.
Neither source certifies the candidate engine, its complete card catalog, a fair
CPU, or a finished CardStashy Play experience.

## Uploaded REA source archive

The supplied file was inspected directly as a ZIP, without installing REA,
starting its CLI/MCP server, running package scripts, or invoking an analysis
tool against another application.

| Identity | Inspected value |
| --- | --- |
| Uploaded filename | `rea-rea-agents-6.7.0.zip` |
| SHA-256 | `da21a98de3553c4166cacee2c43f27dcc552e96b85bde768df4a687c8a4e82ce` |
| Inventory | 4,707 entries; 56,396,670 total uncompressed bytes; no unsafe archive paths identified in the preflight |
| Package | `rea-agents`, version `6.7.0` |
| Declared Node engine | `^22.19.0 || ^24.11.0 || >=26.0.0` |
| Declared package license | MIT |
| Declared source repository | `https://github.com/morluto/rea` |

Files read inside the archive included `README.md`, `package.json`,
`docs/browser-observation.md`, `docs/browser-scenario-contract.md`,
`docs/javascript-runtime-observation.md`, and `docs/wasm-artifacts.md`.
The public repository's main-branch README inspected separately by the primary
session differed from this uploaded README and was more current. Main-branch
claims must not be attributed to the exact 6.7.0 ZIP without checking its bytes.
The package's declared license is not a completed dependency or distribution
audit. No REA or third-party application code was copied into CardStashy.

The uploaded README describes static JavaScript inspection, website observation,
and runtime workflows. Its detailed contracts narrow what those results prove:

- Static JavaScript analysis reads selected artifacts without running the app.
  It can identify imports, routes and endpoint candidates; candidates are not
  proof that a feature executes or that an inferred algorithm is correct.
- Passive browser CDP observation records bounded page/script/resource/network
  evidence. The passive provider is distinct from the Playwright scenario
  provider, which actually drives declared browser actions and can capture
  intermediate DOM, accessibility, screenshots and events.
- The documented passive Node/Electron Inspector provider uses `Runtime.enable`
  and `Debugger.enable`. Script/context presence does not reveal execution
  causality, caller edges, hidden CPU state or decision quality.
- The documented offline WASM route validates/decodes explicitly selected bytes
  using caller-supplied WABT; it does not execute the module. Its documented
  8 MiB selected-file limit would exclude our pinned 40,060,780-byte Phase WASM.
  No REA WASM invocation was attempted, and decoded WAT would not itself prove
  Magic rules correctness or CPU fairness.

Practical use for CardStashy is evidence discipline: pin source/runtime bytes,
record exact interaction steps and intermediate prompts, preserve unknowns,
and compare our own permitted UI packets against authoritative traces. A
visible reference match or captured client script cannot establish a remote
opponent's private search algorithm, hidden-information access, weights, RNG,
combo competence or optimal decisions. These remain inference unless supported
by actual authorized source and executable tests.

## Direct Moxgate guest observations

The primary development session directly visited the public guest flow at
[https://www.moxgate.com/solo](https://www.moxgate.com/solo) on October 24.
The observed matchup was **Pauper: Mono Red Madness versus Golgari Gardens**.
These observations came from browser interaction, not an installed REA capture.
No reference-site branding, proprietary textures, code or screenshot chrome is
a CardStashy product asset.

| Observed behavior | CardStashy requirement | Engine/CPU acceptance evidence still needed |
| --- | --- | --- |
| Opening modal showed Keep Hand, Mulligan with “Draw 7, put 1 back,” and a separate Friendly redraw of seven. | Present the selected format's real mulligan and bottom-card procedure. Treat friendly redraw as a separately disclosed casual policy, not a rules exception copied into Practice. | Verify actual hand/library changes, mulligan count, actor ownership and restored pending choices; one opening screenshot cannot prove format legality. |
| CPU kept seven, played Swamp, and passed the turn in the observed opening sequence. | A CPU must make only current engine-legal choices, develop its resources and act in actual priority/choice windows. | Record the CPU's permitted observation and accepted choices. This single sequence reveals neither its policy internals nor whether its choices were strong or fair. |
| Our hand displayed faces/names and named draw log entries. Opponent hand showed backs/count; its draw log said only that it drew a card. | Use seat-scoped presentation and logs. Reveal identities only when the rules grant the viewer knowledge; preserve legitimate reveal history separately from unknown future draws. | Compare human/CPU packets under changed hidden hands/libraries; exercise search/reveal expiry, reconnect, log and replay privacy. Card backs alone do not prove the underlying packet is private. |
| Stops menu offered own/opponent Upkeep, Draw, Main 1, Combat, Main 2 and End; Full Control was off. | Let assistance and chosen response stops control presentation without changing rules or eliminating mandatory decisions. | Assert exact priority ownership and stop behavior against accepted transitions, including the opponent's turn. UI labels do not certify the underlying stop algorithm. |
| Help described automatic passing when nothing worthwhile is available and said it never ends your turn. Later phases/turns advanced in this observed session without another explicit pass click after Bolt. | Record explicit auto-yield preferences and explain any automatic phase progression. Preserve this uncertainty rather than treating the help text or the observed progression as a certified universal policy. | Trace all accepted passes and phase changes. Do not infer the exact auto-yield/end-turn policy from the sparse observed sequence. |
| ACTIONS listed available choices across zones and showed costs. A land entry was labeled “Cast Free,” while the log correctly said that Mountain was played. | Build menus from legal actions and distinguish playing a land from casting a spell. Our land action must remain `PlayLand`, without a spell stack entry or cast triggers. | Verify land allowance/timing and cast-trigger absence, separately from the display label. One reference label must not become our rules implementation. |
| Selecting Lightning Bolt opened a target prompt with You and Golgari Gardens plus Confirm/Cancel. The stack panel already displayed a cast entry while target confirmation was unfinished. | Keep target selection and provisional presentation distinct from an accepted cast. Do not open the opponent's response window until the cast is legally completed, including required choices and payment. | Verify target legality, cancellation, stale choice rejection and the exact commit boundary. The premature visual entry is not evidence that the reference granted real priority at that moment. |
| After target confirmation, Pay Mana offered Auto/Cancel and described cancellation as refunding everything; Auto tapped one Mountain. The stack then showed that the opponent could respond. | Preview legal payment, retain explicit confirmation/cancel controls and animate accepted taps. Do not promise general undo after committed information or rules consequences. | Verify actual mana sources/restrictions, pending-cost ownership, cancellation semantics, and a real engine response window after accepted casting. |
| A later state showed Bolt in our graveyard, the log naming Golgari Gardens as target and reporting three damage/life lost; opponent life was 17 and ours 20. The CPU then drew an unnamed card and played a second Swamp; the displayed turn advanced from 2 to 4. | Make accepted resolution, zones, life totals and viewer-safe logs agree. Render phase progression from accepted engine events. | No CPU response spell was observed, so this does not test counterspell/removal responses or prove an optimal pass. Independent rules assertions and an exact accepted-action trace are still required. |

This observation did not establish a 30-second expiry or a complete timer policy.
CardStashy requires a visible **30-second response window** with authority-owned,
persisted timing and explicit behavior on expiry. The isolated clock contract
may propose only an actual legal `PassPriority` for the same actor, accepted
revision and decision. Required targets, payments, blockers and searches need
an explicit unresolved-choice path; a timer cannot invent a choice or loss.
A completed timer UI, full anti-stall policy and real response-spell tests remain
separate integration work.

This guest match establishes only the listed visible interactions. It does not
certify the reference's complete Pauper legality, all-card coverage, complex
mechanics, token scale, combo handling, private CPU logic, offline behavior or
CardStashy's engine adoption. Preserve CardStashy's own card identity, finishes,
rounded glass/aura and right-side inspection design while implementing and
validating our own rules/choice contracts.
