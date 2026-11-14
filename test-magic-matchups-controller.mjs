import assert from 'node:assert/strict';
import {createMagicMatchups,matchupFingerprint} from './magic-matchups-controller.js';
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const flush=()=>new Promise(resolve=>setImmediate(resolve));
const analysis=()=>({summary:'Synthetic conditional coaching.',outlook:'uncertain',confidence:'limited',assumptions:['Assume usable mana.'],scenarios:['On the play','On the draw','After disruption'].map(title=>({title,setup:'A hypothetical opening.',plan:'Develop a threat carefully.',risk:'The opponent may interact.',lesson:'Retain a follow-up.',cardIds:['p0','o0']})),coaching:[{title:'Keep resources',text:'Do not overcommit.',cardIds:['p0']}],recommendation:null,limitations:['Not a rules simulation.']});
const card=name=>({name,type_line:'Creature',oracle_text:'Synthetic fixture.',mana_cost:'{R}',color_identity:name.startsWith('Blue')?['U']:['R'],legalities:{standard:'legal'},image_uris:{art_crop:'https://fixture.invalid/card.svg'}});
const opponent={name:'Red fixture',format:'Standard',cards:[{name:'Red creature',qty:60}],provenance:{kind:'import',source:'Synthetic pasted list'}};
const prof=()=>({game:'mtg',score:70,clock:[0,0,0,0,.2,.5,.8,1],maxT:8,inter:8,threats:20,flow:6,plan:'Aggro',size:60,features:{colors:[],creatures:20,noncreature:16,artifacts:0}});
function harness({resolveGate,fetchGate,metaGate,data,noProfile}={}){
 let deck={id:'player',name:'Player fixture',format:'Standard',cards:[{name:'Player creature',qty:60}],side:[]};
 let st={question:'',colors:[],selectionMode:'top',mode:'bo1',opponent:structuredClone(opponent),busy:false,error:'',result:null};
 const epoch={account:1,workspace:1,nav:1},calls={fetch:[],resolve:[],meta:[],render:0};
 const field=data||{format:'Standard',source:'Synthetic source',updatedAt:'2026-10-18',decks:[{name:'Red fixture',format:'Standard',main:[{name:'Red creature',qty:60}],share:.2}]};
 const ctl=createMagicMatchups({getDeck:()=>deck,state:()=>st,lookup:card,metaKey:()=> 'mtg:Standard',loadMeta:async key=>{calls.meta.push(key);return metaGate?metaGate.promise:field;},resolveNames:async names=>{calls.resolve.push(names);if(resolveGate)await resolveGate.promise;},capture:()=>({...epoch}),current:t=>Object.keys(epoch).every(k=>epoch[k]===t[k]),render:()=>calls.render++,profile:d=>noProfile?null:prof(d)});
 return {ctl,calls,epoch,get deck(){return deck;},set deck(v){deck=v;},get st(){return st;},set st(v){st=v;}};
}
{
 const h=harness(),before=JSON.stringify(h.deck);await h.ctl.analyze();assert.equal(h.calls.fetch.length,0,'the matchup read never uses the network');assert.equal(h.st.error,'');assert.equal(h.st.result.scenarios.length,3);assert.equal(h.st.result.confidence,'simulated');assert.ok(h.st.result.win>0&&h.st.result.win<1);assert.match(h.st.result.summary,/2,000 simulated games against Red fixture/);assert.equal(h.st.busy,false);assert.equal(JSON.stringify(h.deck),before);assert.equal(h.st.request.opponent.cards[0].name,'Red creature');
 const again=harness();await again.ctl.analyze();assert.deepEqual(again.st.result,h.st.result,'same lists, same read');
 const three=harness();three.st.mode='bo3';await three.ctl.analyze();assert.match(three.st.result.scenarios[2].lesson,/no sideboard/);
 const none=harness({noProfile:true});await none.ctl.analyze();assert.match(none.st.error,/full list is needed/);assert.equal(none.st.result,null);
}
for(const kind of ['cancel','account','workspace','nav','deck']){
 const gate=deferred(),h=harness({resolveGate:gate});const p=h.ctl.analyze();if(kind==='cancel')h.ctl.cancel();else if(kind==='deck')h.deck.cards[0].qty++;else h.epoch[kind]++;gate.resolve();await p;assert.equal(h.st.result,null,kind+' during card resolution shows no stale read');
}
for(const field of ['mode','question','opponent']){
 const gate=deferred(),h=harness({resolveGate:gate});const p=h.ctl.analyze();await flush();h.st[field]=field==='mode'?'bo3':field==='question'?'A new question':{...h.st.opponent,name:'New opponent'};gate.resolve();await p;assert.equal(h.st.result,null,field+' changed while cards were loading');
}
{
 const h=harness();h.st.opponent=null;await h.ctl.analyze();assert.equal(h.calls.fetch.length,0);assert.match(h.st.error,/preview/i);
 const x=harness();x.st.colors=['U'];await x.ctl.select();assert.equal(x.calls.fetch.length,0,'opponent preview never starts AI');assert.match(x.st.error,/No verified matching/);
}
for(const field of ['account','workspace','nav']){
 const gate=deferred(),h=harness({metaGate:gate});h.st.opponent=null;const p=h.ctl.select();h.epoch[field]++;gate.resolve({format:'Standard',source:'Synthetic',updatedAt:'2026-10-18',decks:[{name:'Red',main:[{name:'Red creature',qty:60}]}]});await p;assert.equal(h.st.opponent,null);assert.equal(h.calls.resolve.length,0);
}
{
 const h=harness({data:{format:'Modern',source:'Synthetic',updatedAt:'2026-10-18',decks:[]}});await h.ctl.select();assert.match(h.st.error,/different format/);assert.equal(h.calls.resolve.length,0);
 const x=harness({data:{format:'Standard',source:'',updatedAt:'2026-10-18',decks:[{name:'Red',main:[{name:'Red creature',qty:60}]}]}});await x.ctl.select();assert.match(x.st.error,/No verified matching/,'unattributed field cannot become a top opponent');
}
{
 const decks=Array.from({length:25},(_,i)=>({name:'Red source '+i,format:'Standard',share:i,main:[{name:'Red '+i,qty:60}]}));
 const h=harness({data:{format:'Standard',source:'Synthetic bounded field',updatedAt:'2026-10-18',decks}});h.st.colors=['R'];await h.ctl.select();assert.equal(h.st.sampleCount,16);assert.equal(h.calls.resolve[0].length,16);assert.equal(h.st.opponent.name,'Red source 15');assert.equal(h.st.opponent.provenance.source,'Synthetic bounded field');assert.equal(h.calls.fetch.length,0);
 const huge=Array.from({length:16},(_,i)=>({name:'List '+i,main:Array.from({length:38},(_,j)=>({name:`Red ${i}-${j}`,qty:1}))}));
 const x=harness({data:{format:'Standard',source:'Synthetic',updatedAt:'2026-10-18',decks:huge}});await x.ctl.select();assert.match(x.st.error,/too large/);assert.equal(x.calls.resolve.length,0,'more than 600 field names rejected before provider requests');
}
{
 const deck=harness().deck;assert.notEqual(matchupFingerprint(deck),matchupFingerprint({...deck,commander:'New leader'}));assert.notEqual(matchupFingerprint(deck),matchupFingerprint({...deck,commanders:['A','B']}));
}
console.log('PASS: matchup read from the app simulation with no network, repeatable, duplicate/cancel guards, account/workspace/navigation/deck/opponent/mode staleness, no deck mutations, source/color/format checks and bounded opponent resolution.');
