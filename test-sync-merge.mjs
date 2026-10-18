import assert from 'node:assert/strict';
import {mergeAccountWorkspaces,workspaceContentSig} from './sync-merge.js';
const deck=(id,name=id)=>({id,name,cards:[{name:'Card',qty:1}]});
const ws=()=>({decks:[deck('a'),deck('b')],collection:[{id:'lot',qty:2}],activeDeck:'a',settings:{game:'mtg',budget:25,theme:'dark'},valueHistory:[{date:'2026-10-17',total:2,copies:2}],tcg:{ptcg:{decks:[deck('p')],activeDeck:'p',collection:[],valueHistory:[]}}});
const copy=structuredClone;
{
 const base=ws(),local=copy(base),remote=copy(base);local.decks[0].name='Local A';remote.decks[1].name='Remote B';
 const result=mergeAccountWorkspaces(base,local,remote);assert.deepEqual(result.state.decks.map(d=>d.name),['Local A','Remote B']);assert.deepEqual(result.conflicts,[]);assert.deepEqual(base,ws());
}
{
 const base=ws(),local=copy(base),remote=copy(base);local.decks[0].cards[0].qty=7;remote.decks[0].cards[0].qty=8;
 const result=mergeAccountWorkspaces(base,local,remote);assert.equal(result.state.decks[0].cards[0].qty,8);assert.deepEqual(result.conflicts,['decks[a]']);assert.equal(local.decks[0].cards[0].qty,7);
 local.collection[0].qty=3;remote.collection[0].qty=4;assert.equal(mergeAccountWorkspaces(base,local,remote).state.collection[0].qty,4,'quantities are not added');
}
{
 const base=ws(),local=copy(base),remote=copy(base);local.decks=local.decks.filter(d=>d.id!=='b');remote.decks=remote.decks.filter(d=>d.id!=='a');
 const result=mergeAccountWorkspaces(base,local,remote);assert.deepEqual(result.state.decks,[]);assert.equal(result.state.activeDeck,null);
 remote.tcg.ptcg.decks=[];assert.equal(mergeAccountWorkspaces(base,local,remote).state.tcg.ptcg.activeDeck,null);
}
{
 const base=ws(),local=copy(base),remote=copy(base);local.decks.shift();remote.decks[0].name='Changed remotely';
 assert.equal(mergeAccountWorkspaces(base,local,remote).state.decks[0].name,'Changed remotely','remote edit wins concurrent local deletion, recovered separately');
 local.decks=[deck('a','Local')];remote.decks=[];assert.deepEqual(mergeAccountWorkspaces(base,local,remote).state.decks,[],'remote deletion wins a concurrent local edit');
}
{
 const base=ws(),local=copy(base),remote=copy(base);local.settings.game='ptcg';remote.settings.game='ygo';local.settings.budget=75;remote.settings.theme='light';
 local.valueHistory.push({date:'2026-10-18',total:3,copies:2});remote.valueHistory.push({date:'2026-10-19',total:4,copies:2});
 const result=mergeAccountWorkspaces(base,local,remote);assert.deepEqual(result.state.settings,{game:'ptcg',budget:75,theme:'light'});assert.equal(result.state.valueHistory.length,3);
 const incidental=copy(base);incidental.settings.game='ygo';incidental.activeDeck='b';incidental.valueHistory=[];incidental.tcg.ptcg.valueHistory=[{date:'2026-10-18',total:4,copies:2}];assert.equal(workspaceContentSig(incidental),workspaceContentSig(base));
 incidental.settings.budget=9;assert.notEqual(workspaceContentSig(incidental),workspaceContentSig(base));
}
{
 const base=ws(),local=copy(base),remote=copy(base);local.valueHistory[0].total=5;
 assert.equal(mergeAccountWorkspaces(base,local,remote).state.valueHistory[0].total,5,'one-sided history edit survives');remote.valueHistory[0].total=6;assert.equal(mergeAccountWorkspaces(base,local,remote).state.valueHistory[0].total,6,'same-day concurrent observation is server-authoritative');
 remote.valueHistory=[];assert.equal(mergeAccountWorkspaces(base,local,remote).state.valueHistory.length,1,'history dates are retained');
}
{
 const local=ws(),remote=ws();local.decks.push(deck('local-only'));remote.decks.shift();
 const result=mergeAccountWorkspaces(null,local,remote);assert.deepEqual(result.state.decks,remote.decks,'untrusted baseline never guesses a local addition or resurrects a deleted remote deck');assert.equal(result.state.activeDeck,null);assert.equal(result.hasBaseline,false);
}
{
 const base={settings:{optional:1,nullable:1}},local={settings:{nullable:null}},remote={settings:{optional:1,nullable:1}};
 const merged=mergeAccountWorkspaces(base,local,remote).state;assert(!Object.hasOwn(merged.settings,'optional'));assert.equal(merged.settings.nullable,null);
 const attack=JSON.parse('{"__proto__":{"polluted":true}}');const m=mergeAccountWorkspaces({},attack,{});assert.equal({}.polluted,undefined);assert.equal(Object.getPrototypeOf(m.state),Object.prototype);
}
{
 const base=ws(),local=copy(base),remote=copy(base);local.decks.push(deck('c','Local addition'));local.decks[0].name='Local edit';remote.decks.reverse();remote.decks.push(deck('d','Remote addition'));
 const merged=mergeAccountWorkspaces(base,local,remote).state;assert.deepEqual(merged.decks.map(d=>d.id),['b','a','d','c'],'remote order with distinct new local ids appended once');assert.equal(merged.decks.find(d=>d.id==='a').name,'Local edit');
 const ambiguous={notes:['base']};const result=mergeAccountWorkspaces(ambiguous,{notes:['local']},{notes:['remote']});assert.deepEqual(result.state.notes,['remote']);assert.deepEqual(result.conflicts,['notes'],'non-keyed lists are not guessed or concatenated');
}
console.log('PASS: account three-way merge, independent decks, atomic conflicting rows, no quantity sum, deletion tombstones, all-game history, navigation, preferences, missing/null and baseline migration.');
