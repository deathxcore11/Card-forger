// Engineered real-card positions; accepted actions through the production adapter/journal.
import assert from 'node:assert/strict';import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {bootMechanics,sha} from './mechanics-inputs.mjs';import {prepare,deck,state,signature} from './mechanics-fixtures.mjs';
import {createMatchAuthority} from './match-authority.mjs';import {createJournal} from './worker-journal.mjs';
const {engine:e,provenance,networkCalls}=await bootMechanics({cardNames:['Forest','Component Pouch','Tavern Swindler']});
let saved=null,requested=null,seq=0,pouch,swindler;
const player=deck('Forest','Component Pouch','Tavern Swindler'),opponent=deck('Forest'),format=e.getFormatRegistry().find(f=>f.format==='Vintage').default_config;
const {adapter,close}=createMatchAuthority({engine:e,epoch:'outcome-proof',decks:{player:{main_deck:player},opponent:{main_deck:opponent}},format,policyWorker:{terminate(){}},onStart(){
 const f=prepare(e,player,opponent);[pouch]=f.move('Component Pouch',0,'Battlefield');[swindler]=f.move('Tavern Swindler',0,'Battlefield');f.restore();
}});
const open=()=>createJournal({engine:adapter,version:'outcome-proof-v1',epoch:'outcome-proof',choose:async(actions,rng)=>{const index=actions.findIndex(a=>JSON.stringify(a)===JSON.stringify(requested));assert(index>=0,'candidate witness no longer present');return {index,rng};},storage:{read:async()=>structuredClone(saved),write:async(n,revision)=>{assert.equal(saved?.revision??null,revision);saved=structuredClone(n);}}});
let journal=open(),status;
async function send(op,fields={}){const r=await journal({v:1,epoch:'outcome-proof',id:'o-'+(++seq),op,...fields});assert(r.ok,JSON.stringify(r));status=r.result;return r;}
async function take(type,predicate=()=>true){const legal=adapter.legal();requested=legal.actions.find(a=>a.type===type&&predicate(a));assert(requested,'missing '+type+' at '+JSON.stringify(state(e).waiting_for)+' choices '+JSON.stringify(legal.actions));return send('step',{revision:status.revision});}
async function resolve(){for(let n=0;n<20&&state(e).stack.length;n++)await take('PassPriority');assert.equal(state(e).stack.length,0);}
try{
 await send('create',{seed:12345,first:0});assert.deepEqual(status.outcomes,[]);
 await take('ActivateAbility',a=>a.data.source_id===pouch&&a.data.ability_index===1);await resolve();
 const die=status.outcomes.find(r=>r.outcome.kind==='die');assert(die,'real Component Pouch roll must be visible');assert.equal(die.outcome.player,0);assert.equal(die.outcome.sides,20);assert(Number.isInteger(die.outcome.result));
 await take('ActivateAbility',a=>a.data.source_id===swindler);await resolve();const coin=status.outcomes.find(r=>r.outcome.kind==='coin');assert(coin,'real Tavern Swindler flip must be visible');assert.equal(coin.outcome.player,0);assert.equal(typeof coin.outcome.won,'boolean');assert.equal(state(e).players[0].life,coin.outcome.won?23:17);
 const before=signature(e),outcomes=structuredClone(status.outcomes),durable=structuredClone(saved),last=Object.entries(saved.receipts).at(-1);assert(last);
 const [id,receipt]=last,revision=receipt.response.revision-1;journal=open();await send('resume');assert.deepEqual(status.outcomes,outcomes);assert.deepEqual(signature(e),before);
 const reply=await journal({v:1,epoch:'outcome-proof',id,op:'step',revision});assert(reply.ok);assert.deepEqual(reply.result,receipt.response);assert.deepEqual(signature(e),before);assert.deepEqual(saved,durable);assert.equal(networkCalls(),0);
 const report={passed:true,provenance,outcomes,life:state(e).players[0].life,revision:saved.revision,networkCalls:0,checks:['real d20 ability through adapter and journal','real coin ability, exact win/loss life consequence','authorized outcome slice persisted with accepted engine save','restored timeline and RNG unchanged','lost-ack receipt replay does not repeat outcome or apply'],sourceSha256:Object.fromEntries(await Promise.all(['random-outcomes-engine.mjs','random-outcomes.mjs','match-authority.mjs','worker-journal.mjs'].map(async f=>[f,sha(await readFile(new URL(f,import.meta.url)))]))),limits:'Two engineered Vintage positions using unchanged pinned real-card definitions. Generated candidate witnesses in this driver, not broad human legality, all roll replacements, pregame roll-offs, CPU, signed-in match or all-card coverage.'};await mkdir('test-results/random-outcomes',{recursive:true});await writeFile('test-results/random-outcomes/report.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}finally{close();}
