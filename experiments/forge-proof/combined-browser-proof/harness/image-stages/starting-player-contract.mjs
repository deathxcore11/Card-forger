import assert from 'node:assert/strict';

// Verify the actual image's committed first-player event. The native engine
// owns card-specific overrides; a requested preference is not the result.
export function assertStartingPlayerReceipt(state, input) {
  if (input?.startingPlayer === undefined && input?.playStyle === undefined) return;
  const receipt = state?.initialization?.pregame;
  assert(receipt?.schema === 'cardstashy.forge-pregame.v1'
    && receipt.selection === input.startingPlayer && receipt.playStyle === input.playStyle
    && Number.isSafeInteger(receipt.firstPlayerId) && receipt.firstPlayerId >= 0
    && Array.isArray(state.players) && state.players.some(player => player.id === receipt.firstPlayerId)
    && JSON.stringify(state.pregame) === JSON.stringify(receipt),
  'native_starting_player_receipt_mismatch');
}
