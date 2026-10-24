# Play mechanic coverage: owner clarification, October 24

The owner explicitly requires token generators, combos, ninjutsu and complex
cards such as **Head Games**. The simple Forest/Bears proof is a starting test,
not the intended final gameplay ceiling. Preserve broad Magic functionality as
the development target; do not silently cut these mechanics to make the first
runtime proof pass. Universal support for every card/interaction remains
unproven and must not be advertised.

## Acceptance work added

| Area | Required executable checks | Current CardStashy evidence |
| --- | --- | --- |
| Head Games | Target the correct opponent; move that hand to that library; controller searches the correct library and selects the required count; selected cards enter that opponent's hand; shuffle that library only. Test empty hand, target becoming illegal, search restrictions, multiplayer seat ownership, saved SearchChoice and duplicate responses. | Targeted Node/WASM search, shuffle, temporary visibility and fresh-process SearchChoice restore pass. General player-choice UI and full edge matrix remain open. |
| Authorized searches/reveals | A search grants only its proper participant the allowed view while the choice exists. Afterward retain legitimate remembered information without exposing future library order or unknown cards. Human UI, CPU, replay and logs obey the same knowledge contract. | Head Games temporary search permission passes targeted WASM checks. New human-seat projection drops private zones; broader reveal-history audit remains open. |
| Token generators | Exact quantity, characteristics, controller, token type, copies, entry state, triggered abilities, replacement/doubling choices, death/sacrifice and zone cleanup. Separate distinct instances even when artwork/name match. Test mixed counters, damage and temporary effects. | Raise the Alarm creates two distinct Soldiers; with Parallel Lives it creates four in targeted WASM checks. Broader token/trigger/copy/cleanup coverage remains open. |
| Combos and loops | Execute actual costs, prerequisites, mana restrictions, triggers, priority and opponent responses. Test removal/counters interrupting the line, changing resources, optional exits and a verified finite repetition shortcut where legal. Mandatory loops and diagnostic time ceilings must not invent a win. Large token/resource totals need bounded work and readable representation. | Three finite Basalt/Power Artifact cycles pass with net mana totals 2/4/6. Broad combos, shortcuts and contextual CPU remain unproved. |
| Ninjutsu | Exact activation timing and returnable unblocked attacker; real available payment; correct Ninja/source zone; return as cost; ability on stack and response; tapped/attacking entry and proper defender; damage timing and resulting triggers. Commander ninjutsu and newer relatives require their own exact support. Save/restore during the activation/choice. | Actual WASM regression FAILS: activation immediately enters the Ninja without a stack response window. This blocks adoption/support for ninjutsu. |
| Other complex mechanics | Stack and priority, targets and modes, X/alternate/additional costs, copies, replacement effects, continuous layers, attachments, counters/damage, graveyard/exile/command zone, transformation, multiple faces and format rules. Maintain exact-card/face coverage and adversarial interaction fixtures. | Existing handoff retains these requirements; no blanket all-card certificate. |

For each supported card, keep these distinct: a catalog entry, executable
rule definition, passing interaction test, usable player-choice interface,
recovery/privacy correctness and competent CPU use. A parsed keyword or a
passing unrelated smoke game cannot promote it to supported status. A deck
containing unproved cards stays clearly unavailable for rules-enforced matches;
never delete/substitute its cards or fall back to manual rules silently.

## Source evidence inspected, not executed

Pinned upstream: `phase-rs/phase@71ccd8fe1715c45fe9e9bd78d391bec5ac8a4234`.

- `crates/engine/tests/integration/targeted_player_mass_library_shuffle.rs`:
  `head_games_search_selection_preserves_targeted_opponent_for_final_shuffle`
  exercises the search selection and retained shuffle target.
- `crates/engine/src/game/engine_resolution_choices.rs` handles the designated
  searched player; parser tests also name Head Games and Jester's Mask.
- `crates/engine/tests/integration/issue_3648_ninjutsu_combat_flow.rs`,
  `issue_5338_moon_circuit_hacker_ninjutsu_mana.rs`, and
  `issue_1319_ninjutsu_dead_attacker.rs` are relevant ninjutsu regressions.
  Some upstream tests return early when their card database is missing. A future
  test run must verify fixtures actually loaded; exit zero alone is insufficient.
- `player_scope_created_token_union.rs`, `cr733_resolved_token_creation.rs`,
  `token_storm_scaling_gate.rs`, and `token_zone_change_index.rs` are relevant
  token/replacement/scale/zone test sources.
- `combo_infinite_pile.rs`, `loop_shortcut_mana_engine.rs`,
  `loop_shortcut_shortening.rs`, and `loop_period_trigger_driven_replay.rs`
  are relevant loop/shortcut test sources.

Official explanatory reference for ordinary ninjutsu:
[Wizards: Kamigawa Neon Dynasty mechanics](https://magic.wizards.com/en/news/feature/kamigawa-neon-dynasty-mechanics-2022-01-27).
Use the current comprehensive rules and exact Oracle text when implementing
edge cases and newer variants. Head Games wording was supplied in the owner's
card screenshot and matches the inspected pinned regression text. The direct
Gatherer page was unavailable during this check; no live Gatherer ruling audit
is claimed.

Next integration work must obtain versioned executable card records for these
fixtures, then exercise them through the actual WASM/worker and permitted
choice projection. Do not replace that evidence with hand-authored success
flags or a heuristic interpretation of printed rules.

## Execution follow-up

The new optional `mechanics-smoke.mjs` suite uses 18 unchanged upstream card
records and clearly labeled engineered positions. It reports six passing cases
and one failing ninjutsu case and exits nonzero intentionally. The ordinary
Lightning Bolt / Counterspell response test passes independently of that
blocker. Captured evidence is in the experiment directory; no broad card pool
or release is certified. See the engine evaluation for the exact findings.
