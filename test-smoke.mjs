import assert from 'node:assert/strict';
import {S,blank} from './store.js';
import {tcgCollection,ui,registerTcg,parseLines,metaOwned} from './tcg.js';
import {SOURCES} from './tcg.js';
import {blankGame} from './games.js';
S.state=blank();
assert.equal(metaOwned("ptcg",{list:[{name:"Psychic Energy",qty:10}]}).have,0);
assert.deepEqual(parseLines("Main Deck\n2 Dark Magician\nSide Deck\n1 Kuriboh"),[{qty:2,name:"Dark Magician",zone:"main"},{qty:1,name:"Kuriboh",zone:"side"}]);
for(const game of ['ptcg','ygo']) {
 S.state.settings.game=game;
 S.state.tcg ||= {}; S.state.tcg[game]=blankGame();
 S.state.tcg[game].collection=Array.from({length:10000},(_,i)=>({id:String(i),cardId:'fixture'+i,name:'Card '+i,qty:1,location:i===9999?'Blue box':'',addedAt:''}));
 let html=tcgCollection();assert.equal((html.match(/class="lot"/g)||[]).length,120);assert.match(html,/120 of 10000/);
 ui(game).coll.q='Blue box';html=tcgCollection();assert.equal((html.match(/class="lot"/g)||[]).length,1);assert.match(html,/Card 9999/);
 ui(game).coll.q='not present';assert.match(tcgCollection(),/No matching cards/);ui(game).coll.q='';
}
assert.throws(()=>parseLines('x'.repeat(2000001)),/2 MB/);
// Exercise the real import actions: no empty/partial commits, cancellation, bounded requests.
S.state=blank();S.state.settings.game='ygo';const A={},C={},I={},nodes=new Map([['#tImpText',{value:''}],['#tImpName',{value:'QA'}],['#tImpFormat',{value:'tcg'}],['#tImpStatus',{textContent:''}]]);
globalThis.document={querySelector:s=>nodes.get(s)};let commits=0;
registerTcg({A,C,I,writeRecord:async()=>{},commit:async fn=>{commits++;fn(S.state)},render(){},openSheet(){},closeSheet(){S.ui.sheetCtx=null},toast(){},go(){},busy:()=>()=>{}});
let inflight=0,max=0,calls=0;SOURCES.ygo.byName=async name=>{calls++;inflight++;max=Math.max(max,inflight);await new Promise(r=>setTimeout(r,2));inflight--;return name==='Missing'?null:{id:name,name,game:'ygo',typeLine:'Effect Monster'};};
S.ui.sheetCtx={type:'timport'};nodes.get('#tImpText').value='1 Missing';await A.tImpDeck({});assert.equal(commits,0);assert.match(nodes.get('#tImpStatus').textContent,/Nothing saved/);
nodes.get('#tImpText').value='0 Zero';await A.tImpDeck({});assert.equal(commits,0);assert.match(nodes.get('#tImpStatus').textContent,/positive/);
nodes.get('#tImpText').value=Array.from({length:20},(_,i)=>'1 Card'+i).join('\n');await A.tImpDeck({});assert.equal(commits,1);assert.ok(max<=6&&max>1);assert.equal(S.state.tcg.ygo.decks[0].zones.main.length,20);
S.ui.sheetCtx={type:'timport'};nodes.get('#tImpText').value='1 Cancelled';let finish;SOURCES.ygo.byName=()=>new Promise(r=>finish=r);const pending=A.tImpDeck({});S.ui.sheetCtx=null;finish({id:'cancelled',name:'Cancelled',game:'ygo'});await pending;assert.equal(commits,1,'closing import must prevent a later commit');
console.log('PASS: 10,000-entry rendering bounds, location filtering, no-results guidance, oversized input, invalid quantities, unmatched imports, six-worker bound and cancellation before commit.');
