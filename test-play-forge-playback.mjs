import test from 'node:test';
import assert from 'node:assert/strict';
import {cpuPlaybackBeats,CpuActionPlaybackQueue} from './experiments/forge-proof/cpu-action-playback.mjs';
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
