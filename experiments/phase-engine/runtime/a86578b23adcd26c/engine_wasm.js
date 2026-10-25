/* @ts-self-types="./engine_wasm.d.ts" */

/**
 * Apply a seat mutation to a seat state, using the TLS card database for deck
 * resolution. Both arguments are JSON strings; returns `{ state, delta }` as
 * a JS object on success, or a JS error string on failure.
 * @param {string} state_json
 * @param {string} mutation_json
 * @returns {any}
 */
export function apply_seat_mutation(state_json, mutation_json) {
    const ptr0 = passStringToWasm0(state_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passStringToWasm0(mutation_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len1 = WASM_VECTOR_LEN;
    const ret = wasm.apply_seat_mutation(ptr0, len0, ptr1, len1);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
}

/**
 * The longest match structure `format` may be played as; the lobby offers Bo3 only when this is Bo3.
 * @param {any} format
 * @returns {any}
 */
export function bestOfThreeCeilingForFormat(format) {
    const ret = wasm.bestOfThreeCeilingForFormat(format);
    return ret;
}

/**
 * Build the HTTP request for one LLM-driven AI decision.
 *
 * `endpoint_json` is the player's configured `LlmEndpointConfig`. `history_json`
 * is the engine-authored game log the caller has accumulated from prior
 * `ActionResult`s — engine data handed back for rendering, not a client
 * derivation. Returns `null` when the seat has no decision to make; throws only
 * on a malformed argument, which is a programming error rather than a runtime
 * outcome.
 * @param {string} difficulty
 * @param {number} player_id
 * @param {string} endpoint_json
 * @param {string} history_json
 * @returns {any}
 */
export function buildLlmDecisionRequest(difficulty, player_id, endpoint_json, history_json) {
    const ptr0 = passStringToWasm0(difficulty, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passStringToWasm0(endpoint_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len1 = WASM_VECTOR_LEN;
    const ptr2 = passStringToWasm0(history_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len2 = WASM_VECTOR_LEN;
    const ret = wasm.buildLlmDecisionRequest(ptr0, len0, player_id, ptr1, len1, ptr2, len2);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
}

/**
 * Build the connection-probe request for an endpoint.
 *
 * Stateless by design: a player configures a provider in Settings, usually
 * with no game running, and a test that required a live board would be
 * untestable exactly when it is most needed. The request is built by the same
 * `build_chat_request` a real decision uses, so a probe that succeeds proves
 * the endpoint, credential and model the game path will use.
 * @param {string} endpoint_json
 * @returns {any}
 */
export function buildLlmProbeRequest(endpoint_json) {
    const ptr0 = passStringToWasm0(endpoint_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.buildLlmProbeRequest(ptr0, len0);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
}

/**
 * Build the bounded card corpus for parallel AI scoring workers. The live
 * main engine remains the only authority that owns the full card database.
 * @returns {string}
 */
export function build_ai_card_subset() {
    let deferred2_0;
    let deferred2_1;
    try {
        const ret = wasm.build_ai_card_subset();
        var ptr1 = ret[0];
        var len1 = ret[1];
        if (ret[3]) {
            ptr1 = 0; len1 = 0;
            throw takeFromExternrefTable0(ret[2]);
        }
        deferred2_0 = ptr1;
        deferred2_1 = len1;
        return getStringFromWasm0(ptr1, len1);
    } finally {
        wasm.__wbindgen_free(deferred2_0, deferred2_1, 1);
    }
}

/**
 * The canonical printed name of each of `names`, index-aligned, `null` where
 * `CardDatabase::canonical_name` has none. Errors if the card database is
 * not loaded.
 * @param {any} names
 * @returns {any}
 */
export function canonicalCardNames(names) {
    const ret = wasm.canonicalCardNames(names);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
}

/**
 * Classify a deck's archetype (Aggro / Midrange / Control / Combo / Ramp) using
 * `phase_ai::DeckProfile::analyze`. The engine is the single authority for archetype
 * classification — the frontend must not compute this from card lists itself.
 *
 * Input: a flat list of card names (duplicates allowed — `resolve_player_deck_list`
 * groups them into DeckEntry counts). Unresolvable names are silently skipped.
 * Output: `{ archetype, confidence: "Pure" | "Hybrid", secondary? }`.
 * @param {any} names_js
 * @returns {any}
 */
export function classify_deck_js(names_js) {
    const ret = wasm.classify_deck_js(names_js);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
}

/**
 * Clear the game state without dropping the WASM instance or card database.
 *
 * Used by the singleton adapter to reset between game sessions. Any in-flight
 * AI computation that calls `with_state()` after this will return an error
 * immediately rather than running a full search on stale state.
 */
export function clear_game_state() {
    wasm.clear_game_state();
}

/**
 * Discard the loaded replay (if any). Safe to call even when none is loaded.
 */
export function clear_replay_playback() {
    wasm.clear_replay_playback();
}

/**
 * CR 702.124: Of `candidates`, which can legally pair with `first_commander`
 * as a co-commander? Applies the full partner family (generic Partner, Partner
 * with [Name], Friends Forever, Character Select, Doctor's Companion, Choose a
 * Background) via the engine's single-authority `can_pair_commanders`. The
 * frontend must not re-derive partner-pairing rules — it filters its candidate
 * list through this. Returns an empty array if the database isn't loaded.
 *
 * `draft_set_codes` is every set whose draft boosters this deck's draft
 * CONTAINED, as an array — or `null`/`undefined`, which is read as the empty
 * array, i.e. constructed play. CR 903.13f(3)
 * conditions its partner grant on what the DRAFT contained, which is a session
 * property no pair of card names can express — so the caller supplies the set
 * codes and the ENGINE maps them to a grant. The client never learns which
 * sets grant what.
 *
 * A LIST rather than one code, because CR 903.13f(3) asks about containment: a
 * mixed draft that opened Commander Masters and other boosters contained
 * Commander Masters, and the grant is in force. The engine takes the union.
 *
 * It is a REQUIRED third parameter, and `JsValue` rather than
 * `Vec<String>`, on purpose: that matches this file's existing convention
 * for engine-typed arguments and makes a stale caller a compile error rather
 * than a silent `undefined`.
 * @param {string} first_commander
 * @param {any} candidates
 * @param {any} draft_set_codes
 * @returns {any}
 */
export function commanderPartnerCandidates(first_commander, candidates, draft_set_codes) {
    const ptr0 = passStringToWasm0(first_commander, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.commanderPartnerCandidates(ptr0, len0, candidates, draft_set_codes);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
}

/**
 * Returns legal Commander-family companion candidates from the main deck.
 * @param {any} request
 * @returns {any}
 */
export function companionCandidates(request) {
    const ret = wasm.companionCandidates(request);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
}

/**
 * Create a default 2-player game state.
 * @returns {any}
 */
export function create_initial_state() {
    const ret = wasm.create_initial_state();
    return ret;
}

/**
 * Axis A: capture a lobby's live, fully-resolved `FormatConfig` as a saved
 * custom-format DEFINITION (`CustomFormatDef`), which the client persists
 * locally. Never produces an active config — `formatConfigForCustomRules`
 * below is the reverse direction, applied when a player later selects a saved
 * definition.
 *
 * Fallible, and the engine's own rejection message is surfaced verbatim: a
 * format whose `deck_loading.rs` behavior grants an auxiliary deck or
 * component keyed on the literal format (Planechase's shared planar deck,
 * Archenemy's scheme deck, Momir's game-start emblem) has no representation in
 * `StructuralRules` and would be silently lost, as would an already-`Custom`
 * source's own legality rules. An empty name is rejected too. The frontend
 * must not re-derive any of these conditions — it displays what the engine
 * says.
 * @param {string} name
 * @param {any} format_config
 * @returns {any}
 */
export function customFormatFromLobbyConfig(name, format_config) {
    const ptr0 = passStringToWasm0(name, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.customFormatFromLobbyConfig(ptr0, len0, format_config);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
}

/**
 * CR 100.2a / CR 903.5b: The named card's per-card deck-construction copy-limit
 * override, or `null` when the default four-of / singleton limit applies.
 * Serialized as the `DeckCopyLimit` tagged union (`{"type":"Unlimited"}` or
 * `{"type":"UpTo","data":N}`); the frontend must switch on `.type`. The engine
 * is the single authority — the frontend never re-parses Oracle text.
 * @param {string} name
 * @returns {any}
 */
export function deckCopyLimit(name) {
    const ptr0 = passStringToWasm0(name, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.deckCopyLimit(ptr0, len0);
    return ret;
}

/**
 * Who supplies `format`'s deck; the lobby offers a pile choice only for `HostPile`.
 * @param {any} format
 * @returns {any}
 */
export function deckSupplyForFormat(format) {
    const ret = wasm.deckSupplyForFormat(format);
    return ret;
}

/**
 * Host the running Eye to Eye / Mouth to Mouth contest locally (single-player and
 * P2P-host engines have no server to stamp time). The JS driver passes its own
 * monotonic `now_ms` (`performance.now()`), the seats that are AI, and any clicks it
 * collected since the last call — each stamped with its own `at_ms`. Clicks are
 * applied in order, then the clock is advanced to `now_ms`, exactly as the server
 * does; the engine's state machine decides everything.
 *
 * A contest's real-time result cannot be replayed from a recorded action list, so
 * the first drive call invalidates an in-progress replay recording (the same
 * treatment debug actions get).
 * @param {number} now_ms
 * @param {Uint8Array} ai_players
 * @param {Uint8Array} away_players
 * @param {any} clicks
 * @returns {any}
 */
export function drive_contest_js(now_ms, ai_players, away_players, clicks) {
    const ptr0 = passArray8ToWasm0(ai_players, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArray8ToWasm0(away_players, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ret = wasm.drive_contest_js(now_ms, ptr0, len0, ptr1, len1, clicks);
    return ret;
}

/**
 * Estimates a Commander deck's bracket without touching `GAME_STATE`.
 * Reads `CARD_DB` for bracket signals. Returns `null` (via serde) when the
 * deck has no commander or the card database is not loaded.
 * @param {any} deck_js
 * @returns {any}
 */
export function estimate_bracket_for_deck(deck_js) {
    const ret = wasm.estimate_bracket_for_deck(deck_js);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
}

/**
 * Always-definite deck/format gate for callers that ENFORCE rather than hint.
 *
 * Returns `{ compatible: boolean, reasons: string[] }` — never a tri-state.
 * Backed by `evaluate_deck_format_gate`, a thin wrapper over the same
 * authoritative `validate_deck_for_format` the real game-creation boundary
 * runs, so a host's admission decision cannot disagree with the engine's own.
 *
 * Its one intended caller is the P2P host's per-guest deck check
 * (`validateGuestDeck` in `client/src/adapter/p2p-adapter.ts`), which kicks a
 * guest whose deck is illegal for the room's format. UI-hint callers must keep
 * using `evaluate_deck_compatibility_js`: that one deliberately answers "no
 * opinion" (`selected_format_compatible: null`) for a Custom format — every
 * request crossing this WASM boundary carries only a bare `GameFormat` tag
 * (Wire-Inertness Invariant, `types::format::SelectedFormat`), which can never
 * resolve real rules even though Phase 1d wired a real evaluator
 * (`evaluate_custom_format`) for a trusted, already-`Resolved` config — which
 * is the honest answer for a legality chip and an unacceptable one for a kick.
 * @param {any} request
 * @returns {any}
 */
export function evaluateDeckFormatGate(request) {
    const ret = wasm.evaluateDeckFormatGate(request);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
}

/**
 * Evaluate deck compatibility and format legality using the loaded card database.
 * Returns strict Standard/Commander checks, BO3 readiness, and selected-format compatibility.
 * @param {any} request
 * @returns {any}
 */
export function evaluate_deck_compatibility_js(request) {
    const ret = wasm.evaluate_deck_compatibility_js(request);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
}

/**
 * Export the current game state as a JSON string.
 * Used by the engine worker to transfer state to AI workers for root parallelism.
 * @returns {string}
 */
export function export_game_state_json() {
    let deferred2_0;
    let deferred2_1;
    try {
        const ret = wasm.export_game_state_json();
        var ptr1 = ret[0];
        var len1 = ret[1];
        if (ret[3]) {
            ptr1 = 0; len1 = 0;
            throw takeFromExternrefTable0(ret[2]);
        }
        deferred2_0 = ptr1;
        deferred2_1 = len1;
        return getStringFromWasm0(ptr1, len1);
    } finally {
        wasm.__wbindgen_free(deferred2_0, deferred2_1, 1);
    }
}

/**
 * Serialize the current game's replay recording to a JSON string — the
 * format `load_replay_for_playback` reads back. Errors if no game has been
 * initialized in this worker (or the recording was invalidated by undo).
 * @returns {string}
 */
export function export_replay_log() {
    let deferred2_0;
    let deferred2_1;
    try {
        const ret = wasm.export_replay_log();
        var ptr1 = ret[0];
        var len1 = ret[1];
        if (ret[3]) {
            ptr1 = 0; len1 = 0;
            throw takeFromExternrefTable0(ret[2]);
        }
        deferred2_0 = ptr1;
        deferred2_1 = len1;
        return getStringFromWasm0(ptr1, len1);
    } finally {
        wasm.__wbindgen_free(deferred2_0, deferred2_1, 1);
    }
}

/**
 * The single authoritative `CustomFormatRules -> FormatConfig` resolver,
 * exposed for the lobby's "select a saved custom format" action.
 * `FormatConfig::for_custom_rules` itself is total and infallible: a
 * `CustomFormatRules` carries every structural field the config needs, so
 * there is no unresolvable input. This wrapper is fallible anyway — beyond
 * deserializing the JS payload, it also bounds the resolved config's
 * `starting_life` (CR 704.5a / CR 810.8c playability floor, and the engine's
 * `MAX_STARTING_LIFE` overflow-safety ceiling) via
 * `validate_starting_life_bounds`. `custom_rules` is user-editable
 * localStorage data, so this bound fails early with a readable lobby-level
 * message rather than a raw `FormatConfig::deserialize` error at game
 * start. It is defense in depth, not the sole check: `FormatConfig`'s own
 * `Deserialize` (see below) remains the closing gate regardless.
 *
 * The frontend must call this rather than assembling a `FormatConfig` from the
 * saved rules itself. `FormatConfig`'s own `Deserialize` re-derives the config
 * with this exact function and demands equality, so any hand-built config
 * would be rejected at the next boundary it crossed.
 * @param {any} custom_rules
 * @returns {any}
 */
export function formatConfigForCustomRules(custom_rules) {
    const ret = wasm.formatConfigForCustomRules(custom_rules);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
}

/**
 * Convert an LLM completion into an authority-bound proposal.
 *
 * Mirrors `get_ai_action_proposal_from_scores`: the model's reply is an
 * untrusted hint, so a fresh contract is derived from the live state and the
 * selected action is admitted only if that contract contains it. There is
 * intentionally no endpoint by which model text becomes a `GameAction` without
 * this check.
 * @param {number} player_id
 * @param {string} fingerprint
 * @param {string} provider_label
 * @param {number} status
 * @param {string} response_body
 * @returns {any}
 */
export function getAiActionProposalFromLlmResponse(player_id, fingerprint, provider_label, status, response_body) {
    const ptr0 = passStringToWasm0(fingerprint, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passStringToWasm0(provider_label, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len1 = WASM_VECTOR_LEN;
    const ptr2 = passStringToWasm0(response_body, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len2 = WASM_VECTOR_LEN;
    const ret = wasm.getAiActionProposalFromLlmResponse(player_id, ptr0, len0, ptr1, len1, status, ptr2, len2);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
}

/**
 * Return the authoritative list of user-selectable formats as a typed array.
 * The frontend treats this as the single source of truth for rendering
 * format pickers, badges, and default configs — no hand-maintained mirrors.
 * @returns {any}
 */
export function getFormatRegistry() {
    const ret = wasm.getFormatRegistry();
    return ret;
}

/**
 * Mint an opaque, authority-bound proposal for the AI's next action.
 *
 * Callers must submit it through [`submit_ai_action_proposal`]. The registry
 * is local to this live WASM instance and is cleared
 * on every successful state mutation, restore, resume, reset, and new game.
 * @param {string} difficulty
 * @param {number} player_id
 * @returns {any}
 */
export function get_ai_action_proposal(difficulty, player_id) {
    const ptr0 = passStringToWasm0(difficulty, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.get_ai_action_proposal(ptr0, len0, player_id);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
}

/**
 * Convert score-only worker output into an authority-bound proposal.
 *
 * The worker state may be old, from another game, or maliciously altered.
 * Consequently this endpoint always derives a new decision contract from the
 * main WASM state, discards every score whose action is not an exact member,
 * and only then mints an opaque proposal. There is intentionally no public
 * score-to-`GameAction` endpoint.
 * @param {string} scores_json
 * @param {string} difficulty
 * @param {number} player_id
 * @param {bigint} rng_seed
 * @returns {any}
 */
export function get_ai_action_proposal_from_scores(scores_json, difficulty, player_id, rng_seed) {
    const ptr0 = passStringToWasm0(scores_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passStringToWasm0(difficulty, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len1 = WASM_VECTOR_LEN;
    const ret = wasm.get_ai_action_proposal_from_scores(ptr0, len0, ptr1, len1, player_id, rng_seed);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
}

/**
 * Diagnostic counterpart of score-worker proposal rebinding. It preserves the
 * existing authority filter and selector; the returned receipt is local WASM
 * observability data bound to the same opaque token.
 * @param {string} scores_json
 * @param {string} difficulty
 * @param {number} player_id
 * @param {bigint} rng_seed
 * @returns {any}
 */
export function get_ai_action_proposal_from_scores_with_diagnostics(scores_json, difficulty, player_id, rng_seed) {
    const ptr0 = passStringToWasm0(scores_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passStringToWasm0(difficulty, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len1 = WASM_VECTOR_LEN;
    const ret = wasm.get_ai_action_proposal_from_scores_with_diagnostics(ptr0, len0, ptr1, len1, player_id, rng_seed);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
}

/**
 * Mint an ordinary opaque proposal together with a local-only diagnostic
 * receipt. The receipt is an observation of the minted capability, never an
 * additional action-selection API.
 * @param {string} difficulty
 * @param {number} player_id
 * @returns {any}
 */
export function get_ai_action_proposal_with_diagnostics(difficulty, player_id) {
    const ptr0 = passStringToWasm0(difficulty, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.get_ai_action_proposal_with_diagnostics(ptr0, len0, player_id);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
}

/**
 * Score candidates inside an isolated AI worker. These are plain,
 * serializable hints rather than capabilities: they cannot cross the action
 * boundary until the live main engine reissues an exact proposal.
 * @param {string} difficulty
 * @param {number} player_id
 * @param {bigint} rng_seed
 * @returns {any}
 */
export function get_ai_scored_candidates(difficulty, player_id, rng_seed) {
    const ptr0 = passStringToWasm0(difficulty, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.get_ai_scored_candidates(ptr0, len0, player_id, rng_seed);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
}

/**
 * Mint a proposal using the existing tactical floor without entering
 * rollout search. This is the engine-owned escape for a timed-out optional
 * scorer; it still issues and validates the current decision contract.
 * @param {string} difficulty
 * @param {number} player_id
 * @returns {any}
 */
export function get_ai_tactical_action_proposal(difficulty, player_id) {
    const ptr0 = passStringToWasm0(difficulty, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.get_ai_tactical_action_proposal(ptr0, len0, player_id);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
}

/**
 * Diagnostic counterpart of [`get_ai_tactical_action_proposal`].
 * @param {string} difficulty
 * @param {number} player_id
 * @returns {any}
 */
export function get_ai_tactical_action_proposal_with_diagnostics(difficulty, player_id) {
    const ptr0 = passStringToWasm0(difficulty, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.get_ai_tactical_action_proposal_with_diagnostics(ptr0, len0, player_id);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
}

/**
 * Look up a card face by name from the loaded card database.
 * Returns the serialized `CardFace` (keywords, abilities, triggers, static_abilities,
 * replacements, card_type, oracle_text, etc.) or null if not found.
 * Used by the deck builder to display engine-parsed ability data.
 * @param {string} name
 * @returns {any}
 */
export function get_card_face_data(name) {
    const ptr0 = passStringToWasm0(name, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.get_card_face_data(ptr0, len0);
    return ret;
}

/**
 * Returns the hierarchical parse tree for a card face, with per-item support status.
 * Each `ParsedItem` contains category, label, source_text, supported (bool), details
 * (key-value pairs), and recursive children (sub-abilities, modal modes, costs).
 * Returns null if the card database is not loaded or the card is not found.
 * @param {string} name
 * @returns {any}
 */
export function get_card_parse_details(name) {
    const ptr0 = passStringToWasm0(name, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.get_card_parse_details(ptr0, len0);
    return ret;
}

/**
 * Returns the official WotC rulings for a card as a JS array of `{date, text}`
 * objects. Returns an empty array if the card is not found, the database is
 * not loaded, or the card has no rulings (back faces of multi-face cards
 * inherit empty rulings — they're deduped at export time to the front face).
 * @param {string} name
 * @returns {any}
 */
export function get_card_rulings(name) {
    const ptr0 = passStringToWasm0(name, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.get_card_rulings(ptr0, len0);
    return ret;
}

/**
 * Variant of `get_game_state` that takes the viewer seat as an argument.
 * Runs the viewer filter first (hides opponent hand/library per standard
 * multiplayer redaction), then wraps the result in the same
 * `ClientGameStateRef` envelope `get_game_state` returns.
 * @param {number} viewer
 * @returns {any}
 */
export function get_filtered_game_state(viewer) {
    const ret = wasm.get_filtered_game_state(viewer);
    return ret;
}

/**
 * Get the current game state as a `ClientGameState` wire envelope
 * (`{ state, derived }`). The `derived` block holds engine-authored
 * presentation projections — commander-damage grouping, etc. — so the
 * frontend never computes game logic. Derivation happens just-in-time per
 * call and does not mutate `GameState`. See
 * `engine::game::derived_views::ClientGameStateRef`.
 * @returns {any}
 */
export function get_game_state() {
    const ret = wasm.get_game_state();
    return ret;
}

/**
 * Viewer-scoped legal actions. Returns the same shape as `get_legal_actions_js`
 * but empty when the viewer is not the player currently expected to act. Used
 * by the P2P host to broadcast per-guest legal-action payloads without leaking
 * game logic into the transport adapter.
 * @param {number} player_id
 * @returns {any}
 */
export function get_legal_actions_for_viewer_js(player_id) {
    const ret = wasm.get_legal_actions_for_viewer_js(player_id);
    return ret;
}

/**
 * Get the legal actions, auto-pass recommendation, spell costs, and the CR 118.3
 * "can't pay this cost right now" read-out for the current game state.
 * Returns `{ actions: GameAction[], autoPassRecommended: boolean, spellCosts: Record<string, ManaCost>,
 * activationBlockReasons: Record<string, AbilityBlockEntry[]> }`.
 * @returns {any}
 */
export function get_legal_actions_js() {
    const ret = wasm.get_legal_actions_js();
    return ret;
}

/**
 * Current stack pressure bucket for animation pacing (Normal/Elevated/Rapid/Instant).
 * Not a rules concept — presentation policy owned by the engine for consistency
 * across browser/desktop/server consumers. Returned as a string to avoid
 * tsify enum-sharing overhead; frontend maps the string to a multiplier.
 * @returns {any}
 */
export function get_stack_pressure() {
    const ret = wasm.get_stack_pressure();
    return ret;
}

/**
 * @param {number} player_id
 * @returns {any}
 */
export function get_viewer_snapshot_js(player_id) {
    const ret = wasm.get_viewer_snapshot_js(player_id);
    return ret;
}

/**
 * Combined viewer projection and event slice for one engine transition.
 * Unlike the legacy state-only endpoint, this path validates the viewer id
 * before narrowing it to the engine's representable PlayerId domain.
 * @param {number} player_id
 * @param {any} events
 * @returns {any}
 */
export function get_viewer_transition_snapshot_js(player_id, events) {
    const ret = wasm.get_viewer_transition_snapshot_js(player_id, events);
    return ret;
}

/**
 * Whether the current game has an in-progress replay recording. `false`
 * before any game has started, or after the recording was invalidated by
 * undo/restore (see `restore_game_state`).
 * @returns {boolean}
 */
export function has_replay_recording() {
    const ret = wasm.has_replay_recording();
    return ret !== 0;
}

/**
 * Initialize panic hook for better error messages in WASM.
 * Called automatically on first use — safe to call multiple times.
 *
 * We install our own hook (composing with `console_error_panic_hook`'s
 * console output) so panics are *both* logged to devtools and captured
 * for later retrieval. With `panic = 'abort'`, the hook runs before the
 * WASM trap, so a thread-local written here is readable from the next JS
 * call into the module.
 */
export function init_panic_hook() {
    wasm.init_panic_hook();
}

/**
 * Initialize a new game for local (single-player / AI) play.
 * Accepts deck_data as a DeckList (name-only) or null/undefined for empty libraries.
 * format_config_js: optional FormatConfig JSON — defaults to Standard if null/undefined.
 * match_config_js: optional MatchConfig JSON — defaults to BO1 if null/undefined.
 * player_count: number of players — defaults to 2 if not provided.
 * first_player: 0 = human plays first (CR 103.1), 1 = opponent plays first, None = random.
 * Names are resolved against the card database loaded via load_card_database().
 * Returns the initial ActionResult (events + waiting_for).
 *
 * Refuses with an `engine_occupied` envelope when a multiplayer host session
 * holds this engine — on a memory-constrained device that host shares this
 * very worker, and overwriting its game would destroy the authoritative state
 * its guests are playing against.
 * @param {any} deck_data
 * @param {number | null | undefined} seed
 * @param {any} format_config_js
 * @param {any} match_config_js
 * @param {number | null} [player_count]
 * @param {number | null} [first_player]
 * @returns {any}
 */
export function initialize_game(deck_data, seed, format_config_js, match_config_js, player_count, first_player) {
    const ret = wasm.initialize_game(deck_data, !isLikeNone(seed), isLikeNone(seed) ? 0 : seed, format_config_js, match_config_js, isLikeNone(player_count) ? 0xFFFFFF : player_count, isLikeNone(first_player) ? 0xFFFFFF : first_player);
    return ret;
}

/**
 * Initialize a new game *and* claim this engine for a multiplayer host
 * session, in one call.
 *
 * Same parameters and same return envelope as `initialize_game`. The P2P host
 * uses this instead, for two reasons that only a single call can satisfy:
 *
 * 1. **Refuses an occupied engine.** A hosted game must never start on top of
 *    a live local game. A client-side probe followed by an install is two
 *    round-trips with a window between them; this guard runs inside the same
 *    synchronous worker task as the install, so nothing can interleave.
 * 2. **Atomic multiplayer-flag claim.** The flag is set on the line after the
 *    state install (see `claim_engine_for`), so there is no window where a
 *    stray `restore_game_state` (undo) would be accepted, and no window where
 *    a failed init leaves the flag set on an engine it never took. Mirrors
 *    `resume_multiplayer_host_state`, the resume-side sibling of this call.
 * @param {any} deck_data
 * @param {number | null | undefined} seed
 * @param {any} format_config_js
 * @param {any} match_config_js
 * @param {number | null} [player_count]
 * @param {number | null} [first_player]
 * @returns {any}
 */
export function initialize_multiplayer_host_game(deck_data, seed, format_config_js, match_config_js, player_count, first_player) {
    const ret = wasm.initialize_multiplayer_host_game(deck_data, !isLikeNone(seed), isLikeNone(seed) ? 0 : seed, format_config_js, match_config_js, isLikeNone(player_count) ? 0xFFFFFF : player_count, isLikeNone(first_player) ? 0xFFFFFF : first_player);
    return ret;
}

/**
 * Whether the named card can serve as this format's command-zone leader.
 * Reads the engine's MTGJSON-derived `CardFace` leadership fields and
 * format-specific deck-validation predicates.
 * @param {string} name
 * @param {any} format
 * @returns {boolean}
 */
export function isCardCommanderEligibleForFormat(name, format) {
    const ptr0 = passStringToWasm0(name, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.isCardCommanderEligibleForFormat(ptr0, len0, format);
    return ret !== 0;
}

/**
 * CR 903.3: Whether the named card can serve as a commander
 * (legendary creature, legendary background, or "can be your commander").
 * Returns false if the card database isn't loaded or the card isn't found.
 * @param {string} name
 * @returns {boolean}
 */
export function is_card_commander_eligible(name) {
    const ptr0 = passStringToWasm0(name, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.is_card_commander_eligible(ptr0, len0);
    return ret !== 0;
}

/**
 * Read the multiplayer enforcement flag. Exposed primarily for tests and
 * adapters that need to defend their own paths (e.g., skip history pushes).
 * @returns {boolean}
 */
export function is_multiplayer_mode() {
    const ret = wasm.is_multiplayer_mode();
    return ret !== 0;
}

/**
 * Read-only preview of cast-time target slots for a currently castable spell.
 * Returns `[]` for uncastable, untargeted, or target-ambiguous casts.
 * @param {number} object_id
 * @returns {any}
 */
export function legal_targets_for_castable_js(object_id) {
    const ret = wasm.legal_targets_for_castable_js(object_id);
    return ret;
}

/**
 * Batch variant for hover/drag clients that need previews for many castable
 * cards. The engine flushes layers once and reuses that snapshot for every id.
 * @param {any} object_ids
 * @returns {any}
 */
export function legal_targets_for_castables_js(object_ids) {
    const ret = wasm.legal_targets_for_castables_js(object_ids);
    return ret;
}

/**
 * Returns the engine-typed catalog of debug-spawnable token presets,
 * loaded from `crates/engine/data/known-tokens.toml`. Read by the debug UI
 * to populate the Create Token dropdown — frontend never derives this list.
 * @returns {any}
 */
export function list_token_presets_js() {
    const ret = wasm.list_token_presets_js();
    return ret;
}

/**
 * The engine-owned LLM provider catalog: vendors, default endpoints, and
 * suggested model ids for the settings UI. The display layer renders exactly
 * this rather than carrying a list of its own.
 * @returns {any}
 */
export function llmProviderCatalog() {
    const ret = wasm.llmProviderCatalog();
    return ret;
}

/**
 * Load the card database from a JSON string (card-data.json contents).
 * Must be called before initialize_game to enable name-based deck resolution.
 * @param {string} json_str
 * @returns {number}
 */
export function load_card_database(json_str) {
    const ptr0 = passStringToWasm0(json_str, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.load_card_database(ptr0, len0);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return ret[0] >>> 0;
}

/**
 * Load a replay log (the JSON produced by `export_replay_log`) for
 * scrubbing/playback. Independent of the live `GAME_STATE` — does not
 * require, and does not affect, an active game. Uses the loaded `CARD_DB`
 * to resolve the recorded deck list when reconstructing the starting
 * state — and errors (rather than silently reconstructing empty
 * libraries) if the replay carries deck data but no card database is
 * loaded; see `ReplayError::MissingCardDatabase`. Returns the total number
 * of recorded actions; valid `replay_seek_js` targets are `0..=length`.
 * @param {string} json_str
 * @returns {number}
 */
export function load_replay_for_playback(json_str) {
    const ptr0 = passStringToWasm0(json_str, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.load_replay_for_playback(ptr0, len0);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return ret[0] >>> 0;
}

/**
 * CR 100.2a / CR 903.5b: How many copies of the named card a deck built under
 * `format_config` may legally contain across main deck, sideboard, and command
 * zone combined (CR 100.4a). Unlike `deckCopyLimit`, this is the *resolved*
 * ceiling — it already applies the basic-land exemption, the card's printed
 * override, and the format default, so the caller compares a count against it
 * directly.
 *
 * `format_config` is a full `FormatConfig` JSON object (as published by
 * `getFormatRegistry`'s `default_config`), not a bare `GameFormat` string: only
 * the config carries the resolved `default_deck_copy_limit` a custom format
 * declares.
 *
 * Serialized as the `DeckCopyLimit` tagged union (`{"type":"Unlimited"}` or
 * `{"type":"UpTo","data":N}`); switch on `.type`. Returns `{"type":"Unlimited"}`
 * when the card database isn't loaded, so a not-yet-hydrated frontend never
 * blocks a legal add.
 * @param {string} name
 * @param {any} format_config
 * @returns {any}
 */
export function maxDeckCopies(name, format_config) {
    const ptr0 = passStringToWasm0(name, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.maxDeckCopies(ptr0, len0, format_config);
    return ret;
}

/**
 * Verify WASM integration works.
 * @returns {string}
 */
export function ping() {
    let deferred1_0;
    let deferred1_1;
    try {
        const ret = wasm.ping();
        deferred1_0 = ret[0];
        deferred1_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
}

/**
 * Issue #5468: non-mutating dry-run of `action` for `actor`. Runs the action on
 * a throwaway clone (the live `GAME_STATE` is never touched) and returns the
 * PUBLIC deltas — life-total changes, public-zone object transitions, created
 * tokens, and objects that ceased to exist — a viewer could observe, for
 * hover-preview UX ("this kills that", "you take 4").
 *
 * Hidden-zone movements never leak: the diff is taken over
 * `filter_state_for_viewer` snapshots (so any identity the viewer can't see is
 * already redacted), AND a transition is surfaced only when at least one
 * endpoint is a public zone (see `engine::game::preview`), so a fully-hidden
 * hand↔library draw is elided even for the acting player's opponents. Returns
 * an error string when `action` is malformed or illegal in the current state.
 * @param {number} actor
 * @param {any} action
 * @returns {any}
 */
export function preview_action_js(actor, action) {
    const ret = wasm.preview_action_js(actor, action);
    return ret;
}

/**
 * Preview one opaque interaction response without committing. A REFUSED declaration is a
 * successful outcome carrying `status: rejected` — never a transport error — so the caller
 * branches on the answer rather than on an error code.
 * @param {number} actor
 * @param {any} request
 * @returns {any}
 */
export function preview_interaction_js(actor, request) {
    const ret = wasm.preview_interaction_js(actor, request);
    return ret;
}

/**
 * Non-mutating automatic spell-payment preview. The engine simulates the
 * exact, currently legal `CastSpell` action and returns the permanent ids that
 * produced mana before that spell was committed to the stack. It returns an
 * empty array when the cast needs another choice before payment can be final.
 * @param {number} actor
 * @param {any} action
 * @returns {any}
 */
export function preview_mana_payment_js(actor, action) {
    const ret = wasm.preview_mana_payment_js(actor, action);
    return ret;
}

/**
 * Project an authoritative seat view from Rust so frontend transports do not
 * need to understand format topology details.
 * @param {string} state_json
 * @returns {any}
 */
export function project_seat_view(state_json) {
    const ptr0 = passStringToWasm0(state_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.project_seat_view(ptr0, len0);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
}

/**
 * The loaded replay's header (format/match config, player count, seed,
 * deck data), or `null` if none is loaded. Lets the viewer show "vs. <deck>"
 * chrome without re-deriving it from the action sequence.
 * @returns {any}
 */
export function replay_header_js() {
    const ret = wasm.replay_header_js();
    return ret;
}

/**
 * Total number of recorded actions in the loaded replay, or `0` if none is loaded.
 * @returns {number}
 */
export function replay_length_js() {
    const ret = wasm.replay_length_js();
    return ret >>> 0;
}

/**
 * Seek the loaded replay to `target` (clamped to the recording's length) and
 * return the reconstructed state at that point, wrapped the same way
 * `get_game_state` wraps the live state. Returns `Ok(null)` only when no
 * replay is loaded — a reconstruction desync (`ReplayError::Desync`, an
 * engine-version mismatch between recording and playback, not a rules
 * outcome) is a real failure and must not be silently swallowed into the
 * same null the caller uses for "nothing loaded"; it throws instead, like
 * every other fallible engine entry point that returns `Result<_, JsValue>`.
 * @param {number} target
 * @returns {any}
 */
export function replay_seek_js(target) {
    const ret = wasm.replay_seek_js(target);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
}

/**
 * Restore the game state from a JSON string.
 * Uses serde_json which handles string-keyed maps (from localStorage round-trip)
 * correctly deserializing into HashMap<ObjectId, V>.
 *
 * Refuses when `MULTIPLAYER_MODE` is set — rewriting a single client's
 * state in a multiplayer session would diverge from the authoritative
 * game on the wire. Undo is a single-player affordance only.
 * @param {string} json_str
 */
export function restore_game_state(json_str) {
    const ptr0 = passStringToWasm0(json_str, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.restore_game_state(ptr0, len0);
    if (ret[1]) {
        throw takeFromExternrefTable0(ret[0]);
    }
}

/**
 * Resume a multiplayer host session from a persisted `GameState`.
 *
 * Called when a P2P host returns after a crash/reload and needs to restore
 * the authoritative game state from disk so returning guests (still in
 * their reconnect backoff) can re-bind to their seats. Mirrors
 * `server-core::GameSession::from_persisted` — the analogous pattern for
 * the WebSocket-server authority.
 *
 * Differs from `restore_game_state` in two load-bearing ways:
 *
 * 1. **Fresh RNG seed.** `restore_game_state` re-seeds from the SAVED
 *    `rng_seed` and fast-forwards to the saved `rng_word_pos`, so the
 *    restored game continues the very stream the snapshot was taken on —
 *    correct for undo, wrong for resume, where continued play must not
 *    re-draw the values the pre-save timeline already committed to. This
 *    function stamps a FRESH seed and resets `rng_word_pos` to 0 so the
 *    resumed host diverges instead.
 *
 *    It does NOT rewind to position 0: that was true only before issue
 *    #5466 taught the restore path to carry the offset, and it survives
 *    today just for snapshots written back then, which carry
 *    `rng_word_pos == 0`. Both the shared decode chokepoint
 *    (`PersistedGameState::into_game_state`) and `restore_game_state`'s
 *    own repeat call `rehydrate_rng`.
 * 2. **Atomic multiplayer-flag flip.** Sets `MULTIPLAYER_MODE` in the
 *    same call that loads state, so there's no window where a stray
 *    `restore_game_state` (undo) would be accepted on the resumed
 *    session.
 *
 * Refuses when the engine is already in use — this is a fresh-instance
 * entry point. Callers must clear any existing state first.
 * @param {string} json_str
 * @returns {any}
 */
export function resume_multiplayer_host_state(json_str) {
    const ptr0 = passStringToWasm0(json_str, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.resume_multiplayer_host_state(ptr0, len0);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
}

/**
 * Explicitly drive any persisted stack automation after a successful restore.
 *
 * [`restore_game_state`] deliberately remains an undo/decode boundary: it
 * installs a playable snapshot but never manufactures a priority pass. This
 * separately-invoked transition is the only WASM owner allowed to ask the
 * engine to resume a saved `StackResolutionSession` or legacy Ready latch.
 * Its bounded engine-authored presentation describes the automated burst;
 * callers read the final game snapshot through the normal state exports.
 * @returns {any}
 */
export function resume_restored_game_state() {
    const ret = wasm.resume_restored_game_state();
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
}

/**
 * Search the loaded card database. The engine is the single authority for the
 * rules data search filters on — format legality, set membership, card types,
 * mana value, and colors — so deck-builder search runs here, never as a
 * third-party API call. Returns `{ results, total }` (see `CardSearchResults`),
 * or an error if the database is not loaded or the query is malformed.
 * @param {any} query
 * @returns {any}
 */
export function search_cards_js(query) {
    const ret = wasm.search_cards_js(query);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
}

/**
 * Set the multiplayer enforcement flag directly.
 *
 * Entering multiplayer is *not* done here: the engine claims the flag itself,
 * in the same call that installs the game (`initialize_multiplayer_host_game`,
 * `resume_multiplayer_host_state`), so no client can leave the flag and the
 * game it describes out of step. This entry point serves the release side —
 * `releaseHostSession` clears the flag when a host session ends, so the next
 * local game on a shared worker may undo again.
 * @param {boolean} enabled
 */
export function set_multiplayer_mode(enabled) {
    wasm.set_multiplayer_mode(enabled);
}

/**
 * CR 100.4a: Returns the sideboard policy stored on a `FormatConfig` as a
 * tagged union: `{"type": "Forbidden"}`, `{"type": "Limited", "data": 15}`,
 * or `{"type": "Unlimited"}`.
 *
 * `format_config` is a full `FormatConfig` JSON object (as published by
 * `getFormatRegistry`'s `default_config`), not a bare `GameFormat` string: only
 * the config carries the resolved policy a custom format declares.
 *
 * The frontend must exhaustive-switch on `.type` — unit variants (`Forbidden`,
 * `Unlimited`) emit no `data` field under `#[serde(tag, content)]`.
 *
 * The engine is the single authority for format sideboard rules; the frontend
 * never hardcodes 15 or any other cap.
 * @param {any} format_config
 * @returns {any}
 */
export function sideboardPolicyForFormat(format_config) {
    const ret = wasm.sideboardPolicyForFormat(format_config);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
}

/**
 * Returns the engine-authored Oathbreaker signature-spell selection policy.
 * @param {any} request
 * @returns {any}
 */
export function signatureSpellSelectionPolicy(request) {
    const ret = wasm.signatureSpellSelectionPolicy(request);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
}

/**
 * Submit a game action on behalf of `actor` and return the ActionResult
 * (events + waiting_for).
 *
 * **Security contract:** `actor` must be the transport-authenticated
 * `PlayerId` of the caller — either the local human's seat (in local/AI
 * games) or the connection-authenticated seat (in P2P/WebSocket games).
 * It must *never* come from UI or wire payload data. The engine rejects any
 * action whose `actor` does not match `authorized_submitter(state)`, so
 * passing a spoofed value here will fail cleanly rather than silently
 * applying the action as another player.
 * @param {number} actor
 * @param {any} action
 * @returns {any}
 */
export function submit_action(actor, action) {
    const ret = wasm.submit_action(actor, action);
    return ret;
}

/**
 * Submit an action selected from an engine-issued AI proposal.
 *
 * A stale or foreign proposal is a normal race outcome and is returned as a
 * tagged value. Rejected actions leave the proposal live for diagnostics or a
 * retry; only a successful apply invalidates the authority generation.
 * @param {string} token
 * @param {number} actor
 * @param {any} action
 * @returns {any}
 */
export function submit_ai_action_proposal(token, actor, action) {
    const ptr0 = passStringToWasm0(token, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.submit_ai_action_proposal(ptr0, len0, actor, action);
    return ret;
}

/**
 * Submit one opaque, engine-authored interaction response. The browser never
 * materializes a `GameAction`; only a successful engine reducer result exposes
 * the exact action to the replay recorder.
 * @param {number} actor
 * @param {any} submission
 * @returns {any}
 */
export function submit_interaction_js(actor, submission) {
    const ret = wasm.submit_interaction_js(actor, submission);
    return ret;
}

/**
 * Drain the last captured panic message (consuming it). Returns `null` when
 * no panic has been observed since the last drain. JS calls this after a
 * thrown `RuntimeError` to decide whether to surface the modal as a real
 * engine crash (with the panic text + report link) or a transient
 * state-loss (the legacy reload prompt).
 * @returns {string | undefined}
 */
export function take_last_panic_message() {
    const ret = wasm.take_last_panic_message();
    let v1;
    if (ret[0] !== 0) {
        v1 = getStringFromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    }
    return v1;
}

/**
 * Validate a probe response through the engine's own extraction and decoding.
 *
 * The transport deliberately returns non-2xx bodies rather than rejecting, so
 * that a vendor's error message survives to be shown. That makes "bytes came
 * back" a meaningless success signal -- a rejected key and an unknown model
 * both arrive as well-formed bodies. This is the authority that says whether a
 * reply is one the game path could actually use.
 * @param {string} provider_label
 * @param {number} status
 * @param {string} response_body
 * @returns {any}
 */
export function validateLlmProbeResponse(provider_label, status, response_body) {
    const ptr0 = passStringToWasm0(provider_label, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passStringToWasm0(response_body, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len1 = WASM_VECTOR_LEN;
    const ret = wasm.validateLlmProbeResponse(ptr0, len0, status, ptr1, len1);
    return ret;
}
function __wbg_get_imports() {
    const import0 = {
        __proto__: null,
        __wbg_Error_bce6d499ff0a4aff: function(arg0, arg1) {
            const ret = Error(getStringFromWasm0(arg0, arg1));
            return ret;
        },
        __wbg_Number_b7972a139bfbfdf0: function(arg0) {
            const ret = Number(arg0);
            return ret;
        },
        __wbg_String_8564e559799eccda: function(arg0, arg1) {
            const ret = String(arg1);
            const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len1 = WASM_VECTOR_LEN;
            getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
            getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
        },
        __wbg___wbindgen_bigint_get_as_i64_410e28c7b761ad83: function(arg0, arg1) {
            const v = arg1;
            const ret = typeof(v) === 'bigint' ? v : undefined;
            getDataViewMemory0().setBigInt64(arg0 + 8 * 1, isLikeNone(ret) ? BigInt(0) : ret, true);
            getDataViewMemory0().setInt32(arg0 + 4 * 0, !isLikeNone(ret), true);
        },
        __wbg___wbindgen_boolean_get_2304fb8c853028c8: function(arg0) {
            const v = arg0;
            const ret = typeof(v) === 'boolean' ? v : undefined;
            return isLikeNone(ret) ? 0xFFFFFF : ret ? 1 : 0;
        },
        __wbg___wbindgen_debug_string_edece8177ad01481: function(arg0, arg1) {
            const ret = debugString(arg1);
            const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len1 = WASM_VECTOR_LEN;
            getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
            getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
        },
        __wbg___wbindgen_in_07056af4f902c445: function(arg0, arg1) {
            const ret = arg0 in arg1;
            return ret;
        },
        __wbg___wbindgen_is_bigint_aeae3893f30ed54e: function(arg0) {
            const ret = typeof(arg0) === 'bigint';
            return ret;
        },
        __wbg___wbindgen_is_function_5cd60d5cf78b4eef: function(arg0) {
            const ret = typeof(arg0) === 'function';
            return ret;
        },
        __wbg___wbindgen_is_null_2042690d351e14f0: function(arg0) {
            const ret = arg0 === null;
            return ret;
        },
        __wbg___wbindgen_is_object_b4593df85baada48: function(arg0) {
            const val = arg0;
            const ret = typeof(val) === 'object' && val !== null;
            return ret;
        },
        __wbg___wbindgen_is_string_dde0fd9020db4434: function(arg0) {
            const ret = typeof(arg0) === 'string';
            return ret;
        },
        __wbg___wbindgen_is_undefined_35bb9f4c7fd651d5: function(arg0) {
            const ret = arg0 === undefined;
            return ret;
        },
        __wbg___wbindgen_jsval_eq_c0ed08b3e0f393b9: function(arg0, arg1) {
            const ret = arg0 === arg1;
            return ret;
        },
        __wbg___wbindgen_jsval_loose_eq_0ad77b7717db155c: function(arg0, arg1) {
            const ret = arg0 == arg1;
            return ret;
        },
        __wbg___wbindgen_number_get_f73a1244370fcc2c: function(arg0, arg1) {
            const obj = arg1;
            const ret = typeof(obj) === 'number' ? obj : undefined;
            getDataViewMemory0().setFloat64(arg0 + 8 * 1, isLikeNone(ret) ? 0 : ret, true);
            getDataViewMemory0().setInt32(arg0 + 4 * 0, !isLikeNone(ret), true);
        },
        __wbg___wbindgen_string_get_d109740c0d18f4d7: function(arg0, arg1) {
            const obj = arg1;
            const ret = typeof(obj) === 'string' ? obj : undefined;
            var ptr1 = isLikeNone(ret) ? 0 : passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            var len1 = WASM_VECTOR_LEN;
            getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
            getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
        },
        __wbg___wbindgen_throw_9c31b086c2b26051: function(arg0, arg1) {
            throw new Error(getStringFromWasm0(arg0, arg1));
        },
        __wbg_call_13665d9f14390edc: function() { return handleError(function (arg0, arg1) {
            const ret = arg0.call(arg1);
            return ret;
        }, arguments); },
        __wbg_done_54b8da57023b7ed2: function(arg0) {
            const ret = arg0.done;
            return ret;
        },
        __wbg_entries_564a7e8b1e54ede5: function(arg0) {
            const ret = Object.entries(arg0);
            return ret;
        },
        __wbg_error_a6fa202b58aa1cd3: function(arg0, arg1) {
            let deferred0_0;
            let deferred0_1;
            try {
                deferred0_0 = arg0;
                deferred0_1 = arg1;
                console.error(getStringFromWasm0(arg0, arg1));
            } finally {
                wasm.__wbindgen_free(deferred0_0, deferred0_1, 1);
            }
        },
        __wbg_from_fa561fa561dc8031: function(arg0) {
            const ret = Array.from(arg0);
            return ret;
        },
        __wbg_getRandomValues_3f44b700395062e5: function() { return handleError(function (arg0, arg1) {
            globalThis.crypto.getRandomValues(getArrayU8FromWasm0(arg0, arg1));
        }, arguments); },
        __wbg_get_3e9a707ab7d352eb: function() { return handleError(function (arg0, arg1) {
            const ret = Reflect.get(arg0, arg1);
            return ret;
        }, arguments); },
        __wbg_get_98fdf51d029a75eb: function(arg0, arg1) {
            const ret = arg0[arg1 >>> 0];
            return ret;
        },
        __wbg_get_unchecked_1dfe6d05ad91d9b7: function(arg0, arg1) {
            const ret = arg0[arg1 >>> 0];
            return ret;
        },
        __wbg_get_with_ref_key_6412cf3094599694: function(arg0, arg1) {
            const ret = arg0[arg1];
            return ret;
        },
        __wbg_instanceof_ArrayBuffer_53db37b06f6b9afe: function(arg0) {
            let result;
            try {
                result = arg0 instanceof ArrayBuffer;
            } catch (_) {
                result = false;
            }
            const ret = result;
            return ret;
        },
        __wbg_instanceof_Map_16f217b9a2a08d8c: function(arg0) {
            let result;
            try {
                result = arg0 instanceof Map;
            } catch (_) {
                result = false;
            }
            const ret = result;
            return ret;
        },
        __wbg_instanceof_Uint8Array_abd07d4bd221d50b: function(arg0) {
            let result;
            try {
                result = arg0 instanceof Uint8Array;
            } catch (_) {
                result = false;
            }
            const ret = result;
            return ret;
        },
        __wbg_isArray_94898ed3aad6947b: function(arg0) {
            const ret = Array.isArray(arg0);
            return ret;
        },
        __wbg_isSafeInteger_01e964d144ad3a55: function(arg0) {
            const ret = Number.isSafeInteger(arg0);
            return ret;
        },
        __wbg_iterator_1441b47f341dc34f: function() {
            const ret = Symbol.iterator;
            return ret;
        },
        __wbg_length_2591a0f4f659a55c: function(arg0) {
            const ret = arg0.length;
            return ret;
        },
        __wbg_length_56fcd3e2b7e0299d: function(arg0) {
            const ret = arg0.length;
            return ret;
        },
        __wbg_new_227d7c05414eb861: function() {
            const ret = new Error();
            return ret;
        },
        __wbg_new_7ddec6de44ff8f5d: function(arg0) {
            const ret = new Uint8Array(arg0);
            return ret;
        },
        __wbg_next_2a4e19f4f5083b0f: function(arg0) {
            const ret = arg0.next;
            return ret;
        },
        __wbg_next_6429a146bf756f93: function() { return handleError(function (arg0) {
            const ret = arg0.next();
            return ret;
        }, arguments); },
        __wbg_now_e7c6795a7f81e10f: function(arg0) {
            const ret = arg0.now();
            return ret;
        },
        __wbg_parse_2c1cad6215e84999: function() { return handleError(function (arg0, arg1) {
            const ret = JSON.parse(getStringFromWasm0(arg0, arg1));
            return ret;
        }, arguments); },
        __wbg_performance_3fcf6e32a7e1ed0a: function(arg0) {
            const ret = arg0.performance;
            return ret;
        },
        __wbg_prototypesetcall_5f9bdc8d75e07276: function(arg0, arg1, arg2) {
            Uint8Array.prototype.set.call(getArrayU8FromWasm0(arg0, arg1), arg2);
        },
        __wbg_stack_3b0d974bbf31e44f: function(arg0, arg1) {
            const ret = arg1.stack;
            const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len1 = WASM_VECTOR_LEN;
            getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
            getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
        },
        __wbg_static_accessor_GLOBAL_THIS_02344c9b09eb08a9: function() {
            const ret = typeof globalThis === 'undefined' ? null : globalThis;
            return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
        },
        __wbg_static_accessor_GLOBAL_ac6d4ac874d5cd54: function() {
            const ret = typeof global === 'undefined' ? null : global;
            return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
        },
        __wbg_static_accessor_SELF_9b2406c23aeb2023: function() {
            const ret = typeof self === 'undefined' ? null : self;
            return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
        },
        __wbg_static_accessor_WINDOW_b34d2126934e16ba: function() {
            const ret = typeof window === 'undefined' ? null : window;
            return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
        },
        __wbg_value_9cc0518af87a489c: function(arg0) {
            const ret = arg0.value;
            return ret;
        },
        __wbindgen_cast_0000000000000001: function(arg0) {
            // Cast intrinsic for `I64 -> Externref`.
            const ret = arg0;
            return ret;
        },
        __wbindgen_cast_0000000000000002: function(arg0, arg1) {
            // Cast intrinsic for `Ref(String) -> Externref`.
            const ret = getStringFromWasm0(arg0, arg1);
            return ret;
        },
        __wbindgen_cast_0000000000000003: function(arg0) {
            // Cast intrinsic for `U64 -> Externref`.
            const ret = BigInt.asUintN(64, arg0);
            return ret;
        },
        __wbindgen_init_externref_table: function() {
            const table = wasm.__wbindgen_externrefs;
            const offset = table.grow(4);
            table.set(0, undefined);
            table.set(offset + 0, undefined);
            table.set(offset + 1, null);
            table.set(offset + 2, true);
            table.set(offset + 3, false);
        },
    };
    return {
        __proto__: null,
        "./engine_wasm_bg.js": import0,
    };
}

function addToExternrefTable0(obj) {
    const idx = wasm.__externref_table_alloc();
    wasm.__wbindgen_externrefs.set(idx, obj);
    return idx;
}

function debugString(val) {
    // primitive types
    const type = typeof val;
    if (type == 'number' || type == 'boolean' || val == null) {
        return  `${val}`;
    }
    if (type == 'string') {
        return `"${val}"`;
    }
    if (type == 'symbol') {
        const description = val.description;
        if (description == null) {
            return 'Symbol';
        } else {
            return `Symbol(${description})`;
        }
    }
    if (type == 'function') {
        const name = val.name;
        if (typeof name == 'string' && name.length > 0) {
            return `Function(${name})`;
        } else {
            return 'Function';
        }
    }
    // objects
    if (Array.isArray(val)) {
        const length = val.length;
        let debug = '[';
        if (length > 0) {
            debug += debugString(val[0]);
        }
        for(let i = 1; i < length; i++) {
            debug += ', ' + debugString(val[i]);
        }
        debug += ']';
        return debug;
    }
    // Test for built-in
    const builtInMatches = /\[object ([^\]]+)\]/.exec(toString.call(val));
    let className;
    if (builtInMatches && builtInMatches.length > 1) {
        className = builtInMatches[1];
    } else {
        // Failed to match the standard '[object ClassName]'
        return toString.call(val);
    }
    if (className == 'Object') {
        // we're a user defined class or Object
        // JSON.stringify avoids problems with cycles, and is generally much
        // easier than looping through ownProperties of `val`.
        try {
            return 'Object(' + JSON.stringify(val) + ')';
        } catch (_) {
            return 'Object';
        }
    }
    // errors
    if (val instanceof Error) {
        return `${val.name}: ${val.message}\n${val.stack}`;
    }
    // TODO we could test for more things here, like `Set`s and `Map`s.
    return className;
}

function getArrayU8FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getUint8ArrayMemory0().subarray(ptr / 1, ptr / 1 + len);
}

let cachedDataViewMemory0 = null;
function getDataViewMemory0() {
    if (cachedDataViewMemory0 === null || cachedDataViewMemory0.buffer.detached === true || (cachedDataViewMemory0.buffer.detached === undefined && cachedDataViewMemory0.buffer !== wasm.memory.buffer)) {
        cachedDataViewMemory0 = new DataView(wasm.memory.buffer);
    }
    return cachedDataViewMemory0;
}

function getStringFromWasm0(ptr, len) {
    return decodeText(ptr >>> 0, len);
}

let cachedUint8ArrayMemory0 = null;
function getUint8ArrayMemory0() {
    if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
        cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8ArrayMemory0;
}

function handleError(f, args) {
    try {
        return f.apply(this, args);
    } catch (e) {
        const idx = addToExternrefTable0(e);
        wasm.__wbindgen_exn_store(idx);
    }
}

function isLikeNone(x) {
    return x === undefined || x === null;
}

function passArray8ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 1, 1) >>> 0;
    getUint8ArrayMemory0().set(arg, ptr / 1);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}

function passStringToWasm0(arg, malloc, realloc) {
    if (realloc === undefined) {
        const buf = cachedTextEncoder.encode(arg);
        const ptr = malloc(buf.length, 1) >>> 0;
        getUint8ArrayMemory0().subarray(ptr, ptr + buf.length).set(buf);
        WASM_VECTOR_LEN = buf.length;
        return ptr;
    }

    let len = arg.length;
    let ptr = malloc(len, 1) >>> 0;

    const mem = getUint8ArrayMemory0();

    let offset = 0;

    for (; offset < len; offset++) {
        const code = arg.charCodeAt(offset);
        if (code > 0x7F) break;
        mem[ptr + offset] = code;
    }
    if (offset !== len) {
        if (offset !== 0) {
            arg = arg.slice(offset);
        }
        ptr = realloc(ptr, len, len = offset + arg.length * 3, 1) >>> 0;
        const view = getUint8ArrayMemory0().subarray(ptr + offset, ptr + len);
        const ret = cachedTextEncoder.encodeInto(arg, view);

        offset += ret.written;
        ptr = realloc(ptr, len, offset, 1) >>> 0;
    }

    WASM_VECTOR_LEN = offset;
    return ptr;
}

function takeFromExternrefTable0(idx) {
    const value = wasm.__wbindgen_externrefs.get(idx);
    wasm.__externref_table_dealloc(idx);
    return value;
}

let cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
cachedTextDecoder.decode();
const MAX_SAFARI_DECODE_BYTES = 2146435072;
let numBytesDecoded = 0;
function decodeText(ptr, len) {
    numBytesDecoded += len;
    if (numBytesDecoded >= MAX_SAFARI_DECODE_BYTES) {
        cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
        cachedTextDecoder.decode();
        numBytesDecoded = len;
    }
    return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}

const cachedTextEncoder = new TextEncoder();

if (!('encodeInto' in cachedTextEncoder)) {
    cachedTextEncoder.encodeInto = function (arg, view) {
        const buf = cachedTextEncoder.encode(arg);
        view.set(buf);
        return {
            read: arg.length,
            written: buf.length
        };
    };
}

let WASM_VECTOR_LEN = 0;

let wasmModule, wasmInstance, wasm;
function __wbg_finalize_init(instance, module) {
    wasmInstance = instance;
    wasm = instance.exports;
    wasmModule = module;
    cachedDataViewMemory0 = null;
    cachedUint8ArrayMemory0 = null;
    wasm.__wbindgen_start();
    return wasm;
}

async function __wbg_load(module, imports) {
    if (typeof Response === 'function' && module instanceof Response) {
        if (typeof WebAssembly.instantiateStreaming === 'function') {
            try {
                return await WebAssembly.instantiateStreaming(module, imports);
            } catch (e) {
                const validResponse = module.ok && expectedResponseType(module.type);

                if (validResponse && module.headers.get('Content-Type') !== 'application/wasm') {
                    console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", e);

                } else { throw e; }
            }
        }

        const bytes = await module.arrayBuffer();
        return await WebAssembly.instantiate(bytes, imports);
    } else {
        const instance = await WebAssembly.instantiate(module, imports);

        if (instance instanceof WebAssembly.Instance) {
            return { instance, module };
        } else {
            return instance;
        }
    }

    function expectedResponseType(type) {
        switch (type) {
            case 'basic': case 'cors': case 'default': return true;
        }
        return false;
    }
}

function initSync(module) {
    if (wasm !== undefined) return wasm;


    if (module !== undefined) {
        if (Object.getPrototypeOf(module) === Object.prototype) {
            ({module} = module)
        } else {
            console.warn('using deprecated parameters for `initSync()`; pass a single object instead')
        }
    }

    const imports = __wbg_get_imports();
    if (!(module instanceof WebAssembly.Module)) {
        module = new WebAssembly.Module(module);
    }
    const instance = new WebAssembly.Instance(module, imports);
    return __wbg_finalize_init(instance, module);
}

async function __wbg_init(module_or_path) {
    if (wasm !== undefined) return wasm;


    if (module_or_path !== undefined) {
        if (Object.getPrototypeOf(module_or_path) === Object.prototype) {
            ({module_or_path} = module_or_path)
        } else {
            console.warn('using deprecated parameters for the initialization function; pass a single object instead')
        }
    }

    if (module_or_path === undefined) {
        module_or_path = new URL('engine_wasm_bg.wasm', import.meta.url);
    }
    const imports = __wbg_get_imports();

    if (typeof module_or_path === 'string' || (typeof Request === 'function' && module_or_path instanceof Request) || (typeof URL === 'function' && module_or_path instanceof URL)) {
        module_or_path = fetch(module_or_path);
    }

    const { instance, module } = await __wbg_load(await module_or_path, imports);

    return __wbg_finalize_init(instance, module);
}

export { initSync, __wbg_init as default };
