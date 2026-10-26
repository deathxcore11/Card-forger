import test from 'node:test';
import assert from 'node:assert/strict';
import { assertStartingPlayerReceipt } from './starting-player-contract.mjs';
import { receiptOnlyState } from './probe-image.mjs';

test('same-image receipt preserves the committed first player and rejects missing or altered results', () => {
  const input={startingPlayer:'random',playStyle:'quick'};
  const pregame={schema:'cardstashy.forge-pregame.v1',firstPlayerId:4,selection:'random',playStyle:'quick'};
  const state={players:[{id:3,secret:'PRIVATE_CANARY'},{id:4}],pregame,initialization:{pregame}};
  const capsule=receiptOnlyState(state);
  assertStartingPlayerReceipt(capsule,input);
  assert(!JSON.stringify(capsule).includes('PRIVATE_CANARY'));
  for(const patch of [{firstPlayerId:7},{firstPlayerId:4.1},{selection:'first'},{playStyle:'practice'},{schema:'fake'}]) {
    const changed={...pregame,...patch};
    assert.throws(()=>assertStartingPlayerReceipt({...capsule,pregame:changed,initialization:{pregame:changed}},input),/native_starting_player_receipt_mismatch/);
  }
  assert.throws(()=>assertStartingPlayerReceipt({...capsule,pregame:{...pregame,firstPlayerId:3}},input),/native_starting_player_receipt_mismatch/);
  assert.throws(()=>assertStartingPlayerReceipt({},input),/native_starting_player_receipt_mismatch/);
  assert.doesNotThrow(()=>assertStartingPlayerReceipt({},{}));
});
