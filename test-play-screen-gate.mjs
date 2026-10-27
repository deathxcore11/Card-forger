// Play on tablets and unfolded foldables: who is admitted, who sees the bigger-screen
// notice, and how a match waits while the screen is too small.
import assert from 'node:assert/strict';
import {playScreenFits,playDeviceEligibility,playDeviceGate,playScreenPauseApplies,readPlayDeviceEligibility,readPlayScreen,playTableSupported,createPlayScreenPause,PLAY_SMALL_SCREEN_LIMIT_MS} from './desktop-play.js';

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

// Every current tablet browser plays; an old one is asked to update.
const tabletUA={
 'Samsung Internet':'Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/27.0 Chrome/125.0.0.0 Safari/537.36',
 'Edge':'Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 EdgA/141.0.0.0',
 'Firefox':'Mozilla/5.0 (Android 14; Mobile; rv:131.0) Gecko/131.0 Firefox/131.0',
 'Chrome on iPad':'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/141.0 Mobile/15E148 Safari/604.1'};
for(const [name,ua] of Object.entries(tabletUA))assert.equal(playDeviceEligibility({ua,platform:'Linux armv8l',maxTouchPoints:10,anyCoarse:true,width:820,height:1180}).eligible,true,name+' plays on a tablet');
assert.equal(playDeviceEligibility({ua:'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',platform:'MacIntel',maxTouchPoints:5,anyCoarse:true,width:834,height:1194}).eligible,true,'Safari on iPad plays');
assert.deepEqual(playDeviceEligibility({...chromeTablet,width:820,height:1180,tableSupported:false}),{eligible:false,reason:'touch-browser',entry:'touch'});
assert.equal(playDeviceGate({reason:'touch-browser'}).title,'Play needs a newer browser');
assert.equal(playTableSupported({CSS:{supports:()=>true},PointerEvent:function(){}}),true);
assert.equal(playTableSupported({CSS:{supports:q=>q!=='selector(:has(a))'},PointerEvent:function(){}}),false,'no :has() support');
assert.equal(playTableSupported({}),false,'no CSS.supports at all');

// A desktop is admitted at any window size or zoom and never pauses; touch devices pause.
const desktopView=(width,height)=>({navigator:{userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',platform:'Win32',maxTouchPoints:0},matchMedia:q=>({matches:/fine|hover/.test(q)}),innerWidth:width,innerHeight:height});
const tabletView=(width,height)=>({navigator:{userAgent:chromeTablet.ua,platform:chromeTablet.platform,maxTouchPoints:10},matchMedia:q=>({matches:/coarse/.test(q)}),CSS:{supports:()=>true},PointerEvent:function(){},innerWidth:width,innerHeight:height});
for(const [w,h] of [[850,580],[683,384],[1920,1080]])assert.equal(playScreenPauseApplies(desktopView(w,h),{}),false,`a desktop at ${w}x${h} never pauses`);
for(const [w,h] of [[820,1180],[412,915]])assert.equal(playScreenPauseApplies(tabletView(w,h),{}),true,`a touch device at ${w}x${h} can pause`);
// The Android app takes the touch rules: phones are gated both ways, a match can pause, and
// a WebView without the table's CSS is asked to update instead of getting a broken table.
const appView=(width,height,extra={})=>({Capacitor:{isNativePlatform:()=>true},navigator:{userAgent:'Mozilla/5.0 (Linux; Android 15; SM-F956U Build/AP3A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/141.0.0.0 Mobile Safari/537.36',maxTouchPoints:10},matchMedia:q=>({matches:/coarse/.test(q)}),CSS:{supports:()=>true},PointerEvent:function(){},innerWidth:width,innerHeight:height,...extra});
for(const [w,h] of [[884,1104],[1104,884],[820,1180]])assert.deepEqual(readPlayDeviceEligibility(appView(w,h),{}),{eligible:true,reason:'wide-touch-candidate',entry:'touch'},`the app plays at ${w}x${h}`);
for(const [w,h] of [[412,915],[915,412],[1280,599]])assert.deepEqual(readPlayDeviceEligibility(appView(w,h),{}),{eligible:false,reason:'touch-space',entry:'touch'},`the app sees the notice at ${w}x${h}`);
for(const [w,h] of [[1104,884],[412,915]])assert.equal(playScreenPauseApplies(appView(w,h),{}),true,`the app at ${w}x${h} can pause`);
for(const extra of [{CSS:undefined},{CSS:{supports:q=>q!=='container-type'}},{PointerEvent:undefined}]){
 const result=readPlayDeviceEligibility(appView(1104,884,extra),{});
 assert.deepEqual(result,{eligible:false,reason:'app-webview',entry:'touch'},'an old app WebView is asked to update');
 assert.deepEqual(playDeviceGate(result),{title:'Play needs a newer WebView',line:'Update Android System WebView from Google Play, then reopen the app.'});
}
// In the app the keyboard shrinks the WebView: typing keeps the size from before it opened.
{
 const view=appView(841,701),doc={documentElement:{clientWidth:841,clientHeight:701},activeElement:null},search={tagName:'INPUT',type:'search'};
 const size=(w,h,focus=null)=>{doc.documentElement.clientWidth=w;doc.documentElement.clientHeight=h;doc.activeElement=focus;return [readPlayDeviceEligibility(view,doc).eligible,readPlayScreen(view,doc).fits];};
 assert.deepEqual(size(841,701),[true,true]);
 assert.deepEqual(size(841,400,search),[true,true],'the keyboard opening over the deck search does not gate Play');
 assert.deepEqual(size(841,701,search),[true,true]);
 assert.deepEqual(size(841,400,{tagName:'BUTTON',type:'submit'}),[false,false],'a shorter window without a text field is gated');
 assert.deepEqual(size(841,701),[true,true]);
 assert.deepEqual(size(400,701,search),[false,false],'folding while typing is still gated');
 const web=tabletView(1180,820),webDoc={documentElement:{clientWidth:1180,clientHeight:820},activeElement:search};
 readPlayScreen(web,webDoc);webDoc.documentElement.clientHeight=500;assert.equal(readPlayScreen(web,webDoc).fits,false,'the website measures what the browser reports');
}

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
console.log('PASS: tablets and unfolded foldables play in both orientations in every current browser and the Android app, phones see the notice, desktops never pause, and the pause resumes, ticks and expires once.');
