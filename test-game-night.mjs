// Game Night: clock, turn log, notes, winner, Table Spirit, journal, and the shared table over a fake channel.
import assert from 'node:assert/strict';
const mem=()=>{const m=new Map();return {getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k)};};
globalThis.localStorage=mem();globalThis.sessionStorage=mem();
const {newTable,changeCounter,saveTable,loadTable}=await import('./tabletop.js');
const gn=await import('./game-night.js');
const sh=await import('./table-share.js');

// Clock and turn log
const s=newTable('mtg',{players:3});
assert.equal(gn.elapsed(s,1000),0);
gn.startClock(s,1000);assert.equal(gn.elapsed(s,6000),5000);
gn.setNote(s,'Mulliganed to five');
const e=gn.endTurn(s,200000);
assert.deepEqual([e.turn,e.seat,e.ms,e.long,e.note],[1,0,199000,true,'Mulliganed to five']);
assert.equal(s.turn,1);assert.equal(s.night.note,'');assert.equal(gn.elapsed(s,205000),5000,'clock restarts for the next player while running');
gn.endTurn(s,206000);assert.equal(s.night.log.length,2);assert.equal(s.night.log[1].long,false);
assert.ok(gn.undoTurn(s,300000));assert.equal(s.turn,1);assert.equal(s.night.log.length,1);
assert.ok(gn.undoTurn(s,300001));assert.equal(s.night.note,'Mulliganed to five','undo gives the note back');assert.equal(s.turn,0);
assert.equal(gn.undoTurn(s),false);
gn.pauseClock(s,310000);assert.equal(s.night.running,false);const held=gn.elapsed(s,999999);assert.equal(held,gn.elapsed(s,5e9));
assert.equal(gn.clockText(65000),'1:05');assert.equal(gn.clockText(3725000),'1:02:05');
// no timers are enforced: a long turn only marks
assert.equal(gn.isLong(s,5e9),true,'a long turn is only marked');const quick=newTable('mtg',{players:2});gn.startClock(quick,0);gn.pauseClock(quick,1000);assert.equal(gn.isLong(quick,5e9),false,'a paused clock never turns long');

// Winner toggles; Table Spirit tallies and editable values
assert.ok(gn.setWinner(s,2));assert.equal(s.night.winner,2);gn.setWinner(s,2);assert.equal(s.night.winner,null);assert.equal(gn.setWinner(s,9),false);
assert.equal(gn.spiritAward(s,0,'kill'),false,'off until the group opts in');
gn.setSpirit(s,true);assert.ok(gn.spiritAward(s,0,'kill'));assert.ok(gn.spiritAward(s,0,'kill'));assert.ok(gn.spiritAward(s,1,'firstBlood'));
assert.equal(gn.spiritAward(s,2,'firstBlood'),false,'first blood only once');
assert.ok(gn.setSpiritValue(s,'kill',3));assert.equal(gn.setSpiritValue(s,'kill',99),false);assert.equal(gn.setSpiritValue(s,'bogus',1),false);
assert.deepEqual(gn.spiritScores(s).map(x=>x.points),[6,1,0]);
assert.ok(gn.spiritUndo(s,1,'firstBlood'));assert.ok(gn.spiritAward(s,2,'firstBlood'));assert.equal(gn.spiritUndo(s,1,'kill'),false);

// Saved tables keep the night and survive bad data
saveTable(s,localStorage);const back=loadTable('mtg',localStorage);
assert.equal(back.night.spirit.values.kill,3);assert.equal(back.night.log.length,0);assert.equal(back.night.spirit.tally[0].kill,2);
const bad=structuredClone(s);bad.night={running:true,startedAt:0,log:[{turn:'x'}],winner:77,spirit:{on:true,values:{kill:-4},tally:{9:{kill:1}}}};
const clean=gn.cleanNight(bad.night,3);assert.equal(clean.running,false);assert.equal(clean.winner,null);assert.deepEqual(clean.log,[]);assert.equal(clean.spirit.values.kill,1);assert.deepEqual(clean.spirit.tally,{});

// Journal stays on the device next to the deck
const store=mem();
gn.addJournal('mtg','deck-1',{at:5,line:gn.journalLine(gn.summary(s,0))},store);
assert.equal(gn.loadJournal('mtg','deck-1',store).length,1);assert.equal(gn.loadJournal('mtg','deck-2',store).length,0);
assert.match(gn.loadJournal('mtg','deck-1',store)[0].line,/turn/);
assert.equal(gn.addJournal('mtg','deck-1',{line:'  '},store).length,1);

// Link codes
const code=sh.newShareCode();assert.ok(sh.validCode(code));assert.notEqual(code,sh.newShareCode());
assert.equal(sh.shareCodeFromHash('#table/'+code),code);assert.equal(sh.shareCodeFromHash('#table/short'),null);
assert.equal(sh.shareLink(code),'https://cardstashy.com/#table/'+code);

// applyOp: the host applies what other phones tap
const t=newTable('mtg',{players:2});
assert.ok(sh.applyOp(t,{t:'delta',seat:1,field:'life',delta:-3}));assert.equal(t.players[1].life,17);
assert.ok(sh.applyOp(t,{t:'undo',seat:1}));assert.equal(t.players[1].life,20);
assert.equal(sh.applyOp(t,{t:'delta',seat:1,field:'life',delta:1e9}),false);assert.equal(sh.applyOp(t,{t:'nope'}),false);assert.equal(sh.applyOp(t,null),false);
assert.ok(sh.applyOp(t,{t:'turn'},10));assert.equal(t.turn,1);assert.ok(sh.applyOp(t,{t:'turnUndo'},11));assert.equal(t.turn,0);
assert.equal(sh.cleanShared({game:'mtg',players:[]}),null);assert.ok(sh.cleanShared(JSON.parse(JSON.stringify(t))));

// Two phones through a fake channel
const bus=new Map();
const fakeClient=name=>({channel(topic){const handlers=[];const ch={on:(_t,f,cb)=>{handlers.push([f.event,cb]);return ch;},subscribe(cb){(bus.get(topic)||bus.set(topic,new Set()).get(topic)).add(ch);ch.cb=cb;queueMicrotask(()=>cb('SUBSCRIBED'));return ch;},send({event,payload}){for(const o of bus.get(topic))if(o!==ch)for(const [ev,cb] of o.handlers)if(ev===event)cb({payload:structuredClone(payload)});return 'ok';},handlers};return ch;},removeChannel(ch){bus.get([...bus.keys()][0])?.delete(ch);}});
const hostTable=newTable('mtg',{players:2});let seen=null,status='';
const timers={setInterval:()=>1,clearInterval(){}};
const host=await sh.openShare({client:fakeClient('h'),code,host:true,editor:true,getState:()=>hostTable,setState(){},timers});
const viewer=await sh.openShare({client:fakeClient('v'),code,host:false,editor:false,getState:()=>seen,setState:x=>{seen=x;},onStatus:x=>{status=x;},timers});
assert.equal(seen.players[0].life,20,'a joining phone gets the whole table');
assert.equal(viewer.tap({t:'delta',seat:0,field:'life',delta:-1}),false,'a viewer cannot tap');
const tapper=await sh.openShare({client:fakeClient('t'),code,host:false,editor:true,getState:()=>seen,setState:x=>{seen=x;},timers});
assert.ok(tapper.tap({t:'delta',seat:0,field:'life',delta:-4}));
assert.equal(hostTable.players[0].life,16);assert.equal(seen.players[0].life,16,'everyone sees the tap');
changeCounter(hostTable,1,'poison',2);host.publish();assert.equal(seen.players[1].poison,2);
assert.ok(host.tap({t:'turn'}));assert.equal(seen.turn,1);
assert.throws(()=>sh.openShare({client:fakeClient('x'),code:'bad',host:false,getState(){},setState(){}}),/not valid/);
console.log('game night: ok');
