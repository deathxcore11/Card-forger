import test from 'node:test';
import assert from 'node:assert/strict';
import {cpuPlaybackBeats,CpuActionPlaybackQueue,createPlaybackSession,eventsSince,eventPlaybackBeats,playbackBeats,tableActivity} from './experiments/forge-proof/cpu-action-playback.mjs';
import {nativeZoneSearch} from './experiments/forge-proof/native-panel.mjs';

const card=(id,o={})=>({id,known:true,controller:1,owner:1,zone:'Battlefield',name:'Card '+id,types:['Creature'],type:'Creature',text:'',...o});
const snap=(revision,cards,o={})=>({status:{revision,surface:{seat:0,activeSeat:1,turn:4,phase:'Main1',players:[{seat:0},{seat:1}],cards,stack:[],...o}},native:{stack:[]}});

test('the CPU playback skips tokens, shows at most three arrivals, and never runs past about 2.6 s',()=>{
 const before=snap(1,[]);
 const goblins=Array.from({length:12},(_,i)=>card(100+i,{isToken:true,name:'Goblin'}));
 assert.deepEqual(cpuPlaybackBeats(before,snap(2,goblins)),[],'a token swarm arrives with the board');
 const lands=[card(1,{types:['Land'],type:'Land'}),card(2),card(3),card(4),card(5)];
 const beats=cpuPlaybackBeats(before,snap(2,lands));
 assert.equal(beats.length,3,'three arrivals at most');
 assert.ok(beats.reduce((t,b)=>t+b.duration,0)<=2600,'one update stays within the budget');
 assert.deepEqual(cpuPlaybackBeats(before,snap(2,[card(9,{controller:0})])),[],'your own permanents are not replayed');
});

test('a backlog of CPU updates plays faster, and flush shows the latest board at once',()=>{
 const shown=[],timers=[],fns=[];
 const q=new CpuActionPlaybackQueue({present:(s,busy)=>shown.push([s.status.revision,busy]),schedule:(fn,ms)=>{timers.push(ms);fns.push(fn);return timers.length;},cancel:()=>{}});
 q.push(snap(1,[]));q.push(snap(2,[card(1)]));q.push(snap(3,[card(1),card(2)]));q.push(snap(4,[card(1),card(2),card(3)]));
 assert.equal(timers[0],850,'a lone update plays at full pace');
 fns[0]();fns[1]?.();
 assert.ok(timers.slice(1).some(ms=>ms<=425),'with more updates waiting, the next beats run at double speed');
 q.flush();assert.deepEqual(shown.at(-1),[4,false],'flush presents the latest board, unlocked');assert.equal(q.busy,false);
});

test('the card picker only opens for a choice the player can make on a healthy connection',()=>{
 const option=(index,o={})=>({index,value:{id:50+index,kind:'card',hidden:false,name:'Forest',zone:'Library',...o}});
 const base=p=>({native:{revision:3,viewer:1,status:'running',prompt:{id:'p',supported:true,method:'chooseSingleEntityForEffect',min:0,max:1,options:[option(0),option(1)],...p}},status:{surface:{cards:[]}}});
 assert.equal(nativeZoneSearch(base()).kind,'prompt');
 assert.equal(nativeZoneSearch({...base(),transportError:'HOST_REQUEST_TIMEOUT'}),null,'a broken connection keeps the dock, with Refresh and Concede');
 assert.equal(nativeZoneSearch(base({options:[option(0,{hidden:true}),option(1,{hidden:true})]})),null,'nothing selectable means no picker');
 assert.equal(nativeZoneSearch(base({supported:false})),null,'an unadapted prompt shows its diagnostic in the dock');
});

// Event-log snapshots: viewer 10 sits in seat 0, the CPU is 20 in seat 1.
const ev=(revision,latest,items,cards=[],o={},n={})=>({status:{revision,surface:{seat:0,activeSeat:1,prioritySeat:1,turn:4,phase:'Main1',players:[{seat:0,nativeId:10},{seat:1,nativeId:20}],cards,stack:[],awaitingHuman:false,...o}},native:{viewer:10,status:'running',busy:true,stack:[],events:{schema:'cardstashy.forge-events.v1',latest,items},...n}});
const e=(seq,type,o)=>({seq,type,turn:4,phase:'MAIN1',...o});
const ref=(id,name)=>({kind:'card',id,name});

test('the event log is used only when it vouches for every event since the board shown',()=>{
 const items=[e(5,'land',{player:20,card:ref(1,'Swamp')}),e(6,'cast',{player:20,stackId:9,source:ref(2,'Murder'),targets:[ref(3,'Ghalta')]})];
 assert.deepEqual(eventsSince(ev(1,4,[]),ev(2,6,items)).map(x=>x.seq),[5,6]);
 assert.equal(eventsSince(ev(1,3,[]),ev(2,6,items)),null,'event 4 fell out of the window: a gap');
 assert.deepEqual(eventsSince(ev(1,6,[]),ev(2,6,items)),[],'nothing new');
 assert.equal(eventsSince({status:{}},ev(2,6,items)),null,'an older host without the log');
 const old=snap(1,[]),next=snap(2,[card(7)]);
 assert.equal(playbackBeats(old,next)[0].label,'CPU · ENTERED BATTLEFIELD','without the log, the snapshot difference still tells the arrival');
});

test('a CPU turn is told in the order Forge accepted it, with targets, and lands never get a spotlight',()=>{
 const ghalta=card(3,{controller:0,owner:0,name:'Ghalta'});
 const items=[e(5,'turn',{player:20,number:4}),e(6,'land',{player:20,card:ref(1,'Swamp')}),e(7,'cast',{player:20,stackId:9,source:ref(2,'Murder'),targets:[ref(3,'Ghalta')]}),
  e(8,'resolve',{source:ref(2,'Murder'),fizzled:false}),e(9,'zone',{card:ref(3,'Ghalta'),from:'Battlefield',to:'Graveyard',player:10,token:false})];
 const beats=eventPlaybackBeats(ev(1,4,[],[ghalta]),ev(2,9,items,[{...ghalta,zone:'Graveyard'},card(1,{name:'Swamp',types:['Land']})]));
 assert.deepEqual(beats.map(b=>b.kind),['phase','log','spell','resolve','arrival']);
 assert.equal(beats[1].duration,0,'the land is logged in order but holds nothing');
 assert.deepEqual(beats[2].targets,[{kind:'card',id:3}]);
 assert.equal(beats[2].line,'CPU cast Murder targeting Ghalta.');
 assert.equal(beats[4].line,'Ghalta went to the graveyard.');
 const fizzle=eventPlaybackBeats(ev(1,6,[]),ev(2,8,[e(7,'cast',{player:20,stackId:9,source:ref(2,'Murder'),targets:[ref(3,'Ghalta')]}),e(8,'resolve',{source:ref(2,'Murder'),fizzled:true})]));
 assert.match(fizzle[1].line,/no legal targets left, so it didn't resolve/,'no destination is assumed for a spell that did not resolve');
});

test('a token swarm is one arrival, combat damage one summary, and the whole update stays within budget',()=>{
 const goblins=Array.from({length:12},(_,i)=>e(10+i,'zone',{card:ref(100+i,'Goblin'),from:null,to:'Battlefield',player:20,token:true}));
 const damage=[e(22,'damage',{target:{kind:'player',id:10},source:ref(5,'Ogre'),amount:3,combat:true}),e(23,'damage',{target:{kind:'player',id:10},source:ref(6,'Elf'),amount:1,combat:true})];
 const beats=eventPlaybackBeats(ev(1,9,[]),ev(2,23,[...goblins,...damage]));
 assert.deepEqual(beats.map(b=>b.label),['CPU · 12 GOBLIN TOKENS','COMBAT DAMAGE · YOU TAKE 4']);
 const many=Array.from({length:10},(_,i)=>e(30+i,'cast',{player:20,stackId:i,source:ref(200+i,'Bolt'),targets:[]}));
 assert.ok(eventPlaybackBeats(ev(1,29,[]),ev(2,39,many)).reduce((t,b)=>t+b.duration,0)<=3600);
});

test('a real decision is shown at once and unlocked, with the CPU play told over it',()=>{
 const shown=[],beats=[],timers=[];
 const q=new CpuActionPlaybackQueue({present:(s,busy)=>shown.push([s.status.revision,busy]),beat:b=>beats.push(b.label),schedule:fn=>{timers.push(fn);return timers.length;},cancel:()=>{}});
 q.push(ev(1,4,[]));
 const respond=ev(2,5,[e(5,'cast',{player:20,stackId:9,source:ref(2,'Murder'),targets:[ref(3,'Ghalta')]})],[card(3,{controller:0,owner:0,name:'Ghalta'})],{awaitingHuman:true,prioritySeat:0,stack:[{id:9,source:2,controller:1}]},{busy:false,inputType:'InputPassPriority',stack:[{id:9,activatingPlayer:20}]});
 q.push(respond);
 assert.deepEqual(shown.at(-1),[2,false],'the response window is on screen immediately and commands are allowed');
 assert.equal(q.busy,false);assert.equal(q.overlay,true);assert.deepEqual(beats,['CPU · CASTS'],'the spell is still announced');
 let displayed=shown.at(-1)&&respond;const authority={snapshot:()=>respond,nativeButton:()=>'passed'};
 assert.equal(createPlaybackSession(authority,{displayed:()=>displayed,busy:()=>q.busy}).nativeButton('ok',2),'passed');
 const act=tableActivity(respond,{overlay:true,recent:q.recent});
 assert.equal(act.label,'Your decision · Respond or pass');assert.equal(act.detail,'CPU cast Murder targeting Ghalta.');
 // Passing lets the CPU go on: the overlay stops and the next update plays normally.
 q.push(ev(3,6,[e(6,'resolve',{source:ref(2,'Murder'),fizzled:false})]));
 assert.equal(q.overlay,false);assert.equal(q.running,true);assert.deepEqual(beats,['CPU · CASTS','CPU · RESOLVES']);
});

test('the activity line only claims what the state shows',()=>{
 assert.equal(tableActivity({...ev(1,0,[]),transportError:'HOST_REQUEST_TIMEOUT'}).label,'Waiting for connection');
 assert.equal(tableActivity(ev(1,0,[])).label,'CPU thinking');
 assert.equal(tableActivity(ev(1,0,[],[],{prioritySeat:null},{stack:[{id:1,activatingPlayer:10}]})).label,'Resolving effects');
 assert.equal(tableActivity(ev(1,0,[],[],{},{stack:[{id:1,activatingPlayer:20}]})).label,'CPU thinking','the CPU holding priority over its own spell is still deciding');
 assert.equal(tableActivity(ev(1,0,[],[],{activeSeat:0,prioritySeat:0})).label,'Forge is applying your play');
 assert.equal(tableActivity(ev(1,0,[],[],{activeSeat:0,prioritySeat:0,awaitingHuman:true},{busy:false,inputType:'InputAttack'})).label,'Your decision · Declare attackers');
 assert.equal(tableActivity({status:{terminal:{winner:0},surface:{}}}),null);
});
