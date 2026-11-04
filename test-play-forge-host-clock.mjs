// The host's turn clock (friend matches) reaches the table even when it changes without a new revision.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createForgePresentationSession} from './experiments/forge-proof/forge-session.mjs';

const raw=(revision,afk)=>({schema:'cardstashy.forge-proof.v1',revision,viewer:0,status:'running',busy:false,turn:3,phase:'Main1',activePlayer:0,priorityPlayer:0,inputType:'InputPassPriority',
 players:[{id:0,isViewer:true,life:20},{id:1,isViewer:false,life:20}],cards:[],...(afk===undefined?{}:{afk})});
const mk=()=>createForgePresentationSession({request:async()=>({})});

test('the host clock is carried on the snapshot and follows changes at the same revision',()=>{
 const s=mk();let seen=0;s.subscribe(()=>{seen++;});
 assert.equal(s.snapshot().hostClock,undefined,'a host without a clock sends nothing');
 s.acceptState(raw(5,{own:true,reason:'turn',total:90000,deadline:2e12,serverNow:2e12-60000,remainingMs:60000,strikes:0,strikeLimit:3}));
 const h=s.snapshot().hostClock;assert.equal(h.own,true);assert.equal(h.remainingMs,60000);assert.ok(h.receivedAt>0);
 // The same board again, a little later: the clock is refreshed without a new revision.
 s.acceptState(raw(5,{own:true,reason:'turn',total:90000,deadline:2e12,serverNow:2e12-50000,remainingMs:50000,strikes:0,strikeLimit:3}));
 assert.equal(s.snapshot().hostClock.remainingMs,50000);
 // Its window ends and the other seat's begins, still the same revision.
 s.acceptState(raw(5,{own:false,reason:'turn',total:90000,deadline:2e12+9e4,serverNow:2e12,remainingMs:90000,strikes:0,strikeLimit:3}));
 assert.equal(s.snapshot().hostClock.own,false);
 s.acceptState(raw(5,null));assert.equal(s.snapshot().hostClock,null,'no window');
 s.acceptState(raw(4,{own:true,reason:'turn',total:1,deadline:1,serverNow:1,remainingMs:1,strikes:0,strikeLimit:3}));
 assert.equal(s.snapshot().hostClock,null,'an older board never rewinds the clock');
});
