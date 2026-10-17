import assert from 'node:assert/strict';
import { S, blank } from './store.js';
import { registerTcg, cache, SOURCES, ptcglIdentity, ptcglName } from './tcg.js';
import { normalizePtcg, ptcgSource, ptcgPrintingMatches } from './ptcg.js';

const pk = (id, name = 'Pikachu', attack = id) => normalizePtcg({id, name, localId:id.split('-').at(-1), category:'Pokemon', stage:'Basic', attacks:[{name:attack,damage:10}], set:{id:id.slice(0,id.lastIndexOf('-')),name:'Fixture set'}, pricing:{tcgplayer:{normal:{marketPrice:1}}}});
const a=pk('base1-58'), b=pk('sv04-027');
assert.deepEqual(ptcglIdentity('Pikachu SV04 027/182'),{name:'Pikachu',set:'SV04',number:'027'});
assert.deepEqual(ptcglIdentity('Pikachu sv04.5 TG01'),{name:'Pikachu',set:'sv04.5',number:'TG01'});
assert.deepEqual(ptcglIdentity('Professor’s Research'),{name:'Professor’s Research'});
assert.equal(ptcglName('Pikachu ex SVI 63'),'Pikachu ex');
assert.ok(ptcgPrintingMatches(b,{name:'pikachu',set:'SV04',number:'27'}));
assert.ok(!ptcgPrintingMatches(b,{name:'Pikachu',set:'BASE1',number:'27'}));
assert.ok(!ptcgPrintingMatches(b,{name:'Pikachu ex',set:'SV04',number:'27'}));
assert.ok(!ptcgPrintingMatches(b,{name:'Pikachu',set:'SV04',number:'28'}));

let nodes={}, html='', commits=0;
globalThis.document={querySelector:sel=>nodes[sel] || null, querySelectorAll:()=>[]};
const A={}, c={A,C:{},I:{},commit:async fn=>{commits++;await fn(S.state);},render:()=>{},openSheet:(value,ctx)=>{html=value;S.ui.sheetCtx=ctx;},closeSheet:()=>{S.ui.sheetCtx=null;},toast:()=>{},writeRecord:async()=>{},go:()=>{},busy:()=>()=>{}};
registerTcg(c);
const reset=(cards=[a,b])=>{
  S.state=blank();S.state.settings.game='ptcg';S.ui.sheetCtx={type:'timport'};
  for(const id of Object.keys(cache.ptcg))delete cache.ptcg[id];
  for(const card of cards)cache.ptcg[card.id]=card;
  nodes={'#tImpText':{value:''},'#tImpName':{value:'Exact printings'},'#tImpFormat':{value:'unlimited'},'#tImpStatus':{textContent:''}};
  commits=0;
};
const run=async(text,action='tImpDeck')=>{nodes['#tImpText'].value=text;await A[action]({dataset:{}});};
const original={get:ptcgSource.get,byName:ptcgSource.byName,tournamentCard:ptcgSource.tournamentCard,fetch:globalThis.fetch};
try {
  ptcgSource.byName=async()=>{throw Error('Name fallback must not be used for explicit printings');};
  globalThis.fetch=async u=>{throw Error('Unexpected network request: '+u);};
  for(const order of [[a,b],[b,a]]) {
    reset(order);
    const exported=ptcgSource.exportText({zones:{main:[{cardId:a.id,name:a.name,qty:1},{cardId:b.id,name:b.name,qty:2}]}},id=>cache.ptcg[id]);
    await run(exported);
    assert.equal(commits,1,nodes['#tImpStatus'].textContent);
    assert.deepEqual(S.state.tcg.ptcg.decks[0].zones.main.map(r=>[r.cardId,r.qty]),[[a.id,1],[b.id,2]]);
    assert.notEqual(cache.ptcg[a.id].attacks[0].name,cache.ptcg[b.id].attacks[0].name);
  }
  reset([b,a]);await run('1 Pikachu BASE1 58\n2 Pikachu SV04 27','tImpColl');
  assert.deepEqual(S.state.tcg.ptcg.collection.map(r=>[r.cardId,r.qty]),[[a.id,1],[b.id,2]]);
  reset();ptcgSource.tournamentCard=async()=>null;
  await run('1 Pikachu BASE1 58\n1 Pikachu MISSING 27');
  assert.equal(commits,0);assert.match(nodes['#tImpStatus'].textContent,/Nothing saved.*Pikachu MISSING 27/);
  reset();await run('1 Pikachu MISSING 27','tImpColl');assert.equal(commits,0);
  // Repeated exact rows deduplicate their lookup without collapsing other printings.
  let lookups=0;reset([]);ptcgSource.tournamentCard=async row=>{lookups++;return row.set.toLowerCase()==='sv04'?b:a;};
  await run('1 Pikachu SV04 27\n2 Pikachu SV04 27\n3 Pikachu BASE1 58');
  assert.equal(lookups,2);assert.deepEqual(S.state.tcg.ptcg.decks[0].zones.main.map(r=>[r.cardId,r.qty]),[[b.id,3],[a.id,3]]);
  // Bare ids remain exact; name-only input is intentionally still supported.
  reset();await run('2 sv04-027');assert.equal(S.state.tcg.ptcg.decks[0].zones.main[0].cardId,b.id);
  reset();await run('2 Pikachu');assert.equal(S.state.tcg.ptcg.decks[0].zones.main[0].name,'Pikachu');
  reset();await run('0 Pikachu BASE1 58');assert.equal(commits,0);assert.match(nodes['#tImpStatus'].textContent,/positive whole-number/);
  // Closing the import while a lookup is in flight must not save anything.
  reset([]);let release;ptcgSource.tournamentCard=()=>new Promise(r=>release=r);
  const task=run('1 Pikachu SV04 27');await Promise.resolve();S.ui.sheetCtx=null;release(b);await task;assert.equal(commits,0);

  ptcgSource.tournamentCard=original.tournamentCard;
  const urls=[];
  globalThis.fetch=async value=>{
    const u=new URL(value);urls.push(u);
    if(u.pathname.endsWith('/cards'))return Response.json([{id:b.id,name:b.name}]);
    if(u.pathname.endsWith('/sets/sv04'))return Response.json({id:'sv04',abbreviation:{official:'PAR'}});
    throw Error('Unexpected '+u);
  };
  ptcgSource.get=async id=>id===b.id?b:null;
  assert.equal((await ptcgSource.tournamentCard({name:'Pikachu',set:'PAR',number:'27'}))?.id,b.id,'official set abbreviation');
  assert.equal(await ptcgSource.tournamentCard({name:'Pikachu',set:'WRONG',number:'27'}),null,'even a sole name/number match cannot override an explicit set');
  ptcgSource.get=async()=>({...b,set:{...b.set,number:'28'}});
  assert.equal(await ptcgSource.tournamentCard({name:'Pikachu',set:'PAR',number:'27'}),null,'revalidate hydrated collector number');
  ptcgSource.get=async()=>({...b,id:'base1-027',set:{...b.set,id:'base1'}});
  assert.equal(await ptcgSource.tournamentCard({name:'Pikachu',set:'PAR',number:'27'}),null,'hydration must return the same exact printing id');
  globalThis.fetch=async value=>{const u=new URL(value);assert.notEqual(u.searchParams.get('localId'),'NaN');return Response.json([]);};
  assert.deepEqual(await ptcgSource.byNameNumber('Charizard','TG01'),[]);
  globalThis.fetch=async()=>Response.json([{id:'swsh1-TG01',name:'Charizard'}]);
  assert.equal((await ptcgSource.byNameNumber('Charizard','tg01'))[0]?.id,'swsh1-TG01','case-insensitive alphanumeric identity');
} finally {
  Object.assign(ptcgSource,{get:original.get,byName:original.byName,tournamentCard:original.tournamentCard});globalThis.fetch=original.fetch;
}
console.log('PASS: exact Pokémon import round-trips, reversed cache order, collection imports, official set aliases, complete-or-no-save failures, lookup deduplication, ids, cancellation and alphanumeric collector numbers.');
