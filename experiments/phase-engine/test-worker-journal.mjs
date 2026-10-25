import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createJournal,fail} from './worker-journal.mjs';
import {describeChoices,chooseSmoke} from './smoke-policy-worker.mjs';
function fixture(){
 let state=0,durable=null,applyCount=0,failWrite=false,failApply=false;
 const action={type:'PlayLand',data:{object:123}},engine={start(){state=0;},restore(s){state=JSON.parse(s).state;},save:()=>JSON.stringify({state,hidden:'PRIVATE_LIBRARY'}),summary:()=>({turn:state+1,terminal:null}),legal:()=>({actor:state%2,actions:[action]}),apply(){state++;applyCount++;if(failApply)throw Error('PRIVATE_HAND');}};
 const storage={read:async()=>structuredClone(durable),write:async(s,expected)=>{if(failWrite)throw Error('PRIVATE_SAVE');if((durable?.revision??null)!==expected)throw Error('CONFLICT');durable=structuredClone(s);}};
 const make=(epoch='one',choose=async()=>({index:0,rng:12}))=>createJournal({engine,storage,choose,version:'test-v1',epoch});
 return {make,get durable(){return durable;},get count(){return applyCount;},get state(){return state;},set failWrite(v){failWrite=v;},set failApply(v){failApply=v;}};
}
const msg=(op,id,revision=0,epoch='one')=>({v:1,op,id,epoch,...(op==='create'?{seed:123,first:0}:op==='step'?{revision}:{})});
test('concurrent commands serialize; only one accepts a revision',async()=>{const f=fixture(),h=f.make();await h(msg('create','c'));const [a,b]=await Promise.all([h(msg('step','a')),h(msg('step','b'))]);assert(a.ok);assert.equal(b.error,'STALE_REVISION');assert.equal(f.count,1);});
test('duplicate returns receipt, collision rejects, prototype-named IDs are ordinary IDs',async()=>{const f=fixture(),h=f.make();await h(msg('create','c'));const a=await h(msg('step','constructor'));assert(a.ok);assert.deepEqual(await h(msg('step','constructor')),a);assert.equal((await h(msg('step','constructor',1))).error,'ID_COLLISION');assert.equal(f.count,1);});
test('lost acknowledgement survives restart without repeating accepted move',async()=>{const f=fixture(),h=f.make();await h(msg('create','c'));const receipt=await h(msg('step','lost'));const resumed=f.make('two');assert((await resumed(msg('resume','r',0,'two'))).ok);assert.equal((await resumed(msg('step','old',1))).error,'STALE_SESSION');const duplicate=await resumed(msg('step','lost',0,'two'));assert.deepEqual(duplicate.result,receipt.result);assert.equal(f.count,1);});
test('failed persistence restores state and requires explicit recovery',async()=>{const f=fixture(),h=f.make();await h(msg('create','c'));f.failWrite=true;const reply=await h(msg('step','a'));assert.equal(reply.error,'RECOVERY_REQUIRED');assert.equal(f.state,0);assert.equal(f.durable.revision,0);assert(!JSON.stringify(reply).includes('PRIVATE'));assert.equal((await h(msg('step','b'))).error,'RECOVERY_REQUIRED');});
test('throw after engine mutation restores last durable state',async()=>{const f=fixture(),h=f.make();await h(msg('create','c'));f.failApply=true;const r=await h(msg('step','a'));assert.equal(f.state,0);assert.equal(r.error,'RECOVERY_REQUIRED');assert(!JSON.stringify(r).includes('PRIVATE'));});
test('two authorities cannot overwrite the same durable revision',async()=>{const f=fixture(),a=f.make(),b=f.make('two');await a(msg('create','c'));await b(msg('resume','r',0,'two'));assert((await a(msg('step','a'))).ok);assert.equal((await b(msg('step','b',0,'two'))).error,'RECOVERY_REQUIRED');assert.equal(f.durable.revision,1);});
test('malformed and stale-session requests never apply',async()=>{const f=fixture(),h=f.make();await h(msg('create','c'));for(const m of [null,{}, {...msg('step','a'),extra:1},{...msg('step','a'),revision:-1},{...msg('step','a'),id:123}])assert.equal((await h(m)).error,'BAD_REQUEST');assert.equal((await h(msg('step','b',0,'two'))).error,'STALE_SESSION');assert.equal(f.count,0);});
test('out-of-range policy proposals never apply or leak state',async()=>{const f=fixture(),h=f.make('one',async()=>({index:2,rng:10}));await h(msg('create','c'));const r=await h(msg('step','a'));assert.equal(r.error,'BAD_PROPOSAL');assert.equal(f.count,0);assert(!JSON.stringify(r).includes('PRIVATE'));});
test('policy packet omits object IDs and hidden payloads; seeded choices repeat',()=>{const a=[{type:'PlayLand',data:{id:1,hidden:'Forest'}},{type:'CastSpell',data:{id:2,hidden:'Bears'}}];const b=[{type:'PlayLand',data:{id:500,hidden:'Other'}},{type:'CastSpell',data:{id:999,hidden:'Secret'}}];assert.deepEqual(describeChoices(a),describeChoices(b));assert.deepEqual(chooseSmoke(describeChoices(a),123),chooseSmoke(describeChoices(b),123));assert(!JSON.stringify(describeChoices(a)).includes('Forest'));});
test('__proto__ receipt persists as data and replays exactly once',async()=>{const f=fixture(),h=f.make();await h(msg('create','c'));const first=await h(msg('step','__proto__'));assert(first.ok);assert(Object.hasOwn(f.durable.receipts,'__proto__'));assert.deepEqual(await h(msg('step','__proto__')),first);assert.equal(f.count,1);});
test('incompatible saved version is refused',async()=>{const f=fixture(),h=f.make();await h(msg('create','c'));f.durable.version='future';assert.equal((await f.make('two')(msg('resume','r',0,'two'))).error,'INCOMPATIBLE_SAVE');assert.equal(f.count,0);});

test('human choice context is revision-bound and part of durable request identity',async()=>{
 const f=fixture(),seen=[],h=f.make('one',async(actions,rng,context)=>{seen.push(context);return {index:0,rng};});
 await h(msg('create','c'));const command={...msg('step','human'),choice:'r0-choice0'};
 const accepted=await h(command);assert(accepted.ok);assert.deepEqual(seen,[{choice:'r0-choice0',revision:0,actor:0}]);
 assert.deepEqual(await h(command),accepted);assert.equal(f.count,1);
 assert.equal((await h({...command,choice:'r0-choice1'})).error,'ID_COLLISION');assert.equal(f.count,1);
 const resumed=f.make('two');await resumed(msg('resume','r',0,'two'));
 assert.deepEqual((await resumed({...command,epoch:'two'})).result,accepted.result);assert.equal(f.count,1);
});
test('chooser rejection leaves engine, RNG and accepted trace unchanged',async()=>{
 const f=fixture(),h=f.make('one',async(actions,rng,context)=>{if(context.choice!=='valid')fail('BAD_CHOICE');return {index:0,rng};});
 await h(msg('create','c'));const before=structuredClone(f.durable);
 assert.equal((await h({...msg('step','invalid'),choice:'invalid'})).error,'BAD_CHOICE');
 assert.deepEqual(f.durable,before);assert.equal(f.count,0);
 assert((await h({...msg('step','valid'),choice:'valid'})).ok);assert.equal(f.count,1);
});
test('choice is a bounded step-only string',async()=>{
 const f=fixture(),h=f.make();await h(msg('create','c'));
 for(const m of [{...msg('status','a'),choice:'x'}, {...msg('step','b'),choice:null}, {...msg('step','c'),choice:''}, {...msg('step','d'),choice:'x'.repeat(161)}, {...msg('step','e'),choice:'bad\nchoice'}])assert.equal((await h(m)).error,'BAD_REQUEST');
 assert.equal(f.count,0);
});
test('malformed saves reject before restoration or another move',async()=>{
 for(const mutate of [s=>s.revision=-1,s=>s.revision=1,s=>s.policyRng=-1,s=>s.policyRng=NaN,s=>s.receipts=[],s=>s.engine=null]){
  const f=fixture(),h=f.make();await h(msg('create','c'));mutate(f.durable);
  assert.equal((await f.make('two')(msg('resume','r',0,'two'))).error,'CORRUPT_SAVE');assert.equal(f.count,0);
 }
});
test('failed initial persistence requires a new authority before retrying',async()=>{
 const f=fixture(),h=f.make();f.failWrite=true;assert.equal((await h(msg('create','c'))).error,'RECOVERY_REQUIRED');
 f.failWrite=false;assert.equal((await h(msg('create','again'))).error,'RECOVERY_REQUIRED');assert.equal(f.durable,null);
 assert((await f.make('two')(msg('create','fresh',0,'two'))).ok);
});
test('summary receives the accepted revision and cannot override it',async()=>{
 let state=0,durable=null;const revisions=[];
 const h=createJournal({version:'test-v1',epoch:'one',choose:async()=>({index:0,rng:1}),storage:{read:async()=>durable,write:async s=>{durable=s;}},engine:{start(){},restore(){},save:()=>'{"state":0}',legal:()=>({actor:0,actions:[{type:'PassPriority'}]}),apply(){state++;},summary(revision){revisions.push(revision);return {revision:999,turn:state,terminal:null};}}});
 assert.equal((await h(msg('create','c'))).result.revision,0);
 assert.equal((await h(msg('step','a'))).result.revision,1);assert(revisions.includes(0));assert(revisions.includes(1));
});

// Status polling must not repeatedly rebuild expensive engine/viewer interaction
// projections. Returning clones also keeps callers from editing the cached view.
test('status reuses the accepted projection and a new action invalidates it',async()=>{
 let state=0,durable=null,reads=0;
 const engine={start(){},restore(s){state=Number(s);},save:()=>String(state),summary(){reads++;return {turn:state,terminal:null,surface:{cards:[{name:'Visible card'}]}};},legal:()=>({actor:0,actions:[{type:'PassPriority'}]}),apply(){state++;}};
 const h=createJournal({engine,version:'cache-test',epoch:'one',choose:async()=>({index:0,rng:1}),storage:{read:async()=>durable,write:async s=>{durable=structuredClone(s);}}});
 const first=await h(msg('create','c'));first.result.surface.cards[0].name='changed';
 for(let i=0;i<20;i++){const reply=await h(msg('status','status-'+i));assert.equal(reply.result.surface.cards[0].name,'Visible card');assert.equal(reply.result.turn,0);}
 assert.equal(reads,1);
 const accepted=await h(msg('step','move'));assert.equal(accepted.result.turn,1);assert.equal(reads,2);
 assert.deepEqual((await h(msg('step','move'))).result,accepted.result);assert.equal(reads,2);
 await h(msg('status','after'));assert.equal(reads,2);
});

test('a newly terminal projection rejects another move and preserves its receipt',async()=>{
 let state=0,durable=null,applies=0;
 const h=createJournal({version:'terminal-cache',epoch:'one',choose:async()=>({index:0,rng:1}),storage:{read:async()=>durable,write:async s=>{durable=structuredClone(s);}},engine:{start(){},restore:s=>{state=Number(s);},save:()=>String(state),summary:()=>({terminal:state?{winner:0}:null}),legal:()=>({actor:0,actions:[{type:'PassPriority'}]}),apply(){state++;applies++;}}});
 await h(msg('create','c'));const win=await h(msg('step','last'));
 assert.deepEqual(win.result.terminal,{winner:0});
 assert.equal((await h(msg('step','extra',1))).error,'GAME_OVER');
 assert.deepEqual(await h(msg('step','last')),win);assert.equal(applies,1);
});
