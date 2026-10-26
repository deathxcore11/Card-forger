// Native exception text may include card data or implementation details. Only
// these fixed control-state codes may cross the authenticated host boundary.
const reasons = new Set([
  'stale_revision', 'stale_prompt', 'native_engine_busy', 'native_input_changed',
  'native_dialog_requires_reply', 'ok_disabled', 'cancel_disabled',
  'native_match_unavailable', 'native_game_finished', 'native_concession_in_progress',
  'exact_initialization_unverified',
]);
export const nativeActionRejection = value => reasons.has(value) ? value : 'native_action_rejected';
