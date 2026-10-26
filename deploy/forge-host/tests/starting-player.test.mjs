import test from 'node:test';
import assert from 'node:assert/strict';
import {validateExactDeckInput} from '../src/vendor/host001/admission-ledger.mjs';
import {verifyStartingPlayerReceipt} from '../src/native-adapter-next.mjs';
import {nativeAdapter} from '../src/native-adapter.mjs';
const deck={format:'Standard',cards:[{name:'Mountain',qty:60}],side:[],printing:'unchanged'};
const input={format:'Standard',humanDeck:deck,opponentDeck:structuredClone(deck),difficultyPolicyVersion:'forge-heuristic-medium-beta-v1'};
test('starting selection preserves exact deck snapshots and forbids nonrandom Quick Play',()=>{
  assert.deepEqual(validateExactDeckInput(input),input);
  for(const [playStyle,startingPlayer] of [['quick','random'],['practice','random'],['practice','first'],['practice','second']]){
    const exact={...input,playStyle,startingPlayer};assert.deepEqual(validateExactDeckInput(exact),exact);
  }
  for(const extra of [{startingPlayer:'first'},{playStyle:'practice'},{playStyle:'quick',startingPlayer:'first'},{playStyle:'quick',startingPlayer:'second'},{playStyle:'practice',startingPlayer:true},{playStyle:'ranked',startingPlayer:'random'}])assert.throws(()=>validateExactDeckInput({...input,...extra}),/invalid_starting_player_selection/);
});
test('native starting receipt is bound to selection, native players and projection',()=>{
  const request={...input,playStyle:'practice',startingPlayer:'first'};
  const pregame={schema:'cardstashy.forge-pregame.v1',firstPlayerId:8,selection:'first',playStyle:'practice'};
  const state={players:[{id:8},{id:13}],pregame,initialization:{pregame}};
  assert.doesNotThrow(()=>verifyStartingPlayerReceipt(state,request));
  assert.doesNotThrow(()=>verifyStartingPlayerReceipt({},input));
  for(const patch of [{selection:'second'},{firstPlayerId:99},{firstPlayerId:8.5},{playStyle:'quick'},{schema:'fake'}]){
    const changed={...pregame,...patch};assert.throws(()=>verifyStartingPlayerReceipt({...state,pregame:changed,initialization:{pregame:changed}},request),/native_starting_player_receipt_mismatch/);
  }
  assert.throws(()=>verifyStartingPlayerReceipt({...state,pregame:{...pregame,firstPlayerId:13}},request),/native_starting_player_receipt_mismatch/);
});

test('unsupported pre-toss setup is reported promptly with a bounded safe explanation',async()=>{
  const errors=['This deck requires a setup choice before the coin toss. This version cannot handle that choice yet. Your deck was not changed.'];
  const failure=await nativeAdapter({}).readStartupFailure({epoch:'epoch',internalToken:'private',fetchExisting:async()=>new Response(JSON.stringify({status:'failed',initialization:{failureCode:'unsupported_native_pregame_choice',errors}}),{headers:{'X-Host-Epoch':'epoch','Content-Type':'application/json'}})});
  assert.deepEqual(failure,{code:'unsupported_native_pregame_choice',errors});
});
