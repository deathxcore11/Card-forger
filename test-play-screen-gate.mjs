// Play on tablets and unfolded foldables: who is admitted, who sees the bigger-screen
// notice, and how a match waits while the screen is too small.
import assert from 'node:assert/strict';
import {playScreenFits,playDeviceEligibility,playDeviceGate,playScreenPauseApplies,createPlayScreenPause,PLAY_SMALL_SCREEN_LIMIT_MS} from './desktop-play.js';

// Shortest side 600 CSS px or more, in either orientation.
for(const [w,h] of [[820,1180],[1180,820],[884,1104],[1104,884],[744,1133],[1024,768],[600,600]])assert.equal(playScreenFits(w,h),true,`${w}x${h} fits`);
for(const [w,h] of [[390,844],[844,390],[915,412],[932,430],[412,915],[599,1200]])assert.equal(playScreenFits(w,h),false,`${w}x${h} is too small`);
for(const [w,h] of [[0,800],[800,0],[NaN,800],[800,Infinity]])assert.equal(playScreenFits(w,h),null,'an unknown size is not judged');

const chromeTablet={ua:'Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',platform:'Linux armv8l',maxTouchPoints:10,anyCoarse:true};
const fold={...chromeTablet,ua:'Mozilla/5.0 (Linux; Android 15; SM-F956U) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36'};
assert.deepEqual(playDeviceEligibility({...chromeTablet,width:820,height:1180}),{eligible:true,reason:'wide-touch-candidate',entry:'touch'});
assert.equal(playDeviceEligibility({...fold,width:1104,height:884}).eligible,true,'an unfolded fold plays in landscape');
assert.equal(playDeviceEligibility({...fold,width:884,height:1104}).eligible,true,'an unfolded fold plays in portrait');
for(const [w,h] of [[412,915],[915,412]])assert.deepEqual(playDeviceEligibility({...fold,width:w,height:h}),{eligible:false,reason:'touch-space',entry:'touch'},`a phone or cover screen at ${w}x${h} sees the notice`);
assert.deepEqual(playDeviceGate({reason:'touch-space'}),{title:'Play needs a bigger screen',line:'Unfold your device, turn it sideways on a tablet, or use a computer.'});

// A desktop is admitted at any window size or zoom and never pauses; touch devices pause.
const desktopView=(width,height)=>({navigator:{userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',platform:'Win32',maxTouchPoints:0},matchMedia:q=>({matches:/fine|hover/.test(q)}),innerWidth:width,innerHeight:height});
const tabletView=(width,height)=>({navigator:{userAgent:chromeTablet.ua,platform:chromeTablet.platform,maxTouchPoints:10},matchMedia:q=>({matches:/coarse/.test(q)}),innerWidth:width,innerHeight:height});
for(const [w,h] of [[850,580],[683,384],[1920,1080]])assert.equal(playScreenPauseApplies(desktopView(w,h),{}),false,`a desktop at ${w}x${h} never pauses`);
for(const [w,h] of [[820,1180],[412,915]])assert.equal(playScreenPauseApplies(tabletView(w,h),{}),true,`a touch device at ${w}x${h} can pause`);
assert.equal(playScreenPauseApplies({Capacitor:{isNativePlatform:()=>true},navigator:{},matchMedia:()=>({matches:false})},{}),false,'the Android app does not run Play yet');

// The pause: starts when the screen stops fitting, resumes at once, ticks, and expires once.
{
 let t=0;const timers=new Map();let id=0;const events=[];
 const run=()=>{for(const [k,{at,fn}] of [...timers].sort((a,b)=>a[1].at-b[1].at)){if(at>t)continue;timers.delete(k);fn();}};
 const advance=ms=>{const end=t+ms;while(true){const next=[...timers.values()].map(x=>x.at).filter(at=>at<=end).sort((a,b)=>a-b)[0];if(next===undefined)break;t=next;run();}t=end;};
 const pause=createPlayScreenPause({limitMs:3000,now:()=>t,setTimer:(fn,ms)=>{timers.set(++id,{at:t+ms,fn});return id;},clearTimer:k=>timers.delete(k),
  onPause:ms=>events.push(['pause',ms]),onResume:()=>events.push(['resume']),onTick:left=>events.push(['tick',left]),onExpire:()=>events.push(['expire'])});
 pause.update(true);pause.update(null);assert.deepEqual(events,[],'a fitting or unknown screen does nothing');
 pause.update(false);assert.equal(pause.paused,true);assert.deepEqual(events.splice(0),[['pause',3000],['tick',3000]]);
 pause.update(false);assert.deepEqual(events,[],'staying small does not restart the pause');
 advance(1000);assert.deepEqual(events.splice(0),[['tick',2000]]);
 pause.update(true);assert.equal(pause.paused,false);assert.deepEqual(events.splice(0),[['resume']]);assert.equal(timers.size,0,'resuming stops the countdown');
 pause.update(false);advance(3000);assert.deepEqual(events.splice(0).map(e=>e[0]),['pause','tick','tick','tick','expire']);
 assert.equal(pause.ended,true);pause.update(false);pause.update(true);assert.deepEqual(events,[],'nothing happens after expiry');
 const quiet=createPlayScreenPause({limitMs:1000,now:()=>t,setTimer:(fn,ms)=>{timers.set(++id,{at:t+ms,fn});return id;},clearTimer:k=>timers.delete(k),onExpire:()=>events.push(['expire'])});
 quiet.update(false);quiet.destroy();advance(5000);assert.deepEqual(events,[],'a destroyed pause never expires');
}
assert.equal(PLAY_SMALL_SCREEN_LIMIT_MS,5*60*1000);
console.log('PASS: tablets and unfolded foldables play in both orientations, phones see the notice, desktops never pause, and the pause resumes, ticks and expires once.');
