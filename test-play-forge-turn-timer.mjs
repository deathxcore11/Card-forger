import test from 'node:test';
import assert from 'node:assert/strict';
import {createTurnTimer,waitingOn,TURN_MS,PROMPT_MS,WARN_MS} from './experiments/forge-proof/turn-timer.mjs';

// A snapshot the way the session builds one: awaitingHuman + an input type means the game waits on you.
const snap=(o={})=>({busy:false,status:{revision:o.revision??1,surface:{seat:0,turn:o.turn??5,awaitingHuman:o.awaiting??true}},
 native:{viewer:1,revision:o.revision??1,activePlayer:o.active??1,priorityPlayer:1,inputType:o.input??'InputPassPriority',prompt:o.prompt??null,busy:false,buttons:{ok:'OK',okEnabled:true,cancel:'End turn',cancelEnabled:true}}});

function rig(first,opts={}){
 let t=1000,s=first,hold=false;const acts=[],changes=[],strikes=[];let conceded=0,tickFn=null;
 const timer=createTurnTimer({snapshot:()=>s,paused:()=>hold,act:(w,x)=>{acts.push([w.kind,x.native.inputType]);return Promise.resolve();},concede:()=>{conceded++;},
  onChange:c=>changes.push(c),onStrike:(n,limit)=>strikes.push([n,limit]),mode:opts.mode||'solo',now:()=>t,every:fn=>{tickFn=fn;return 1;},stopEvery:()=>{}});
 const run=async ms=>{for(let i=0;i<ms/250;i++){t+=250;tickFn();await Promise.resolve();await Promise.resolve();}};
 return {timer,run,set:x=>{s=x;},hold:v=>{hold=v;},acts,changes,strikes,conceded:()=>conceded,last:()=>changes.at(-1)};
}

test('your own turn gets 90 s, a prompt 30 s, and the CPU’s turn nothing',()=>{
 assert.deepEqual([waitingOn(snap()).kind,waitingOn(snap()).total],['turn',TURN_MS]);
 assert.deepEqual([waitingOn(snap({input:'InputAttack'})).kind,waitingOn(snap({input:'InputAttack'})).total],['prompt',PROMPT_MS]);
 assert.equal(waitingOn(snap({input:'InputConfirmMulligan'})).total,PROMPT_MS);
 assert.equal(waitingOn(snap({active:2})).kind,'response','a response window on the CPU’s turn is a short one');
 assert.equal(waitingOn(snap({awaiting:false})),null,'not waiting on you, no clock');
});

test('the ring drains while the game waits on you, warns in the last 10 s, and passes at zero',async()=>{
 const r=rig(snap());
 await r.run(1000);assert.equal(r.last().kind,'turn');assert.equal(r.last().warn,false);
 await r.run(TURN_MS-1000-WARN_MS-500);assert.equal(r.last().warn,false);
 await r.run(1000);assert.equal(r.last().warn,true,'the last 10 s warn');
 await r.run(WARN_MS);
 assert.deepEqual(r.acts,[['turn','InputPassPriority']],'the turn passes once at zero');
 assert.deepEqual(r.strikes,[[1,null]]);
});

test('it pauses while the CPU plays, a pop-up or the menu is open, and picks up where it stopped',async()=>{
 const r=rig(snap());
 await r.run(10000);const before=r.last().remaining;
 r.hold(true);await r.run(60000);
 assert.equal(r.last().paused,true);assert.ok(Math.abs(r.last().remaining-before)<=1300,'no time passes while held');
 r.hold(false);await r.run(5000);assert.ok(r.last().remaining<before-3500&&r.last().remaining>before-6500);
 assert.deepEqual(r.acts,[]);
});

test('a prompt in your turn has its own 30 s, and the turn clock waits for it',async()=>{
 const r=rig(snap());
 await r.run(20000);const turnLeft=r.last().remaining;
 r.set(snap({input:'InputSelectTargets',revision:2}));await r.run(250);
 assert.equal(r.last().kind,'prompt');assert.ok(r.last().remaining>PROMPT_MS-1000);
 await r.run(10000);
 r.set(snap({revision:3}));await r.run(250);
 assert.equal(r.last().kind,'turn');assert.ok(Math.abs(r.last().remaining-turnLeft)<=1300,'the turn clock did not run during the prompt');
});

test('touching the table clears missed turns and restarts a prompt, not the turn',async()=>{
 const r=rig(snap({input:'InputBlock'}));
 await r.run(25000);assert.ok(r.last().remaining<=6200);
 r.timer.poke();await r.run(250);assert.ok(r.last().remaining>PROMPT_MS-1000,'a prompt starts over');
 const t=rig(snap());await t.run(30000);const left=t.last().remaining;t.timer.poke();await t.run(250);
 assert.ok(t.last().remaining<=left,'the turn’s 90 s is not refilled by a touch');
});

test('against the CPU a missed turn only passes; three in a row concede in a friend match',async()=>{
 const solo=rig(snap());
 for(let turn=5;turn<10;turn++){solo.set(snap({turn,revision:turn}));await solo.run(TURN_MS+500);}
 assert.equal(solo.acts.length,5);assert.equal(solo.conceded(),0,'solo modes never concede');
 const friend=rig(snap(),{mode:'friend'});
 for(let turn=5;turn<8;turn++){friend.set(snap({turn,revision:turn}));await friend.run(TURN_MS+500);}
 assert.deepEqual(friend.strikes,[[1,3],[2,3],[3,3]]);
 assert.equal(friend.acts.length,2);assert.equal(friend.conceded(),1,'the third missed turn concedes');
});

test('a touch between missed turns keeps the match alive',async()=>{
 const r=rig(snap(),{mode:'friend'});
 for(let turn=5;turn<9;turn++){r.set(snap({turn,revision:turn}));await r.run(TURN_MS+500);if(turn===6)r.timer.poke();}
 assert.equal(r.conceded(),0);
});

test('a friend’s turn shows a line but never acts',async()=>{
 const r=rig(snap({active:2,awaiting:false}),{mode:'friend'});
 await r.run(TURN_MS+5000);
 assert.equal(r.last().own,false);assert.deepEqual(r.acts,[]);assert.equal(r.conceded(),0);
});

test('an answer the table refuses is tried again a few times, then left alone',async()=>{
 let calls=0,t=0,tickFn;
 const timer=createTurnTimer({snapshot:()=>snap({input:'InputAttack'}),act:()=>{calls++;return Promise.reject(Error('STALE_CHOICE'));},now:()=>t,every:fn=>{tickFn=fn;return 1;},stopEvery:()=>{}});
 for(let i=0;i<400;i++){t+=250;tickFn();await Promise.resolve();await Promise.resolve();await Promise.resolve();}
 assert.ok(calls>=1&&calls<=3,`tried ${calls} times`);timer.stop();
});

test('a friend match with a host clock draws the host’s time and never acts itself',async()=>{
 const host=(o={})=>({...snap(),hostClock:{own:true,reason:'turn',total:90000,remainingMs:60000,strikes:0,strikeLimit:3,receivedAt:1000,...o}});
 const r=rig(host(),{mode:'friend'});
 await r.run(250);assert.equal(r.last().kind,'turn');assert.ok(Math.abs(r.last().remaining-59750)<=1300,'it starts from the host’s time left');
 await r.run(20000);assert.ok(Math.abs(r.last().remaining-39750)<=1300,'then counts down on the local clock from receipt');
 r.set(host({remainingMs:5000,receivedAt:21250}));await r.run(250);assert.equal(r.last().warn,true,'the host’s last 10 s warn');
 await r.run(30000);assert.deepEqual(r.acts,[],'the host answers, not this client');assert.equal(r.conceded(),0);
 r.set(host({own:false,reason:'turn',remainingMs:50000,receivedAt:51500}));await r.run(250);assert.equal(r.last().own,false,'the other seat’s window is a line only');
 r.set({...snap(),hostClock:null});await r.run(250);assert.equal(r.last(),null,'no window, no clock');
 r.set(host({strikes:2}));await r.run(250);assert.deepEqual(r.strikes.at(-1),[2,3],'a strike from the host shows the warning');
});

test('without a host clock a friend match keeps the local one',async()=>{
 const r=rig(snap(),{mode:'friend'});await r.run(250);assert.equal(r.last().kind,'turn');await r.run(TURN_MS);assert.equal(r.acts.length,1);
});
