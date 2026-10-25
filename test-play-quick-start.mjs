import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('./app.js',import.meta.url),'utf8').match(/A\.playStartCandidate=async\(\)=>\{[\s\S]*?\n\};/)[0];
function fixture({quick=true,matchResult=true,route='play'}={}){
 const state={playStyle:quick?'quick':'practice',selected:{name:'Your exact list'},opponent:quick?null:{name:'CPU'},match:{mode:'cpu'},profile:{signedIn:true}};
 let pairCalls=0,starts=0,pregames=0,first=null,release;
 const element=()=>({id:'',inert:false,setAttribute(){},classList:{add(){},remove(){}},append(){},remove(){}}),app=element(),doc={getElementById:id=>id==='app'?app:id==='practiceTableStyles'?element():null,createElement:element,head:element(),body:element()};
 const A={playFindOpponent:async()=>{pairCalls++;await new Promise(r=>release=r);if(matchResult){state.opponent={name:'CPU'};state.quickMatch={};}return matchResult;}};
 const deps={A,PLAY_MATCH_RELEASE_READY:true,toast(){},T:{game:()=> 'mtg'},syncDesktopPlayEntries:()=>({eligible:true}),playSetup:{snapshot:()=>state},S:{ui:{view:route}},document:doc,readPlayAccount:()=>({}),cloudInfo:()=>({user:{id:'owner'}}),accountGeneration:1,accountLocked:false,createPracticeCardPreparation:()=>({prepare(){},lookup(){}}),key:x=>x,resolveNames(){},meta(){},api(){},createPlayerMat:()=>({start:async options=>{starts++;first=options.first;}}),createPracticeCatalogReview(){},savePlayDeck(){},closePlayerMat(){},go(){},V:{deckArtwork:()=>''},mountPracticePregame:()=>{pregames++;return {};},resolvePracticePregame:choice=>{assert.equal(choice,'random');return {seed:42,first:1};}};
 new Function(...Object.keys(deps),'let playStarting=false,playerMatHost=null,practicePregame=null,playerMatRoot=null;'+source)(...Object.values(deps));
 return {A,state,release:()=>release(),counts:()=>({pairCalls,starts,pregames,first})};
}
test('one Quick Play click pairs once, skips the confirmation screen and starts with a random first seat',async()=>{const f=fixture(),pending=f.A.playStartCandidate();await f.A.playStartCandidate();assert.equal(f.counts().pairCalls,1);f.release();await pending;assert.deepEqual(f.counts(),{pairCalls:1,starts:1,pregames:0,first:1});});
test('a cancelled/stale pairing or navigation away cannot start a match',async()=>{for(const options of [{matchResult:false},{route:'home'}]){const f=fixture(options),pending=f.A.playStartCandidate();f.release();await pending;assert.equal(f.counts().starts,0);assert.equal(f.counts().pregames,0);}});
test('Practice preserves the optional starting-player setup',async()=>{const f=fixture({quick:false});await f.A.playStartCandidate();assert.deepEqual(f.counts(),{pairCalls:0,starts:0,pregames:1,first:null});});

test('tested starter launch preserves the tested pairing and waits for selection to finish',async()=>{
 const starter=readFileSync(new URL('./app.js',import.meta.url),'utf8').match(/A\.playStarterMatch=async\(\)=>\{[^\n]+/)[0];
 let done;const steps=[],A={},playSetup={snapshot:()=>({profile:{signedIn:true}}),setPlayStyle:value=>steps.push(value)};
 new Function('A','cancelPlayBuilds','playSetup','selectPracticeStarter','refreshPlayMenu','toast',starter)(A,()=>{},playSetup,async()=>{steps.push('select');await new Promise(r=>done=r);},()=>steps.push('refresh'),()=>{});
 A.playStartCandidate=async()=>steps.push('start');const pending=A.playStarterMatch();assert.deepEqual(steps,['practice','select']);done();await pending;assert.deepEqual(steps,['practice','select','refresh','start']);
});
