// A lost action reply no longer freezes the match: the table waits for the server
// to settle it on a state read, then unlocks. Nothing is resent.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createForgeHostClient,exactDigest,FORGE_REVISION} from './play-forge-host-client.js';

const OWNER='11111111-1111-4111-8111-111111111111',MATCH='22222222-2222-4222-8222-222222222222',GENERATION='33333333-3333-4333-8333-333333333333';
const SCHEMA='cardstashy.forge-proof.v1';
const deck={name:'Exact deck',format:'Commander',commander:'Commander Name',cards:[{name:'Mountain',qty:99},{name:'Commander Name',qty:1}],side:[]};
const snapshot=revision=>({schema:SCHEMA,forgeRevision:FORGE_REVISION,revision,viewer:0,players:[{id:0,isViewer:true},{id:1,isViewer:false}]});
function fixture(){
 const sent=[],states=[],actions=[];
 const client=createForgeHostClient({readAccount:()=>({user:{id:OWNER},accountGeneration:1}),getAccessToken:async()=>'fixture.account.token',fetchImpl:async(path,init)=>{
  if(path==='/api/play/matches'){
   const body=JSON.parse(init.body);
   return Response.json({matchId:MATCH,generation:GENERATION,expiresAt:Date.now()+60000,schema:SCHEMA,forgeRevision:FORGE_REVISION,status:'initializing',deckDigests:{human:await exactDigest(body.humanDeck),opponent:await exactDigest(body.opponentDeck)}},{status:202});
  }
  if(path.endsWith('/actions')){const body=JSON.parse(init.body);sent.push(body);const reply=actions.shift();assert(reply,'fixture needs an action reply');return reply(body);}
  const state=states.shift();assert(state,'fixture needs a state');return Response.json({matchId:MATCH,generation:GENERATION,status:'running',...state});
 }});
 return {client,sent,states,actions};
}
const open=async f=>{await f.client.create({format:'Commander',humanDeck:deck,opponentDeck:deck,difficultyPolicyVersion:'forge-default-v1'});};

test('a lost reply waits for the server, then the table unlocks without resending',async()=>{
 const f=fixture();await open(f);
 f.actions.push(body=>Response.json({commandId:body.commandId,state:'pending_outcome_unknown'},{status:202}));
 await assert.rejects(f.client.submit({revision:7,op:'card',id:3}),e=>e.code==='ACTION_OUTCOME_UNKNOWN'&&/Checking whether your last action went through/.test(e.message));
 assert.equal(f.client.status().blocked,true);assert.equal(f.client.status().outcomePending,true);
 await assert.rejects(f.client.submit({revision:7,op:'ok'}),e=>e.code==='ACTION_OUTCOME_PENDING');
 // Still pending on the server at the same revision: stay locked.
 f.states.push({snapshot:snapshot(7),commandPending:true});await f.client.read();
 assert.equal(f.client.status().outcomePending,true);
 // The server settled it: the board moved on (the land was played).
 f.states.push({snapshot:snapshot(8),commandPending:false});await f.client.read();
 assert.equal(f.client.status().blocked,false);assert.equal(f.client.status().error,null);
 f.actions.push(body=>Response.json({commandId:body.commandId,state:'accepted'},{status:202}));
 assert.equal((await f.client.submit({revision:8,op:'ok'})).state,'accepted');
 assert.deepEqual(f.sent.map(b=>b.action.revision),[7,8],'the unknown action was sent once, never again');
});

test('a server release at the same revision also unlocks',async()=>{
 const f=fixture();await open(f);
 f.actions.push(()=>{throw TypeError('network connection lost');});
 await assert.rejects(f.client.submit({revision:4,op:'card',id:1}));
 assert.equal(f.client.status().outcomePending,true);
 f.states.push({snapshot:snapshot(4),commandPending:false});await f.client.read();
 assert.equal(f.client.status().blocked,false);
});

test('refusals and rate limits never lock the table; a finished or lost match still does',async()=>{
 const f=fixture();await open(f);
 f.actions.push(body=>Response.json({commandId:body.commandId,state:'rejected',error:'stale_revision'},{status:409}));
 await assert.rejects(f.client.submit({revision:2,op:'ok'}));assert.equal(f.client.status().blocked,false);
 f.actions.push(()=>Response.json({error:'match_rate_limit'},{status:429,headers:{'Retry-After':'1'}}));
 await assert.rejects(f.client.submit({revision:2,op:'ok'}),e=>e.status===429);assert.equal(f.client.status().blocked,false);
 f.actions.push(()=>Response.json({error:'match_interrupted',reason:'replaced'},{status:410}));
 await assert.rejects(f.client.submit({revision:2,op:'ok'}),e=>e.status===410&&e.reason==='replaced');
 assert.equal(f.client.status().blocked,true);assert.equal(f.client.status().outcomePending,false);
});

test('an older server without the pending flag still unlocks once the board moves',async()=>{
 const f=fixture();await open(f);
 f.actions.push(body=>Response.json({commandId:body.commandId,state:'pending_outcome_unknown'},{status:202}));
 await assert.rejects(f.client.submit({revision:5,op:'ok'}));
 f.states.push({snapshot:snapshot(5)});await f.client.read();assert.equal(f.client.status().outcomePending,true);
 f.states.push({snapshot:snapshot(6)});await f.client.read();assert.equal(f.client.status().outcomePending,false);
});

test('the table itself redraws unlocked when a lost action is settled without a new board',async()=>{
 const {createForgePresentationSession}=await import('./experiments/forge-proof/forge-session.mjs');
 const f=fixture();await open(f);
 const board=revision=>({...snapshot(revision),turn:1,phase:'MAIN1',inputType:'InputPassPriority',priorityPlayer:0,activePlayer:0,buttons:{okEnabled:true},players:[{id:0,isViewer:true,zones:{}},{id:1,isViewer:false,zones:{}}]});
 const session=createForgePresentationSession({allowControlMode:true,transportStatus:()=>f.client.status(),request:async(path,body)=>body?f.client.submit(body):(await f.client.read()).snapshot});
 const shown=[];session.subscribe(s=>shown.push({busy:s.busy,error:s.transportError}));
 session.acceptState(board(7));
 f.actions.push(body=>Response.json({commandId:body.commandId,state:'pending_outcome_unknown'},{status:202}));
 f.states.push({snapshot:board(7),commandPending:true});
 await session.nativeButton('ok');
 assert.equal(shown.at(-1).busy,true,'locked while the server settles it');
 // The engine never took the action, so the board stays at revision 7 and only the server's release changes.
 f.states.push({snapshot:board(7),commandPending:false});await session.refresh();
 assert.deepEqual(shown.at(-1),{busy:false,error:null},'the last drawn table is unlocked, with no stale message');
});

test('a settled failure leaves no stale diagnostic, and an unusable sign-in token never locks the table',async()=>{
 const f=fixture();await open(f);
 f.actions.push(()=>Response.json({error:'body_timeout'},{status:408}));
 await assert.rejects(f.client.submit({revision:3,op:'ok'}));assert.equal(f.client.status().outcomePending,true);
 f.states.push({snapshot:snapshot(4),commandPending:false});await f.client.read();
 assert.deepEqual([f.client.status().blocked,f.client.status().error],[false,null]);
 const g=fixture();await open(g);let token='fixture.account.token';
 const client=createForgeHostClient({readAccount:()=>({user:{id:OWNER},accountGeneration:1}),getAccessToken:async()=>token,fetchImpl:async(path,init)=>path==='/api/play/matches'?Response.json({matchId:MATCH,generation:GENERATION,expiresAt:Date.now()+60000,schema:SCHEMA,forgeRevision:FORGE_REVISION,status:'initializing',deckDigests:{human:await exactDigest(JSON.parse(init.body).humanDeck),opponent:await exactDigest(JSON.parse(init.body).opponentDeck)}},{status:202}):assert.fail('nothing is sent with an unusable token')});
 await client.create({format:'Commander',humanDeck:deck,opponentDeck:deck,difficultyPolicyVersion:'forge-default-v1'});
 token='';
 await assert.rejects(client.submit({revision:2,op:'ok'}),e=>e.code==='AUTHENTICATION_REQUIRED');
 assert.equal(client.status().outcomePending,false);assert.equal(client.status().blocked,false);
});
