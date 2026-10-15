import assert from 'node:assert/strict';
import { S, blank } from './store.js';
import { homeHero, tcgSearch } from './tcg.js';
import { search } from './views.js';
import { openAsk, closeAsk, ask, boundedToolOutput } from './ai-ask.js';
S.state=blank();
for(const game of ['mtg','ptcg','ygo']) {
 S.state.settings.game=game;
 const html=game==='mtg'?search():tcgSearch();
 assert.equal((html.match(/data-act="askOpen"/g)||[]).length,1,`${game}: one Ask entry on Search`);
 assert.match(html,/search-query/); assert.doesNotMatch(html,/ask-chip/);
 const hero=homeHero(game,'Your cards');
 assert.equal((hero.match(/data-act="askOpen"/g)||[]).length,1);
 assert.match(hero,/data-act="homeSearch">Search<\/button><button class="ask-launch"/);
}
// Small DOM boundary fake: hold network/tool completions while dialogs close and reopen.
const dialogs=[];
function part(){return {children:[],innerHTML:'',value:'',classList:{add(){},remove(){}},remove(){},focus(){},querySelector(){return null;},append(child){this.children.push(child);}};}
globalThis.document={body:{append(d){dialogs.push(d);}},createElement(tag){
 const e=part();e.nodes={'.ask-log':part(),'.ask-input':part(),'.ask-bar':part(),'.ask-step':part()};
 e.setAttribute=()=>{};e.addEventListener=()=>{};e.showModal=()=>{};e.close=()=>{};
 e.querySelector=q=>e.nodes[q]||part();e.nodes['.ask-bar'].addEventListener=()=>{};
 return e;
}};
let finish, signal, called=0;
openAsk();
const pending=ask('old question',async(u,init)=>{called++;signal=init.signal;return new Promise(r=>finish=r);});
await ask('double tap',()=>{throw Error('Duplicate request');});
assert.equal(called,1);
closeAsk();assert.equal(signal.aborted,true,'closing aborts the pending network request');
openAsk({game:'ptcg'});
finish(Response.json({answer:{text:'Old Magic answer',source:'app'}}));await pending;
assert.equal(dialogs.at(-1).nodes['.ask-log'].children.length,0,'old answer never enters the new dialog');
let finishTool, followups=0;
closeAsk();openAsk({tools:{search_cards:()=>new Promise(r=>finishTool=r)}});
const toolPending=ask('tool question',async()=>{followups++;return Response.json({calls:[{name:'search_cards',call_id:'one',arguments:'{}'}]});});
while(!finishTool) await new Promise(r=>setTimeout(r,0));
closeAsk();openAsk({game:'ygo'});finishTool({cards:[]});await toolPending;
assert.equal(followups,1,'closed tool loop makes no follow-up paid request');
closeAsk();
assert.deepEqual(JSON.parse(boundedToolOutput({x:'a'.repeat(13000)})),{error:'Result too large. Narrow the request to fewer cards or sets.'});
assert.deepEqual(JSON.parse(boundedToolOutput({cards:[]})),{cards:[]});
// Repeated cancellation must never surface stale errors or leave a new dialog busy.
for(let i=0;i<100;i++){
 openAsk();let reject;
 const p=ask('cancel',()=>new Promise((r,j)=>reject=j));closeAsk();openAsk();
 reject(Error('stale failure'));await p;closeAsk();
}
console.log('PASS: one Ask on Search and Home in all three games; duplicate-submit guard, close/reopen network and tool races, 100 cancellation cycles, valid bounded tool JSON.');
