import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import vm from 'node:vm';
const app=readFileSync(new URL('./app.js',import.meta.url),'utf8');
test('app Back asks for active-match concession and closes a finished match without another loss',()=>{
 const source=app.slice(app.indexOf('function appBack(){'),app.indexOf('globalThis.cardstashyBack='));let phase='playing',exits=0,closes=0;
 const context={playerMatHost:{snapshot:()=>({phase}),requestExit:()=>exits++},closePlayerMat:()=>closes++};vm.createContext(context);vm.runInContext(source,context);
 assert.equal(context.appBack(),true);assert.equal(exits,1);assert.equal(closes,0);phase='finished';assert.equal(context.appBack(),true);assert.equal(exits,1);assert.equal(closes,1);
});
test('browser traversal restores the active route before confirmation and does not mutate match state',()=>{
 const source=app.slice(app.indexOf('function applyHistory() {'),app.indexOf('let pendingHistoryId=null;'));const restore=[];let exits=0;
 const active={entryId:'current',route:'#play',index:2},previous={entryId:'older',route:'#decks',index:1};
 const context={playerMatHost:{snapshot:()=>({phase:'playing'}),requestExit:()=>exits++},activeEntry:active,location:{hash:'#decks'},history:{state:{cardstashy:previous}},normalizeRoute:x=>x,historyEntry:s=>s.cardstashy,restoreActiveHistory:x=>restore.push(x)};
 vm.createContext(context);vm.runInContext(source,context);context.applyHistory();assert.equal(exits,1);assert.equal(restore.length,1);assert.equal(restore[0].mode,'pop');assert.equal(restore[0].entry.entryId,'older');
 context.location.hash='#play';context.history.state.cardstashy=active;context.applyHistory();assert.equal(exits,1);assert.equal(restore.length,1);
});
