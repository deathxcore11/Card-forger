import assert from 'node:assert/strict';
import fs from 'node:fs';
import {valueComposition,valueHistoryModel,valueHistoryChart,valuePageOverview,valueTopLots,valuePageAttrs} from './value-page.js';
import {VALUE_FIXTURES,VALUE_NOW,VALUE_HISTORY,valueSnapshot} from './tests/value-page-fixtures.mjs';
import {S,blank} from './store.js';
import {cardKey} from './core.js';
import {collection as magicCollection} from './views.js';
import {collectionValue as magicValue,lotPrice} from './insights.js';
import {cache,ui,entryPrice,collectionValue as tcgValue,tcgCollection} from './tcg.js';
const saved={state:S.state,catalog:S.catalog,collTab:S.ui.collTab,storage:globalThis.localStorage};
let writes=0;
globalThis.localStorage={getItem:()=>null,setItem:()=>{writes++},removeItem:()=>{writes++}};
const deepFreeze = object => {if(object&&typeof object==='object'&&!Object.isFrozen(object)){Object.freeze(object);for(const value of Object.values(object))deepFreeze(value);}return object;};
try {
 for(const game of ['mtg','ptcg','ygo']) {
  const fixture=structuredClone(VALUE_FIXTURES[game]),state={...blank(),settings:{game},tcg:{ptcg:{collection:[],decks:[],wishlist:[],valueHistory:[]},ygo:{collection:[],decks:[],wishlist:[],valueHistory:[]}}};
  const side=game==='mtg'?state:state.tcg[game];side.collection=fixture.collection;side.valueHistory=structuredClone(VALUE_HISTORY);
  if(game==='mtg'){S.catalog=Object.fromEntries(fixture.cards.map(card=>[cardKey(card.name),card]));state.printings=Object.fromEntries(fixture.cards.map(card=>[card.id,card]));S.ui.collTab='value';}
  else{Object.assign(cache[game],Object.fromEntries(fixture.cards.map(card=>[card.id,card])));ui(game).coll.tab='value';}
  S.state=state;
  const rows=fixture.collection.map(entry=>({entry,card:game==='mtg'?state.printings[entry.printingId]||S.catalog[cardKey(entry.name)]:cache[game][entry.cardId],unit:game==='mtg'?lotPrice(entry,S.catalog,state.printings):entryPrice(cache[game][entry.cardId],entry)})),value=game==='mtg'?magicValue(side.collection,S.catalog,state.printings):tcgValue(game),before=JSON.stringify({state,cards:fixture.cards});
  deepFreeze(rows);
  const groups=valueComposition(game,rows),html=valuePageOverview({game,value,rows,history:side.valueHistory,now:VALUE_NOW}),top=valueTopLots({game,rows});
  assert(Math.abs(groups.reduce((sum,g)=>sum+g.total,0)-value.total)<1e-8,`${game}: composition counts each priced lot once`);
  assert.equal(groups.reduce((sum,g)=>sum+g.copies,0),value.copies-value.unpriced);
  assert.equal((top.match(/class="value-lot"/g)||[]).length,fixture.collection.length-1,'null rows excluded; legitimate custom-zero stays');
  for(const row of rows.filter(r=>r.unit!==null)){assert(top.includes(`data-entry="${row.entry.id}"`));assert(top.includes(game==='mtg'?`data-name="${row.entry.name}"`:`data-id="${row.entry.cardId}"`));}
  assert.match(html,/Known subtotal · USD/);assert.match(html,/1 copy without a price/);assert.match(html,/data-value-refresh/);assert.match(html,new RegExp(`data-act="${game==='mtg'?'refreshPrices':'tRefreshPrices'}"`));
  assert.match(top,/class="value-card-art"/);assert.match(top,/data-art-sources=/);assert.match(top,/\$0\.00/);assert.match(top,/Near Mint/);assert.match(html,/\.\d{2}<\/b>/,'composition retains cents');
  if(game==='mtg'){assert.equal(groups.find(g=>g.key==='Red').total,12.55);assert(groups.some(g=>g.key==='Multicolor'));}
  if(game==='ptcg'){assert.equal(groups.find(g=>g.key==='Fire / Water').total,18.24);assert(groups.some(g=>g.key==='Trainer'));assert(groups.some(g=>g.key==='Energy'));assert.match(top,/selected-alternate\.png/);const alternate=top.match(/<button[^>]*data-entry="ptcg-alternate"[\s\S]*?<\/button>/)[0];assert.doesNotMatch(alternate,/value-dual\.png/,'selected variant art cannot fall back to base-card art');}
  if(game==='ygo'){assert(groups.some(g=>g.key==='Spell'));assert(groups.some(g=>g.key==='Trap'));assert(groups.some(g=>g.key==='LIGHT'));assert(groups.some(g=>g.key==='Unknown'));}
  const actual=game==='mtg'?magicCollection():tcgCollection();
  assert.match(actual,new RegExp(`data-value-game="${game}"`));assert.match(actual,/Price alerts/);assert.match(actual,/value-chart/);assert.match(actual,/value-lot/);if(game==='mtg')assert.match(actual,/Trade binder/);
  assert.equal(JSON.stringify({state,cards:fixture.cards}),before,'render does not modify cards, collection or history');
  assert.equal(writes,0,'render does not persist observations');
  const allUnknown=valuePageOverview({game,value:{total:0,copies:1,unpriced:1},rows:[],history:[valueSnapshot('2026-10-18',0,{copies:1,unpriced:1})],now:VALUE_NOW});
  assert.match(allUnknown,/data-value-amount>—</);assert.match(allUnknown,/Value unavailable/);assert.doesNotMatch(allUnknown,/class="value-chart-point/);assert.doesNotMatch(allUnknown,/value-chart-change/);
  const free=valuePageOverview({game,value:{total:0,copies:1,unpriced:0},rows:[],history:[valueSnapshot('2026-10-18',0,{copies:1})],now:VALUE_NOW});assert.match(free,/data-value-amount>\$0\.00</);assert.match(free,/1 copy</);assert.doesNotMatch(free,/1 copies/);
  // Removing all holdings leaves the historical graph available, not a blank-start screen.
  S.state=structuredClone(state);const emptySide=game==='mtg'?S.state:S.state.tcg[game];emptySide.collection=[];const empty=game==='mtg'?magicCollection():tcgCollection();assert.match(empty,/value-chart/);assert.match(empty,/0 copies/);assert.doesNotMatch(empty,/No value to track yet/);
 }
 const before=JSON.stringify(VALUE_HISTORY),model=valueHistoryModel(VALUE_HISTORY,VALUE_NOW);
 assert.equal(JSON.stringify(VALUE_HISTORY),before);assert.equal(model.points.length,6);assert(!model.points.some(p=>p.date>'2026-10-18'));
 assert.deepEqual(model.points.map(p=>p.status),['legacy','complete','partial','unavailable','complete','complete']);assert.equal(model.change.delta,1.22);assert.equal(model.change.date,'2026-10-16');
 const historyHtml=valueHistoryChart(VALUE_HISTORY,VALUE_NOW);assert.equal((historyHtml.match(/class="value-chart-line"/g)||[]).length,1,'no bridge across partial, missing or legacy values');assert.doesNotMatch(historyHtml,/2099|\$999/);assert.match(historyHtml,/Legacy/);assert.match(historyHtml,/Known subtotal/);assert.match(historyHtml,/Value unavailable/);assert.match(historyHtml,/↑ \+\$1\.22/);assert.match(historyHtml,/datetime="2026-10-10"/);
 const onlyFuture=[valueSnapshot('2099-01-01',999)];assert.match(valueHistoryChart(onlyFuture,VALUE_NOW),/No saved snapshots yet/);assert.equal(onlyFuture.length,1,'future stored points remain untouched');
 assert.deepEqual(valueHistoryModel([{date:'2026-02-30',total:0},{date:'nonsense',total:1}],VALUE_NOW).points,[]);
 for(const patch of [{copies:.5},{unpriced:.5},{copies:-1},{unpriced:5},{total:NaN},{total:-1},{currency:'EUR'},{basis:'unverified'}]){const bad=valueHistoryModel([valueSnapshot('2026-10-17',10),valueSnapshot('2026-10-18',11,patch)],VALUE_NOW);assert.equal(bad.points.at(-1).status,'unavailable');assert.equal(bad.change,null);}
 assert.equal(valueHistoryModel([{date:'2026-10-16',total:10},{date:'2026-10-18',total:20}],VALUE_NOW).change,null,'legacy-only values never claim verified movement');
 const zeros=valueHistoryModel([valueSnapshot('2026-10-16',0),valueSnapshot('2026-10-18',5)],VALUE_NOW);assert.equal(zeros.change.percent,null);assert.equal(zeros.change.delta,5);assert.doesNotMatch(valueHistoryChart([valueSnapshot('2026-10-16',0),valueSnapshot('2026-10-18',5)],VALUE_NOW),/NaN|Infinity/);
 assert.equal(valueHistoryModel([valueSnapshot('2026-10-17',10),valueSnapshot('2026-10-18',10)],VALUE_NOW).change.direction,'flat');assert.equal(valueHistoryModel([valueSnapshot('2026-10-17',10),valueSnapshot('2026-10-18',8.75)],VALUE_NOW).change.direction,'down');
 const duplicate=valueHistoryModel([valueSnapshot('2026-10-18',10),valueSnapshot('2026-10-16',7),valueSnapshot('2026-10-18',12)],VALUE_NOW);assert.deepEqual(duplicate.points.map(p=>p.total),[7,12]);
 const one=valueHistoryChart([valueSnapshot('2026-10-18',2.12)],VALUE_NOW);assert.equal((one.match(/class="value-chart-point/g)||[]).length,1);assert.doesNotMatch(one,/class="value-chart-line/);assert.match(one,/No earlier values have been estimated/);
 const spacing=valueHistoryChart(['2026-10-10','2026-10-11','2026-10-18'].map(date=>valueSnapshot(date,1)),VALUE_NOW);const xs=[...spacing.matchAll(/class="value-chart-point complete" cx="([\d.]+)"/g)].map(m=>Number(m[1]));assert(Math.abs((xs[1]-xs[0])/(xs[2]-xs[0])-1/8)<.001,'x axis uses actual elapsed dates');
 const longHistory=Array.from({length:500},(_,i)=>valueSnapshot(new Date(Date.UTC(2024,0,i+1)).toISOString().slice(0,10),i));
 assert.equal(valueHistoryModel(longHistory,VALUE_NOW).points.length,500);const longHtml=valueHistoryChart(longHistory,VALUE_NOW);assert.equal((longHtml.match(/class="value-chart-point/g)||[]).length,365);assert.equal(longHistory.length,500);assert.match(longHtml,/500 saved snapshots/);assert.match(longHtml,/earlier records remain saved/);
 const unknown=valueComposition('mtg',[{entry:{qty:2},card:null,unit:1.25}]);assert.equal(unknown[0].key,'Unknown');assert.equal(unknown[0].total,2.5);
 const escaped=valueTopLots({game:'mtg',rows:[{entry:{id:'bad"<id',name:'<script>unsafe</script>',qty:1},card:null,unit:1.23}]});assert.doesNotMatch(escaped,/<script>/);assert.match(escaped,/&lt;script&gt;/);assert.match(escaped,/data-entry="bad&quot;&lt;id"/);assert.match(escaped,/Artwork unavailable/);
 assert.notEqual(valuePageAttrs('mtg'),valuePageAttrs('ptcg'));
 const style=fs.readFileSync('style.css','utf8');assert(style.startsWith('@import url("./value-page.css");'));
 console.log('PASS: actual all-game Value render purity; exact owned-lot actions/art, cents, custom zero vs unknown; single-bucket composition; future/legacy/coverage-safe real history with dated gaps, first point, preserved empty-collection history and game identity.');
} finally {
 S.state=saved.state;S.catalog=saved.catalog;S.ui.collTab=saved.collTab;
 if(saved.storage===undefined)delete globalThis.localStorage;else globalThis.localStorage=saved.storage;
}
