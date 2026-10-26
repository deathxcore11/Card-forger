import test from 'node:test';
import assert from 'node:assert/strict';
import {createForgeHostClient,exactForgeInput,exactDigest,FORGE_REVISION} from './play-forge-host-client.js';

const OWNER='11111111-1111-4111-8111-111111111111';
const MATCH='22222222-2222-4222-8222-222222222222';
const GENERATION='33333333-3333-4333-8333-333333333333';
const SCHEMA='cardstashy.forge-proof.v1';
const opening=(firstPlayerId=0,selection='random',playStyle='practice')=>({schema:'cardstashy.forge-pregame.v1',firstPlayerId,selection,playStyle});
function setup(playStyle='practice',startingPlayer='random',format='Commander'){
 const deck=(name,id)=>({id,name,format,commander:format==='Commander'?'Commander Name':null,cards:[{name:'Mountain',qty:24,printingId:id,finish:'foil'},{name:'Creature Name',qty:4}],side:[{name:'Sideboard Card',qty:2}],source:{kind:'import',originalText:'Unchanged import\n4 Creature Name'},revision:7});
 return {playStyle,profile:{ownerId:OWNER},match:{mode:'cpu',format,difficulty:'Medium',startingPlayer},selected:deck('My exact deck','human-printing'),opponent:deck('CPU exact deck','cpu-printing')};
}
function fixture(input=exactForgeInput(setup())){
 const requests=[],states=[];
 const client=createForgeHostClient({readAccount:()=>({user:{id:OWNER},accountGeneration:1}),getAccessToken:async()=>'fixture.account.token',fetchImpl:async(path,init)=>{
  requests.push({path,init});
  if(init.method==='POST'){
   const sent=JSON.parse(init.body);
   return Response.json({matchId:MATCH,generation:GENERATION,expiresAt:Date.now()+60000,schema:SCHEMA,forgeRevision:FORGE_REVISION,status:'initializing',deckDigests:{human:await exactDigest(sent.humanDeck),opponent:await exactDigest(sent.opponentDeck)}},{status:202});
  }
  const state=states.shift();assert(state,'Fixture needs a native snapshot');
  return Response.json({matchId:MATCH,generation:GENERATION,status:'running',snapshot:state});
 }});
 const state=(pregame,revision=1,players=[{id:0,isViewer:true},{id:1,isViewer:false}])=>({schema:SCHEMA,forgeRevision:FORGE_REVISION,revision,viewer:0,players,...(pregame===undefined?{}:{pregame})});
 return {client,input,requests,states,state};
}

test('Quick Play forces random while preserving exact deck snapshots in every format',()=>{
 for(const format of ['Standard','Modern','Commander'])for(const preference of ['first','second','random']){
  const chosen=setup('quick',preference,format),before=structuredClone(chosen),input=exactForgeInput(chosen);
  assert.equal(input.startingPlayer,'random');assert.equal(input.playStyle,'quick');
  assert.deepEqual(input.humanDeck,before.selected);assert.deepEqual(input.opponentDeck,before.opponent);assert.deepEqual(chosen,before);
  input.humanDeck.cards[0].printingId='mutated';assert.equal(chosen.selected.cards[0].printingId,'human-printing');
 }
});

test('Practice forwards first, second, or random without modifying either deck',()=>{
 for(const preference of ['first','second','random']){
  const chosen=setup('practice',preference),input=exactForgeInput(chosen);
  assert.equal(input.startingPlayer,preference);assert.equal(input.playStyle,'practice');
  assert.deepEqual(input.humanDeck,chosen.selected);assert.deepEqual(input.opponentDeck,chosen.opponent);
 }
 assert.throws(()=>exactForgeInput(setup('practice','invalid')),/FORGE_STARTING_PLAYER_INVALID/);
});

test('invalid paired preferences do not send requests or leave create locked',async()=>{
 const f=fixture();
 for(const prefs of [{startingPlayer:'first'},{playStyle:'practice'},{startingPlayer:'first',playStyle:'quick'},{startingPlayer:'invalid',playStyle:'practice'}]){
  const invalid={...f.input};delete invalid.startingPlayer;delete invalid.playStyle;Object.assign(invalid,prefs);
  await assert.rejects(f.client.create(invalid),/FORGE_STARTING_PLAYER_INVALID/);
  assert.equal(f.requests.length,0);assert.equal(f.client.status().blocked,false);
 }
 await f.client.create(f.input);assert.equal(f.requests.length,1);
 const sent=JSON.parse(f.requests[0].init.body);assert.deepEqual(sent,f.input);assert.equal(f.client.status().blocked,false);
});

test('native committed opening receipt stays stable across successive snapshots',async()=>{
 const f=fixture();await f.client.create(f.input);
 f.states.push(f.state(opening(1)),f.state(opening(1),2));
 assert.deepEqual((await f.client.read()).snapshot.pregame,opening(1));
 assert.deepEqual((await f.client.read()).snapshot.pregame,opening(1));assert.equal(f.client.status().blocked,false);
});

test('initial running snapshot may await the committed native first-player event',async()=>{
 const f=fixture();await f.client.create(f.input);f.states.push(f.state(undefined),f.state(opening(1),2));
 assert.equal((await f.client.read()).snapshot.pregame,undefined);
 assert.equal((await f.client.read()).snapshot.pregame.firstPlayerId,1);assert.equal(f.client.status().blocked,false);
});

for(const [name,receipt]of [
 ['changed requested selection',opening(1,'second')],
 ['changed play style',opening(0,'random','quick')],
 ['unknown starting player',opening(9)],
 ['invalid receipt schema',{...opening(),schema:'invented'}],
])test('rejects '+name+' before exposing the native snapshot',async()=>{
 const f=fixture();await f.client.create(f.input);f.states.push(f.state(receipt));
 await assert.rejects(f.client.read(),/HOST_PREGAME_RECEIPT_MISMATCH/);
 assert.equal(f.client.status().blocked,true);assert.equal(f.client.status().error,'HOST_PREGAME_RECEIPT_MISMATCH');
});

for(const [name,second]of [
 ['first player',opening(1)],
 ['selection',opening(0,'first')],
 ['missing receipt',undefined],
])test('rejects '+name+' changing after a committed receipt',async()=>{
 const f=fixture();await f.client.create(f.input);f.states.push(f.state(opening()),f.state(second,2));
 await f.client.read();await assert.rejects(f.client.read(),/HOST_PREGAME_RECEIPT_MISMATCH/);assert.equal(f.client.status().blocked,true);
});

test('engine rules may override requested first or second without changing the preference receipt',async()=>{
 for(const [selection,firstPlayerId]of [['first',1],['second',0]]){
  const f=fixture(exactForgeInput(setup('practice',selection)));await f.client.create(f.input);f.states.push(f.state(opening(firstPlayerId,selection)));
  const result=await f.client.read();assert.equal(result.snapshot.pregame.firstPlayerId,firstPlayerId);assert.equal(f.client.status().blocked,false);
 }
});

test('duplicate native player IDs cannot authorize a starting-player receipt',async()=>{
 const f=fixture();await f.client.create(f.input);f.states.push(f.state(opening(),1,[{id:0,isViewer:true},{id:0,isViewer:false}]));
 await assert.rejects(f.client.read(),/HOST_NATIVE_PROJECTION_MISMATCH/);assert.equal(f.client.status().blocked,true);
});
