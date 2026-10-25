import {test} from 'node:test';import assert from 'node:assert/strict';
import {terminalOutcome,journalMatchResult} from './match-result.mjs';
import {createJournal} from './worker-journal.mjs';
const context={matchId:'exact-match',snapshotDigest:'frozen-original-decks',format:'Commander',difficulty:'Hard',now:()=>1234};
const journal=(action={type:'PassPriority'},terminal={winner:0})=>({revision:1,history:[{actor:0,action}],receipts:{accepted:{response:{revision:1,terminal}}}});

test('accepted ending commands distinguish real game terminal, concession and both clocks',()=>{
 for(const [action,reason]of [[{type:'PassPriority'},'engine-terminal'],[{type:'HumanConcede'},'human-concession'],[{type:'HumanTimeoutConcede',reason:'inactivity'},'idle-timeout'],[{type:'HumanTimeoutConcede',reason:'turn-limit'},'turn-timeout'],[{type:'HumanTimeoutConcede',reason:'worker-timeout'},'unknown'],[null,'unknown']]){
  assert.equal(terminalOutcome({winner:1},action).reason,reason);
  assert.equal(terminalOutcome(null,action),null);
 }
 assert.equal(terminalOutcome({winner:null},{type:'PassPriority'}).winner,null);
 for(const winner of [undefined,'0',-1,2])assert.throws(()=>terminalOutcome({winner},{type:'PassPriority'}),/INVALID_MATCH_RESULT/);
});
test('result metadata binds the exact snapshot and accepted revision, with stable timestamp on duplicate',()=>{
 const j=journal(),r=journalMatchResult(j,context);assert.deepEqual(r,{matchId:'exact-match',revision:1,winner:0,reason:'engine-terminal',finishedAt:1234,snapshotDigest:'frozen-original-decks',format:'Commander',difficulty:'Hard'});
 const duplicate=journalMatchResult(j,{...context,now:()=>{throw Error('DUPLICATE_TIMESTAMP');}},r);assert.deepEqual(duplicate,r);duplicate.reason='changed';assert.equal(r.reason,'engine-terminal');
 for(const mutate of [x=>x.revision=2,x=>x.winner=1,x=>x.snapshotDigest='different-list',x=>x.reason='turn-timeout',x=>x.matchId='other']){const tampered=structuredClone(r);mutate(tampered);assert.throws(()=>journalMatchResult(j,context,tampered),/RESULT_CONFLICT/);}
});
test('nonterminal errors and stale receipts cannot create or erase a result',()=>{
 assert.equal(journalMatchResult(journal({type:'WorkerTimeout'},null),context),null);
 const j=journal();j.revision=2;assert.equal(journalMatchResult(j,context),null);
 const end=journalMatchResult(journal(),context);assert.throws(()=>journalMatchResult(journal(null,null),context,end),/RESULT_CONFLICT/);
 const conflicting=journal();conflicting.receipts.other={response:{revision:1,terminal:{winner:1}}};assert.throws(()=>journalMatchResult(conflicting,context),/RESULT_CONFLICT/);
});
test('journal emits human concession only after an accepted engine terminal, and receipt/status agree',async()=>{
 let terminal=null,saved=null,calls=0;
 const engine={humanSeat:0,start(){},save:()=>JSON.stringify(terminal),restore:s=>{terminal=JSON.parse(s);},summary:()=>({terminal}),act(c){assert.equal(c.kind,'concede');calls++;terminal={winner:1};return true;}};
 const h=createJournal({engine,storage:{read:async()=>saved,write:async s=>{saved=structuredClone(s);}},version:'test',epoch:'one'});
 const packet=(op,id,fields={})=>({v:1,epoch:'one',op,id,...fields});await h(packet('create','c',{seed:1,first:0}));
 const move=packet('act','quit',{revision:0,command:{kind:'concede'}}),first=await h(move);assert.deepEqual(first.result.terminal,{winner:1,reason:'human-concession'});assert.deepEqual(await h(move),first);assert.equal(calls,1);
 assert.deepEqual((await h(packet('status','poll'))).result.terminal,first.result.terminal);
});
test('CPU proposal failure creates no terminal, receipt or accepted history entry',async()=>{
 let saved=null,applies=0;const h=createJournal({epoch:'one',version:'test',engine:{start(){},save:()=>'{"position":0}',restore(){},summary:()=>({terminal:null}),legal:()=>({actor:1,actions:[{type:'PassPriority'}]}),apply(){applies++;}},storage:{read:async()=>saved,write:async s=>{saved=structuredClone(s);}},choose:async()=>{throw Error('CPU_WORKER_TIMEOUT');}});
 await h({v:1,epoch:'one',id:'c',op:'create',seed:1,first:0});const reply=await h({v:1,epoch:'one',id:'cpu',op:'step',revision:0});assert.equal(reply.ok,false);assert.equal(reply.error,'RECOVERY_REQUIRED');assert.equal(applies,0);assert.equal(saved.revision,0);assert.deepEqual(saved.history,[]);assert.equal(journalMatchResult(saved,context),null);
});
